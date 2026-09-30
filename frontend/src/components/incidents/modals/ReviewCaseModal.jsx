import {
  useCallback,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiShield,
  FiXCircle,
} from "react-icons/fi";

import Button from "../../ui/Button";

import {
  SmartAlertCard,
} from "../badges/IncidentBadges";

import {
  formatDateTime,
} from "../../../utils/incidents/incidentHelpers";

import {
  BaseModal,
  CaseTimeline,
  Detail,
  Field,
  InfoCard,
  ModalFooter,
  ProofReview,
} from "../shared/ModalUI";

const SEVERITY_STYLE = {
  Minor:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Major:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  Critical:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
};

const STATUS_STYLE = {
  Open:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  Investigating:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  "For Review":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  Closed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function ReviewBadge({
  label,
  value,
  styles,
  icon,
}) {
  const displayValue =
    String(
      value || "-"
    ).trim() || "-";

  const currentStyle =
    styles?.[
      displayValue
    ] ||
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>

      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${currentStyle}`}
      >
        {displayValue}
      </span>
    </div>
  );
}

export default function ReviewCaseModal({
  incident,
  onClose,
  onApprove,
  onReject,
  showNotice,
}) {
  const [
    returnComment,
    setReturnComment,
  ] = useState("");

  const [
    processingAction,
    setProcessingAction,
  ] = useState(null);

  const isProcessing =
    processingAction !==
    null;

  const isApproving =
    processingAction ===
    "approve";

  const isReturning =
    processingAction ===
    "return";

  const handleClose =
    useCallback(() => {
      if (
        isProcessing
      ) {
        return;
      }

      onClose?.();
    }, [
      isProcessing,
      onClose,
    ]);

  const handleReturnCommentChange =
    useCallback(
      (event) => {
        setReturnComment(
          event.target.value
        );
      },
      []
    );

  const handleReturn =
    useCallback(
      async () => {
        if (
          isProcessing ||
          !incident
        ) {
          return;
        }

        const cleanComment =
          returnComment.trim();

        if (
          !cleanComment
        ) {
          showNotice?.(
            "error",
            "Return Comment Required",
            "Please enter a return comment before sending this case back for correction."
          );
          return;
        }

        try {
          setProcessingAction(
            "return"
          );

          const success =
            await onReject?.(
              incident,
              cleanComment
            );

          if (
            success ===
            false
          ) {
            setProcessingAction(
              null
            );
          }
        } catch (error) {
          console.error(
            "Return incident case error:",
            error
          );

          setProcessingAction(
            null
          );

          showNotice?.(
            "error",
            "Return Failed",
            error?.message ||
              "The case could not be returned for correction. Please try again."
          );
        }
      },
      [
        incident,
        isProcessing,
        onReject,
        returnComment,
        showNotice,
      ]
    );

  const handleApprove =
    useCallback(
      async () => {
        if (
          isProcessing ||
          !incident
        ) {
          return;
        }

        try {
          setProcessingAction(
            "approve"
          );

          const success =
            await onApprove?.(
              incident
            );

          if (
            success ===
            false
          ) {
            setProcessingAction(
              null
            );
          }
        } catch (error) {
          console.error(
            "Approve incident case error:",
            error
          );

          setProcessingAction(
            null
          );

          showNotice?.(
            "error",
            "Approval Failed",
            error?.message ||
              "The case could not be approved and closed. Please try again."
          );
        }
      },
      [
        incident,
        isProcessing,
        onApprove,
        showNotice,
      ]
    );

  if (!incident) {
    return null;
  }

  const incidentCode =
    incident.displayId ||
    incident.id ||
    "-";

  const employeeName =
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const violation =
    incident.violation ||
    incident.violationType ||
    "-";

  const sanction =
    incident.sanction ||
    incident.actionTaken ||
    "-";

  const investigation =
    incident.investigation ||
    {};

  const resolution =
    incident.resolution ||
    null;

  const smartAlerts =
    Array.isArray(
      incident.smartAlerts
    )
      ? incident.smartAlerts
      : [];

  return (
    <BaseModal
      onClose={
        handleClose
      }
      title="Authorized Case Review"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="indigo"
      size="lg"
      preventClose={
        isProcessing
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                aria-hidden="true"
              >
                <FiShield />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-violet-900 dark:text-violet-200">
                  Independent HR Review
                </p>

                <p className="mt-1 text-xs leading-5 text-violet-700 dark:text-violet-300">
                  Review the incident details, investigation record, and submitted proof before approving closure or returning the case for correction.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewBadge
              label="Severity"
              value={
                incident.severity
              }
              styles={
                SEVERITY_STYLE
              }
              icon={
                <FiAlertTriangle
                  aria-hidden="true"
                />
              }
            />

            <ReviewBadge
              label="Case Status"
              value={
                incident.status
              }
              styles={
                STATUS_STYLE
              }
              icon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
            />
          </div>

          <InfoCard title="Incident Summary">
            <Detail
              label="Incident ID"
              value={
                incidentCode
              }
            />

            <Detail
              label="Employee"
              value={
                employeeName
              }
            />

            <Detail
              label="Violation"
              value={
                violation
              }
            />

            <Detail
              label="Sanction"
              value={
                sanction
              }
            />

            <Detail
              label="Case Age"
              value={`${Number(
                incident.caseAgeDays ||
                  0
              )} day(s)`}
            />
          </InfoCard>

          {smartAlerts.length >
            0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {smartAlerts.map(
                  (
                    alert,
                    index
                  ) => (
                    <SmartAlertCard
                      key={
                        alert.id ||
                        `${alert.type || "alert"}-${index}`
                      }
                      alert={
                        alert
                      }
                    />
                  )
                )}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Investigation Information">
            <Detail
              label="Started By"
              value={
                investigation.startedByName ||
                incident.investigationStartedByName ||
                incident.investigation_started_by_name ||
                "-"
              }
            />

            <Detail
              label="Username"
              value={
                investigation.startedByUsername ||
                incident.investigationStartedByUsername ||
                "-"
              }
            />

            <Detail
              label="User ID"
              value={
                investigation.startedById ||
                incident.investigationStartedById ||
                "-"
              }
            />

            <Detail
              label="Date Started"
              value={formatDateTime(
                investigation.startedAt ||
                  incident.investigationStartedAt ||
                  incident.investigation_started_at
              )}
            />
          </InfoCard>

          {resolution ? (
            <ProofReview
              resolution={
                resolution
              }
            />
          ) : (
            <InfoCard title="Resolution Proof Review">
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <FiFileText
                  className="mt-0.5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />

                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  No resolution proof was submitted for this case.
                </p>
              </div>
            </InfoCard>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <Field label="Return Comment if Proof is Not Enough">
              <textarea
                rows={4}
                value={
                  returnComment
                }
                onChange={
                  handleReturnCommentChange
                }
                disabled={
                  isProcessing
                }
                placeholder="Example: Proof is incomplete. Please upload the signed memo or acknowledged document."
                className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Required only when returning the case for correction. Approval does not require a return comment.
              </p>
            </Field>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="danger"
              leftIcon={
                <FiXCircle
                  aria-hidden="true"
                />
              }
              loading={
                isReturning
              }
              disabled={
                isProcessing
              }
              onClick={
                handleReturn
              }
            >
              {isReturning
                ? "Returning Case..."
                : "Return for Correction"}
            </Button>

            <Button
              type="button"
              variant="success"
              leftIcon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
              loading={
                isApproving
              }
              disabled={
                isProcessing
              }
              onClick={
                handleApprove
              }
            >
              {isApproving
                ? "Approving Case..."
                : "Approve & Close"}
            </Button>
          </ModalFooter>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <CaseTimeline
            incident={
              incident
            }
          />
        </aside>
      </div>
    </BaseModal>
  );
}