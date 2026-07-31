import { useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
} from "../../../utils/kpi/kpiHelpers";

import {
  useDeleteKPIDecisionMutation,
  useKPIDecisionHistoryQuery,
} from "../../../hooks/useKPIDecisionQueries";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDecisionTypeClasses(type) {
  switch (type) {
    case "Accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300";
    case "Modified":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300";
    case "Rejected":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300";
  }
}

function getDecisionIcon(type) {
  switch (type) {
    case "Accepted":
      return <FiCheckCircle size={12} />;
    case "Modified":
      return <FiEdit3 size={12} />;
    case "Rejected":
      return <FiXCircle size={12} />;
    default:
      return <FiFileText size={12} />;
  }
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

function HistoryCard({ record, onDelete, isDeleting }) {
  const decisionType = record.decisionType || "Recorded";

  const decisionConfidence =
    record.decisionConfidence || DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    record.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {getInitials(record.employeeName)}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {record.employeeName || "Unknown Employee"}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ID: {formatEmployeeId(record.employeeId)} •{" "}
              {record.company || "Unassigned"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge className={getDecisionTypeClasses(decisionType)}>
                {getDecisionIcon(decisionType)}
                {decisionType}
              </StatusBadge>

              <StatusBadge
                className={getDecisionConfidenceClasses(decisionConfidence)}
              >
                <FiZap size={12} />
                {decisionConfidence}
              </StatusBadge>

              <StatusBadge
                className={getSuggestedHRActionClasses(suggestedHRAction)}
              >
                <FiShield size={12} />
                {suggestedHRAction}
              </StatusBadge>

              <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <FiClock size={12} />
                {formatDateTime(record.decidedAt)}
              </StatusBadge>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(record.id)}
          disabled={isDeleting}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/40"
          title="Remove decision history record"
        >
          <FiTrash2 />
          {isDeleting ? "Removing..." : "Remove"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            System Recommendation
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record.systemRecommendation || "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Final HR Action
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record.finalAction || "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Decided By
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record.decidedBy || "HR User"}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {record.decidedByRole || "Authorized User"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FiFileText />
          HR Notes
        </p>

        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          {record.notes || "No HR notes recorded."}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          Decision Basis Snapshot
        </p>

        <p className="line-clamp-3 text-sm leading-7 text-indigo-700/90 dark:text-indigo-300/90">
          {record.correctiveActionBasis ||
            record.suggestedHRActionReason ||
            record.decisionConfidenceReason ||
            record.recommendationReason ||
            "No decision basis snapshot available."}
        </p>
      </div>
    </article>
  );
}

export default function DecisionHistorySection() {
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("ALL");

  const {
    data: history = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useKPIDecisionHistoryQuery();

  const deleteDecisionMutation = useDeleteKPIDecisionMutation();

  const filteredHistory = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return history
      .filter((record) => {
        if (decisionFilter === "ALL") return true;
        return record.decisionType === decisionFilter;
      })
      .filter((record) => {
        if (!keyword) return true;

        return [
          record.employeeName,
          record.employeeId,
          record.company,
          record.decisionType,
          record.systemRecommendation,
          record.suggestedHRAction,
          record.finalAction,
          record.notes,
          record.decidedBy,
          record.decidedByRole,
          record.riskLevel,
          record.kpiLevel,
          record.decisionConfidence,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [history, search, decisionFilter]);

  const summary = useMemo(() => {
    return {
      total: history.length,
      accepted: history.filter((record) => record.decisionType === "Accepted")
        .length,
      modified: history.filter((record) => record.decisionType === "Modified")
        .length,
      rejected: history.filter((record) => record.decisionType === "Rejected")
        .length,
    };
  }, [history]);

  const handleDelete = async (recordId) => {
    await deleteDecisionMutation.mutateAsync(recordId);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
              <FiClock className="text-indigo-600 dark:text-indigo-300" />
              Decision History
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Stores reviewed HR decisions from the Recommendation Review queue for monitoring, reference, and employee case tracking.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800/70">
              <p className="text-[11px] font-extrabold uppercase">Total</p>
              <p className="mt-1 text-xl font-extrabold">{summary.total}</p>
            </div>

            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70">
              <p className="text-[11px] font-extrabold uppercase">
                Accepted
              </p>
              <p className="mt-1 text-xl font-extrabold">
                {summary.accepted}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
              <p className="text-[11px] font-extrabold uppercase">
                Modified
              </p>
              <p className="mt-1 text-xl font-extrabold">
                {summary.modified}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
              <p className="text-[11px] font-extrabold uppercase">
                Rejected
              </p>
              <p className="mt-1 text-xl font-extrabold">
                {summary.rejected}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_130px]">
          <div className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search decision history by employee, action, reviewer, notes..."
              className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          <select
            value={decisionFilter}
            onChange={(event) => setDecisionFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="ALL">All Decisions</option>
            <option value="Accepted">Accepted</option>
            <option value="Modified">Modified</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiRefreshCw />
            {isFetching ? "Syncing" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error.message || "Failed to load decision history."}
        </div>
      )}

      {deleteDecisionMutation.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {deleteDecisionMutation.error?.message ||
            "Failed to delete decision record."}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Loading decision history...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <FiFileText size={22} />
          </div>

          <p className="text-lg font-extrabold text-slate-800 dark:text-white">
            No decision history recorded yet.
          </p>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Decisions will appear here after HR accepts, modifies, or rejects a
            recommendation from the Recommendation Review tab.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredHistory.map((record) => (
            <HistoryCard
              key={record.id}
              record={record}
              onDelete={handleDelete}
              isDeleting={deleteDecisionMutation.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}