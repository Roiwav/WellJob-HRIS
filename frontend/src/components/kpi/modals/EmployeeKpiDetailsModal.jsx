import {
  FiAlertCircle,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiUser,
  FiUsers,
  FiVideo,
  FiX,
} from "react-icons/fi";

import KPIBadge from "../badges/KPIBadge";
import RiskBadge from "../badges/RiskBadge";
import { WELLJOB_LOW_KPI_ACTIONS } from "../../../utils/kpi/kpiHelpers";

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

function getActionIcon(code) {
  switch (code) {
    case "VERBAL_COUNSELING":
      return <FiMessageSquare />;
    case "PERFORMANCE_IMPROVEMENT_PLAN":
      return <FiTarget />;
    case "REASSIGNMENT_OF_POSITION":
      return <FiRefreshCw />;
    case "SEMINAR_WEBINAR":
      return <FiVideo />;
    case "EMPLOYEE_TRAINING":
      return <FiUsers />;
    default:
      return <FiShield />;
  }
}

function getActionClasses(code, isRecommended) {
  if (isRecommended) {
    return "border-amber-400 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  }

  switch (code) {
    case "VERBAL_COUNSELING":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300";
    case "PERFORMANCE_IMPROVEMENT_PLAN":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300";
    case "REASSIGNMENT_OF_POSITION":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300";
    case "SEMINAR_WEBINAR":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "EMPLOYEE_TRAINING":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300";
  }
}

function ActionGuideCard({ action, isRecommended = false }) {
  return (
    <div
      className={`min-h-[165px] rounded-2xl border p-4 transition ${getActionClasses(
        action.code,
        isRecommended
      )}`}
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-lg dark:bg-slate-950/30">
            {getActionIcon(action.code)}
          </div>

          {isRecommended && (
            <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-900 dark:bg-amber-900 dark:text-amber-200">
              Recommended
            </span>
          )}
        </div>

        <h4 className="text-sm font-extrabold">{action.title}</h4>

        <p className="mt-2 text-xs font-medium leading-5 opacity-90">
          {action.shortDescription ||
            "Recommended corrective action based on KPI indicators."}
        </p>
      </div>
    </div>
  );
}

export default function EmployeeKpiDetailsModal({ employee, onClose }) {
  if (!employee) return null;

  const recommendation =
  employee.recommendation || "Retain / Maintain Good Standing";
const correctiveActionCode = employee.correctiveActionCode || "RETAIN";
const isRetain =
  correctiveActionCode === "RETAIN" ||
  recommendation === "Retain" ||
  recommendation === "Retain / Maintain Good Standing";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
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

                <KPIBadge level={employee.kpiLevel || "Good Standing"} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Risk Level
                </p>

                <RiskBadge level={employee.riskLevel || "Low Risk"} />
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
              Recommended HR Action
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
                {employee.correctiveActionReason ||
                  employee.recommendationReason ||
                  "No recommendation reason available."}
              </p>

              <div className="mt-4 rounded-xl bg-white/60 p-3 text-xs font-semibold leading-5 dark:bg-slate-950/30">
                <span className="font-extrabold">Basis: </span>
                {employee.correctiveActionBasis ||
                  "Based on KPI level, violation count, severity score, and risk level."}
              </div>
            </div>
          </section>

          {!isRetain && (
            <section>
              <div className="mb-3 flex flex-col gap-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Welljob Corrective Action Guide for This Employee
                </h3>

                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  All available HR actions are shown below. The system marks the
                  most suitable recommendation based on the employee KPI record.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {WELLJOB_LOW_KPI_ACTIONS.map((action) => (
                  <ActionGuideCard
                    key={action.code}
                    action={action}
                    isRecommended={action.code === correctiveActionCode}
                  />
                ))}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                These actions are system-generated recommendation guides only.
                The final action remains under HR and management review.
              </p>
            </section>
          )}
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