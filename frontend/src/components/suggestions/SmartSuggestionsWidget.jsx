import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClipboard,
  FiFilter,
  FiMessageCircle,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../../context/useAuth";
import useSmartSuggestions from "../../hooks/useSmartSuggestions";

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPriorityStyle(priority) {
  if (priority === "High") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300";
  }

  if (priority === "Medium") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300";
}

function getCategoryStyle(category) {
  if (category === "Workforce") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300";
  }

  if (category === "Incident Prevention") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300";
  }

  if (category === "Compliance") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (category === "Deployment") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function filterSuggestions(suggestions, activeFilter) {
  const items = Array.isArray(suggestions) ? [...suggestions] : [];

  if (activeFilter === "HIGH") {
    return items.filter(
      (item) => !item.isDismissed && item.priority === "High"
    );
  }

  if (activeFilter === "REVIEWED") {
    return items.filter((item) => !item.isDismissed && item.isReviewed);
  }

  if (activeFilter === "DISMISSED") {
    return items.filter((item) => item.isDismissed);
  }

  return items.filter((item) => !item.isDismissed);
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function SuggestionItem({ suggestion, onReview, onDismiss }) {
  const isReviewed = Boolean(suggestion.isReviewed);
  const isDismissed = Boolean(suggestion.isDismissed);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getPriorityStyle(
                suggestion.priority
              )}`}
            >
              {suggestion.priority || "Low"}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getCategoryStyle(
                suggestion.category
              )}`}
            >
              {suggestion.category || "General"}
            </span>

            {isReviewed && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                Reviewed
              </span>
            )}

            {isDismissed && (
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Dismissed
              </span>
            )}
          </div>

          <h3 className="text-sm font-black leading-5 text-slate-900 dark:text-white">
            {suggestion.title || "Smart Suggestion"}
          </h3>

          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {suggestion.company || "Company not specified"} •{" "}
            {formatDate(suggestion.generatedAt)}
          </p>
        </div>

        {suggestion.priority === "High" && (
          <div className="shrink-0 rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <FiAlertTriangle size={18} />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Issue
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {suggestion.issue || "No issue details available."}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Suggestion
          </p>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-900 dark:text-white">
            {suggestion.recommendation || "No suggestion available."}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Reason
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {suggestion.reason || "No reason available."}
          </p>
        </div>
      </div>

      {!isDismissed && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {!isReviewed && (
            <button
              type="button"
              onClick={() => onReview?.(suggestion)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            >
              <FiCheckCircle />
              Reviewed
            </button>
          )}

          <button
            type="button"
            onClick={() => onDismiss?.(suggestion)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <FiTrash2 />
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}

export default function SmartSuggestionsWidget() {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL");

  const {
    canView,
    suggestions,
    summary,
    isLoading,
    isFetching,
    error,
    refresh,
    markSuggestionReviewed,
    dismissSuggestion,
  } = useSmartSuggestions(user, {
    pollInterval: 15000,
  });

  const visibleSuggestions = useMemo(() => {
    return filterSuggestions(suggestions, activeFilter);
  }, [suggestions, activeFilter]);

  const activeCount = Number(summary?.active || 0);
  const highCount = Number(summary?.high || 0);

  const handleReview = async (suggestion) => {
    if (!suggestion?.suggestionKey) return;
    await markSuggestionReviewed(suggestion.suggestionKey);
  };

  const handleDismiss = async (suggestion) => {
    if (!suggestion?.suggestionKey) return;
    await dismissSuggestion(suggestion.suggestionKey);
  };

  if (!canView) return null;

  return (
    <>
      <div className="fixed bottom-24 right-6 z-[1100]">
        <div className="group relative flex items-center">
          <div className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
            Smart Suggestions
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-700"
            title="Smart Suggestions"
          >
            <FiMessageCircle size={24} />

            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}

            {highCount > 0 && (
              <span className="absolute -left-1 -top-1 h-4 w-4 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[1150] flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b border-slate-200 p-5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                    <FiClipboard className="text-indigo-600" />
                    Smart Suggestions
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    HR recommendations generated from workforce and incident
                    patterns.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close Smart Suggestions"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={activeFilter === "ALL"}
                    onClick={() => setActiveFilter("ALL")}
                  >
                    All
                  </FilterButton>

                  <FilterButton
                    active={activeFilter === "HIGH"}
                    onClick={() => setActiveFilter("HIGH")}
                  >
                    High
                  </FilterButton>

                  <FilterButton
                    active={activeFilter === "REVIEWED"}
                    onClick={() => setActiveFilter("REVIEWED")}
                  >
                    Reviewed
                  </FilterButton>

                  <FilterButton
                    active={activeFilter === "DISMISSED"}
                    onClick={() => setActiveFilter("DISMISSED")}
                  >
                    Dismissed
                  </FilterButton>
                </div>

                <button
                  type="button"
                  onClick={() => refresh()}
                  disabled={isFetching}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
                >
                  <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
                  Sync
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Loading smart suggestions...
                </div>
              ) : visibleSuggestions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <FiFilter size={22} />
                  </div>

                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    No suggestions found
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Suggestions will appear when the system detects workforce,
                    incident, deployment, or compliance patterns.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleSuggestions.map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.suggestionKey}
                      suggestion={suggestion}
                      onReview={handleReview}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                These are rule-based suggestions only. Final action still
                depends on HR or authorized management review.
              </p>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}