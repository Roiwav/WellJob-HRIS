import {
  useMemo,
  useState,
} from "react";
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import Button from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import FilterBar from "../../ui/FilterBar";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";
import SuccessToast from "../../ui/SuccessToast";

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

const DECISION_FILTER_OPTIONS = [
  {
    value: "ALL",
    label: "All Decisions",
  },
  {
    value: "Accepted",
    label: "Accepted",
  },
  {
    value: "Modified",
    label: "Modified",
  },
  {
    value: "Rejected",
    label: "Rejected",
  },
];

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function formatEmployeeId(id) {
  return String(id || "-").replace(
    /^KPI-/i,
    ""
  );
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getInitials(name) {
  return String(
    name || "Employee"
  )
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase()
    )
    .join("");
}

function getDecisionTypeClasses(type) {
  switch (type) {
    case "Accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300";

    case "Modified":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300";

    case "Rejected":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300";
  }
}

function DecisionTypeIcon({
  type,
}) {
  switch (type) {
    case "Accepted":
      return (
        <FiCheckCircle
          size={12}
          aria-hidden="true"
        />
      );

    case "Modified":
      return (
        <FiEdit3
          size={12}
          aria-hidden="true"
        />
      );

    case "Rejected":
      return (
        <FiXCircle
          size={12}
          aria-hidden="true"
        />
      );

    default:
      return (
        <FiFileText
          size={12}
          aria-hidden="true"
        />
      );
  }
}

function StatusBadge({
  children,
  className = "",
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-extrabold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function HistoryCard({
  record,
  onRequestDelete,
  isDeleting = false,
}) {
  const decisionType =
    record?.decisionType ||
    "Recorded";

  const decisionConfidence =
    record?.decisionConfidence ||
    DECISION_CONFIDENCE.LOW;

  const suggestedHRAction =
    record?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
            aria-hidden="true"
          >
            {getInitials(
              record?.employeeName
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {record?.employeeName ||
                "Unknown Employee"}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ID:{" "}
              {formatEmployeeId(
                record?.employeeId
              )}{" "}
              •{" "}
              {record?.company ||
                "Unassigned"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                className={getDecisionTypeClasses(
                  decisionType
                )}
              >
                <DecisionTypeIcon
                  type={decisionType}
                />

                {decisionType}
              </StatusBadge>

              <StatusBadge
                className={getDecisionConfidenceClasses(
                  decisionConfidence
                )}
              >
                <FiZap
                  size={12}
                  aria-hidden="true"
                />

                {decisionConfidence}
              </StatusBadge>

              <StatusBadge
                className={getSuggestedHRActionClasses(
                  suggestedHRAction
                )}
              >
                <FiShield
                  size={12}
                  aria-hidden="true"
                />

                {suggestedHRAction}
              </StatusBadge>

              <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <FiClock
                  size={12}
                  aria-hidden="true"
                />

                {formatDateTime(
                  record?.decidedAt
                )}
              </StatusBadge>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="danger"
          size="sm"
          leftIcon={
            <FiTrash2
              aria-hidden="true"
            />
          }
          loading={isDeleting}
          disabled={isDeleting}
          title="Remove decision history record"
          onClick={() =>
            onRequestDelete(record)
          }
        >
          Remove
        </Button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            System Recommendation
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record?.systemRecommendation ||
              "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Final HR Action
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record?.finalAction ||
              "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Decided By
          </p>

          <p className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">
            {record?.decidedBy ||
              "HR User"}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {record?.decidedByRole ||
              "Authorized User"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FiFileText
            aria-hidden="true"
          />

          HR Notes
        </p>

        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          {record?.notes ||
            "No HR notes recorded."}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          Decision Basis Snapshot
        </p>

        <p className="line-clamp-3 text-sm leading-7 text-indigo-700/90 dark:text-indigo-300/90">
          {record?.correctiveActionBasis ||
            record?.suggestedHRActionReason ||
            record?.decisionConfidenceReason ||
            record?.recommendationReason ||
            "No decision basis snapshot available."}
        </p>
      </div>
    </article>
  );
}

export default function DecisionHistorySection() {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    decisionFilter,
    setDecisionFilter,
  ] = useState("ALL");

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    refreshError,
    setRefreshError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const {
    data: historyData,
    isLoading,
    isFetching,
    error,
    refetch,
  } =
    useKPIDecisionHistoryQuery();

  const deleteDecisionMutation =
    useDeleteKPIDecisionMutation();

  const history =
    useMemo(() => {
      return Array.isArray(
        historyData
      )
        ? historyData.filter(Boolean)
        : [];
    }, [historyData]);

  const filteredHistory =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearchText(search);

      const searchTerms =
        normalizedSearch
          ? normalizedSearch.split(
              /\s+/
            )
          : [];

      return history.filter(
        (record) => {
          if (
            decisionFilter !==
              "ALL" &&
            record?.decisionType !==
              decisionFilter
          ) {
            return false;
          }

          if (
            searchTerms.length ===
            0
          ) {
            return true;
          }

          const searchableText =
            normalizeSearchText(
              [
                record?.employeeName,
                record?.employeeId,
                formatEmployeeId(
                  record?.employeeId
                ),
                record?.company,
                record?.decisionType,
                record?.systemRecommendation,
                record?.suggestedHRAction,
                record?.finalAction,
                record?.notes,
                record?.decidedBy,
                record?.decidedByRole,
                record?.riskLevel,
                record?.kpiLevel,
                record?.decisionConfidence,
              ]
                .filter(
                  (value) =>
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                )
                .join(" ")
            );

          return searchTerms.every(
            (term) =>
              searchableText.includes(
                term
              )
          );
        }
      );
    }, [
      history,
      search,
      decisionFilter,
    ]);

  const summary =
    useMemo(() => {
      return history.reduce(
        (counts, record) => {
          counts.total += 1;

          if (
            record?.decisionType ===
            "Accepted"
          ) {
            counts.accepted += 1;
          }

          if (
            record?.decisionType ===
            "Modified"
          ) {
            counts.modified += 1;
          }

          if (
            record?.decisionType ===
            "Rejected"
          ) {
            counts.rejected += 1;
          }

          return counts;
        },
        {
          total: 0,
          accepted: 0,
          modified: 0,
          rejected: 0,
        }
      );
    }, [history]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    decisionFilter !== "ALL";

  const pageError =
    refreshError ||
    error?.message ||
    "";

  const handleClearFilters = () => {
    setSearch("");
    setDecisionFilter("ALL");
  };

  const handleRefresh =
    async () => {
      if (isFetching) {
        return;
      }

      setRefreshError("");

      try {
        const result =
          await refetch();

        if (
          result?.isError ||
          result?.error
        ) {
          setRefreshError(
            result?.error?.message ||
              "Failed to refresh decision history."
          );
        }
      } catch (refreshRequestError) {
        console.error(
          "Decision history refresh error:",
          refreshRequestError
        );

        setRefreshError(
          refreshRequestError?.message ||
            "Failed to refresh decision history."
        );
      }
    };

  const handleRequestDelete = (
    record
  ) => {
    if (
      deleteDecisionMutation.isPending
    ) {
      return;
    }

    deleteDecisionMutation.reset();
    setDeleteTarget(record);
  };

  const handleCloseDeleteDialog =
    () => {
      if (
        deleteDecisionMutation.isPending
      ) {
        return;
      }

      deleteDecisionMutation.reset();
      setDeleteTarget(null);
    };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget?.id ||
        deleteDecisionMutation.isPending
      ) {
        return;
      }

      try {
        await deleteDecisionMutation.mutateAsync(
          deleteTarget.id
        );

        setDeleteTarget(null);

        setSuccessMessage(
          "The decision history record was removed successfully."
        );
      } catch (deleteError) {
        console.error(
          "KPI decision deletion error:",
          deleteError
        );
      }
    };

  return (
    <>
      <section
        className="space-y-5"
        aria-labelledby="decision-history-title"
        aria-busy={
          isFetching &&
          !isLoading
        }
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2
                id="decision-history-title"
                className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"
              >
                <FiClock
                  className="text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />

                Decision History
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Stores reviewed HR
                decisions from the
                Recommendation Review
                queue for monitoring,
                reference, and employee
                case tracking.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Total
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {summary.total}
                </p>
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

              <div className="rounded-2xl bg-red-50 px-4 py-3 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Rejected
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {summary.rejected}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <FilterBar
              resultCount={
                filteredHistory.length
              }
              resultLabel="decision record"
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      !hasActiveFilters
                    }
                    onClick={
                      handleClearFilters
                    }
                  >
                    Clear All
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={
                      <FiRefreshCw
                        className={
                          isFetching
                            ? "animate-spin"
                            : ""
                        }
                        aria-hidden="true"
                      />
                    }
                    loading={isFetching}
                    disabled={isFetching}
                    onClick={
                      handleRefresh
                    }
                  >
                    Refresh
                  </Button>
                </>
              }
            >
              <div className="w-full sm:col-span-2 xl:w-[520px]">
                <SearchInput
                  label="Search decision history"
                  hideLabel
                  placeholder="Search employee, action, reviewer, notes, confidence, or risk..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  onClear={() =>
                    setSearch("")
                  }
                />
              </div>

              <div className="w-full xl:w-[200px]">
                <label
                  htmlFor="decision-history-filter"
                  className="sr-only"
                >
                  Filter by decision type
                </label>

                <select
                  id="decision-history-filter"
                  value={
                    decisionFilter
                  }
                  onChange={(event) =>
                    setDecisionFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {DECISION_FILTER_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </FilterBar>
          </div>
        </div>

        {pageError && (
          <ErrorState
            compact
            title="Decision history error"
            message={pageError}
            retryLabel={
              isFetching
                ? "Refreshing history..."
                : "Reload decision history"
            }
            onRetry={
              isFetching
                ? undefined
                : handleRefresh
            }
          />
        )}

        {isLoading ? (
          <LoadingSkeleton
            rows={5}
            columns={4}
            showHeader
          />
        ) : filteredHistory.length ===
          0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <EmptyState
              icon={
                hasActiveFilters
                  ? "search"
                  : "records"
              }
              title={
                hasActiveFilters
                  ? "No decision records matched"
                  : "No decision history recorded yet"
              }
              description={
                hasActiveFilters
                  ? "No recorded HR decisions matched the current search and decision filter."
                  : "Decisions will appear here after HR accepts, modifies, or rejects a recommendation from the Recommendation Review tab."
              }
              secondaryActionLabel={
                hasActiveFilters
                  ? "Clear filters"
                  : ""
              }
              onSecondaryAction={
                hasActiveFilters
                  ? handleClearFilters
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredHistory.map(
              (record) => {
                const isDeletingRecord =
                  deleteDecisionMutation.isPending &&
                  String(
                    deleteTarget?.id
                  ) ===
                    String(
                      record?.id
                    );

                return (
                  <HistoryCard
                    key={
                      record?.id ||
                      `${record?.employeeId || "employee"}-${record?.decidedAt || "decision"}`
                    }
                    record={record}
                    isDeleting={
                      isDeletingRecord
                    }
                    onRequestDelete={
                      handleRequestDelete
                    }
                  />
                );
              }
            )}
          </div>
        )}

        {isFetching &&
          !isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
            >
              <FiRefreshCw
                className="animate-spin"
                aria-hidden="true"
              />

              Updating decision
              history...
            </div>
          )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Decision Record"
        tone="danger"
        confirmLabel="Remove Record"
        cancelLabel="Cancel"
        loading={
          deleteDecisionMutation.isPending
        }
        disabled={
          !deleteTarget?.id
        }
        closeOnBackdrop={
          !deleteDecisionMutation.isPending
        }
        onClose={
          handleCloseDeleteDialog
        }
        onConfirm={
          handleConfirmDelete
        }
      >
        <p>
          Are you sure you want to
          remove the decision record
          for{" "}
          <strong className="font-bold text-slate-900 dark:text-white">
            {deleteTarget?.employeeName ||
              "this employee"}
          </strong>
          ?
        </p>

        <p className="mt-2 font-semibold text-red-600 dark:text-red-300">
          This action removes the
          recorded HR decision from
          Decision History and cannot
          be undone.
        </p>

        {deleteDecisionMutation.isError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
          >
            {deleteDecisionMutation
              .error?.message ||
              "Failed to remove the decision record."}
          </p>
        )}
      </ConfirmDialog>

      <SuccessToast
        title="Decision History Updated"
        message={successMessage}
        duration={3500}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </>
  );
}