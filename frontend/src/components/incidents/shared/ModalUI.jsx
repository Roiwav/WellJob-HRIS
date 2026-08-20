import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiXCircle,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";

import {
  formatDateTime,
} from "../../../utils/incidents/incidentHelpers";

import {
  fetchIncidentEvidencePreview,
  formatFileSize,
} from "../../../utils/incidents/evidenceFiles";

const DIALOG_TONE_BY_COLOR = {
  red: "danger",
  green: "success",
  indigo: "default",
  amber: "warning",
};

const DIALOG_SIZE_MAP = {
  sm: "md",
  md: "lg",
  lg: "xl",
  xl: "xl",
};

const EVIDENCE_OBJECT_URL_LIFETIME_MS =
  5 * 60 * 1000;

function getDisplayValue(
  value,
  fallback = "-"
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const normalizedValue =
    String(value).trim();

  return (
    normalizedValue ||
    fallback
  );
}

function getTimelineEventAction(
  event
) {
  return String(
    event?.actionType ||
      event?.action_type ||
      event?.status ||
      ""
  )
    .trim()
    .toUpperCase();
}

function getTimelineEventDate(
  event
) {
  return (
    event?.createdAt ||
    event?.created_at ||
    event?.date ||
    event?.reportedAt ||
    null
  );
}

function getTimelineEventCreator(
  event
) {
  return (
    event?.createdByName ||
    event?.created_by_name ||
    event?.createdBy ||
    event?.created_by ||
    "System"
  );
}

function getTimelineEventDescription(
  event
) {
  if (event?.description) {
    return event.description;
  }

  const action =
    getTimelineEventAction(
      event
    );

  const createdBy =
    getTimelineEventCreator(
      event
    );

  if (
    action ===
    "CREATE_INCIDENT"
  ) {
    return `Reported by ${createdBy}.`;
  }

  if (
    action ===
    "START_INVESTIGATION"
  ) {
    return `${createdBy} started the investigation.`;
  }

  if (
    action ===
      "SUBMIT_RESOLUTION" ||
    action ===
      "SUBMIT_INVESTIGATION"
  ) {
    return `${createdBy} submitted proof for Super Admin review.`;
  }

  if (
    action ===
    "RETURN_INCIDENT"
  ) {
    return `${createdBy} returned the case for correction.`;
  }

  if (
    action ===
    "CLOSE_INCIDENT"
  ) {
    return `${createdBy} approved and closed the case.`;
  }

  return `Updated by ${createdBy}.`;
}

function getTimelineEventTitle(
  event
) {
  if (event?.title) {
    return event.title;
  }

  const action =
    getTimelineEventAction(
      event
    );

  if (
    action ===
    "CREATE_INCIDENT"
  ) {
    return "Reported";
  }

  if (
    action ===
    "START_INVESTIGATION"
  ) {
    return "Investigation Started";
  }

  if (
    action ===
      "SUBMIT_RESOLUTION" ||
    action ===
      "SUBMIT_INVESTIGATION"
  ) {
    return "Proof Submitted";
  }

  if (
    action ===
    "RETURN_INCIDENT"
  ) {
    return "Returned by Super Admin";
  }

  if (
    action ===
    "CLOSE_INCIDENT"
  ) {
    return "Approved and Closed";
  }

  return "Timeline Event";
}

function getTimelineEventState(
  event
) {
  const action =
    getTimelineEventAction(
      event
    );

  if (
    action ===
    "RETURN_INCIDENT"
  ) {
    return "rejected";
  }

  if (
    action ===
    "CLOSE_INCIDENT"
  ) {
    return "closed";
  }

  const title =
    String(
      event?.title || ""
    ).toLowerCase();

  if (
    title.includes(
      "return"
    ) ||
    title.includes(
      "reject"
    )
  ) {
    return "rejected";
  }

  if (
    title.includes(
      "closed"
    ) ||
    title.includes(
      "approved"
    )
  ) {
    return "closed";
  }

  return "done";
}

function hasValidNumericId(
  value
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      normalized
    )
  ) {
    return false;
  }

  const numericValue =
    Number(normalized);

  return (
    Number.isSafeInteger(
      numericValue
    ) &&
    numericValue > 0
  );
}

export function BaseModal({
  children,
  onClose,
  title,
  subtitle,
  color = "red",
  size = "lg",
  preventClose = false,
  initialFocusRef,
}) {
  const dialogTone =
    DIALOG_TONE_BY_COLOR[
      color
    ] || "default";

  const dialogSize =
    DIALOG_SIZE_MAP[
      size
    ] || "xl";

  return (
    <Dialog
      open
      onClose={
        onClose
      }
      title={
        title
      }
      description={
        subtitle
      }
      tone={
        dialogTone
      }
      size={
        dialogSize
      }
      preventClose={
        preventClose
      }
      closeOnOverlay={
        !preventClose
      }
      closeOnEscape={
        !preventClose
      }
      initialFocusRef={
        initialFocusRef
      }
    >
      {children}

      <ModalStyle />
    </Dialog>
  );
}

export function NoticeModal({
  type = "success",
  title,
  message,
  onClose,
  preventClose = false,
}) {
  const isSuccess =
    type ===
    "success";

  return (
    <Dialog
      open
      onClose={
        onClose
      }
      title={
        title
      }
      description={
        message
      }
      tone={
        isSuccess
          ? "success"
          : "danger"
      }
      size="md"
      preventClose={
        preventClose
      }
      closeOnOverlay={
        !preventClose
      }
      closeOnEscape={
        !preventClose
      }
      footer={
        <Button
          type="button"
          variant={
            isSuccess
              ? "success"
              : "danger"
          }
          disabled={
            preventClose
          }
          onClick={
            onClose
          }
        >
          Close
        </Button>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            isSuccess
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {isSuccess ? (
            <FiCheckCircle
              size={24}
              aria-hidden="true"
            />
          ) : (
            <FiAlertCircle
              size={24}
              aria-hidden="true"
            />
          )}
        </div>

        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {message}
        </p>
      </div>
    </Dialog>
  );
}

export function AlertBox({
  type = "warning",
  title,
  message,
}) {
  const style =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div
      role={
        type === "error"
          ? "alert"
          : "status"
      }
      className={`flex items-start gap-4 rounded-2xl border p-5 ${style}`}
    >
      <div className="rounded-full bg-white/50 p-3">
        <FiAlertCircle
          size={22}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <h3 className="text-lg font-extrabold">
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6">
          {message}
        </p>
      </div>
    </div>
  );
}

export function CaseTimeline({
  incident,
}) {
  const status =
    String(
      incident?.status ||
        "Open"
    ).trim();

  const timelineEvents =
    Array.isArray(
      incident?.timelineEvents
    )
      ? incident.timelineEvents
      : Array.isArray(
            incident?.timeline_events
          )
        ? incident.timeline_events
        : Array.isArray(
              incident?.timeline
            )
          ? incident.timeline
          : [];

  const databaseSteps =
    timelineEvents
      .filter(
        (
          event
        ) =>
          event &&
          (
            event.title ||
            getTimelineEventAction(
              event
            )
          )
      )
      .map(
        (
          event,
          index
        ) => ({
          id:
            event.id ||
            `${
              getTimelineEventAction(
                event
              ) ||
              "timeline"
            }-${
              getTimelineEventDate(
                event
              ) ||
              index
            }`,

          title:
            getTimelineEventTitle(
              event
            ),

          description:
            getTimelineEventDescription(
              event
            ),

          createdAt:
            getTimelineEventDate(
              event
            ),

          state:
            getTimelineEventState(
              event
            ),
        })
      );

  const investigation =
    incident?.investigation ||
    null;

  const resolution =
    incident?.resolution ||
    null;

  const review =
    incident?.review ||
    null;

  const reportedBy =
    incident?.reportedByName ||
    incident?.reported_by_name ||
    incident?.reportedBy ||
    incident?.reported_by ||
    "Unknown Reporter";

  const reportedAt =
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.date ||
    incident?.createdAt ||
    incident?.created_at ||
    null;

  const investigationStartedAt =
    investigation?.startedAt ||
    incident?.investigationStartedAt ||
    incident?.investigation_started_at ||
    null;

  const investigationStartedBy =
    investigation?.startedByName ||
    incident?.investigationStartedByName ||
    incident?.investigation_started_by_name ||
    "-";

  const resolutionSubmittedAt =
    resolution?.submittedAt ||
    incident?.resolutionSubmittedAt ||
    incident?.resolution_submitted_at ||
    null;

  const resolutionSubmittedBy =
    resolution?.submittedByName ||
    incident?.resolutionSubmittedByName ||
    incident?.resolution_submitted_by_name ||
    "-";

  const reviewedAt =
    review?.reviewedAt ||
    incident?.reviewedAt ||
    incident?.reviewed_at ||
    null;

  const reviewedBy =
    review?.reviewedByName ||
    incident?.reviewedByName ||
    incident?.reviewed_by_name ||
    "-";

  const reviewDecision =
    review?.decision ||
    incident?.reviewDecision ||
    incident?.review_decision ||
    (
      status ===
      "Closed"
        ? "Approved"
        : ""
    );

  const normalizedDecision =
    String(
      reviewDecision
    )
      .trim()
      .toLowerCase();

  const isReturned =
    normalizedDecision ===
      "returned" ||
    normalizedDecision ===
      "rejected";

  const fallbackSteps = [
    {
      id:
        "reported",

      title:
        "Reported",

      description:
        `Reported by ${reportedBy}`,

      createdAt:
        reportedAt,

      state:
        "done",
    },
    {
      id:
        "investigation",

      title:
        "Investigation Started",

      description:
        investigationStartedAt
          ? `Started by ${investigationStartedBy}`
          : "Waiting for HR action",

      createdAt:
        investigationStartedAt,

      state:
        investigationStartedAt
          ? "done"
          : "pending",
    },
    {
      id:
        "proof",

      title:
        "Proof Submitted",

      description:
        resolutionSubmittedAt
          ? `Submitted by ${resolutionSubmittedBy}`
          : "Waiting for resolution proof",

      createdAt:
        resolutionSubmittedAt,

      state:
        resolutionSubmittedAt
          ? "done"
          : "pending",
    },
    {
      id:
        "review",

      title:
        isReturned
          ? "Returned by Super Admin"
          : "Approved and Closed",

      description:
        reviewedAt
          ? `${
              reviewDecision ||
              "Reviewed"
            } by ${reviewedBy}`
          : "Waiting for Super Admin review",

      createdAt:
        reviewedAt,

      state:
        isReturned
          ? "rejected"
          : status ===
              "Closed"
            ? "closed"
            : "pending",
    },
  ];

  const steps =
    databaseSteps.length >
    0
      ? databaseSteps
      : fallbackSteps;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <p className="mb-5 text-xs font-bold uppercase tracking-wide text-gray-500">
        Case Timeline
      </p>

      <div className="space-y-5">
        {steps.map(
          (
            item,
            index
          ) => {
            const isCompleted =
              item.state ===
                "done" ||
              item.state ===
                "closed";

            const iconStyle =
              item.state ===
              "rejected"
                ? "border-red-300 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                : isCompleted
                  ? "border-green-300 bg-green-100 text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-300"
                  : "border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";

            return (
              <div
                key={
                  item.id
                }
                className="relative flex gap-3"
              >
                {index !==
                  steps.length -
                    1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[15px] top-8 h-full w-px bg-gray-200 dark:bg-white/10"
                  />
                )}

                <div
                  className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${iconStyle}`}
                >
                  {item.state ===
                  "rejected" ? (
                    <FiXCircle
                      aria-hidden="true"
                    />
                  ) : isCompleted ? (
                    <FiCheckCircle
                      aria-hidden="true"
                    />
                  ) : (
                    <FiClock
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {
                      item.title
                    }
                  </p>

                  <p className="mt-0.5 break-words text-xs text-gray-500">
                    {item.description ||
                      "-"}
                  </p>

                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <FiClock
                      aria-hidden="true"
                    />

                    {formatDateTime(
                      item.createdAt
                    )}
                  </p>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export function ProofReview({
  resolution,
}) {
  if (!resolution) {
    return (
      <InfoCard title="Resolution Proof Review">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No resolution proof was
          submitted.
        </p>
      </InfoCard>
    );
  }

  const submittedBy =
    resolution.submittedByName ||
    resolution.submitted_by_name ||
    "-";

  const submittedAt =
    resolution.submittedAt ||
    resolution.submitted_at ||
    null;

  const actionTaken =
    resolution.actionTaken ||
    resolution.action_taken ||
    "-";

  const remarks =
    resolution.remarks ||
    resolution.resolutionNotes ||
    resolution.resolution_notes ||
    "-";

  const proofFiles =
    Array.isArray(
      resolution.proofFiles
    )
      ? resolution.proofFiles
      : Array.isArray(
            resolution.proof_files
          )
        ? resolution.proof_files
        : [];

  return (
    <InfoCard title="Resolution Proof Review">
      <Detail
        label="Submitted By"
        value={
          submittedBy
        }
      />

      <Detail
        label="Submitted Date"
        value={
          formatDateTime(
            submittedAt
          )
        }
      />

      <TextDetail
        label="Action Taken"
        value={
          actionTaken
        }
      />

      <TextDetail
        label="Remarks"
        value={
          remarks
        }
      />

      <ProofList
        files={
          proofFiles
        }
      />
    </InfoCard>
  );
}

export function TextDetail({
  label,
  value,
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-line break-words text-sm leading-6">
        {getDisplayValue(
          value
        )}
      </p>
    </div>
  );
}

function ProofFileCard({
  file,
  index,
  onRemove,
}) {
  const [
    isOpening,
    setIsOpening,
  ] =
    useState(false);

  const [
    openError,
    setOpenError,
  ] =
    useState("");

  const abortControllerRef =
    useRef(null);

  const fileId =
    file?.id ||
    file?.name ||
    `proof-${index}`;

  const fileName =
    file?.name ||
    file?.fileName ||
    "Uploaded file";

  const localUrl =
    file?.isLocal
      ? file?.localUrl ||
        null
      : null;

  const incidentId =
    file?.incidentId ??
    file?.incident_id ??
    null;

  const evidenceId =
    file?.evidenceId ??
    file?.evidence_id ??
    file?.id ??
    null;

  const hasProtectedReference =
    !file?.isLocal &&
    hasValidNumericId(
      incidentId
    ) &&
    hasValidNumericId(
      evidenceId
    );

  useEffect(
    () => {
      return () => {
        if (
          abortControllerRef.current
        ) {
          abortControllerRef.current.abort();

          abortControllerRef.current =
            null;
        }
      };
    },
    []
  );

  const handleOpenProtectedEvidence =
    useCallback(
      async () => {
        if (
          isOpening ||
          file?.isLocal
        ) {
          return;
        }

        setOpenError(
          ""
        );

        if (
          !hasProtectedReference
        ) {
          setOpenError(
            "The saved evidence reference is unavailable."
          );

          return;
        }

        /*
         * Open the target window synchronously
         * from the user click.
         *
         * This prevents browsers from treating
         * the eventual Blob preview as an
         * unsolicited popup after the async
         * authenticated fetch completes.
         */
        const previewWindow =
          window.open(
            "about:blank",
            "_blank"
          );

        if (
          !previewWindow
        ) {
          setOpenError(
            "The evidence preview was blocked by the browser. Allow pop-ups for this site and try again."
          );

          return;
        }

        try {
          previewWindow.opener =
            null;
        } catch {
          // Browser may restrict opener assignment.
        }

        if (
          abortControllerRef.current
        ) {
          abortControllerRef.current.abort();
        }

        const controller =
          new AbortController();

        abortControllerRef.current =
          controller;

        setIsOpening(
          true
        );

        try {
          const preview =
            await fetchIncidentEvidencePreview({
              incidentId,
              evidenceId,
              signal:
                controller.signal,
            });

          if (
            controller.signal
              .aborted
          ) {
            if (
              preview?.url
            ) {
              URL.revokeObjectURL(
                preview.url
              );
            }

            if (
              !previewWindow.closed
            ) {
              previewWindow.close();
            }

            return;
          }

          if (
            previewWindow.closed
          ) {
            URL.revokeObjectURL(
              preview.url
            );

            return;
          }

          /*
           * The protected binary has now been
           * retrieved through authenticatedFetch.
           *
           * The new tab receives only the temporary
           * Blob URL — never the legacy public
           * /documents URL.
           */
          previewWindow.location.replace(
            preview.url
          );

          /*
           * Blob URLs consume browser memory.
           *
           * Keep the URL alive long enough for the
           * new tab/browser PDF viewer to consume
           * it, then release the parent page's URL
           * reference.
           */
          window.setTimeout(
            () => {
              URL.revokeObjectURL(
                preview.url
              );
            },
            EVIDENCE_OBJECT_URL_LIFETIME_MS
          );
        } catch (error) {
          if (
            !previewWindow.closed
          ) {
            previewWindow.close();
          }

          if (
            error?.name ===
            "AbortError"
          ) {
            return;
          }

          setOpenError(
            error?.message ||
              "Unable to open the incident evidence file."
          );
        } finally {
          if (
            abortControllerRef.current ===
            controller
          ) {
            abortControllerRef.current =
              null;
          }

          setIsOpening(
            false
          );
        }
      },
      [
        evidenceId,
        file?.isLocal,
        hasProtectedReference,
        incidentId,
        isOpening,
      ]
    );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
          <FiFileText
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-bold text-gray-900 dark:text-white">
            {fileName}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {file?.type ||
              "Uploaded file"}
          </p>

          <p className="text-xs text-gray-500">
            {formatFileSize(
              file?.size
            )}{" "}
            •{" "}
            {file?.status ||
              "Uploaded"}
          </p>

          <p className="text-xs text-gray-400">
            {file?.uploadedAt
              ? formatDateTime(
                  file.uploadedAt
                )
              : "-"}
          </p>

          {file?.error && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
              {file.error}
            </p>
          )}

          {openError && (
            <p
              role="alert"
              className="mt-2 text-xs font-semibold leading-5 text-red-600 dark:text-red-300"
            >
              {openError}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {file?.isLocal &&
              localUrl && (
                <a
                  href={
                    localUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                >
                  Open local preview
                </a>
              )}

            {!file?.isLocal && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={
                  isOpening
                }
                disabled={
                  isOpening ||
                  !hasProtectedReference
                }
                onClick={
                  handleOpenProtectedEvidence
                }
              >
                {isOpening
                  ? "Opening..."
                  : "Open"}
              </Button>
            )}

            {onRemove && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() =>
                  onRemove(
                    fileId
                  )
                }
              >
                Remove
              </Button>
            )}
          </div>

          {!file?.isLocal &&
            !hasProtectedReference &&
            !openError && (
              <p className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                This saved evidence record
                does not contain a valid
                protected file reference.
              </p>
            )}

          {file?.isLocal && (
            <p className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
              Local preview only.
              Cross-device access begins
              after the server stores and
              returns this file.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProofList({
  files = [],
  onRemove,
}) {
  const safeFiles =
    Array.isArray(
      files
    )
      ? files
      : [];

  if (
    safeFiles.length ===
    0
  ) {
    return (
      <p className="mt-3 text-sm text-gray-500">
        No proof uploaded.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {safeFiles.map(
        (
          file,
          index
        ) => (
          <ProofFileCard
            key={
              file?.id ||
              file?.name ||
              `proof-${index}`
            }
            file={
              file
            }
            index={
              index
            }
            onRemove={
              onRemove
            }
          />
        )
      )}
    </div>
  );
}

export function InfoCard({
  title,
  children,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>

      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

export function Detail({
  label,
  value,
}) {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3">
      <span className="font-semibold text-gray-500">
        {label}
      </span>

      <span className="min-w-0 break-words font-medium text-gray-900 dark:text-white">
        {getDisplayValue(
          value
        )}
      </span>
    </div>
  );
}

export function Field({
  label,
  required = false,
  children,
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}

        {required && (
          <>
            {" "}
            <span
              className="text-red-500"
              aria-hidden="true"
            >
              *
            </span>

            <span className="sr-only">
              Required
            </span>
          </>
        )}
      </div>

      {children}
    </div>
  );
}

export function ModalFooter({
  children,
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:flex-wrap sm:justify-end dark:border-white/10">
      {children}
    </div>
  );
}

function ModalStyle() {
  return (
    <style>{`
      .input-field {
        width: 100%;
        border-radius: 0.875rem;
        border: 1px solid rgb(209 213 219);
        background: white;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        line-height: 1.5rem;
        color: rgb(17 24 39);
        outline: none;
        transition:
          border-color 150ms ease,
          box-shadow 150ms ease,
          background-color 150ms ease;
      }

      .input-field::placeholder {
        color: rgb(156 163 175);
      }

      .input-field:hover:not(:disabled) {
        border-color: rgb(156 163 175);
      }

      .input-field:focus {
        border-color: rgb(99 102 241);
        box-shadow: 0 0 0 3px rgb(224 231 255);
      }

      .input-field:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }

      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }

      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }

      .dark .input-field:hover:not(:disabled) {
        border-color: rgba(255, 255, 255, 0.2);
      }

      .dark .input-field:focus {
        border-color: rgb(129 140 248);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
      }
    `}</style>
  );
}