import {
  FiAlertCircle,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiFileText,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";
import KPIBadge from "../badges/KPIBadge";
import RiskBadge from "../badges/RiskBadge";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function DetailCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

export default function EmployeeKpiDetailsModal({ employee, onClose }) {
  if (!employee) return null;

  const recommendation = employee.recommendation || "Retain";
  const isRetain = recommendation === "Retain";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-5 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-extrabold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <FiUser />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">
                  {employee.name || "Unknown Employee"}
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Employee ID: {formatEmployeeId(employee.id)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close KPI details"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee Overview
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DetailCard
                icon={<FiBriefcase />}
                label="Company"
                value={employee.company || "Unassigned"}
              />
              <DetailCard
                icon={<FiUser />}
                label="Status"
                value={employee.status || "Unknown"}
              />
              <DetailCard
                icon={<FiFileText />}
                label="Violations"
                value={employee.violationCount || 0}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              KPI and Risk Evaluation
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  KPI Level
                </p>
                <KPIBadge level={employee.kpiLevel || "Clean"} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Risk Level
                </p>
                <RiskBadge level={employee.riskLevel || "Clean"} />
              </div>

              <DetailCard
                icon={<FiBarChart2 />}
                label="Severity Score"
                value={employee.severityScore || 0}
              />

              <DetailCard
                icon={<FiAlertCircle />}
                label="Critical Cases"
                value={employee.criticalIncidentCount || 0}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Decision Support Recommendation
            </h3>

            <div
              className={`rounded-2xl border p-5 ${
                isRetain
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300"
              }`}
            >
              <div className="mb-3 flex items-center gap-2 font-extrabold">
                {isRetain ? <FiCheckCircle /> : <FiShield />}
                {recommendation}
              </div>

              <p className="text-sm leading-7">
                {employee.recommendationReason ||
                  "No recommendation reason available."}
              </p>
            </div>
          </section>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 text-right dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}