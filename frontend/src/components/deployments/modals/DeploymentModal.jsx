import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiMapPin,
  FiUser,
  FiX,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import IconButton from "../../ui/IconButton";

import {
  formatLongDisplayDate,
  getDeploymentDisplayStatus,
  getDeploymentTimelineInfo,
  getStatusBadgeClass,
  normalizeDeploymentStatus,
} from "../../../utils/deployments/deploymentHelpers";

const STATUS_MESSAGES = {
  Deployed: {
    icon: FiCheckCircle,
    className:
      "text-emerald-600 dark:text-emerald-300",
    message:
      "This employee is currently deployed.",
  },

  Completed: {
    icon: FiCheckCircle,
    className:
      "text-blue-600 dark:text-blue-300",
    message:
      "This deployment has been completed.",
  },

  Resigned: {
    icon: FiAlertTriangle,
    className:
      "text-sky-600 dark:text-sky-300",
    message:
      "The employee resigned and this deployment has ended.",
  },

  Terminated: {
    icon: FiAlertTriangle,
    className:
      "text-rose-600 dark:text-rose-300",
    message:
      "The employee's employment was terminated and this deployment has ended.",
  },

  AWOL: {
    icon: FiAlertTriangle,
    className:
      "text-orange-600 dark:text-orange-300",
    message:
      "This deployment ended due to AWOL.",
  },

  "Other Separation": {
    icon: FiAlertTriangle,
    className:
      "text-slate-600 dark:text-slate-300",
    message:
      "This deployment ended for another recorded separation reason.",
  },

  Ended: {
    icon: FiAlertTriangle,
    className:
      "text-slate-600 dark:text-slate-300",
    message:
      "This deployment has ended.",
  },

  "For Deployment": {
    icon: FiAlertTriangle,
    className:
      "text-amber-600 dark:text-amber-300",
    message:
      "This deployment is awaiting arrival confirmation.",
  },
};

function getEmployeeInitials(
  employeeName
) {
  return (
    String(
      employeeName ||
        "D"
    )
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("") ||
    "D"
  );
}

function getCompactDisplayStatus(
  internalStatus,
  separationReason,
  separationRemarks
) {
  if (
    internalStatus ===
    "Active"
  ) {
    return "Deployed";
  }

  const resolvedStatus =
    getDeploymentDisplayStatus(
      internalStatus,
      separationReason,
      separationRemarks
    );

  if (
    resolvedStatus ===
      "Separated" ||
    resolvedStatus ===
      "Cancelled"
  ) {
    return "Ended";
  }

  if (
    resolvedStatus ===
    "Pending"
  ) {
    return "For Deployment";
  }

  return (
    resolvedStatus ||
    "Ended"
  );
}

function getEmployeePosition(
  deployment
) {
  return (
    deployment?.position ||
    deployment?.jobTitle ||
    deployment?.job_title ||
    "Not recorded"
  );
}

function cleanSeparationRemarks(
  value
) {
  const cleaned =
    String(
      value ||
        ""
    )
      .replace(
        /^\[Other Separation\]\s*/i,
        ""
      )
      .trim();

  return (
    cleaned ||
    "Not provided"
  );
}

function CompactInfoItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-950/35">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-slate-400">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {label}
          </p>

          <p
            title={String(
              value ||
                "-"
            )}
            className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100"
          >
            {value ||
              "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeploymentStatusMessage({
  status,
}) {
  const config =
    STATUS_MESSAGES[
      status
    ];

  if (!config) {
    return null;
  }

  const StatusIcon =
    config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.className}`}
    >
      <StatusIcon
        size={13}
        aria-hidden="true"
      />
      {config.message}
    </span>
  );
}

function isAttentionStatus(
  status
) {
  return [
    "Resigned",
    "Terminated",
    "AWOL",
    "Other Separation",
    "Ended",
  ].includes(
    status
  );
}

function getStatusNoticeClass(
  status
) {
  if (
    status ===
    "Terminated"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300";
  }

  if (
    status ===
    "AWOL"
  ) {
    return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300";
}

export default function DeploymentModal({
  deployment,
  close,
}) {
  if (!deployment) {
    return null;
  }

  const internalStatus =
    normalizeDeploymentStatus(
      deployment.status
    );

  const separationReason =
    deployment.separationReason ||
    deployment.separation_reason ||
    deployment.endReason ||
    deployment.end_reason ||
    "";

  const separationRemarks =
    deployment.separationRemarks ||
    deployment.separation_remarks ||
    deployment.endRemarks ||
    deployment.end_remarks ||
    "";

  const displayStatus =
    getCompactDisplayStatus(
      internalStatus,
      separationReason,
      separationRemarks
    );

  const employeeName =
    deployment.employee ||
    deployment.employeeName ||
    deployment.employee_name ||
    "Deployment";

  const employeeId =
    deployment.employeeId ||
    deployment.employee_id ||
    deployment.id ||
    "-";

  const employeeInitials =
    getEmployeeInitials(
      employeeName
    );

  const employeePosition =
    getEmployeePosition(
      deployment
    );

  const deploymentStartDate =
    deployment.contractStart ||
    deployment.start;

  const separationDate =
    deployment.separationDate ||
    deployment.contractEnd;

  const hasSeparationDate =
    Boolean(
      separationDate &&
      separationDate !==
        "-"
    );

  const hasEnded =
    internalStatus !==
    "Active";

  const timelineInfo =
    getDeploymentTimelineInfo(
      deploymentStartDate,
      separationDate
    );

  const isAttention =
    isAttentionStatus(
      displayStatus
    );

  const handleClose =
    () => {
      close?.();
    };

  return (
    <Dialog
      open
      onClose={handleClose}
      title={`${employeeName} deployment record`}
      description="Employee deployment information."
      size="lg"
      showHeader={false}
      showCloseButton={false}
      closeOnOverlay
      closeOnEscape
      scrollBody={false}
      bodyClassName="p-0"
    >
      <div className="flex min-h-0 flex-col">
        <header className="shrink-0 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {employeeInitials}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  {employeeName}
                </h2>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {employeeId}
                  </span>

                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      getStatusBadgeClass(
                        internalStatus,
                        separationReason,
                        separationRemarks
                      ),
                    ].join(
                      " "
                    )}
                  >
                    {isAttention && (
                      <FiAlertTriangle
                        size={11}
                        aria-hidden="true"
                      />
                    )}

                    {displayStatus}
                  </span>

                  {deployment.employmentType && (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {
                        deployment.employmentType
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            <IconButton
              label="Close deployment details"
              title="Close"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <FiX
                aria-hidden="true"
              />
            </IconButton>
          </div>
        </header>

        <div className="max-h-[68vh] space-y-3.5 overflow-y-auto px-4 py-4 text-slate-900 dark:text-white sm:px-5">
          <section>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <CompactInfoItem
                icon={
                  <FiCalendar
                    size={14}
                    aria-hidden="true"
                  />
                }
                label="Deployment Date"
                value={
                  formatLongDisplayDate(
                    deploymentStartDate
                  )
                }
              />

              <CompactInfoItem
                icon={
                  <FiBriefcase
                    size={14}
                    aria-hidden="true"
                  />
                }
                label="Position"
                value={
                  employeePosition
                }
              />

              <CompactInfoItem
                icon={
                  <FiBriefcase
                    size={14}
                    aria-hidden="true"
                  />
                }
                label="Client Company"
                value={
                  deployment.company ||
                  "Not recorded"
                }
              />

              <CompactInfoItem
                icon={
                  <FiMapPin
                    size={14}
                    aria-hidden="true"
                  />
                }
                label="Client Site"
                value={
                  deployment.location ||
                  "Not recorded"
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start gap-2.5">
              <FiCalendar
                className="mt-0.5 shrink-0 text-slate-400"
                size={14}
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  Deployment Period
                </p>

                <p className="mt-1 text-sm font-semibold leading-5 text-slate-700 dark:text-slate-200">
                  {timelineInfo}
                </p>

                <div className="mt-1.5">
                  <DeploymentStatusMessage
                    status={
                      displayStatus
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {hasEnded && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Separation Details
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <CompactInfoItem
                  icon={
                    <FiCalendar
                      size={14}
                      aria-hidden="true"
                    />
                  }
                  label="Separation Date"
                  value={
                    hasSeparationDate
                      ? formatLongDisplayDate(
                          separationDate
                        )
                      : "Not recorded"
                  }
                />

                <CompactInfoItem
                  icon={
                    <FiAlertTriangle
                      size={14}
                      aria-hidden="true"
                    />
                  }
                  label="Separation Reason"
                  value={
                    separationReason ||
                    displayStatus ||
                    "Ended"
                  }
                />

                {separationRemarks && (
                  <div className="sm:col-span-2">
                    <CompactInfoItem
                      icon={
                        <FiUser
                          size={14}
                          aria-hidden="true"
                        />
                      }
                      label="Remarks"
                      value={
                        cleanSeparationRemarks(
                          separationRemarks
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {isAttention && (
            <div
              className={[
                "rounded-xl border px-3.5 py-2.5",
                getStatusNoticeClass(
                  displayStatus
                ),
              ].join(
                " "
              )}
            >
              <div className="flex items-start gap-2">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  size={14}
                  aria-hidden="true"
                />

                <p className="text-xs font-medium leading-5">
                  {
                    STATUS_MESSAGES[
                      displayStatus
                    ]?.message ||
                    "This deployment has ended."
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
          >
            Close
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}