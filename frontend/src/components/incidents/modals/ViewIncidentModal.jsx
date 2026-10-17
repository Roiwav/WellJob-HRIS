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
  ProofList,
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

function getDayLabel(
  value
) {
  const days =
    Number(
      value || 0
    );

  return `${days} ${
    days === 1
      ? "day"
      : "days"
  }`;
}

function getCaseAgeLabel(
  value
) {
  return getDayLabel(
    value
  );
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

  return getDayLabel(
    value
  );
}

function formatDateOnly(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const normalized =
    String(
      value
    ).trim();

  const dateOnlyMatch =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  let date;

  if (dateOnlyMatch) {
    date =
      new Date(
        `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T00:00:00+08:00`
      );
  } else {
    date =
      new Date(
        value
      );
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        "Asia/Manila",
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  ).format(
    date
  );
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
    incident.createdAtTimestamp ||
    incident.created_at_timestamp ||
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

  const investigation =
    incident.investigation ||
    null;

  const investigationStartedAt =
    incident.investigationStartedAtTimestamp ||
    incident.investigation_started_at_timestamp ||
    investigation?.startedAt ||
    incident.investigationStartedAt ||
    incident.investigation_started_at ||
    null;

  const investigationStartedBy =
    investigation?.startedByName ||
    incident.investigationStartedByName ||
    incident.investigation_started_by_name ||
    "-";

  const hasInvestigation =
    Boolean(
      investigationStartedAt
    );

  const resolution =
    incident.resolution ||
    null;

  const resolutionSubmittedAt =
    incident.resolutionSubmittedAtTimestamp ||
    incident.resolution_submitted_at_timestamp ||
    resolution?.submittedAt ||
    incident.resolutionSubmittedAt ||
    incident.resolution_submitted_at ||
    null;

  const resolutionSubmittedBy =
    resolution?.submittedByName ||
    incident.resolutionSubmittedByName ||
    incident.resolution_submitted_by_name ||
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
    incident.reviewedAtTimestamp ||
    incident.reviewed_at_timestamp ||
    review?.reviewedAt ||
    incident.reviewedAt ||
    incident.reviewed_at ||
    null;

  const reviewedBy =
    review?.reviewedByName ||
    incident.reviewedByName ||
    incident.reviewed_by_name ||
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
          ? "Review Incident"
          : "Case Details"
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
              title="Before You Start"
              message="Review the case details below before starting the investigation."
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

              </div>
            </HighlightCard>

            <HighlightCard
              icon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
              label="Status"
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

              </div>
            </HighlightCard>
          </div>

          <InfoCard title="Case Summary">
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
              label="Prescribed Sanction"
              value={
                policySanction
              }
            />

            <Detail
              label="Offense Number"
              value={
                Number(
                  incident.offenseCount ||
                    1
                )
              }
            />

            <Detail
              label="Days Open"
              value={getCaseAgeLabel(
                incident.caseAgeDays
              )}
            />
          </InfoCard>

          <InfoCard title="Report Details">
            <Detail
              label="Reported By"
              value={
                reportedBy
              }
            />

            <Detail
              label="Reported On"
              value={formatDateTime(
                reportedAt
              )}
            />

            <Detail
              label="Incident Date"
              value={formatDateOnly(
                incidentDate
              )}
            />

            <Detail
              label="Target Resolution Period"
              value={getSlaLabel(
                incident.slaDays
              )}
            />

            <Detail
              label="Past Due"
              value={
                incident.isOverdue
                  ? "Yes"
                  : "No"
              }
            />
          </InfoCard>

          <InfoCard title="Case Description">
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

          <InfoCard title="Initial Attachment">
            {incident.initialNte ||
            incident.initial_nte ? (
              <ProofList
                files={[
                  incident.initialNte ||
                    incident.initial_nte,
                ]}
              />
            ) : (
              <EmptyWorkflowState message="No file was attached when this incident was reported." />
            )}
          </InfoCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <InfoCard title="Investigation Details">
              {hasInvestigation ? (
                <>
                  <Detail
                    label="Started By"
                    value={
                      investigationStartedBy
                    }
                  />

                  <Detail
                    label="Started On"
                    value={formatDateTime(
                      investigationStartedAt
                    )}
                  />
                </>
              ) : (
                <EmptyWorkflowState message="Investigation has not started yet." />
              )}
            </InfoCard>

            <InfoCard title="Submitted Resolution">
              {hasResolution ? (
                <>
                  <Detail
                    label="Submitted By"
                    value={
                      resolutionSubmittedBy
                    }
                  />

                  <Detail
                    label="Submitted On"
                    value={formatDateTime(
                      resolutionSubmittedAt
                    )}
                  />
                </>
              ) : (
                <EmptyWorkflowState message="No resolution has been submitted yet." />
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

          <InfoCard title="Review Details">
            {hasReview ? (
              <>
                <Detail
                  label="Reviewed By"
                  value={
                    reviewedBy
                  }
                />

                <Detail
                  label="Reviewed On"
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
            <InfoCard title="Reason for Return">
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {reviewComments ||
                  "The case was returned for correction."}
              </p>
            </InfoCard>
          )}

          <InfoCard title="Recommendation">
            <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              {incident.recommendation ||
                "No recommendation available."}
            </p>
          </InfoCard>

          {smartAlerts.length >
            0 && (
            <InfoCard title="Case Alerts">
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
                  : "Investigation Started"}
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