import { useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../../../context/useAuth";
import {
  formatLongDisplayDate,
  getContractTimelineInfo,
  getStatusBadgeClass,
} from "../../../utils/deployments/deploymentHelpers";
import {
  DeploymentInfoCard,
  ConfirmDeploymentActionModal,
} from "../shared/DeploymentModalUI";

export default function DeploymentModal({ deployment, close, mode, onUpdate }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [confirmAction, setConfirmAction] = useState(null);

  if (!deployment) return null;

  const form = deployment;

  const isEdit = mode === "edit" && !isSuperAdmin;
  const isActive = form.status === "Active";
  const isAttention = form.status === "Cancelled" || form.status === "Pending";

  const employeeInitials = String(form.employee || "D")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const timelineInfo = getContractTimelineInfo(
    form.contractStart || form.start,
    form.contractEnd,
    form.employmentType
  );

  const handleClose = () => {
    setConfirmAction(null);
    close();
  };

  const handleSave = () => {
    onUpdate(form);
    handleClose();
  };

  const handleComplete = () => {
    setConfirmAction("complete");
  };

  const handleCancelDeployment = () => {
    setConfirmAction("cancel");
  };

  const handleConfirmAction = () => {
    if (confirmAction === "complete") {
      onUpdate({
        ...form,
        status: "Completed",
      });
    }

    if (confirmAction === "cancel") {
      onUpdate({
        ...form,
        status: "Cancelled",
      });
    }

    setConfirmAction(null);
    close();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:h-[88vh]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {employeeInitials || "D"}
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {form.employee}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
                      {form.id}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        form.status
                      )}`}
                    >
                      {form.status === "Cancelled" && (
                        <FiAlertTriangle className="text-sm" />
                      )}
                      {form.status}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300">
                      {form.employmentType || "Permanent"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close deployment modal"
              >
                <FiX size={22} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 text-gray-900 dark:text-white sm:px-6 sm:py-6 lg:px-8">
            {isAttention && !isEdit && (
              <div
                className={`rounded-2xl border p-5 ${
                  form.status === "Cancelled"
                    ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="mt-0.5" size={18} />
                  <div>
                    <p className="font-semibold">Deployment Status Notice</p>
                    <p className="mt-1 text-sm">
                      {form.status === "Cancelled"
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
                  icon={<FiUser size={16} />}
                  label="Employee"
                  value={form.employee}
                />

                <DeploymentInfoCard
                  icon={<FiBriefcase size={16} />}
                  label="Company"
                  value={form.company}
                />

                <DeploymentInfoCard
                  icon={<FiMapPin size={16} />}
                  label="Location"
                  value={form.location}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Contract Information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DeploymentInfoCard
                  icon={<FiCalendar size={16} />}
                  label="Contract Start"
                  value={formatLongDisplayDate(form.contractStart || form.start)}
                />

                <DeploymentInfoCard
                  icon={<FiCalendar size={16} />}
                  label="Contract End"
                  value={formatLongDisplayDate(form.contractEnd)}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <FiClock size={16} />
                  <span className="text-sm">Timeline Summary</span>
                </div>

                <p className="text-base font-medium">{timelineInfo}</p>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current Status
              </h3>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <FiShield size={16} />
                  <span className="text-sm">Deployment Status</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                      form.status
                    )}`}
                  >
                    {form.status}
                  </span>

                  {form.status === "Active" && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-300">
                      <FiCheckCircle size={14} />
                      Deployment is active and ongoing
                    </span>
                  )}

                  {form.status === "Completed" && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300">
                      <FiCheckCircle size={14} />
                      Deployment has been completed
                    </span>
                  )}

                  {form.status === "Cancelled" && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-300">
                      <FiAlertTriangle size={14} />
                      Deployment has been cancelled
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-gray-300 px-4 py-2 text-black transition hover:bg-gray-400"
            >
              Close
            </button>

            {!isEdit && !isSuperAdmin && isActive && (
              <>
                <button
                  type="button"
                  onClick={handleComplete}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
                >
                  Mark Completed
                </button>

                <button
                  type="button"
                  onClick={handleCancelDeployment}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
                >
                  Cancel Deployment
                </button>
              </>
            )}

            {isEdit && !isSuperAdmin && (
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmAction && (
        <ConfirmDeploymentActionModal
          action={confirmAction}
          employee={form.employee}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </>
  );
}