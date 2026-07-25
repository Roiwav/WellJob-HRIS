import {
  FiCheck,
  FiChevronDown,
  FiFileText,
  FiUploadCloud,
} from "react-icons/fi";

import {
  DOCUMENT_OPTIONS,
  getDocumentStatus,
} from "./employeeConstants";

import {
  ErrorText,
  StatusPill,
} from "./EmployeeComponents";

const DATE_INPUT_CLASS_NAME = [
  "min-h-10 w-full rounded-xl border bg-white px-3 py-2",
  "text-sm font-semibold text-gray-900 outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
].join(" ");

function hasDocumentFile(document) {
  return Boolean(
    document?.file ||
      document?.filePath ||
      document?.file_path ||
      document?.url
  );
}

function getDocumentFileName(document) {
  if (document?.file instanceof File) {
    return document.file.name;
  }

  const path =
    document?.filePath ||
    document?.file_path ||
    document?.url ||
    "";

  if (!path) {
    return "";
  }

  return (
    String(path)
      .split("/")
      .pop()
      ?.split("?")[0] ||
    "Existing document"
  );
}

function isDocumentComplete(document) {
  if (!document?.checked) {
    return false;
  }

  if (!hasDocumentFile(document)) {
    return false;
  }

  if (
    document.expirable &&
    !document.expirationDate
  ) {
    return false;
  }

  return true;
}

export default function EmployeeDocumentsSection({
  documents = [],
  errors = {},
  expanded = false,
  disabled = false,
  dragTargetDocument = "",
  onToggle,
  onDocumentCheck,
  onExpirationChange,
  onFileSelect,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onFileDrop,
}) {
  const safeDocuments = Array.isArray(documents)
    ? documents
    : [];

  const completedCount = safeDocuments.filter(
    isDocumentComplete
  ).length;

  const totalDocuments =
    DOCUMENT_OPTIONS.length;

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={expanded}
        className={[
          "flex w-full items-center justify-between gap-4 p-5 text-left",
          "transition hover:bg-gray-50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          "focus-visible:ring-indigo-500",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:hover:bg-white/5",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <FiFileText aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h3 className="font-extrabold text-gray-900 dark:text-white">
              Compliance Documents
            </h3>

            <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
              Select requirements and attach proof files for compliance
              monitoring.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusPill
            tone={
              completedCount === totalDocuments
                ? "green"
                : "slate"
            }
          >
            {completedCount}/{totalDocuments}
          </StatusPill>

          <FiChevronDown
            aria-hidden="true"
            className={[
              "text-gray-400 transition-transform duration-200",
              expanded ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      </button>

      {errors?.general && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {errors.general}
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-200 p-5 dark:border-white/10">
          <div className="grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {safeDocuments.map((document) => {
              const documentStatus = document.expirable
                ? getDocumentStatus(
                    document.expirationDate
                  )
                : "Permanent";

              const hasFile =
                hasDocumentFile(document);

              const fileName =
                getDocumentFileName(document);

              const isRisky =
                document.checked &&
                (documentStatus === "Expired" ||
                  documentStatus ===
                    "Expiring Soon");

              const isDragging =
                dragTargetDocument ===
                document.name;

              return (
                <article
                  key={document.name}
                  className={[
                    "rounded-2xl border p-4 transition",
                    document.checked
                      ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                      : "border-gray-200 bg-white hover:border-indigo-200 dark:border-white/10 dark:bg-slate-900/50 dark:hover:border-indigo-500/30",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={`employee-document-${document.name}`}
                      type="checkbox"
                      checked={Boolean(
                        document.checked
                      )}
                      disabled={disabled}
                      onChange={() =>
                        onDocumentCheck?.(
                          document.name
                        )
                      }
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                    />

                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`employee-document-${document.name}`}
                        className="flex cursor-pointer items-start justify-between gap-3"
                      >
                        <span className="font-bold text-gray-900 dark:text-white">
                          {document.name}
                        </span>

                        <StatusPill
                          tone={
                            document.expirable
                              ? "amber"
                              : "green"
                          }
                        >
                          {document.expirable
                            ? "Expirable"
                            : "Permanent"}
                        </StatusPill>
                      </label>

                      {document.checked && (
                        <div className="mt-4 space-y-4">
                          {document.expirable && (
                            <div>
                              <label
                                htmlFor={`employee-document-expiration-${document.name}`}
                                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                              >
                                Expiration Date
                              </label>

                              <input
                                id={`employee-document-expiration-${document.name}`}
                                type="date"
                                value={
                                  document.expirationDate ||
                                  ""
                                }
                                disabled={disabled}
                                onChange={(event) =>
                                  onExpirationChange?.(
                                    document.name,
                                    event.target.value
                                  )
                                }
                                className={[
                                  DATE_INPUT_CLASS_NAME,
                                  errors?.[
                                    document.name
                                  ]
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />

                              <ErrorText>
                                {
                                  errors?.[
                                    document.name
                                  ]
                                }
                              </ErrorText>

                              {document.expirationDate && (
                                <p
                                  className={[
                                    "mt-1.5 text-xs font-semibold",
                                    isRisky
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  ].join(" ")}
                                >
                                  Status:{" "}
                                  {documentStatus}
                                </p>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Proof Upload
                            </p>

                            <label
                              onDragEnter={(event) =>
                                onDragEnter?.(
                                  event,
                                  document.name
                                )
                              }
                              onDragOver={(event) =>
                                onDragOver?.(
                                  event,
                                  document.name
                                )
                              }
                              onDragLeave={
                                onDragLeave
                              }
                              onDrop={(event) =>
                                onFileDrop?.(
                                  event,
                                  document.name
                                )
                              }
                              className={[
                                "flex cursor-pointer flex-col items-center justify-center",
                                "rounded-2xl border border-dashed px-4 py-5 text-center",
                                "transition",
                                disabled
                                  ? "cursor-not-allowed opacity-60"
                                  : "",
                                isDragging
                                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300"
                                  : "border-gray-300 bg-white text-gray-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-indigo-500/10",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <FiUploadCloud
                                aria-hidden="true"
                                className="mb-2 text-2xl"
                              />

                              <span className="text-sm font-extrabold">
                                {hasFile
                                  ? "Drop or click to replace the file"
                                  : "Drag and drop proof file here"}
                              </span>

                              <span className="mt-1 text-xs font-medium text-gray-400">
                                or click to browse
                              </span>

                              <input
                                type="file"
                                accept="image/png,image/jpeg,application/pdf"
                                disabled={disabled}
                                className="hidden"
                                onChange={(event) => {
                                  const selectedFile =
                                    event.target
                                      .files?.[0];

                                  onFileSelect?.(
                                    document.name,
                                    selectedFile
                                  );

                                  event.target.value =
                                    "";
                                }}
                              />
                            </label>

                            <p className="mt-1.5 text-xs text-gray-400">
                              PNG, JPEG, or PDF only.
                              Maximum file size: 5MB.
                            </p>

                            <ErrorText>
                              {
                                errors?.[
                                  `${document.name}_file`
                                ]
                              }
                            </ErrorText>

                            {hasFile && (
                              <div className="mt-2 flex min-w-0 items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <FiCheck className="mt-0.5 shrink-0" />

                                <span className="min-w-0 break-all leading-5">
                                  {fileName ||
                                    "Existing document attached"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}