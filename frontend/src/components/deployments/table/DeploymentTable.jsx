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
  getDeploymentDisplayStatus,
  getDeploymentEndReasonDisplay,
  normalizeDeploymentStatus,
} from "../../../utils/deployments/deploymentHelpers";
const ASSIGNMENT_COMPLETION_REASON_OPTIONS = [
  "End of Assignment / Pulled Out by Client",
  "Transferred / Reassigned",
];
const EMPLOYMENT_SEPARATION_REASON_OPTIONS = [
  "Resignation",
  "Termination",
  "AWOL",
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
function EndAssignmentModal({
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
      setError("Please select the deployment end date.");
      return;
    }
    if (!separationReason) {
      setError("Please select a deployment end reason.");
      return;
    }
    const cleanRemarks = separationRemarks.trim();
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
          "The deployment end could not be saved. Please review the information and try again."
        );
      }
    } catch (submitError) {
      console.error(
        "End deployment submit failed:",
        submitError
      );
      setError(
        "Unable to end the deployment. Please try again."
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
      title="End Deployment"
      description="Complete the active deployment or record a genuine employment separation."
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
            Confirm Deployment End
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
            <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p className="break-words">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Client Company:
                </span>{" "}
                {deployment.company || "-"}
              </p>

              <p className="break-words">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Location:
                </span>{" "}
                {deployment.location || "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="deployment-assignment-end-date"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Deployment End Date
          </label>
          <input
            id="deployment-assignment-end-date"
            type="date"
            max={formatDateForInput(new Date())}
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
            htmlFor="deployment-assignment-end-reason"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Deployment End Reason
          </label>
          <select
            id="deployment-assignment-end-reason"
            value={separationReason}
            disabled={isSubmitting}
            onChange={(event) => {
              setSeparationReason(event.target.value);
              clearError();
            }}
            className="ui-select"
          >
            <option value="">Select reason...</option>
            <optgroup label="Deployment end — employment remains Active">
              {ASSIGNMENT_COMPLETION_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </optgroup>
            <optgroup label="Employment separation — employment status changes">
              {EMPLOYMENT_SEPARATION_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="deployment-assignment-end-details"
          className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Deployment End Details
          <span className="ml-1 text-xs font-medium text-slate-400">
            optional
          </span>
        </label>
        <textarea
          id="deployment-assignment-end-details"
          value={separationRemarks}
          disabled={isSubmitting}
          rows={3}
          maxLength={1000}
          placeholder="Add an optional HR note or deployment end detail..."
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
    </Dialog>
  );
}

export default function DeploymentTable({
  deployments = [],
  openView,
  onUpdateRow,
  isSuperAdmin = false,
  isReadOnly = false,
  isHrCoordinator = false,
  canEndDeployments = false,
}) {
  const [endAssignmentTarget, setEndAssignmentTarget] = useState(null);
  const readOnly =
    isSuperAdmin ||
    isReadOnly;
  const safeDeployments = Array.isArray(deployments)
    ? deployments
    : [];

  // HR Coordinators are already restricted to their assigned company
  // by backend scope, so repeating Client Company / Location in every row
  // adds noise without adding useful information.
  const showCompanyLocation = !isHrCoordinator;

  /*
   * Do not show an empty/redundant Separation Details column
   * when every visible record is still actively deployed.
   *
   * If the current page contains at least one ended/completed
   * deployment, the column is shown so its historical details
   * remain available.
   */
  const showSeparationDetails = safeDeployments.some(
    (deployment) =>
      normalizeDeploymentStatus(deployment?.status) !== "Active"
  );

  const visibleColumnCount =
    4 +
    (showCompanyLocation ? 1 : 0) +
    (showSeparationDetails ? 1 : 0);

  const tableMinWidthClass =
    showCompanyLocation && showSeparationDetails
      ? "min-w-[960px]"
      : showCompanyLocation
        ? "min-w-[780px]"
        : showSeparationDetails
          ? "min-w-[760px]"
          : "min-w-[620px]";

  /*
   * Use a fixed column layout so wide screens do not dump all
   * spare width into the Employee column. This keeps HR
   * Coordinator rows compact and visually balanced.
   */
  const columnWidths = showCompanyLocation
    ? showSeparationDetails
      ? {
          employee: "24%",
          company: "24%",
          start: "15%",
          separation: "19%",
          status: "11%",
          actions: "7%",
        }
      : {
          employee: "29%",
          company: "29%",
          start: "17%",
          status: "16%",
          actions: "9%",
        }
    : showSeparationDetails
      ? {
          employee: "31%",
          start: "19%",
          separation: "24%",
          status: "17%",
          actions: "9%",
        }
      : {
          employee: "38%",
          start: "24%",
          status: "25%",
          actions: "13%",
        };
  const handleOpenEndAssignmentModal = useCallback(
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
      setEndAssignmentTarget(
        deployment
      );
    },
    [readOnly]
  );
  const handleCloseEndAssignmentModal = useCallback(() => {
    setEndAssignmentTarget(
      null
    );
  }, []);
  const handleSubmitEndAssignment = useCallback(
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
        setEndAssignmentTarget(
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
              {isHrCoordinator
                ? "Review deployment records for your assigned client company."
                : readOnly
                  ? "Review employee assignments and deployment history."
                  : "Review active assignments and recorded assignment outcomes."}
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {safeDeployments.length} shown
          </span>
        </header>

        <div className="max-h-[520px] overflow-auto">
          <table
            className={`w-full table-fixed ${tableMinWidthClass} border-separate border-spacing-0 text-left`}
          >
            <colgroup>
              <col style={{ width: columnWidths.employee }} />

              {showCompanyLocation && (
                <col style={{ width: columnWidths.company }} />
              )}

              <col style={{ width: columnWidths.start }} />

              {showSeparationDetails && (
                <col style={{ width: columnWidths.separation }} />
              )}

              <col style={{ width: columnWidths.status }} />
              <col style={{ width: columnWidths.actions }} />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgba(226,232,240,1)] backdrop-blur dark:bg-slate-800/95 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
                <th scope="col" className="px-4 py-2.5">
                  Employee
                </th>
                {showCompanyLocation && (
                  <th
                    scope="col"
                    className="px-4 py-3"
                  >
                    Client Company / Location
                  </th>
                )}
                <th scope="col" className="px-4 py-3">
                  Deployment Date
                </th>
                {showSeparationDetails && (
                  <th
                    scope="col"
                    className="px-4 py-3"
                  >
                    Deployment End Details
                  </th>
                )}
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
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
                  const internalStatus =
                    normalizeDeploymentStatus(
                      deployment.status
                    );
                  const separationReason =
                    deployment.separationReason ||
                    deployment.endReason;
                  const separationRemarks =
                    deployment.separationRemarks ||
                    deployment.endRemarks ||
                    deployment.end_remarks ||
                    "";
                  const separationReasonDisplay =
                    getDeploymentEndReasonDisplay(
                      separationReason,
                      "Deployment ended"
                    );
                  const displayStatus =
                    internalStatus === "Active"
                      ? "Deployed"
                      : getDeploymentDisplayStatus(
                          internalStatus,
                          separationReason,
                          separationRemarks
                        );
                  const canEndAssignment =
                    canEndDeployments &&
                    !readOnly &&
                    internalStatus === "Active";
                  const separationDate =
                    deployment.separationDate ||
                    deployment.contractEnd;
                  const hasSeparation =
                    internalStatus !== "Active" &&
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
                      <td className="px-4 py-2.5">
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

                      {showCompanyLocation && (
                        <td className="px-4 py-2.5">
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
                              Location: {deployment.location || "-"}
                            </p>
                          </div>
                        </td>
                      )}

                      <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {formatDisplayDate(
                          deployment.start ||
                            deployment.contractStart
                        )}
                      </td>

                      {showSeparationDetails && (
                        <td className="px-4 py-2.5">
                          {hasSeparation ? (
                            <div className="min-w-0">
                              <p className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">
                                {formatDisplayDate(
                                  separationDate
                                )}
                              </p>
                              <p
                                title={separationReasonDisplay}
                                className="mt-0.5 max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400"
                              >
                                {separationReasonDisplay}
                              </p>
                            </div>
                          ) : (
                            <span
                              className="text-sm text-slate-400"
                              aria-label="No deployment end"
                            >
                              —
                            </span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-2.5">
                        <StatusBadge
                          status={displayStatus}
                          size="sm"
                        />
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            label={`View ${employeeName} deployment details`}
                            title="View deployment details"
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

                          {canEndAssignment && (
                            <IconButton
                              label={`End deployment for ${employeeName}`}
                              title="End deployment"
                              variant="warning"
                              size="sm"
                              onClick={() =>
                                handleOpenEndAssignmentModal(
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
                    colSpan={visibleColumnCount}
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
                        No Deployment Records
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

      {!readOnly && endAssignmentTarget && (
        <EndAssignmentModal
          key={
            endAssignmentTarget.deploymentId ||
            endAssignmentTarget.id ||
            endAssignmentTarget.employeeId
          }
          deployment={endAssignmentTarget}
          onClose={handleCloseEndAssignmentModal}
          onSubmit={handleSubmitEndAssignment}
        />
      )}
    </>
  );
}