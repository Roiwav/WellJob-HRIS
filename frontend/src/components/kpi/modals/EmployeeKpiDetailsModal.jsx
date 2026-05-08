import {
  FiAlertCircle,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiEdit3,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiThumbsUp,
  FiUser,
  FiUsers,
  FiVideo,
  FiX,
  FiXCircle,
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
        {getDisplayValue(value)}
      </p>
    </div>
  );
}

function DecisionBadge({ icon, label, className }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold leading-5 ${className}`}
      title={label}
    >
      {icon}
      <span className="line-clamp-1">{label}</span>
    </span>
  );
}

function ExplanationBox({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
        {children}
      </p>
    </div>
  );
}

function ReviewActionButton({ icon, label, description, tone }) {
  const tones = {
    accept:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300",
    modify:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
    reject:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300",
  };

  return (
    <button
      type="button"
      disabled
      className={`rounded-2xl border p-4 text-left opacity-80 transition ${tones[tone]}`}
      title="This workflow will be connected in the Recommendation Review tab."
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold">
        {icon}
        {label}
      </div>

      <p className="text-xs font-medium leading-5 opacity-90">
        {description}
      </p>

      <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wide opacity-70">
        Workflow preview
      </p>
    </button>
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

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/50">
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
              KPI, Risk, and Decision Evaluation
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Decision Confidence
                </p>

                <DecisionBadge
                  icon={<FiZap size={13} />}
                  label={decisionConfidence}
                  className={getDecisionConfidenceClasses(decisionConfidence)}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Suggested Next Step
                </p>

                <DecisionBadge
                  icon={<FiShield size={13} />}
                  label={suggestedHRAction}
                  className={getSuggestedHRActionClasses(suggestedHRAction)}
                />
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

          <section className="grid gap-4 xl:grid-cols-2">
            <ExplanationBox title="Why this confidence level?">
              {decisionConfidenceReason}
            </ExplanationBox>

            <ExplanationBox title="Why this suggested next step?">
              {suggestedHRActionReason}
            </ExplanationBox>
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
              <div className="mb-3 flex flex-wrap items-center gap-2 font-extrabold">
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

          <section>
            <div className="mb-3 flex flex-col gap-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                HR Review Workflow Preview
              </h3>

              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                This shows how HR may validate the system-generated suggestion.
                Actual recording will be connected in the Recommendation Review
                tab.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <ReviewActionButton
                icon={<FiThumbsUp />}
                label="Accept Suggestion"
                tone="accept"
                description="Use when HR agrees with the system recommendation and wants to record it as the final action."
              />

              <ReviewActionButton
                icon={<FiEdit3 />}
                label="Modify Action"
                tone="modify"
                description="Use when HR agrees with the concern but chooses a different final action after review."
              />

              <ReviewActionButton
                icon={<FiXCircle />}
                label="Reject Suggestion"
                tone="reject"
                description="Use when HR does not follow the suggestion and must provide a reason for rejection."
              />
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
              <div className="mb-1 flex items-center gap-2 font-extrabold">
                <FiClipboard />
                Decision-support reminder
              </div>

              <p>
                The system recommends and explains the action, but the HR
                Manager remains responsible for the final decision.
              </p>
            </div>
          </section>

          {!isRetain && (
            <section>
              <div className="mb-3 flex flex-col gap-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Welljob Corrective Action Guide for This Employee
                </h3>

                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Available HR actions are shown below. The system marks the
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

        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Decision confidence and suggested next step are generated from
            recorded employee incidents, severity score, KPI level, and risk
            level.
          </p>

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