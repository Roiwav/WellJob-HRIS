import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiMapPin,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import IconButton from "../../ui/IconButton";

import {
  formatLongDisplayDate,
  getDeploymentTimelineInfo,
  getStatusBadgeClass,
  normalizeDeploymentStatus,
} from "../../../utils/deployments/deploymentHelpers";

import { DeploymentInfoCard } from "../shared/DeploymentModalUI";

const STATUS_MESSAGES = {
  Active: {
    icon: FiCheckCircle,
    className: "text-green-600 dark:text-green-300",
    message: "Deployment is active and ongoing",
  },
  Completed: {
    icon: FiCheckCircle,
    className: "text-blue-600 dark:text-blue-300",
    message: "Deployment has been completed",
  },
  Cancelled: {
    icon: FiAlertTriangle,
    className: "text-red-600 dark:text-red-300",
    message: "Deployment has been cancelled",
  },
  Pending: {
    icon: FiAlertTriangle,
    className: "text-amber-600 dark:text-amber-300",
    message: "Deployment is awaiting action",
  },
};

function getEmployeeInitials(employeeName) {
  return (
    String(employeeName || "D")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "D"
  );
}

function DeploymentStatusMessage({ status }) {
  const config = STATUS_MESSAGES[status];

  if (!config) {
    return null;
  }

  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${config.className}`}
    >
      <StatusIcon size={14} aria-hidden="true" />
      {config.message}
    </span>
  );
}

export default function DeploymentModal({
  deployment,
  close,
}) {
  if (!deployment) {
    return null;
  }

  const status = normalizeDeploymentStatus(
    deployment.status
  );

  const employeeName =
    deployment.employee || "Deployment";

  const employeeId =
    deployment.employeeId ||
    deployment.employee_id ||
    deployment.id ||
    "-";

  const employeeInitials =
    getEmployeeInitials(employeeName);

  const deploymentStartDate =
    deployment.contractStart ||
    deployment.start;

  const separationDate =
    deployment.separationDate ||
    deployment.contractEnd;

  const timelineInfo =
    getDeploymentTimelineInfo(
      deploymentStartDate,
      separationDate
    );

  const isAttention =
    status === "Cancelled" ||
    status === "Pending";

  const handleClose = () => {
    close?.();
  };

  return (
    <Dialog
      open
      onClose={handleClose}
      title={`${employeeName} deployment record`}
      description="View deployment assignment, timeline, employment status, and separation details."
      size="xl"
      height="xl"
      showHeader={false}
      showCloseButton={false}
      closeOnOverlay
      closeOnEscape
      scrollBody={false}
      bodyClassName="min-h-0 flex-1 p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {employeeInitials}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                  {employeeName}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
                    {employeeId}
                  </span>

                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                      getStatusBadgeClass(status),
                    ].join(" ")}
                  >
                    {status === "Cancelled" && (
                      <FiAlertTriangle
                        className="text-sm"
                        aria-hidden="true"
                      />
                    )}

                    {status}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300">
                    {deployment.employmentType ||
                      "Permanent"}
                  </span>
                </div>
              </div>
            </div>

            <IconButton
              label="Close deployment details"
              title="Close"
              variant="ghost"
              size="md"
              onClick={handleClose}
            >
              <FiX aria-hidden="true" />
            </IconButton>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 text-gray-900 dark:text-white sm:px-6 sm:py-6 lg:px-8">
          {isAttention && (
            <div
              className={[
                "rounded-2xl border p-5",
                status === "Cancelled"
                  ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                  : "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  size={18}
                  aria-hidden="true"
                />

                <div>
                  <p className="font-semibold">
                    Deployment Status Notice
                  </p>

                  <p className="mt-1 text-sm">
                    {status === "Cancelled"
                      ? "This deployment has been cancelled and is no longer active."
                      : "This deployment is pending further action."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Deployment Overview
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DeploymentInfoCard
                icon={
                  <FiUser
                    size={16}
                    aria-hidden="true"
                  />
                }
                label="Employee"
                value={employeeName}
              />

              <DeploymentInfoCard
                icon={
                  <FiBriefcase
                    size={16}
                    aria-hidden="true"
                  />
                }
                label="Company"
                value={deployment.company}
              />

              <DeploymentInfoCard
                icon={
                  <FiMapPin
                    size={16}
                    aria-hidden="true"
                  />
                }
                label="Location"
                value={deployment.location}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Deployment Information
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DeploymentInfoCard
                icon={
                  <FiCalendar
                    size={16}
                    aria-hidden="true"
                  />
                }
                label="Deployment Start Date"
                value={formatLongDisplayDate(
                  deploymentStartDate
                )}
              />

              <DeploymentInfoCard
                icon={
                  <FiCalendar
                    size={16}
                    aria-hidden="true"
                  />
                }
                label="Separation Date"
                value={
                  separationDate &&
                  separationDate !== "-"
                    ? formatLongDisplayDate(
                        separationDate
                      )
                    : "Not separated"
                }
              />
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                Timeline Summary
              </div>

              <p className="text-base font-medium">
                {timelineInfo}
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Current Status
            </h3>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <FiShield
                  size={16}
                  aria-hidden="true"
                />

                <span className="text-sm">
                  Deployment Status
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    getStatusBadgeClass(status),
                  ].join(" ")}
                >
                  {status}
                </span>

                <DeploymentStatusMessage
                  status={status}
                />
              </div>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-6 lg:px-8">
          <Button
            variant="secondary"
            onClick={handleClose}
          >
            Close
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}