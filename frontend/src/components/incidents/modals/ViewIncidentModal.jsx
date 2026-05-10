import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiFileText,
  FiPlay,
  FiShield,
  FiUser,
} from "react-icons/fi";

import { SmartAlertCard } from "../badges/IncidentBadges";
import { formatDateTime } from "../../../utils/incidents/incidentHelpers";

import {
  BaseModal,
  AlertBox,
  InfoCard,
  Detail,
  ModalFooter,
  ProofReview,
  CaseTimeline,
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
  if (!incident) return "-";

  if (incident.displayId) return incident.displayId;

  if (incident.id) {
    const numericId = Number(incident.id);

    if (Number.isFinite(numericId)) {
      return `INC-${String(numericId).padStart(4, "0")}`;
    }

    return String(incident.id);
  }

  return "-";
}

function getValue(value, fallback = "-") {
  const cleanValue = String(value || "").trim();
  return cleanValue || fallback;
}

function PillBadge({ value, styleMap, icon }) {
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

function HighlightCard({ icon, label, children }) {
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
  if (!incident) return null;

  const isStartReview = mode === "start-review";
  const incidentCode = getIncidentCode(incident);

  return (
    <BaseModal
      onClose={onClose}
      title={isStartReview ? "Review Reported Incident" : "Incident Case Details"}
      subtitle={`${incidentCode} • ${getValue(incident.employee, "Unknown Employee")}`}
      color={isStartReview ? "amber" : "red"}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {isStartReview && (
            <AlertBox
              type="warning"
              title="Review before starting investigation"
              message="Please verify the reporter, employee, violation type, case age, alerts, and case details before proceeding."
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <HighlightCard icon={<FiAlertTriangle />} label="Severity Level">
              <PillBadge
                value={incident.severity || "Minor"}
                styleMap={SEVERITY_STYLE}
                icon={<FiShield size={13} />}
              />

              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Severity is removed from the table and shown here for detailed
                incident review.
              </p>
            </HighlightCard>

            <HighlightCard icon={<FiCheckCircle />} label="Case Status">
              <PillBadge
                value={incident.status || "Open"}
                styleMap={STATUS_STYLE}
                icon={<FiCheckCircle size={13} />}
              />

              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Current workflow status of this disciplinary case.
              </p>
            </HighlightCard>
          </div>

          <InfoCard title="Report Information">
            <Detail label="Incident ID" value={incidentCode} />
            <Detail
              label="Reported By"
              value={incident.reportedByName || incident.reportedBy || "-"}
            />            <Detail
              label="Reported Date"
              value={formatDateTime(incident.reportedAt || incident.date)}
            />
            <Detail label="Status" value={incident.status || "-"} />
            <Detail
              label="Case Age"
              value={`${incident.caseAgeDays || 0} day(s)`}
            />
            <Detail
              label="SLA Target"
              value={`${incident.slaDays || "-"} day(s)`}
            />
            <Detail label="Overdue" value={incident.isOverdue ? "Yes" : "No"} />
          </InfoCard>

          <InfoCard title="Investigation Information">
  <Detail
    label="Started By"
    value={
      incident.investigation?.startedByName ||
      incident.investigationStartedByName ||
      "-"
    }
  />
  <Detail
    label="Date Started"
    value={formatDateTime(
      incident.investigation?.startedAt ||
        incident.investigationStartedAt
    )}
  />
  <Detail
    label="Proof Submitted By"
    value={
      incident.resolution?.submittedByName ||
      incident.resolutionSubmittedByName ||
      "-"
    }
  />
  <Detail
    label="Proof Submitted Date"
    value={formatDateTime(
      incident.resolution?.submittedAt ||
        incident.resolutionSubmittedAt
    )}
  />
</InfoCard>

          <InfoCard title="Employee and Violation">
            <Detail label="Employee" value={incident.employee || "-"} />
            <Detail label="Employee ID" value={incident.employeeId || "-"} />
            <Detail label="Company" value={incident.company || "-"} />
            <Detail label="Violation" value={incident.violation || "-"} />
            <Detail label="Severity" value={incident.severity || "-"} />
            <Detail label="Offense Count" value={incident.offenseCount || 1} />
            <Detail label="Sanction" value={incident.sanction || "-"} />
          </InfoCard>

          <InfoCard title="System Recommendation">
            <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {incident.recommendation || "No recommendation generated."}
            </p>
          </InfoCard>

          {incident.smartAlerts?.length > 0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {incident.smartAlerts.map((alert) => (
                  <SmartAlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Incident Description">
            <div className="flex items-start gap-3">
              <FiFileText className="mt-1 shrink-0 text-gray-400" />

              <p className="whitespace-pre-line break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
                {incident.description || "No description provided."}
              </p>
            </div>
          </InfoCard>

          {incident.review?.decision === "Rejected" && (
            <InfoCard title="Super Admin Return Comment">
              <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {incident.review.comments}
              </p>
            </InfoCard>
          )}

          {incident.resolution && (
            <ProofReview resolution={incident.resolution} />
          )}

          {isStartReview && (
            <ModalFooter>
              <button type="button" onClick={onClose} className="btn-light">
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onRequestStart?.(incident)}
                className="btn-amber"
              >
                <FiPlay />
                Start Investigation
              </button>
            </ModalFooter>
          )}
        </div>

        <div className="min-w-0">
          <CaseTimeline incident={incident} />
        </div>
      </div>
    </BaseModal>
  );
}