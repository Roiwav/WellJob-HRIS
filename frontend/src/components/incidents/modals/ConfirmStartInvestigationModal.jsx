import { useCallback, useMemo, useState } from "react";
import { FiPlay } from "react-icons/fi";

import { formatDateTime } from "../../../utils/incidents/incidentHelpers";

import Button from "../../ui/Button";

import {
  AlertBox,
  BaseModal,
  Detail,
  InfoCard,
  ModalFooter,
} from "../shared/ModalUI";

export default function ConfirmStartInvestigationModal({
  incident,
  currentUser,
  onClose,
  onConfirm,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDateTime = useMemo(() => {
    return formatDateTime(new Date().toISOString());
  }, []);

const safeIncident = useMemo(() => {
  return incident || {};
}, [incident]);

const safeCurrentUser = useMemo(() => {
  return currentUser || {};
}, [currentUser]);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    onClose?.();
  }, [isSubmitting, onClose]);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !safeIncident?.id) {
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await onConfirm?.(safeIncident);

      if (result === false) {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(
        "Start investigation confirmation error:",
        error
      );

      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    onConfirm,
    safeIncident,
  ]);

  if (!incident) {
    return null;
  }

  return (
    <BaseModal
      onClose={handleClose}
      title="Confirm Investigation Start"
      subtitle="This action will be recorded in the case timeline."
      color="amber"
      size="sm"
      preventClose={isSubmitting}
    >
      <div className="space-y-5">
        <AlertBox
          type="warning"
          title="Are you sure you want to start the investigation?"
          message="This will move the case to Investigating status and record the responsible user's identity, role, date, and time in the case timeline."
        />

        <InfoCard title="Case to Investigate">
          <Detail
            label="Incident ID"
            value={
              safeIncident.displayId ||
              safeIncident.id
            }
          />

          <Detail
            label="Employee"
            value={
              safeIncident.employee ||
              safeIncident.employeeName
            }
          />

          <Detail
            label="Violation Type"
            value={
              safeIncident.violation ||
              safeIncident.violationType
            }
          />

          <Detail
            label="Severity"
            value={safeIncident.severity}
          />

          <Detail
            label="Current Status"
            value={safeIncident.status}
          />

          <Detail
            label="Case Age"
            value={`${Number(
              safeIncident.caseAgeDays || 0
            )} day(s)`}
          />
        </InfoCard>

        <InfoCard title="Investigation Started By">
          <Detail
            label="Name"
            value={
              safeCurrentUser.name ||
              safeCurrentUser.fullName ||
              safeCurrentUser.full_name
            }
          />

          <Detail
            label="Username"
            value={safeCurrentUser.username}
          />

          <Detail
            label="User ID"
            value={
              safeCurrentUser.id ||
              safeCurrentUser.userId
            }
          />

          <Detail
            label="Role"
            value={safeCurrentUser.role}
          />

          <Detail
            label="Date and Time"
            value={currentDateTime}
          />
        </InfoCard>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="warning"
            leftIcon={<FiPlay aria-hidden="true" />}
            loading={isSubmitting}
            disabled={
              isSubmitting ||
              !safeIncident?.id
            }
            onClick={handleConfirm}
          >
            {isSubmitting
              ? "Starting Investigation..."
              : "Yes, Start Investigation"}
          </Button>
        </ModalFooter>
      </div>
    </BaseModal>
  );
}