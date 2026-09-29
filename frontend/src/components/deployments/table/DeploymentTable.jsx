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

function getEmployeePosition(deployment) {
  return (
    deployment?.position ||
    deployment?.jobTitle ||
    deployment?.job_title ||
    ""
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
      title="Record Employee Separation"
      description="End the active deployment and record the employee's separation details."
      size="lg"
      tone="warning"
      closeOnOverlay={!isSubmitting}
      closeOnEscape={!isSubmitting}
      preventClose={isSubmitting}
      showCloseButton
      bodyClassName="space-y-4 p-5 sm:p-6"
      footer={
        <div className="flex w-full flex-col-reverse justify-end gap-2 sm:flex-row">
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
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <FiBriefcase size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee
            </p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              {employeeName}
            </p>
            <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
              {deployment.company || "-"}{" "}
              <span aria-hidden="true">•</span>{" "}
              {deployment.location || "-"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="deployment-separation-date"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
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
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
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
      </div>

      <div>
        <label
          htmlFor="deployment-separation-details"
          className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Separation Details
          <span className="ml-1 text-xs font-medium text-slate-400">
            {separationReason === "Other Separation"
              ? "required"
              : "optional"}
          </span>
        </label>
        <textarea
          id="deployment-separation-details"
          value={separationRemarks}
          disabled={isSubmitting}
          rows={3}
          maxLength={1000}
          placeholder="Add a short HR note or separation remark..."
          onChange={(event) => {
            setSeparationRemarks(event.target.value);
            clearError();
          }}
          className="ui-textarea"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {separationRemarks.length}/1000
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        Saving this form ends the active deployment and records the employee's separation in deployment history.
      </div>
    </Dialog>
  );
}

export default function DeploymentTable({
  deployments = [],
  openView,
  onUpdateRow,
  isSuperAdmin = false,
  isReadOnly = false,
}) {
  const [separationTarget, setSeparationTarget] = useState(null);
  const readOnly =
    isSuperAdmin ||
    isReadOnly;
  const safeDeployments = Array.isArray(deployments)
    ? deployments
    : [];
  const handleOpenSeparationModal = useCallback(
    (deployment) => {
      const status = normalizeDeploymentStatus(
        deployment?.status
      );
      if (
        readOnly ||
        status !== "Active"
      ) {
        return;
      }
      setSeparationTarget(
        deployment
      );
    },
    [readOnly]
  );
  const handleCloseSeparationModal = useCallback(() => {
    setSeparationTarget(
      null
    );
  }, []);
  const handleSubmitSeparation = useCallback(
    async (updatedDeployment) => {
      if (
        readOnly ||
        typeof onUpdateRow !== "function"
      ) {
        return false;
      }
      const wasSaved =
        await onUpdateRow(
          updatedDeployment
        );
      if (wasSaved) {
        setSeparationTarget(
          null
        );
      }
      return Boolean(
        wasSaved
      );
    },
    [
      onUpdateRow,
      readOnly,
    ]
  );
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <FiBriefcase
                className="shrink-0 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              Deployment Records
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {readOnly
                ? "Review employee assignments and deployment history."
                : "Review active assignments and recorded employee separations."}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {safeDeployments.length} shown
          </span>
        </header>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgba(226,232,240,1)] backdrop-blur dark:bg-slate-800/95 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
                <th scope="col" className="min-w-[240px] px-4 py-3">
                  Employee
                </th>
                <th scope="col" className="min-w-[240px] px-4 py-3">
                  Company / Location
                </th>
                <th scope="col" className="w-[160px] px-4 py-3">
                  Deployment Start
                </th>
                <th scope="col" className="min-w-[190px] px-4 py-3">
                  Separation Details
                </th>
                <th scope="col" className="w-[170px] px-4 py-3">
                  Deployment Status
                </th>
                <th scope="col" className="w-[130px] px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {safeDeployments.length > 0 ? (
                safeDeployments.map((deployment, index) => {
                  const employeeName = getEmployeeName(deployment);
                  const employeeId = getEmployeeId(deployment);
                  const employeePosition = getEmployeePosition(deployment);
                  const status = normalizeDeploymentStatus(
                    deployment.status
                  );
                  const canSeparateEmployee =
                    !readOnly && status === "Active";
                  const separationReason =
                    deployment.separationReason ||
                    deployment.endReason;
                  const separationDate =
                    deployment.separationDate ||
                    deployment.contractEnd;
                  const hasSeparation =
                    status !== "Active" &&
                    Boolean(
                      separationReason ||
                        (
                          separationDate &&
                          separationDate !== "-"
                        )
                    );

                  return (
                    <tr
                      key={getDeploymentKey(
                        deployment,
                        index
                      )}
                      className="align-middle transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex min-w-[46px] shrink-0 items-center justify-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {employeeId}
                          </span>
                          <div className="min-w-0">
                            <p
                              title={employeeName}
                              className="max-w-[210px] truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                            >
                              {employeeName}
                            </p>
                            {employeePosition && (
                              <p
                                title={employeePosition}
                                className="mt-0.5 max-w-[210px] truncate text-xs text-slate-500 dark:text-slate-400"
                              >
                                {employeePosition}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p
                            title={deployment.company || "-"}
                            className="max-w-[220px] truncate text-sm font-semibold text-slate-800 dark:text-slate-200"
                          >
                            {deployment.company || "-"}
                          </p>
                          <p
                            title={deployment.location || "-"}
                            className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400"
                          >
                            {deployment.location || "-"}
                          </p>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {formatDisplayDate(
                          deployment.start ||
                            deployment.contractStart
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {hasSeparation ? (
                          <div className="min-w-0">
                            <p className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">
                              {formatDisplayDate(
                                separationDate
                              )}
                            </p>
                            <p
                              title={separationReason || ""}
                              className="mt-0.5 max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400"
                            >
                              {separationReason ||
                                "Separation recorded"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Currently deployed
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              No separation recorded
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          status={status}
                          size="sm"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            label={`View ${employeeName} deployment`}
                            title="View Deployment"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              openView?.(
                                deployment
                              )
                            }
                          >
                            <FiEye aria-hidden="true" />
                          </IconButton>

                          {canSeparateEmployee && (
                            <IconButton
                              label={`Separate ${employeeName}`}
                              title="Record Separation"
                              variant="warning"
                              size="sm"
                              onClick={() =>
                                handleOpenSeparationModal(
                                  deployment
                                )
                              }
                            >
                              <FiEdit2 aria-hidden="true" />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <FiBriefcase
                          size={22}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        No deployment records found
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                        Deployment records will appear here once an employee is assigned to a client company.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!readOnly && separationTarget && (
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
