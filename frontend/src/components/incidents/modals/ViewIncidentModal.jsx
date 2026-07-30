import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiPlay,
  FiShield,
} from "react-icons/fi";

import Button from "../../ui/Button";

import { SmartAlertCard } from "../badges/IncidentBadges";

import { formatDateTime } from "../../../utils/incidents/incidentHelpers";

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
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",

  Major:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",

  Critical:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
};

const STATUS_STYLE = {
  Open:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",

  Investigating:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",

  "For Review":
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",

  Closed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
};

function getIncidentCode(incident) {
  if (!incident) {
    return "-";
  }

  if (incident.displayId) {
    return incident.displayId;
  }

  if (!incident.id) {
    return "-";
  }

  const numericId = Number(incident.id);

  if (Number.isFinite(numericId)) {
    return `INC-${String(numericId).padStart(4, "0")}`;
  }

  return String(incident.id);
}

function getValue(value, fallback = "-") {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || fallback;
}

function getCaseAgeLabel(value) {
  const caseAge = Number(value || 0);

  return `${caseAge} day(s)`;
}

function getSlaLabel(value) {
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
  const text = getValue(value);

  const style =
    styleMap?.[text] ||
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${style}`}
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
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>

      {children}
    </div>
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
    mode === "start-review";

  const incidentCode =
    getIncidentCode(incident);

  const employeeName =
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const employeeId =
    incident.employeeId ||
    incident.employee_id ||
    "-";

  const violation =
    incident.violation ||
    incident.violationType ||
    incident.violation_type ||
    "-";

  const severity =
    incident.severity || "Minor";

  const status =
    incident.status || "Open";

  const sanction =
    incident.sanction ||
    incident.actionTaken ||
    incident.action_taken ||
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
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at;

  const investigation =
    incident.investigation || {};

  const investigationStartedBy =
    investigation.startedByName ||
    incident.investigationStartedByName ||
    incident.investigation_started_by_name ||
    "-";

  const investigationStartedAt =
    investigation.startedAt ||
    incident.investigationStartedAt ||
    incident.investigation_started_at;

  const resolution =
    incident.resolution || null;

  const resolutionSubmittedBy =
    resolution?.submittedByName ||
    incident.resolutionSubmittedByName ||
    incident.resolution_submitted_by_name ||
    "-";

  const resolutionSubmittedAt =
    resolution?.submittedAt ||
    incident.resolutionSubmittedAt ||
    incident.resolution_submitted_at;

  const reviewDecision =
    incident.review?.decision ||
    incident.reviewDecision ||
    incident.review_decision ||
    "";

  const reviewComments =
    incident.review?.comments ||
    incident.reviewComments ||
    incident.review_comments ||
    "";

  const isReturned =
    String(reviewDecision)
      .trim()
      .toLowerCase() === "rejected" ||
    String(reviewDecision)
      .trim()
      .toLowerCase() === "returned";

  const smartAlerts =
    Array.isArray(incident.smartAlerts)
      ? incident.smartAlerts
      : [];

  const canStartInvestigation =
    isStartReview &&
    status === "Open" &&
    typeof onRequestStart === "function";

  const handleRequestStart = () => {
    if (!canStartInvestigation) {
      return;
    }

    onRequestStart(incident);
  };

  return (
    <BaseModal
      onClose={onClose}
      title={
        isStartReview
          ? "Review Reported Incident"
          : "Incident Case Details"
      }
      subtitle={`${incidentCode} • ${employeeName}`}
      color={
        isStartReview
          ? "amber"
          : "red"
      }
      size="lg"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {isStartReview && (
            <AlertBox
              type="warning"
              title="Review before starting investigation"
              message="Verify the reporter, employee, violation type, case age, alerts, and incident details before proceeding."
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <HighlightCard
              icon={
                <FiAlertTriangle
                  aria-hidden="true"
                />
              }
              label="Severity Level"
            >
              <PillBadge
                value={severity}
                styleMap={SEVERITY_STYLE}
                icon={
                  <FiShield
                    size={13}
                    aria-hidden="true"
                  />
                }
              />

              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Indicates the assessed seriousness and priority of the
                reported incident.
              </p>
            </HighlightCard>

            <HighlightCard
              icon={
                <FiCheckCircle
                  aria-hidden="true"
                />
              }
              label="Case Status"
            >
              <PillBadge
                value={status}
                styleMap={STATUS_STYLE}
                icon={
                  <FiCheckCircle
                    size={13}
                    aria-hidden="true"
                  />
                }
              />

              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Shows the current workflow stage of the disciplinary case.
              </p>
            </HighlightCard>
          </div>

          <InfoCard title="Report Information">
            <Detail
              label="Incident ID"
              value={incidentCode}
            />

            <Detail
              label="Reported By"
              value={reportedBy}
            />

            <Detail
              label="Reported Date"
              value={formatDateTime(
                reportedAt
              )}
            />

            <Detail
              label="Status"
              value={status}
            />

            <Detail
              label="Case Age"
              value={getCaseAgeLabel(
                incident.caseAgeDays
              )}
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

          <InfoCard title="Investigation Information">
            <Detail
              label="Started By"
              value={investigationStartedBy}
            />

            <Detail
              label="Date Started"
              value={formatDateTime(
                investigationStartedAt
              )}
            />

            <Detail
              label="Proof Submitted By"
              value={resolutionSubmittedBy}
            />

            <Detail
              label="Proof Submitted Date"
              value={formatDateTime(
                resolutionSubmittedAt
              )}
            />
          </InfoCard>

          <InfoCard title="Employee and Violation">
            <Detail
              label="Employee"
              value={employeeName}
            />

            <Detail
              label="Employee ID"
              value={employeeId}
            />

            <Detail
              label="Company"
              value={
                incident.company || "-"
              }
            />

            <Detail
              label="Violation"
              value={violation}
            />

            <Detail
              label="Severity"
              value={severity}
            />

            <Detail
              label="Offense Count"
              value={Number(
                incident.offenseCount || 1
              )}
            />

            <Detail
              label="Sanction"
              value={sanction}
            />
          </InfoCard>

          <InfoCard title="System Recommendation">
            <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {incident.recommendation ||
                "No recommendation generated."}
            </p>
          </InfoCard>

          {smartAlerts.length > 0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {smartAlerts.map(
                  (alert, index) => (
                    <SmartAlertCard
                      key={
                        alert.id ||
                        `${alert.type || "alert"}-${index}`
                      }
                      alert={alert}
                    />
                  )
                )}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Incident Description">
            <div className="flex items-start gap-3">
              <FiFileText
                className="mt-1 shrink-0 text-gray-400"
                aria-hidden="true"
              />

              <p className="whitespace-pre-line break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
                {incident.description ||
                  "No description provided."}
              </p>
            </div>
          </InfoCard>

          {isReturned && (
            <InfoCard title="Super Admin Return Comment">
              <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {reviewComments ||
                  "The case was returned for correction."}
              </p>
            </InfoCard>
          )}

          {resolution && (
            <ProofReview
              resolution={resolution}
            />
          )}

          {isStartReview && (
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
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
                {status === "Open"
                  ? "Start Investigation"
                  : "Investigation Already Started"}
              </Button>
            </ModalFooter>
          )}
        </div>

        <aside className="min-w-0">
          <CaseTimeline
            incident={incident}
          />
        </aside>
      </div>
    </BaseModal>
  );
}