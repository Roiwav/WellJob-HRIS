import { FiPlay } from "react-icons/fi";
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

export default function ViewIncidentModal({
  incident,
  onClose,
  mode = "view",
  onRequestStart,
}) {
  const isStartReview = mode === "start-review";

  return (
    <BaseModal
      onClose={onClose}
      title={isStartReview ? "Review Reported Incident" : "Incident Case Details"}
      subtitle={`${incident.id} • ${incident.employee}`}
      color={isStartReview ? "amber" : "red"}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {isStartReview && (
            <AlertBox
              type="warning"
              title="Review before starting investigation"
              message="Please verify the reporter, employee, violation type, case age, alerts, and case details before proceeding."
            />
          )}

          <InfoCard title="Report Information">
            <Detail label="Incident ID" value={incident.id} />
            <Detail label="Reported By" value={incident.reportedBy || "-"} />
            <Detail
              label="Reported Date"
              value={formatDateTime(incident.reportedAt || incident.date)}
            />
            <Detail label="Sanction" value={incident.sanction || "-"} />
            <Detail label="Status" value={incident.status} />
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

          <InfoCard title="Employee and Violation">
            <Detail label="Employee" value={incident.employee} />
            <Detail label="Employee ID" value={incident.employeeId || "-"} />
            <Detail label="Company" value={incident.company || "-"} />
            <Detail label="Violation" value={incident.violation} />
            <Detail label="Severity" value={incident.severity} />
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
            <p className="whitespace-pre-line leading-6">
              {incident.description || "No description provided."}
            </p>
          </InfoCard>

          {incident.review?.decision === "Rejected" && (
            <InfoCard title="Super Admin Return Comment">
              <p className="rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {incident.review.comments}
              </p>
            </InfoCard>
          )}

          {incident.resolution && <ProofReview resolution={incident.resolution} />}

          {isStartReview && (
            <ModalFooter>
              <button type="button" onClick={onClose} className="btn-light">
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onRequestStart(incident)}
                className="btn-amber"
              >
                <FiPlay />
                Start Investigation
              </button>
            </ModalFooter>
          )}
        </div>

        <CaseTimeline incident={incident} />
      </div>
    </BaseModal>
  );
}