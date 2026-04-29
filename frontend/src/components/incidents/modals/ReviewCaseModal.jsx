import { useState } from "react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import { SmartAlertCard } from "../badges/IncidentBadges";
import { formatDateTime } from "../../../utils/incidents/incidentHelpers";
import {
  BaseModal,
  InfoCard,
  Detail,
  Field,
  ModalFooter,
  ProofReview,
  CaseTimeline,
} from "../shared/ModalUI";

export default function ReviewCaseModal({
  incident,
  onClose,
  onApprove,
  onReject,
  showNotice,
}) {
  const [rejectComment, setRejectComment] = useState("");

  const handleReject = () => {
    if (!rejectComment.trim()) {
      showNotice(
        "error",
        "Return Comment Required",
        "Please enter a return comment before sending this case back for correction."
      );
      return;
    }

    onReject(incident, rejectComment.trim());
  };

  return (
    <BaseModal
      onClose={onClose}
      title="Super Admin Case Review"
      subtitle={`${incident.id} • ${incident.employee}`}
      color="indigo"
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <InfoCard title="Incident Summary">
            <Detail label="Violation" value={incident.violation} />
            <Detail label="Severity" value={incident.severity} />
            <Detail label="Sanction" value={incident.sanction} />
            <Detail label="Status" value={incident.status} />
            <Detail
              label="Case Age"
              value={`${incident.caseAgeDays || 0} day(s)`}
            />
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

          <InfoCard title="Investigation Information">
            <Detail
              label="Started By"
              value={incident.investigation?.startedByName || "-"}
            />
            <Detail
              label="Username"
              value={incident.investigation?.startedByUsername || "-"}
            />
            <Detail
              label="User ID"
              value={incident.investigation?.startedById || "-"}
            />
            <Detail
              label="Date Started"
              value={formatDateTime(incident.investigation?.startedAt)}
            />
          </InfoCard>

          {incident.resolution && <ProofReview resolution={incident.resolution} />}

          <Field label="Return Comment if Proof is Not Enough">
            <textarea
              rows="3"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Example: Proof is incomplete. Please upload signed memo or acknowledged document."
              className="input-field resize-none"
            />
          </Field>

          <ModalFooter>
            <button type="button" onClick={handleReject} className="btn-red">
              <FiXCircle />
              Return Case
            </button>

            <button
              type="button"
              onClick={() => onApprove(incident)}
              className="btn-green"
            >
              <FiCheckCircle />
              Approve & Close
            </button>
          </ModalFooter>
        </div>

        <CaseTimeline incident={incident} />
      </div>
    </BaseModal>
  );
}