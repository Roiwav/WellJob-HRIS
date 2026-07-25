import {
  useEffect,
  useMemo,
} from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiFileText,
  FiX,
} from "react-icons/fi";

import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import ErrorState from "../ui/ErrorState";

import {
  DOCUMENT_OPTIONS,
  getDocumentStatus,
  toProperName,
} from "./employeeConstants";

import {
  ReviewBox,
  StatusPill,
} from "./EmployeeComponents";

import {
  getDocumentFileName,
  getDocumentPreviewType,
  getDocumentPreviewUrl,
  getSelectedDocuments,
} from "../../utils/employees/employeeFormHelpers";

function DocumentPreview({
  document,
}) {
  const previewUrl = useMemo(
    () => getDocumentPreviewUrl(document),
    [document]
  );

  const previewType =
    getDocumentPreviewType(document);

  const fileName =
    getDocumentFileName(document) ||
    "Employee document";

  useEffect(() => {
    return () => {
      if (
        previewUrl &&
        previewUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return (
      <p className="mt-3 text-xs text-gray-400">
        No file preview available.
      </p>
    );
  }

  if (previewType === "image") {
    return (
      <img
        src={previewUrl}
        alt={fileName}
        className="mt-3 max-h-52 max-w-full rounded-xl border border-gray-200 object-contain dark:border-white/10"
      />
    );
  }

  if (previewType === "pdf") {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        className="mt-3 h-52 w-full rounded-xl border border-gray-200 dark:border-white/10"
      />
    );
  }

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 dark:border-white/10 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-white/5"
    >
      <FiFileText className="shrink-0" />

      <span className="truncate">
        {fileName}
      </span>
    </a>
  );
}

export default function EmployeeReviewDialog({
  open = false,
  mode = "add",
  employeeId = "",
  formData,
  complianceWarning = "",
  saveError = "",
  isSaving = false,
  onClose,
  onConfirm,
}) {
  const isEditMode = mode === "edit";

  const selectedDocuments = useMemo(() => {
    return getSelectedDocuments(
      formData?.documents
    );
  }, [formData?.documents]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !isSaving
      ) {
        onClose?.();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [isSaving, onClose, open]);

  if (!open) {
    return null;
  }

  const isDeployed =
    formData?.status === "Deployed";

  const dialogTitle = isEditMode
    ? "Review Employee Update"
    : "Review Employee Details";

  const dialogDescription = isEditMode
    ? "Verify all changes before updating the employee record."
    : "Verify all employee information before saving the new record.";

  const confirmLabel = isEditMode
    ? "Confirm Update"
    : "Confirm Save";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSaving
        ) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-review-dialog-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-white p-5 shadow-2xl sm:p-6 dark:bg-slate-900"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <StatusPill tone="green">
              <FiCheck />
              Ready for Confirmation
            </StatusPill>

            <h2
              id="employee-review-dialog-title"
              className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white"
            >
              {dialogTitle}
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {dialogDescription}
            </p>
          </div>

          <IconButton
            label="Close employee review"
            title="Back to edit"
            variant="ghost"
            disabled={isSaving}
            onClick={onClose}
          >
            <FiX size={22} />
          </IconButton>
        </div>

        {complianceWarning && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex gap-3">
              <FiAlertTriangle className="mt-0.5 shrink-0" />

              <div>
                <p className="font-extrabold">
                  Compliance Warning
                </p>

                <p className="mt-1 leading-6">
                  {complianceWarning}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ReviewBox
            label="Employee ID"
            value={employeeId || "-"}
          />

          <ReviewBox
            label="Full Name"
            value={
              toProperName(formData?.name) ||
              "-"
            }
          />

          <ReviewBox
            label="Employment Status"
            value={
              formData?.status || "-"
            }
          />

          <ReviewBox
            label="Company"
            value={
              isDeployed
                ? formData?.company || "-"
                : "Not Assigned"
            }
          />

          <ReviewBox
            label="Start Date"
            value={
              isDeployed
                ? formData?.contractStart ||
                  "-"
                : "Not Applicable"
            }
          />

          <ReviewBox
            label="Selected Documents"
            value={`${selectedDocuments.length}/${DOCUMENT_OPTIONS.length}`}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-gray-200 p-5 dark:border-white/10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <FiFileText />
            </div>

            <div>
              <h3 className="font-extrabold text-gray-900 dark:text-white">
                Compliance Documents
              </h3>

              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                Review selected files and expiration information.
              </p>
            </div>
          </div>

          {selectedDocuments.length > 0 ? (
            <div className="space-y-3">
              {selectedDocuments.map(
                (document) => {
                  const masterDocument =
                    DOCUMENT_OPTIONS.find(
                      (item) =>
                        item.name ===
                        document.name
                    );

                  const isExpirable =
                    Boolean(
                      masterDocument?.expirable
                    );

                  const documentStatus =
                    isExpirable
                      ? getDocumentStatus(
                          document.expirationDate
                        )
                      : "Permanent";

                  const isRisky =
                    documentStatus ===
                      "Expired" ||
                    documentStatus ===
                      "Expiring Soon";

                  return (
                    <article
                      key={document.name}
                      className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-800"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {document.name}
                          </p>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {isExpirable
                              ? `Expires: ${
                                  document.expirationDate ||
                                  "-"
                                }`
                              : "Permanent document"}
                          </p>
                        </div>

                        <StatusPill
                          tone={
                            isRisky
                              ? "amber"
                              : "green"
                          }
                        >
                          {documentStatus}
                        </StatusPill>
                      </div>

                      <DocumentPreview
                        document={document}
                      />
                    </article>
                  );
                }
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No compliance documents selected.
            </p>
          )}
        </section>

        {saveError && (
          <div className="mt-5">
            <ErrorState
              compact
              title={
                isEditMode
                  ? "Unable to update employee"
                  : "Unable to save employee"
              }
              message={saveError}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Button
            variant="secondary"
            disabled={isSaving}
            onClick={onClose}
          >
            Back to Edit
          </Button>

          <Button
            variant="success"
            loading={isSaving}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}