import {
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiUser,
  FiUsers,
  FiVideo,
  FiX,
  FiZap,
} from "react-icons/fi";

import KPIBadge from "../badges/KPIBadge";
import RiskBadge from "../badges/RiskBadge";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  WELLJOB_LOW_KPI_ACTIONS,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
} from "../../../utils/kpi/kpiHelpers";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function getDisplayValue(value) {
  if (value === 0) return 0;
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CompactInfo({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>

      <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">
        {getDisplayValue(value)}
      </p>
    </div>
  );
}

function DecisionBadge({ icon, label, className }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black leading-5 ${className}`}
      title={label}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function DecisionExplanationPanel({
  decisionBasis,
  confidenceReason,
  suggestedStepReason,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <FiClipboard className="text-indigo-500 dark:text-indigo-300" />
          Decision Explanation
        </h3>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Explains the basis, confidence level, and suggested HR step generated
          by the system.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <p className="text-[11px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Main Decision Basis
          </p>

          <p className="mt-2 text-sm leading-6 text-indigo-700/90 dark:text-indigo-200/90">
            {decisionBasis}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FiZap />
              Confidence Reason
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {confidenceReason}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FiShield />
              Suggested Step Reason
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {suggestedStepReason}
            </p>
          </div>
        </div>
      </div>
    </section>
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

function ActionChip({ action, isRecommended = false }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2 ${
        isRecommended
          ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{getActionIcon(action.code)}</span>

        <p className="truncate text-xs font-black">{action.title}</p>

        {isRecommended && (
          <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-black uppercase text-amber-900 dark:bg-amber-900 dark:text-amber-200">
            Suggested
          </span>
        )}
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

  const decisionConfidence =
    employee.decisionConfidence || DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    employee.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

  const decisionConfidenceReason =
    employee.decisionConfidenceReason ||
    "Decision confidence is based on incident count, severity score, critical cases, and risk level.";

  const suggestedHRActionReason =
    employee.suggestedHRActionReason ||
    "Suggested HR action is generated from the employee KPI evaluation and still requires HR validation.";

  const recommendationReason =
    employee.correctiveActionReason ||
    employee.recommendationReason ||
    "No recommendation reason available.";

  const correctiveActionBasis =
    employee.correctiveActionBasis ||
    "Based on KPI level, violation count, severity score, and risk level.";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {getInitials(employee.name)}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-slate-900 dark:text-white">
                  {employee.name || "Unknown Employee"}
                </h2>

                <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Employee ID: {formatEmployeeId(employee.id)} •{" "}
                  {employee.company || "Unassigned"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close KPI details"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid gap-3 md:grid-cols-4">
            <CompactInfo
              icon={<FiBriefcase />}
              label="Company"
              value={employee.company || "Unassigned"}
            />

            <CompactInfo
              icon={<FiUser />}
              label="Status"
              value={employee.status || "Unknown"}
            />

            <CompactInfo
              icon={<FiFileText />}
              label="Violations"
              value={employee.violationCount || 0}
            />

            <CompactInfo
              icon={<FiBarChart2 />}
              label="Severity Score"
              value={employee.severityScore || 0}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="mb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                KPI Decision Summary
              </h3>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                System-generated evaluation for HR review.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  KPI Level
                </p>
                <KPIBadge level={employee.kpiLevel || "Good Standing"} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Risk Level
                </p>
                <RiskBadge level={employee.riskLevel || "Low Risk"} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Confidence
                </p>

                <DecisionBadge
                  icon={<FiZap size={12} />}
                  label={decisionConfidence}
                  className={getDecisionConfidenceClasses(decisionConfidence)}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Suggested Step
                </p>

                <DecisionBadge
                  icon={<FiShield size={12} />}
                  label={suggestedHRAction}
                  className={getSuggestedHRActionClasses(suggestedHRAction)}
                />
              </div>
            </div>
          </section>

          <section
            className={`rounded-3xl border p-4 ${
              isRetain
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide opacity-80">
                  Recommended HR Action
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-black">
                  {isRetain ? <FiCheckCircle /> : <FiShield />}
                  {recommendation}
                </div>
              </div>

              <span className="w-fit rounded-full bg-white/60 px-3 py-1 text-[10px] font-black uppercase dark:bg-slate-950/30">
                System suggestion
              </span>
            </div>

            <p className="mt-3 text-sm leading-6">{recommendationReason}</p>
          </section>

          <DecisionExplanationPanel
            decisionBasis={correctiveActionBasis}
            confidenceReason={decisionConfidenceReason}
            suggestedStepReason={suggestedHRActionReason}
          />

          {!isRetain && (
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="mb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Corrective Action Guide
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  The suggested action is highlighted for HR reference.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {WELLJOB_LOW_KPI_ACTIONS.map((action) => (
                  <ActionChip
                    key={action.code}
                    action={action}
                    isRecommended={action.code === correctiveActionCode}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
            <div className="mb-1 flex items-center gap-2 font-black">
              <FiClipboard />
              Decision-support reminder
            </div>

            <p className="text-xs leading-5">
              The system recommends and explains the action, but the HR Manager
              remains responsible for the final decision.
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-800">
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