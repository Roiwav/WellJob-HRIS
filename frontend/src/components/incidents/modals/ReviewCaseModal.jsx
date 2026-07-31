import { useCallback, useState } from "react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";

import Button from "../../ui/Button";

import { SmartAlertCard } from "../badges/IncidentBadges";

import { formatDateTime } from "../../../utils/incidents/incidentHelpers";

import {
  BaseModal,
  CaseTimeline,
  Detail,
  Field,
  InfoCard,
  ModalFooter,
  ProofReview,
} from "../shared/ModalUI";

export default function ReviewCaseModal({
  incident,
  onClose,
  onApprove,
  onReject,
  showNotice,
}) {
  const [returnComment, setReturnComment] = useState("");
  const [processingAction, setProcessingAction] = useState(null);

  const isProcessing = processingAction !== null;
  const isApproving = processingAction === "approve";
  const isReturning = processingAction === "return";

  const handleClose = useCallback(() => {
    if (isProcessing) {
      return;
    }

    onClose?.();
  }, [isProcessing, onClose]);

  const handleReturnCommentChange = useCallback((event) => {
    setReturnComment(event.target.value);
  }, []);

  const handleReturn = useCallback(async () => {
    if (isProcessing || !incident) {
      return;
    }

    const cleanComment = returnComment.trim();

    if (!cleanComment) {
      showNotice?.(
        "error",
        "Return Comment Required",
        "Please enter a return comment before sending this case back for correction."
      );
      return;
    }

    try {
      setProcessingAction("return");

      const success = await onReject?.(incident, cleanComment);

      if (success === false) {
        setProcessingAction(null);
      }
    } catch (error) {
      console.error("Return incident case error:", error);

      setProcessingAction(null);

      showNotice?.(
        "error",
        "Return Failed",
        error?.message ||
          "The case could not be returned for correction. Please try again."
      );
    }
  }, [
    incident,
    isProcessing,
    onReject,
    returnComment,
    showNotice,
  ]);

  const handleApprove = useCallback(async () => {
    if (isProcessing || !incident) {
      return;
    }

    try {
      setProcessingAction("approve");

      const success = await onApprove?.(incident);

      if (success === false) {
        setProcessingAction(null);
      }
    } catch (error) {
      console.error("Approve incident case error:", error);

      setProcessingAction(null);

      showNotice?.(
        "error",
        "Approval Failed",
        error?.message ||
          "The case could not be approved and closed. Please try again."
      );
    }
  }, [
    incident,
    isProcessing,
    onApprove,
    showNotice,
  ]);

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
    incident.investigation || {};

  const resolution =
    incident.resolution || null;

  const smartAlerts = Array.isArray(incident.smartAlerts)
    ? incident.smartAlerts
    : [];

  return (
    <BaseModal
      onClose={handleClose}
      title="Authorized Case Review"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="indigo"
      size="lg"
      preventClose={isProcessing}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <InfoCard title="Incident Summary">
            <Detail
              label="Incident ID"
              value={incidentCode}
            />

            <Detail
              label="Employee"
              value={employeeName}
            />

            <Detail
              label="Violation"
              value={violation}
            />

            <Detail
              label="Severity"
              value={incident.severity}
            />

            <Detail
              label="Sanction"
              value={sanction}
            />

            <Detail
              label="Status"
              value={incident.status}
            />

            <Detail
              label="Case Age"
              value={`${Number(
                incident.caseAgeDays || 0
              )} day(s)`}
            />
          </InfoCard>

          {smartAlerts.length > 0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {smartAlerts.map((alert, index) => (
                  <SmartAlertCard
                    key={
                      alert.id ||
                      `${alert.type || "alert"}-${index}`
                    }
                    alert={alert}
                  />
                ))}
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
            <ProofReview resolution={resolution} />
          ) : (
            <InfoCard title="Resolution Proof Review">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No resolution proof was submitted for this case.
              </p>
            </InfoCard>
          )}

          <Field label="Return Comment if Proof is Not Enough">
            <textarea
              rows={4}
              value={returnComment}
              onChange={handleReturnCommentChange}
              disabled={isProcessing}
              placeholder="Example: Proof is incomplete. Please upload the signed memo or acknowledged document."
              className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              A comment is required only when returning the case for
              correction.
            </p>
          </Field>

          <ModalFooter>
            <Button
              type="button"
              variant="danger"
              leftIcon={
                <FiXCircle aria-hidden="true" />
              }
              loading={isReturning}
              disabled={isProcessing}
              onClick={handleReturn}
            >
              {isReturning
                ? "Returning Case..."
                : "Return Case"}
            </Button>

            <Button
              type="button"
              variant="success"
              leftIcon={
                <FiCheckCircle aria-hidden="true" />
              }
              loading={isApproving}
              disabled={isProcessing}
              onClick={handleApprove}
            >
              {isApproving
                ? "Approving Case..."
                : "Approve & Close"}
            </Button>
          </ModalFooter>
        </div>

        <aside className="min-w-0">
          <CaseTimeline incident={incident} />
        </aside>
      </div>
    </BaseModal>
  );
}