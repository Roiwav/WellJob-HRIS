import { useCallback, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiEdit2,
  FiEye,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import IconButton from "../../ui/IconButton";
import StatusBadge from "../../ui/StatusBadge";

import {
  formatDateForInput,
  formatDisplayDate,
  normalizeDeploymentStatus,
} from "../../../utils/deployments/deploymentHelpers";

const SEPARATION_REASON_OPTIONS = [
  "Resignation",
  "Termination",
  "Other Separation",
];

function getDeploymentKey(deployment, index) {
  return (
    deployment?.deploymentId ||
    deployment?.deployment_id ||
    deployment?.id ||
    deployment?.employeeId ||
    deployment?.employee_id ||
    `deployment-${index}`
  );
}

function getEmployeeName(deployment) {
  return (
    deployment?.employee ||
    deployment?.employeeName ||
    deployment?.employee_name ||
    "Employee"
  );
}

function getEmployeeId(deployment) {
  return (
    deployment?.employeeId ||
    deployment?.employee_id ||
    deployment?.id ||
    "-"
  );
}

function SeparationModal({
  deployment,
  onClose,
  onSubmit,
}) {
  const [separationDate, setSeparationDate] = useState(() =>
    formatDateForInput(
      deployment?.separationDate || deployment?.contractEnd
    )
  );

  const [separationReason, setSeparationReason] = useState("");
  const [separationRemarks, setSeparationRemarks] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const employeeName = getEmployeeName(deployment);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose?.();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!deployment || isSubmitting) {
      return;
    }

    clearError();

    if (!separationDate) {
      setError("Please select the employee's separation date.");
      return;
    }

    if (!separationReason) {
      setError("Please select a separation reason.");
      return;
    }

    const cleanRemarks = separationRemarks.trim();

    if (
      separationReason === "Other Separation" &&
      !cleanRemarks
    ) {
      setError(
        "Please provide details for Other Separation."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const wasSaved = await onSubmit?.({
        ...deployment,
        separationDate,
        separationReason,
        separationRemarks: cleanRemarks,
      });

      if (!wasSaved) {
        setError(
          "The separation could not be saved. Review the page error and try again."
        );
      }
    } catch (submitError) {
      console.error(
        "Deployment separation submit failed:",
        submitError
      );

      setError(
        submitError?.message ||
          "Unable to save the employee separation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearError,
    deployment,
    isSubmitting,
    onSubmit,
    separationDate,
    separationReason,
    separationRemarks,
  ]);

  if (!deployment) {
    return null;
  }

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Separate Employee"
      description="Record separation only when the employee resigns, is terminated, or leaves employment for another reason."
      size="lg"
      tone="warning"
      closeOnOverlay={!isSubmitting}
      closeOnEscape={!isSubmitting}
      preventClose={isSubmitting}
      showCloseButton
      bodyClassName="space-y-5 p-6"
      footer={
        <div className="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
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
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            Confirm Separation
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/60">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            <FiBriefcase size={22} aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee
            </p>

            <p className="mt-1 truncate font-extrabold text-slate-900 dark:text-white">
              {employeeName}
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-slate-500 dark:text-slate-400">
              {deployment.company || "-"}{" "}
              <span aria-hidden="true">•</span>{" "}
              {deployment.location || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="deployment-separation-date"
            className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300"
          >
            Separation Date
          </label>

          <input
            id="deployment-separation-date"
            type="date"
            value={separationDate}
            disabled={isSubmitting}
            onChange={(event) => {
              setSeparationDate(event.target.value);
              clearError();
            }}
            className="ui-control"
          />
        </div>

        <div>
          <label
            htmlFor="deployment-separation-reason"
            className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300"
          >
            Separation Reason
          </label>

          <select
            id="deployment-separation-reason"
            value={separationReason}
            disabled={isSubmitting}
            onChange={(event) => {
              setSeparationReason(event.target.value);
              clearError();
            }}
            className="ui-select"
          >
            <option value="">Select reason...</option>

            {SEPARATION_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="deployment-separation-details"
            className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300"
          >
            Separation Details
            <span className="ml-1 text-xs font-medium text-gray-400">
              {separationReason === "Other Separation"
                ? "required"
                : "optional"}
            </span>
          </label>

          <textarea
            id="deployment-separation-details"
            value={separationRemarks}
            disabled={isSubmitting}
            rows={4}
            maxLength={1000}
            placeholder="Add a short note or HR remarks..."
            onChange={(event) => {
              setSeparationRemarks(event.target.value);
              clearError();
            }}
            className="ui-textarea"
          />

          <p className="mt-1 text-right text-xs text-gray-400">
            {separationRemarks.length}/1000
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-2">
            <FiAlertTriangle
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span className="break-words">{error}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <strong>Employment rule:</strong>{" "}
        Deployment is continuous. Saving this form records that
        the employee has left employment and ends the active
        deployment.
      </div>
    </Dialog>
  );
}

export default function DeploymentTable({
  deployments = [],
  openView,
  onUpdateRow,
  isSuperAdmin = false,
}) {
  const [separationTarget, setSeparationTarget] = useState(null);

  const safeDeployments = Array.isArray(deployments)
    ? deployments
    : [];

  const handleOpenSeparationModal = useCallback(
    (deployment) => {
      const status = normalizeDeploymentStatus(
        deployment?.status
      );

      if (isSuperAdmin || status !== "Active") {
        return;
      }

      setSeparationTarget(deployment);
    },
    [isSuperAdmin]
  );

  const handleCloseSeparationModal = useCallback(() => {
    setSeparationTarget(null);
  }, []);

  const handleSubmitSeparation = useCallback(
    async (updatedDeployment) => {
      if (typeof onUpdateRow !== "function") {
        return false;
      }

      const wasSaved = await onUpdateRow(updatedDeployment);

      if (wasSaved) {
        setSeparationTarget(null);
      }

      return Boolean(wasSaved);
    },
    [onUpdateRow]
  );

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <header className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              <FiBriefcase
                className="shrink-0 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              Deployment Records
            </h3>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              View and monitor employee deployment assignments.
            </p>
          </div>

          <span className="w-fit rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {safeDeployments.length}{" "}
            {safeDeployments.length === 1
              ? "record"
              : "records"}
          </span>
        </header>

        <div className="max-h-[600px] overflow-auto">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(229,231,235,1)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
              <tr className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-6 py-4">
                  Employee ID
                </th>
                <th scope="col" className="px-6 py-4">
                  Employee
                </th>
                <th scope="col" className="px-6 py-4">
                  Company
                </th>
                <th scope="col" className="px-6 py-4">
                  Location
                </th>
                <th scope="col" className="px-6 py-4">
                  Deployment Start
                </th>
                <th scope="col" className="px-6 py-4">
                  Separation
                </th>
                <th scope="col" className="px-6 py-4">
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-center"
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {safeDeployments.length > 0 ? (
                safeDeployments.map((deployment, index) => {
                  const employeeName =
                    getEmployeeName(deployment);

                  const status = normalizeDeploymentStatus(
                    deployment.status
                  );

                  const canSeparateEmployee =
                    !isSuperAdmin && status === "Active";

                  const separationReason =
                    deployment.separationReason ||
                    deployment.endReason;

                  return (
                    <tr
                      key={getDeploymentKey(
                        deployment,
                        index
                      )}
                      className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-white/5"
                    >
                      <td className="whitespace-nowrap px-6 py-4 align-middle">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {getEmployeeId(deployment)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 align-middle">
                        <p className="max-w-[240px] truncate font-semibold text-gray-900 dark:text-white">
                          {employeeName}
                        </p>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <p className="max-w-[220px] truncate text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {deployment.company || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <p className="max-w-[220px] truncate text-sm font-medium text-gray-600 dark:text-gray-300">
                          {deployment.location || "-"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 align-middle text-sm font-medium text-gray-600 dark:text-gray-300">
                        {formatDisplayDate(
                          deployment.start ||
                            deployment.contractStart
                        )}
                      </td>

                      <td className="px-6 py-4 align-middle text-sm font-medium text-gray-600 dark:text-gray-300">
                        <p className="whitespace-nowrap">
                          {formatDisplayDate(
                            deployment.separationDate ||
                              deployment.contractEnd
                          )}
                        </p>

                        {separationReason && (
                          <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-gray-400 dark:text-gray-500">
                            {separationReason}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <StatusBadge status={status} size="md" />
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          {canSeparateEmployee && (
                            <IconButton
                              label={`Separate ${employeeName}`}
                              title="Separate Employee"
                              variant="warning"
                              size="md"
                              onClick={() =>
                                handleOpenSeparationModal(
                                  deployment
                                )
                              }
                            >
                              <FiEdit2 aria-hidden="true" />
                            </IconButton>
                          )}

                          <IconButton
                            label={`View ${employeeName} deployment`}
                            title="View Deployment"
                            variant="primary"
                            size="md"
                            onClick={() => openView?.(deployment)}
                          >
                            <FiEye aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-14 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10">
                        <FiBriefcase
                          size={24}
                          aria-hidden="true"
                        />
                      </div>

                      <p className="font-extrabold text-gray-900 dark:text-white">
                        No deployments found
                      </p>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Deployment records will appear here once
                        an employee is deployed.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {separationTarget && (
        <SeparationModal
          key={
            separationTarget.deploymentId ||
            separationTarget.id ||
            separationTarget.employeeId
          }
          deployment={separationTarget}
          onClose={handleCloseSeparationModal}
          onSubmit={handleSubmitSeparation}
        />
      )}
    </>
  );
}