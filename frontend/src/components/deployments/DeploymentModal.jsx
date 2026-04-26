import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../context/useAuth";

function formatDisplayDate(dateValue) {
  if (!dateValue || dateValue === "-") return "Not Set";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusBadgeClass(status) {
  const styles = {
    Active:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    Completed:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
    Pending:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    Cancelled:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
  };

  return styles[status] || "bg-gray-100 text-gray-700 border border-gray-200";
}

function getTimelineInfo(start, end, status) {
  if (!start || start === "-") {
    return "Start date is not available.";
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return "Invalid start date.";
  }

  if (end && end !== "-") {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) {
      const diffDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays >= 0) {
        return `Deployment duration: ${diffDays + 1} day${
          diffDays + 1 > 1 ? "s" : ""
        }.`;
      }
    }
  }

  if (status === "Active") {
    return "Deployment is currently ongoing.";
  }

  if (status === "Cancelled") {
    return "Deployment was cancelled before completion.";
  }

  return "Deployment timeline is available.";
}

export default function DeploymentModal({
  deployment,
  close,
  mode,
  onUpdate,
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [form, setForm] = useState(null);

  const initialForm = useMemo(() => deployment || null, [deployment]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  if (!deployment || !form) return null;

  const isEdit = mode === "edit" && !isSuperAdmin;

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = () => {
    onUpdate(form);
    close();
  };

  const handleComplete = () => {
    onUpdate({
      ...form,
      status: "Completed",
      end: new Date().toISOString().split("T")[0],
    });
    close();
  };

  const handleCancelDeployment = () => {
    onUpdate({
      ...form,
      status: "Cancelled",
      end: new Date().toISOString().split("T")[0],
    });
    close();
  };

  const employeeInitials = String(form.employee || "D")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const timelineInfo = getTimelineInfo(form.start, form.end, form.status);
  const isAttention =
    form.status === "Cancelled" || form.status === "Pending";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-gray-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xl font-bold">
                {employeeInitials || "D"}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {form.employee}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-700 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700">
                    {form.id}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                      form.status
                    )}`}
                  >
                    {form.status === "Cancelled" && (
                      <FiAlertTriangle className="text-sm" />
                    )}
                    {form.status}
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30">
                    Deployment Record
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={close}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 text-gray-900 dark:text-white">
          {isAttention && !isEdit && (
            <div
              className={`rounded-2xl p-5 border ${
                form.status === "Cancelled"
                  ? "border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30"
                  : "border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className={`mt-0.5 ${
                    form.status === "Cancelled"
                      ? "text-red-600 dark:text-red-300"
                      : "text-amber-600 dark:text-amber-300"
                  }`}
                  size={18}
                />
                <div>
                  <p
                    className={`font-semibold ${
                      form.status === "Cancelled"
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    Deployment Status Notice
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      form.status === "Cancelled"
                        ? "text-red-700/90 dark:text-red-200"
                        : "text-amber-700/90 dark:text-amber-200"
                    }`}
                  >
                    {form.status === "Cancelled"
                      ? "This deployment has been cancelled and is no longer active."
                      : "This deployment is pending further action."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Deployment Overview
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard
                icon={<FiUser size={16} />}
                label="Employee"
                value={form.employee}
              />
              <InfoCard
                icon={<FiBriefcase size={16} />}
                label="Company"
                value={form.company}
              />
              {isEdit ? (
              <InfoCard
                icon={<FiMapPin size={16} />}
                label="Location"
                value={form.location}
              />
              ) : (
                <InfoCard
                  icon={<FiMapPin size={16} />}
                  label="Location"
                  value={form.location}
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Timeline Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEdit ? (
                <EditableDateCard
                  icon={<FiCalendar size={16} />}
                  label="Start Date"
                  name="start"
                  value={form.start}
                  onChange={handleChange}
                />
              ) : (
                <InfoCard
                  icon={<FiCalendar size={16} />}
                  label="Start Date"
                  value={formatDisplayDate(form.start)}
                />
              )}

              {isEdit ? (
                <EditableDateCard
                  icon={<FiCalendar size={16} />}
                  label="End Date"
                  name="end"
                  value={form.end === "-" ? "" : form.end}
                  onChange={handleChange}
                />
              ) : (
                <InfoCard
                  icon={<FiCalendar size={16} />}
                  label="End Date"
                  value={formatDisplayDate(form.end)}
                />
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <FiClock size={16} />
                <span className="text-sm">Timeline Summary</span>
              </div>
              <p className="font-medium text-base">{timelineInfo}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Current Status
            </h3>

            <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <FiShield size={16} />
                <span className="text-sm">Deployment Status</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                    form.status
                  )}`}
                >
                  {form.status === "Cancelled" && (
                    <FiAlertTriangle className="text-sm" />
                  )}
                  {form.status}
                </span>

                {form.status === "Active" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-300">
                    <FiCheckCircle size={14} />
                    Deployment is active and ongoing
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-t border-gray-200 dark:border-white/10 flex flex-wrap justify-end gap-2 bg-white dark:bg-slate-900">
          {!isEdit ? (
            <>
              <button
                onClick={close}
                className="px-4 py-2 bg-gray-300 rounded-lg text-black hover:bg-gray-400 transition"
              >
                Close
              </button>

              {!isSuperAdmin && form.status !== "Completed" && form.status !== "Cancelled" && (
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Mark Completed
                </button>
              )}

              {!isSuperAdmin && form.status !== "Cancelled" && form.status !== "Completed" && (
                <button
                  onClick={handleCancelDeployment}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Cancel Deployment
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={close}
                className="px-4 py-2 bg-gray-300 rounded-lg text-black hover:bg-gray-400 transition"
              >
                Close
              </button>

              {!isSuperAdmin && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Save Changes
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-slate-900/40">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="font-semibold text-base text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

function EditableCard({ icon, label, name, value, onChange }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-slate-900/40">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <input
        name={name}
        value={value || ""}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      />
    </div>
  );
}

function EditableDateCard({ icon, label, name, value, onChange }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-slate-900/40">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <input
        type="date"
        name={name}
        value={value || ""}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      />
    </div>
  );
}