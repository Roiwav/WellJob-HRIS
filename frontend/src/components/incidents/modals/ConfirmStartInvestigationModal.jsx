import { FiPlay } from "react-icons/fi";
import { formatDateTime } from "../../../utils/incidents/incidentHelpers";
import {
  BaseModal,
  AlertBox,
  InfoCard,
  Detail,
  ModalFooter,
} from "../shared/ModalUI";

export default function ConfirmStartInvestigationModal({
  incident,
  currentUser,
  onClose,
  onConfirm,
}) {
  return (
    <BaseModal
      onClose={onClose}
      title="Confirm Investigation Start"
      subtitle="This action will be recorded in the case timeline."
      color="amber"
      size="sm"
    >
      <div className="space-y-5">
        <AlertBox
          type="warning"
          title="Are you sure you want to start investigation?"
          message="This will move the case to Investigating status and log your name, username, user ID, role, date, and time."
        />

        <InfoCard title="Case to Investigate">
          <Detail label="Incident ID" value={incident.id} />
          <Detail label="Employee" value={incident.employee} />
          <Detail label="Violation Type" value={incident.violation} />
          <Detail label="Severity" value={incident.severity} />
          <Detail
            label="Case Age"
            value={`${incident.caseAgeDays || 0} day(s)`}
          />
        </InfoCard>

        <InfoCard title="Investigation Started By">
          <Detail label="Name" value={currentUser.name} />
          <Detail label="Username" value={currentUser.username} />
          <Detail label="User ID" value={currentUser.id} />
          <Detail label="Role" value={currentUser.role} />
          <Detail
            label="Date and Time"
            value={formatDateTime(new Date().toISOString())}
          />
        </InfoCard>

        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-light">
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(incident)}
            className="btn-amber"
          >
            <FiPlay />
            Yes, Start Investigation
          </button>
        </ModalFooter>
      </div>
    </BaseModal>
  );
}