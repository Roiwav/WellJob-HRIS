import { useMemo, useState } from "react";
import { FiBell, FiFilter, FiMessageCircle, FiRefreshCw, FiX } from "react-icons/fi";

import { useAuth } from "../../context/useAuth";
import useSmartSuggestions from "../../hooks/useSmartSuggestions";

const MAX_VISIBLE_SUGGESTIONS = 5;

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

function getSuggestionTypeLabel(category) {
  if (category === "Workforce") return "Workforce advisory";
  if (category === "Incident Prevention") return "Prevention advisory";
  if (category === "Compliance") return "Compliance advisory";
  if (category === "Deployment") return "Deployment advisory";
  return "HR advisory";
}

function sortSuggestions(items) {
  const priorityRank = {
    High: 3,
    Medium: 2,
    Low: 1,
  };

  return [...items].sort((a, b) => {
    const rankA = priorityRank[a?.priority] || 0;
    const rankB = priorityRank[b?.priority] || 0;

    if (rankB !== rankA) return rankB - rankA;

    const timeA = new Date(a?.generatedAt || a?.timestamp || 0).getTime();
    const timeB = new Date(b?.generatedAt || b?.timestamp || 0).getTime();

    return timeB - timeA;
  });
}

function SuggestionItem({ suggestion }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-900/70">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
          <FiBell size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {getSuggestionTypeLabel(suggestion.category)}
            </span>

            <span className="text-[10px] font-semibold text-slate-400">
              {formatDate(suggestion.generatedAt)}
            </span>
          </div>

          <h3 className="mt-2 text-sm font-black leading-5 text-slate-900 dark:text-white">
            {suggestion.title || "Smart Suggestion"}
          </h3>

          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {suggestion.company || "Company not specified"}
          </p>

          <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {suggestion.issue || "The system detected a possible HR concern based on current records."}
          </p>

          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
            <p className="text-xs font-semibold leading-5 text-slate-900 dark:text-white">
              {suggestion.recommendation || "HR may review this record for possible next steps."}
            </p>

            {suggestion.reason && (
              <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                {suggestion.reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SmartSuggestionsWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { canView, suggestions, isLoading, isFetching, error, refresh } =
    useSmartSuggestions(user, {
      pollInterval: 15000,
    });

  const sortedSuggestions = useMemo(() => {
    const items = Array.isArray(suggestions) ? suggestions : [];
    return sortSuggestions(items);
  }, [suggestions]);

  const visibleSuggestions = useMemo(() => {
    return sortedSuggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
  }, [sortedSuggestions]);

  const totalSuggestions = sortedSuggestions.length;
  const hiddenSuggestions = Math.max(totalSuggestions - visibleSuggestions.length, 0);

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
            onClick={() => setIsOpen((current) => !current)}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-700"
            title="Smart Suggestions"
            aria-label="Open Smart Suggestions"
          >
            <FiMessageCircle size={24} />

            {totalSuggestions > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
                {totalSuggestions > 99 ? "99+" : totalSuggestions}
              </span>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-x-3 bottom-20 z-[1150] sm:inset-x-auto sm:right-6 sm:w-[420px] sm:max-w-[calc(100vw-2rem)]">
          <section className="max-h-[calc(100vh-6rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <header className="border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                    <FiBell className="text-indigo-600" />
                    Smart Suggestions
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Rule-based HR suggestions for review only.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  aria-label="Close Smart Suggestions"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {totalSuggestions} suggestion{totalSuggestions === 1 ? "" : "s"} detected
                </p>

                <button
                  type="button"
                  onClick={() => refresh()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FiRefreshCw className={isFetching ? "animate-spin" : ""} />
                  Sync
                </button>
              </div>
            </header>

            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950">
              {error && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Loading smart suggestions...
                </div>
              ) : visibleSuggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                  <FiFilter className="mx-auto mb-3 text-slate-400" size={22} />

                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    No suggestions found
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Suggestions appear when the system detects HR patterns.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleSuggestions.map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.suggestionKey}
                      suggestion={suggestion}
                    />
                  ))}

                  {hiddenSuggestions > 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      +{hiddenSuggestions} more suggestion
                      {hiddenSuggestions === 1 ? "" : "s"} detected. Resolve related records to reduce the list.
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                Advisory-only. The system suggests possible next steps; HR still decides whether to accept, ignore, or further review them.
              </p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}