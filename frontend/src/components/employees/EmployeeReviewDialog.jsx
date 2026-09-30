import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiFileText,
} from "react-icons/fi";
import {
  getDocumentFileName,
  getDocumentPreviewType,
  getDocumentPreviewUrl,
  getSelectedDocuments,
} from "../../utils/employees/employeeFormHelpers";
import { fetchEmployeeDocumentPreview } from "../../utils/employees/employeeDocumentPreview";
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

function DocumentPreview({ document }) {
  const localPreviewUrl = useMemo(
    () => getDocumentPreviewUrl(document),
    [document]
  );
  const localPreviewType = getDocumentPreviewType(document);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  if (localPreviewUrl) {
    return (
      <PreviewContent
        previewUrl={localPreviewUrl}
        previewType={localPreviewType}
        fileName={getDocumentFileName(document) || "Employee document"}
      />
    );
  }

  return <PersistedDocumentPreview document={document} />;
}

function PersistedDocumentPreview({ document }) {
  const [preview, setPreview] = useState({
    url: "",
    type: "",
    loading: true,
    error: "",
  });

  const fileName =
    getDocumentFileName(document) ||
    "Employee document";

  useEffect(() => {
    const controller = new AbortController();
    let previewUrl = "";

    async function loadPersistedPreview() {
      try {
        const result = await fetchEmployeeDocumentPreview(
          document?.id,
          {
            signal: controller.signal,
          }
        );

        previewUrl = result.url;

        if (controller.signal.aborted) {
          URL.revokeObjectURL(previewUrl);
          previewUrl = "";
          return;
        }

        setPreview({
          url: result.url,
          type: result.type,
          loading: false,
          error: "",
        });
      } catch (error) {
        if (
          error?.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        setPreview({
          url: "",
          type: "",
          loading: false,
          error:
            error?.message ||
            "Unable to load this document preview.",
        });
      }
    }

    void loadPersistedPreview();

    return () => {
      controller.abort();

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [document]);

  if (preview.loading) {
    return (
      <p
        className="mt-3 text-xs text-slate-500 dark:text-slate-400"
        role="status"
      >
        Loading protected document preview...
      </p>
    );
  }

  if (preview.error) {
    return (
      <p
        className="mt-3 text-xs text-rose-600 dark:text-rose-300"
        role="alert"
      >
        {preview.error}
      </p>
    );
  }

  if (!preview.url) {
    return (
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        No file preview available.
      </p>
    );
  }

  return (
    <PreviewContent
      previewUrl={preview.url}
      previewType={preview.type}
      fileName={fileName}
    />
  );
}

function PreviewContent({
  previewUrl,
  previewType,
  fileName,
}) {
  if (previewType === "image") {
    return (
      <img
        src={previewUrl}
        alt={fileName}
        className="mt-3 max-h-48 max-w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700"
      />
    );
  }

  if (previewType === "pdf") {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        className="mt-3 h-48 w-full rounded-xl border border-slate-200 dark:border-slate-700"
      />
    );
  }

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
    >
      <FiFileText
        aria-hidden="true"
        className="shrink-0"
      />
      <span className="truncate">{fileName}</span>
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
  const isDeployed = formData?.status === "Deployed";

  const [
    acknowledgedWarning,
    setAcknowledgedWarning,
  ] = useState("");

  const requiresAcknowledgement =
    Boolean(complianceWarning);

  const complianceAcknowledged =
    !requiresAcknowledgement ||
    acknowledgedWarning === complianceWarning;

  const selectedDocuments = useMemo(
    () =>
      getSelectedDocuments(
        formData?.documents
      ),
    [formData?.documents]
  );

  const dialogTitle = isEditMode
    ? "Review Employee Update"
    : "Review Employee Details";

  const dialogDescription = isEditMode
    ? "Verify the employee changes before updating the record."
    : "Verify the employee information before saving the new record.";

  const handleClose = () => {
    if (!isSaving) {
      onClose?.();
    }
  };

  const handleConfirm = () => {
    if (
      isSaving ||
      (
        requiresAcknowledgement &&
        !complianceAcknowledged
      )
    ) {
      return;
    }

    onConfirm?.();
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog
      open
      onClose={handleClose}
      title={dialogTitle}
      description={dialogDescription}
      tone="neutral"
      size="xl"
      height="xl"
      preventClose={isSaving}
      closeOnOverlay={!isSaving}
      closeOnEscape={!isSaving}
      scrollBody
      bodyClassName="p-4 sm:p-5"
      footer={
        <div className="flex w-full flex-col-reverse justify-end gap-2 sm:flex-row">
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
            variant={
              requiresAcknowledgement
                ? "warning"
                : "success"
            }
            loading={isSaving}
            disabled={
              isSaving ||
              (
                requiresAcknowledgement &&
                !complianceAcknowledged
              )
            }
            onClick={handleConfirm}
          >
            {requiresAcknowledgement
              ? isEditMode
                ? "Proceed and Update"
                : "Proceed and Save"
              : isEditMode
                ? "Confirm Update"
                : "Confirm Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  tone={
                    requiresAcknowledgement
                      ? "amber"
                      : "green"
                  }
                >
                  {requiresAcknowledgement ? (
                    <FiAlertTriangle aria-hidden="true" />
                  ) : (
                    <FiCheck aria-hidden="true" />
                  )}

                  {requiresAcknowledgement
                    ? "Compliance Review Required"
                    : "Ready for Confirmation"}
                </StatusPill>

                {isEditMode && (
                  <StatusPill tone="indigo">
                    Edit Mode
                  </StatusPill>
                )}
              </div>

              <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Confirm the employee details and submitted documents before completing this action.
              </p>
            </div>

            <div className="shrink-0 text-left lg:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Documents
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {selectedDocuments.length}/{DOCUMENT_OPTIONS.length} selected
              </p>
            </div>
          </div>
        </section>

        {complianceWarning && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <div className="flex gap-3">
              <FiAlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />

              <div className="min-w-0">
                <p className="font-bold">
                  Compliance Requirements Pending
                </p>

                <p className="mt-1 break-words leading-5">
                  {complianceWarning}
                </p>

                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 font-medium dark:border-amber-500/25 dark:bg-slate-900/50">
                  <input
                    type="checkbox"
                    checked={complianceAcknowledged}
                    disabled={isSaving}
                    onChange={(event) =>
                      setAcknowledgedWarning(
                        event.target.checked
                          ? complianceWarning
                          : ""
                      )
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />

                  <span className="leading-5">
                    I acknowledge that some compliance requirements are still pending and may be submitted later.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Employee Summary
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Final employee information that will be saved to the record.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ReviewBox
              label="Employee ID"
              value={employeeId || "-"}
            />

            <ReviewBox
              label="Full Name"
              value={
                toProperName(
                  formData?.name
                ) || "-"
              }
            />

            <ReviewBox
              label="Employment Status"
              value={formData?.status || "-"}
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
              label="Position"
              value={
                isDeployed
                  ? formData?.position || "-"
                  : "Not Assigned"
              }
            />

            <ReviewBox
              label="Start Date"
              value={
                isDeployed
                  ? formData?.contractStart || "-"
                  : "Not Applicable"
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <FiFileText aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Compliance Documents
              </h3>

              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Review selected files and expiration information.
              </p>
            </div>
          </div>

          {selectedDocuments.length ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {selectedDocuments.map((document) => {
                const isExpirable =
                  Boolean(document.expirable);

                const documentStatus = isExpirable
                  ? getDocumentStatus(
                      document.expirationDate
                    )
                  : "Permanent";

                const hasMissingDate =
                  isExpirable &&
                  !document.expirationDate;

                const isRisky = [
                  "Expired",
                  "Expiring Soon",
                ].includes(documentStatus);

                return (
                  <article
                    key={document.name}
                    className="px-4 py-3"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900 dark:text-slate-100">
                          {document.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {isExpirable
                            ? `Expires: ${document.expirationDate || "-"}`
                            : "Permanent document"}
                        </p>
                      </div>

                      <StatusPill
                        tone={
                          hasMissingDate
                            ? "red"
                            : isRisky
                              ? "amber"
                              : "green"
                        }
                      >
                        {hasMissingDate
                          ? "Missing Date"
                          : documentStatus}
                      </StatusPill>
                    </div>

                    <DocumentPreview
                      document={document}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              No compliance requirements have been submitted yet.
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