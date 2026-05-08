import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiSearch,
  FiShield,
  FiThumbsUp,
  FiX,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  RECOMMENDATION_LABELS,
  WELLJOB_LOW_KPI_ACTIONS,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
} from "../../../utils/kpi/kpiHelpers";

import {
  useCreateKPIDecisionMutation,
  useKPIDecisionHistoryQuery,
} from "../../../hooks/useKPIDecisionQueries";

const FINAL_ACTION_OPTIONS = Array.from(
  new Set([
    RECOMMENDATION_LABELS.RETAIN,
    ...WELLJOB_LOW_KPI_ACTIONS.map((action) => action.title),
    ...Object.values(HR_ACTION_WORKFLOW),
    "Suspension Review",
    "Termination Review",
    "No Action Required",
  ])
);

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isPendingRecommendation(employee) {
  const recommendation = String(employee?.recommendation || "");
  const suggestedHRAction =
    employee?.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

  const hasConcern =
    Number(employee?.violationCount || 0) > 0 ||
    Number(employee?.criticalIncidentCount || 0) > 0 ||
    employee?.riskLevel === "High Risk" ||
    employee?.riskLevel === "Repeat";

  const isRetain =
    recommendation === RECOMMENDATION_LABELS.RETAIN ||
    recommendation === "Retain" ||
    recommendation === "Retain / Maintain Good Standing";

  return (
    hasConcern &&
    (!isRetain || suggestedHRAction !== HR_ACTION_WORKFLOW.MONITOR)
  );
}

function StatusBadge({ children, className }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${className}`}
    >
      {children}
    </span>
  );
}

function DecisionModal({ employee, mode, user, onClose, onSaved }) {
  const createDecisionMutation = useCreateKPIDecisionMutation();

  const systemRecommendation =
    employee?.recommendation || RECOMMENDATION_LABELS.RETAIN;

  const systemSuggestedAction =
    employee?.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

  const [finalAction, setFinalAction] = useState(
    mode === "reject"
      ? "No Action Required"
      : mode === "modify"
      ? systemRecommendation
      : systemSuggestedAction
  );

  const [notes, setNotes] = useState("");

  const modeConfig = {
    accept: {
      title: "Accept System Suggestion",
      icon: <FiThumbsUp />,
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300",
      button: "Accept Recommendation",
      decisionType: "Accepted",
    },
    modify: {
      title: "Modify Final HR Action",
      icon: <FiEdit3 />,
      tone:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
      button: "Save Modified Action",
      decisionType: "Modified",
    },
    reject: {
      title: "Reject System Suggestion",
      icon: <FiXCircle />,
      tone:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300",
      button: "Reject Recommendation",
      decisionType: "Rejected",
    },
  };

  const config = modeConfig[mode] || modeConfig.accept;
  const isRejectMissingNotes = mode === "reject" && !notes.trim();

  const handleSave = async () => {
    if (isRejectMissingNotes || createDecisionMutation.isPending) return;

    const payload = {
      employeeId: employee.id,
      employeeName: employee.name,
      company: employee.company || "Unassigned",

      riskLevel: employee.riskLevel || "Low Risk",
      kpiLevel: employee.kpiLevel || "Good Standing",
      violationCount: Number(employee.violationCount || 0),
      severityScore: Number(employee.severityScore || 0),
      criticalIncidentCount: Number(employee.criticalIncidentCount || 0),

      decisionConfidence:
        employee.decisionConfidence || DECISION_CONFIDENCE.LOW,
      suggestedHRAction: systemSuggestedAction,
      systemRecommendation,
      finalAction,
      decisionType: config.decisionType,

      notes:
        notes.trim() ||
        `${config.decisionType} based on HR review of the system-generated recommendation.`,
      decidedBy: user?.name || user?.username || "HR User",
      decidedByRole: user?.role || "Authorized User",

      recommendationReason:
        employee.recommendationReason ||
        employee.correctiveActionReason ||
        "",
      decisionConfidenceReason: employee.decisionConfidenceReason || "",
      suggestedHRActionReason: employee.suggestedHRActionReason || "",
      correctiveActionBasis: employee.correctiveActionBasis || "",
    };

    const result = await createDecisionMutation.mutateAsync(payload);
    onSaved(result?.record || result);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`border-b px-6 py-5 ${config.tone}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-lg dark:bg-slate-950/30">
                {config.icon}
              </div>

              <div>
                <h3 className="text-lg font-extrabold">{config.title}</h3>
                <p className="mt-1 text-xs font-semibold opacity-80">
                  This records HR validation of the system-generated
                  recommendation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 transition hover:bg-white/50 dark:hover:bg-slate-800"
              aria-label="Close decision modal"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {getInitials(employee.name)}
              </div>

              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  {employee.name}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Employee ID: {formatEmployeeId(employee.id)} •{" "}
                  {employee.company || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  System Recommendation
                </p>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {systemRecommendation}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  Suggested Next Step
                </p>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {systemSuggestedAction}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Final HR Action
            </label>

            <select
              value={finalAction}
              onChange={(event) => setFinalAction(event.target.value)}
              disabled={mode === "accept"}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-800"
            >
              {FINAL_ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            {mode === "accept" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Accepted recommendations use the system suggested next step as
                the final HR action.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              HR Notes {mode === "reject" ? "(Required)" : "(Optional)"}
            </label>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder={
                mode === "reject"
                  ? "Explain why HR rejected the system suggestion..."
                  : "Add HR validation notes..."
              }
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          {isRejectMissingNotes && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
              Rejection requires HR notes for accountability.
            </div>
          )}

          {createDecisionMutation.isError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
              {createDecisionMutation.error?.message ||
                "Failed to save KPI decision."}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={createDecisionMutation.isPending}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isRejectMissingNotes || createDecisionMutation.isPending}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createDecisionMutation.isPending ? "Saving..." : config.button}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationReviewSection({
  employees = [],
  user,
  onDecisionSaved,
}) {
  const [search, setSearch] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);

  const {
    data: decisionHistory = [],
    isLoading: isHistoryLoading,
    error: historyError,
  } = useKPIDecisionHistoryQuery();

  const decidedEmployeeIds = useMemo(() => {
    return new Set(decisionHistory.map((record) => String(record.employeeId)));
  }, [decisionHistory]);

  const pendingEmployees = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return employees
      .filter(isPendingRecommendation)
      .filter((employee) => !decidedEmployeeIds.has(String(employee.id)))
      .filter((employee) => {
        if (!keyword) return true;

        return [
          employee.name,
          employee.id,
          employee.company,
          employee.kpiLevel,
          employee.riskLevel,
          employee.decisionConfidence,
          employee.suggestedHRAction,
          employee.recommendation,
          employee.recommendationReason,
          employee.suggestedHRActionReason,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        const scoreA =
          Number(a.severityScore || 0) +
          Number(a.violationCount || 0) +
          Number(a.criticalIncidentCount || 0) * 3;

        const scoreB =
          Number(b.severityScore || 0) +
          Number(b.violationCount || 0) +
          Number(b.criticalIncidentCount || 0) * 3;

        return scoreB - scoreA;
      });
  }, [employees, search, decidedEmployeeIds]);

  const handleSaved = (record) => {
    setSelectedReview(null);
    onDecisionSaved?.(record);
  };

  return (
    <>
      <section className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
                <FiShield className="text-indigo-600 dark:text-indigo-300" />
                Recommendation Review Queue
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                HR validates system-generated recommendations here. Accepted, modified, or rejected decisions will appear in Decision History.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Pending
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {pendingEmployees.length}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Recorded
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {decisionHistory.length}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Review
                </p>
                <p className="mt-1 text-xl font-extrabold">HR</p>
              </div>
            </div>
          </div>

          <div className="relative mt-5">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pending recommendation by employee, action, confidence, risk..."
              className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>

        {historyError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
            {historyError.message || "Failed to load decision history."}
          </div>
        )}

        {isHistoryLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Loading recommendation review queue...
          </div>
        ) : pendingEmployees.length === 0 ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <FiCheckCircle size={22} />
            </div>

            <p className="text-lg font-extrabold">
              No pending recommendations for HR review.
            </p>

            <p className="mt-2 text-sm font-medium opacity-80">
              Accepted, modified, or rejected items are removed from this queue
              and will appear in Decision History.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingEmployees.map((employee) => {
              const confidence =
                employee.decisionConfidence || DECISION_CONFIDENCE.LOW;

              const suggestedHRAction =
                employee.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

              return (
                <article
                  key={employee.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {getInitials(employee.name)}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {employee.name || "Unknown Employee"}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ID: {formatEmployeeId(employee.id)} •{" "}
                          {employee.company || "Unassigned"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge
                            className={getDecisionConfidenceClasses(
                              confidence
                            )}
                          >
                            <FiZap size={12} />
                            {confidence}
                          </StatusBadge>

                          <StatusBadge
                            className={getSuggestedHRActionClasses(
                              suggestedHRAction
                            )}
                          >
                            <FiShield size={12} />
                            {suggestedHRAction}
                          </StatusBadge>

                          <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                            <FiAlertCircle size={12} />
                            {employee.violationCount || 0} violation(s)
                          </StatusBadge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReview({ employee, mode: "accept" })
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                      >
                        <FiThumbsUp />
                        Accept
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReview({ employee, mode: "modify" })
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
                      >
                        <FiEdit3 />
                        Modify
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReview({ employee, mode: "reject" })
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
                      >
                        <FiXCircle />
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <FiFileText />
                        Recommendation Reason
                      </p>

                      <p className="line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {employee.recommendationReason ||
                          employee.correctiveActionReason ||
                          "No recommendation reason available."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <FiClock />
                        Next Step Reason
                      </p>

                      <p className="line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {employee.suggestedHRActionReason ||
                          employee.decisionConfidenceReason ||
                          "No next-step reason available."}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedReview && (
        <DecisionModal
          employee={selectedReview.employee}
          mode={selectedReview.mode}
          user={user}
          onClose={() => setSelectedReview(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}