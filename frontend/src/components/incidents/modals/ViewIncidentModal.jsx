import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiPlay,
  FiShield,
} from "react-icons/fi";

import Button from "../../ui/Button";

import {
  SmartAlertCard,
} from "../badges/IncidentBadges";

import {
  formatDateTime,
} from "../../../utils/incidents/incidentHelpers";

import {
  AlertBox,
  BaseModal,
  CaseTimeline,
  Detail,
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

function getIncidentCode(
  incident
) {
  if (!incident) {
    return "-";
  }

  if (
    incident.displayId
  ) {
    return incident.displayId;
  }

  if (!incident.id) {
    return "-";
  }

  const numericId =
    Number(
      incident.id
    );

  if (
    Number.isFinite(
      numericId
    )
  ) {
    return `INC-${String(
      numericId
    ).padStart(
      4,
      "0"
    )}`;
  }

  return String(
    incident.id
  );
}

function getValue(
  value,
  fallback = "-"
) {
  const cleanValue =
    String(
      value ?? ""
    ).trim();

  return (
    cleanValue ||
    fallback
  );
}

function getCaseAgeLabel(
  value
) {
  const caseAge =
    Number(
      value || 0
    );

  return `${caseAge} day(s)`;
}

function getSlaLabel(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return `${value} day(s)`;
}

function PillBadge({
  value,
  styleMap,
  icon,
}) {
  const text =
    getValue(
      value
    );

  const style =
    styleMap?.[
      text
    ] ||
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}
    >
      {icon}

      {text}
    </span>
  );
}

function HighlightCard({
  icon,
  label,
  children,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}

        {label}
      </div>

      {children}
    </div>
  );
}

function EmptyWorkflowState({
  message,
}) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
      {message}
    </p>
  );
}

export default function ViewIncidentModal({
  incident,
  onClose,
  mode = "view",
  onRequestStart,
}) {
  if (!incident) {
    return null;
  }

  const isStartReview =
    mode ===
    "start-review";

  const incidentCode =
    getIncidentCode(
      incident
    );

  const employeeName =
    incident.employee ||
    incident.employeeName ||
    incident.employee_name ||
    "Unknown Employee";

  const employeeId =
    incident.employeeId ||
    incident.employee_id ||
    "-";

  const company =
    incident.company ||
    incident.clientCompany ||
    incident.client_company ||
    "-";

  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "-";

  const severity =
    incident.severity ||
    "Minor";

  const status =
    incident.status ||
    "Open";

  /*
   * Prescribed sanction from the server-authoritative
   * violation policy. Do not substitute actionTaken.
   */
  const policySanction =
    incident.policySanction ||
    incident.policy_sanction ||
    incident.sanction ||
    "-";

  const reportedBy =
    incident.reportedByName ||
    incident.reported_by_name ||
    incident.reportedBy ||
    incident.reported_by ||
    "-";

  const reportedAt =
    incident.reportedAt ||
    incident.reported_at ||
    incident.createdAt ||
    incident.created_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date;

  const incidentDate =
    incident.incidentDate ||
    incident.incident_date ||
    incident.date ||
    reportedAt;

  const location =
    incident.location ||
    "-";

  const investigation =
    incident.investigation ||
    null;

  const investigationStartedAt =
    investigation?.startedAt ||
    incident.investigationStartedAt ||
    incident.investigation_started_at ||
    null;

  const investigationStartedBy =
    investigation?.startedByName ||
    incident.investigationStartedByName ||
    incident.investigation_started_by_name ||
    "-";

  const investigationStartedByUsername =
    investigation?.startedByUsername ||
    incident.investigationStartedByUsername ||
    incident.investigation_started_by_username ||
    "-";

  const investigationStartedById =
    investigation?.startedById ||
    incident.investigationStartedById ||
    incident.investigation_started_by_id ||
    "-";

  const hasInvestigation =
    Boolean(
      investigationStartedAt
    );

  const resolution =
    incident.resolution ||
    null;

  const resolutionSubmittedAt =
    resolution?.submittedAt ||
    incident.resolutionSubmittedAt ||
    incident.resolution_submitted_at ||
    null;

  const resolutionSubmittedBy =
    resolution?.submittedByName ||
    incident.resolutionSubmittedByName ||
    incident.resolution_submitted_by_name ||
    "-";

  const resolutionSubmittedByUsername =
    resolution?.submittedByUsername ||
    incident.resolutionSubmittedByUsername ||
    incident.resolution_submitted_by_username ||
    "-";

  const resolutionSubmittedById =
    resolution?.submittedById ||
    incident.resolutionSubmittedById ||
    incident.resolution_submitted_by_id ||
    "-";

  const hasResolution =
    Boolean(
      resolution &&
      resolutionSubmittedAt
    );

  const review =
    incident.review ||
    null;

  const reviewedAt =
    review?.reviewedAt ||
    incident.reviewedAt ||
    incident.reviewed_at ||
    null;

  const reviewedBy =
    review?.reviewedByName ||
    incident.reviewedByName ||
    incident.reviewed_by_name ||
    "-";

  const reviewedByUsername =
    review?.reviewedByUsername ||
    incident.reviewedByUsername ||
    incident.reviewed_by_username ||
    "-";

  const reviewedById =
    review?.reviewedById ||
    incident.reviewedById ||
    incident.reviewed_by_id ||
    "-";

  const reviewDecision =
    review?.decision ||
    incident.reviewDecision ||
    incident.review_decision ||
    "";

  const reviewComments =
    review?.comments ||
    incident.reviewComments ||
    incident.review_comments ||
    "";

  const hasReview =
    Boolean(
      reviewedAt ||
      reviewDecision
    );

  const normalizedReviewDecision =
    String(
      reviewDecision ||
      ""
    )
      .trim()
      .toLowerCase();

  const isReturned =
    normalizedReviewDecision ===
      "rejected" ||
    normalizedReviewDecision ===
      "returned";

  const smartAlerts =
    Array.isArray(
      incident.smartAlerts
    )
      ? incident.smartAlerts
      : [];

  const canStartInvestigation =
    isStartReview &&
    status ===
      "Open" &&
    typeof onRequestStart ===
      "function";

  const handleRequestStart =
    () => {
      if (
        !canStartInvestigation
      ) {
        return;
      }

      onRequestStart(
        incident
      );
    };

  return (
    <BaseModal
      onClose={
        onClose
      }
      title={
        isStartReview
          ? "Review Reported Incident"
          : "Incident Case Details"
      }
      subtitle={`${incidentCode} • ${employeeName}`}
      color={
        isStartReview
          ? "amber"
          : "indigo"
      }
      size="lg"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {isStartReview && (
            <AlertBox
              type="warning"
              title="Review before starting investigation"
              message="Verify the employee, reporter, violation, case age, alerts, and incident details before proceeding."
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <HighlightCard
              icon={
                <FiAlertTriangle
                  aria-hidden="true"
                />
              }
              label="Severity"
            >
              <div className="flex flex-wrap items-center gap-2">
                <PillBadge
                  value={
                    severity
                  }
                  styleMap={
                    SEVERITY_STYLE
                  }
                  icon={
                    <FiShield
                      size={13}
                      aria-hidden="true"
                    />
                  }
                />

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Assessed incident seriousness
                </span>
              </div>
            </HighlightCard>

            <HighlightCard
              icon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
              label="Case Status"
            >
              <div className="flex flex-wrap items-center gap-2">
                <PillBadge
                  value={
                    status
                  }
                  styleMap={
                    STATUS_STYLE
                  }
                  icon={
                    <FiCheckCircle
                      size={13}
                      aria-hidden="true"
                    />
                  }
                />

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Current incident workflow stage
                </span>
              </div>
            </HighlightCard>
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
              label="Employee ID"
              value={
                employeeId
              }
            />

            <Detail
              label="Company"
              value={
                company
              }
            />

            <Detail
              label="Violation"
              value={
                violation
              }
            />

            <Detail
              label="Policy Sanction"
              value={
                policySanction
              }
            />

            <Detail
              label="Offense Count"
              value={
                Number(
                  incident.offenseCount ||
                    1
                )
              }
            />

            <Detail
              label="Case Age"
              value={getCaseAgeLabel(
                incident.caseAgeDays
              )}
            />
          </InfoCard>

          <InfoCard title="Report Information">
            <Detail
              label="Reported By"
              value={
                reportedBy
              }
            />

            <Detail
              label="Reported Date"
              value={formatDateTime(
                reportedAt
              )}
            />

            <Detail
              label="Incident Date"
              value={formatDateTime(
                incidentDate
              )}
            />

            <Detail
              label="Location"
              value={
                location
              }
            />

            <Detail
              label="SLA Target"
              value={getSlaLabel(
                incident.slaDays
              )}
            />

            <Detail
              label="Overdue"
              value={
                incident.isOverdue
                  ? "Yes"
                  : "No"
              }
            />
          </InfoCard>

          <InfoCard title="Incident Description">
            <div className="flex items-start gap-3">
              <FiFileText
                className="mt-1 shrink-0 text-slate-400"
                aria-hidden="true"
              />

              <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700 dark:text-slate-300">
                {incident.description ||
                  "No description provided."}
              </p>
            </div>
          </InfoCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <InfoCard title="Investigation Information">
              {hasInvestigation ? (
                <>
                  <Detail
                    label="Started By"
                    value={
                      investigationStartedBy
                    }
                  />

                  <Detail
                    label="Username"
                    value={
                      investigationStartedByUsername
                    }
                  />

                  <Detail
                    label="User ID"
                    value={
                      investigationStartedById
                    }
                  />

                  <Detail
                    label="Date Started"
                    value={formatDateTime(
                      investigationStartedAt
                    )}
                  />
                </>
              ) : (
                <EmptyWorkflowState message="Investigation has not started yet." />
              )}
            </InfoCard>

            <InfoCard title="Resolution Proof">
              {hasResolution ? (
                <>
                  <Detail
                    label="Submitted By"
                    value={
                      resolutionSubmittedBy
                    }
                  />

                  <Detail
                    label="Username"
                    value={
                      resolutionSubmittedByUsername
                    }
                  />

                  <Detail
                    label="User ID"
                    value={
                      resolutionSubmittedById
                    }
                  />

                  <Detail
                    label="Submitted Date"
                    value={formatDateTime(
                      resolutionSubmittedAt
                    )}
                  />
                </>
              ) : (
                <EmptyWorkflowState message="No resolution proof has been submitted yet." />
              )}
            </InfoCard>
          </div>

          {hasResolution && (
            <ProofReview
              resolution={
                resolution
              }
            />
          )}

          <InfoCard title="Review Information">
            {hasReview ? (
              <>
                <Detail
                  label="Reviewed By"
                  value={
                    reviewedBy
                  }
                />

                <Detail
                  label="Username"
                  value={
                    reviewedByUsername
                  }
                />

                <Detail
                  label="User ID"
                  value={
                    reviewedById
                  }
                />

                <Detail
                  label="Review Date"
                  value={formatDateTime(
                    reviewedAt
                  )}
                />

                <Detail
                  label="Decision"
                  value={
                    reviewDecision ||
                    "-"
                  }
                />

                <Detail
                  label="Comments"
                  value={
                    reviewComments ||
                    "-"
                  }
                />
              </>
            ) : (
              <EmptyWorkflowState message="This case has not been reviewed yet." />
            )}
          </InfoCard>

          {isReturned && (
            <InfoCard title="Reviewer Return Comment">
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {reviewComments ||
                  "The case was returned for correction."}
              </p>
            </InfoCard>
          )}

          <InfoCard title="System Recommendation">
            <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              {incident.recommendation ||
                "No recommendation generated."}
            </p>
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

          {isStartReview && (
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={
                  onClose
                }
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="warning"
                leftIcon={
                  <FiPlay
                    aria-hidden="true"
                  />
                }
                disabled={
                  !canStartInvestigation
                }
                onClick={
                  handleRequestStart
                }
              >
                {status ===
                "Open"
                  ? "Start Investigation"
                  : "Investigation Already Started"}
              </Button>
            </ModalFooter>
          )}
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