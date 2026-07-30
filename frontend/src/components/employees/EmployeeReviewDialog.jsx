import {
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiFileText,
} from "react-icons/fi";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
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

function DocumentPreview({ document }) {
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
      className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-white/5"
    >
      <FiFileText
        className="shrink-0"
        aria-hidden="true"
      />

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
  const isEditMode =
    mode === "edit";

  const selectedDocuments = useMemo(() => {
    return getSelectedDocuments(
      formData?.documents
    );
  }, [formData?.documents]);

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

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }

    onClose?.();
  }, [isSaving, onClose]);

  const handleConfirm = useCallback(() => {
    if (isSaving) {
      return;
    }

    onConfirm?.();
  }, [isSaving, onConfirm]);

  if (!open) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={dialogTitle}
      description={dialogDescription}
      tone="success"
      size="xl"
      height="xl"
      preventClose={isSaving}
      closeOnOverlay={!isSaving}
      closeOnEscape={!isSaving}
      scrollBody
      bodyClassName="p-5 sm:p-6"
      footer={
        <div className="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={handleClose}
          >
            Back to Edit
          </Button>

          <Button
            type="button"
            variant="success"
            loading={isSaving}
            disabled={isSaving}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="green">
            <FiCheck aria-hidden="true" />
            Ready for Confirmation
          </StatusPill>

          {isEditMode && (
            <StatusPill tone="indigo">
              Edit Mode
            </StatusPill>
          )}
        </div>

        {complianceWarning && (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <div className="flex gap-3">
              <FiAlertTriangle
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p className="font-extrabold">
                  Compliance Warning
                </p>

                <p className="mt-1 break-words leading-6">
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

        <section className="rounded-2xl border border-gray-200 p-5 dark:border-white/10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <FiFileText aria-hidden="true" />
            </div>

            <div className="min-w-0">
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

                  const hasMissingData =
                    isExpirable &&
                    !document.expirationDate;

                  return (
                    <article
                      key={document.name}
                      className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-white/10 dark:bg-slate-800"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <p className="break-words font-bold text-gray-900 dark:text-white">
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
                            hasMissingData
                              ? "red"
                              : isRisky
                                ? "amber"
                                : "green"
                          }
                        >
                          {hasMissingData
                            ? "Missing Date"
                            : documentStatus}
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
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400">
              No compliance documents selected.
            </div>
          )}
        </section>

        {saveError && (
          <ErrorState
            compact
            title={
              isEditMode
                ? "Unable to update employee"
                : "Unable to save employee"
            }
            message={saveError}
          />
        )}
      </div>
    </Dialog>
  );
}