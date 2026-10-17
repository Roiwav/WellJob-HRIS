import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiFileText,
  FiRefreshCw,
  FiShuffle,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { BsLightbulbFill } from "react-icons/bs";

import { useAuth } from "../../context/useAuth";
import useSmartSuggestions from "../../hooks/useSmartSuggestions";

const MAX_VISIBLE_SUGGESTIONS = 5;

const CATEGORY_STYLES = {
  Workforce: {
    icon: FiUsers,
    iconBg:
      "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
    badge:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },

  "Incident Prevention": {
    icon: FiAlertTriangle,
    iconBg:
      "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
    badge:
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },

  Compliance: {
    icon: FiFileText,
    iconBg:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },

  Deployment: {
    icon: FiShuffle,
    iconBg:
      "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
};

const DEFAULT_CATEGORY_STYLE = {
  icon: FiBell,
  iconBg:
    "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
  badge:
    "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
};

const PRIORITY_STYLES = {
  High: {
    border:
      "border-l-rose-500 dark:border-l-rose-400",
    pill:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    dot:
      "bg-rose-500",
  },

  Medium: {
    border:
      "border-l-amber-400",
    pill:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    dot:
      "bg-amber-400",
  },

  Low: {
    border:
      "border-l-sky-300 dark:border-l-sky-400",
    pill:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    dot:
      "bg-sky-400",
  },
};

function getCategoryStyle(category) {
  return (
    CATEGORY_STYLES[category] ||
    DEFAULT_CATEGORY_STYLE
  );
}

function getPriorityStyle(priority) {
  return (
    PRIORITY_STYLES[priority] ||
    PRIORITY_STYLES.Low
  );
}

function isAlertMetric(label) {
  const text =
    String(label || "")
      .toLowerCase();

  return [
    "critical",
    "expired",
    "missing",
  ].some(
    (keyword) =>
      text.includes(keyword)
  );
}

function getMetricChipClass(metric) {
  const flagged =
    isAlertMetric(metric.label) &&
    Number(metric.value) > 0;

  return flagged
    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    "en-PH",
    {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getSuggestionTypeLabel(
  category
) {
  if (
    category === "Workforce"
  ) {
    return "Workforce Recommendation";
  }

  if (
    category ===
    "Incident Prevention"
  ) {
    return "Incident Prevention";
  }

  if (
    category === "Compliance"
  ) {
    return "Compliance Recommendation";
  }

  if (
    category === "Deployment"
  ) {
    return "Deployment Recommendation";
  }

  return "HR Recommendation";
}

function sortSuggestions(items) {
  const priorityRank = {
    High: 3,
    Medium: 2,
    Low: 1,
  };

  return [...items].sort(
    (a, b) => {
      const rankA =
        priorityRank[
          a?.priority
        ] || 0;

      const rankB =
        priorityRank[
          b?.priority
        ] || 0;

      if (
        rankB !== rankA
      ) {
        return (
          rankB -
          rankA
        );
      }

      const timeA =
        new Date(
          a?.generatedAt ||
            a?.timestamp ||
            0
        ).getTime();

      const timeB =
        new Date(
          b?.generatedAt ||
            b?.timestamp ||
            0
        ).getTime();

      return (
        timeB -
        timeA
      );
    }
  );
}

function SuggestionItem({
  suggestion,
  isMutating,
  onReview,
  onDismiss,
}) {
  const categoryStyle =
    getCategoryStyle(
      suggestion.category
    );

  const priorityStyle =
    getPriorityStyle(
      suggestion.priority
    );

  const Icon =
    categoryStyle.icon;

  const metrics =
    Array.isArray(
      suggestion.metrics
    )
      ? suggestion.metrics
      : [];

  const isReviewed =
    suggestion.isReviewed ===
      true ||
    Boolean(
      suggestion.actionType
    );

  const isDismissed =
    suggestion.isDismissed ===
    true;

  return (
    <article
      className={`rounded-2xl border border-slate-200 border-l-4 ${priorityStyle.border} bg-white p-3 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950 ${
        isDismissed
          ? "opacity-70"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${categoryStyle.iconBg}`}
        >
          <Icon
            size={16}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryStyle.badge}`}
            >
              {getSuggestionTypeLabel(
                suggestion.category
              )}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${priorityStyle.pill}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${priorityStyle.dot}`}
              />

              {suggestion.priority ||
                "Low"}
            </span>

            {isReviewed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <FiCheckCircle
                  size={11}
                  aria-hidden="true"
                />

                {suggestion.actionType ||
                  "Reviewed"}
              </span>
            )}

            {isDismissed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FiX
                  size={11}
                  aria-hidden="true"
                />

                Dismissed
              </span>
            )}

            <span className="ml-auto text-[10px] font-semibold text-slate-400">
              {formatDate(
                suggestion.generatedAt
              )}
            </span>
          </div>

          <h3 className="mt-2 text-sm font-black leading-5 text-slate-900 dark:text-white">
            {suggestion.title ||
              "HR Recommendation"}
          </h3>

          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {suggestion.company ||
              "Client company not specified"}
          </p>

          <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {suggestion.issue ||
              "Current records indicate a possible HR concern that may need review."}
          </p>

          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
            <p className="text-xs font-semibold leading-5 text-slate-900 dark:text-white">
              {suggestion.recommendation ||
                "Review the available records and determine the appropriate HR action."}
            </p>

            {suggestion.reason && (
              <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                {suggestion.reason}
              </p>
            )}
          </div>

          {metrics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metrics.map(
                (metric) => (
                  <span
                    key={`${suggestion.suggestionKey}-${metric.label}`}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getMetricChipClass(
                      metric
                    )}`}
                  >
                    {metric.label}:{" "}
                    {metric.value}
                  </span>
                )
              )}
            </div>
          )}

          {isReviewed &&
            suggestion.actionAt && (
              <p className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                Reviewed{" "}
                {formatDate(
                  suggestion.actionAt
                )}
              </p>
            )}

          {isDismissed &&
            suggestion.dismissReason && (
              <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Reason for Dismissal
                </p>

                <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  {
                    suggestion.dismissReason
                  }
                </p>
              </div>
            )}

          {!isDismissed && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                disabled={
                  isMutating ||
                  isReviewed
                }
                onClick={() =>
                  onReview(
                    suggestion
                  )
                }
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle
                  size={14}
                  aria-hidden="true"
                />

                {isReviewed
                  ? "Reviewed"
                  : "Mark as Reviewed"}
              </button>

              <button
                type="button"
                disabled={isMutating}
                onClick={() =>
                  onDismiss(
                    suggestion
                  )
                }
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              >
                <FiX
                  size={14}
                  aria-hidden="true"
                />

                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SmartSuggestionsWidget() {
  const { user } =
    useAuth();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const {
    canView,
    suggestions,
    summary,
    isLoading,
    isFetching,
    isMutating,
    error,
    mutationError,
    refresh,
    takeSuggestionAction,
    dismissSuggestion,
  } =
    useSmartSuggestions(
      user,
      {
        pollInterval:
          60000,
      }
    );

  const sortedSuggestions =
    useMemo(() => {
      const items =
        Array.isArray(
          suggestions
        )
          ? suggestions
          : [];

      return sortSuggestions(
        items
      );
    }, [
      suggestions,
    ]);

  const visibleSuggestions =
    useMemo(() => {
      return sortedSuggestions.slice(
        0,
        MAX_VISIBLE_SUGGESTIONS
      );
    }, [
      sortedSuggestions,
    ]);

  const totalSuggestions =
    sortedSuggestions.length;

  const hiddenSuggestions =
    Math.max(
      totalSuggestions -
        visibleSuggestions.length,
      0
    );

  const highCount =
    summary?.high || 0;

  const mediumCount =
    summary?.medium || 0;

  const lowCount =
    summary?.low || 0;

  const badgeColorClass =
    highCount > 0
      ? "bg-rose-600"
      : mediumCount > 0
        ? "bg-amber-500"
        : "bg-sky-500";

  const handleReview =
    async (suggestion) => {
      try {
        await takeSuggestionAction({
          suggestionKey:
            suggestion.suggestionKey,

          actionType:
            "Reviewed",

          actionNotes:
            "",
        });
      } catch {
        /*
         * mutationError from the hook
         * is rendered in the widget.
         */
      }
    };

  const handleDismiss =
    async (suggestion) => {
      try {
        await dismissSuggestion({
          suggestionKey:
            suggestion.suggestionKey,

          dismissReason:
            "",
        });
      } catch {
        /*
         * mutationError from the hook
         * is rendered in the widget.
         */
      }
    };

  if (!canView) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 right-6 z-[1100]">
        <div className="group relative flex items-center">
          <div className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
            HR Recommendations
          </div>

          <button
            type="button"
            onClick={() =>
              setIsOpen(
                (current) =>
                  !current
              )
            }
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-700"
            title="HR Recommendations"
            aria-label="Open HR Recommendations"
          >
            <BsLightbulbFill
              size={22}
              aria-hidden="true"
            />

            {totalSuggestions >
              0 && (
              <span
                className={`absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full ${badgeColorClass} px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950 ${
                  highCount > 0
                    ? "animate-pulse"
                    : ""
                }`}
              >
                {totalSuggestions >
                99
                  ? "99+"
                  : totalSuggestions}
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
                    <BsLightbulbFill
                      className="text-indigo-600"
                      aria-hidden="true"
                    />

                    HR Recommendations
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Rule-based recommendations to support HR review and decision-making.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsOpen(
                      false
                    )
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  aria-label="Close HR Recommendations"
                >
                  <FiX
                    size={18}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {
                    totalSuggestions
                  }{" "}
                  recommendation
                  {totalSuggestions ===
                  1
                    ? ""
                    : "s"}{" "}
                  available
                </p>

                <button
                  type="button"
                  onClick={() =>
                    refresh()
                  }
                  disabled={
                    isFetching ||
                    isMutating
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FiRefreshCw
                    className={
                      isFetching
                        ? "animate-spin"
                        : ""
                    }
                    aria-hidden="true"
                  />

                  Refresh
                </button>
              </div>

              {totalSuggestions >
                0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {highCount >
                    0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-black text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />

                      {highCount} High
                    </span>
                  )}

                  {mediumCount >
                    0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

                      {
                        mediumCount
                      }{" "}
                      Medium
                    </span>
                  )}

                  {lowCount >
                    0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-black text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />

                      {lowCount} Low
                    </span>
                  )}
                </div>
              )}
            </header>

            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950">
              {error && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  Unable to load HR recommendations. Please try again.
                </div>
              )}

              {mutationError && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  The recommendation could not be updated. Please try again.
                </div>
              )}

              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Loading HR recommendations...
                </div>
              ) : visibleSuggestions.length ===
                0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                  <FiCheckCircle
                    className="mx-auto mb-3 text-emerald-500"
                    size={22}
                    aria-hidden="true"
                  />

                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    No Recommendations Available
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    No current records require an HR recommendation.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleSuggestions.map(
                    (suggestion) => (
                      <SuggestionItem
                        key={
                          suggestion.suggestionKey
                        }
                        suggestion={
                          suggestion
                        }
                        isMutating={
                          isMutating
                        }
                        onReview={
                          handleReview
                        }
                        onDismiss={
                          handleDismiss
                        }
                      />
                    )
                  )}

                  {hiddenSuggestions >
                    0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      +
                      {
                        hiddenSuggestions
                      }{" "}
                      more recommendation
                      {hiddenSuggestions ===
                      1
                        ? ""
                        : "s"}{" "}
                      available. Review or dismiss items to update this list.
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                Decision support only. Review each recommendation and apply HR judgment before taking action.
              </p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}