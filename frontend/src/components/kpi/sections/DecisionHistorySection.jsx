import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";

import Button from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";
import SuccessToast from "../../ui/SuccessToast";

import {
  useDeleteKPIDecisionMutation,
  useKPIDecisionHistoryPageQuery,
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

const HISTORY_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

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
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getDecisionTypeClasses(type) {
  switch (type) {
    case "Accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300";

    case "Modified":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300";

    case "Rejected":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300";

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
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1",
        "text-[11px] font-semibold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function EmployeeNumberBadge({ value }) {
  return (
    <div
      className="flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 px-3 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
      title={`Employee number ${formatEmployeeId(value)}`}
    >
      {formatEmployeeId(value)}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone = "slate",
}) {
  const toneClass = {
    slate:
      "text-slate-800 dark:text-slate-100",
    indigo:
      "text-indigo-700 dark:text-indigo-300",
    emerald:
      "text-emerald-700 dark:text-emerald-300",
    rose:
      "text-rose-700 dark:text-rose-300",
  }[tone];

  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={`text-lg font-bold ${toneClass}`}>
        {value}
      </span>

      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

function HistoryField({
  label,
  value,
  strong = false,
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p
        className={[
          "mt-1.5 text-sm leading-5",
          strong
            ? "font-semibold text-slate-900 dark:text-white"
            : "font-medium text-slate-700 dark:text-slate-200",
        ].join(" ")}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function HistoryCard({
  record,
  onRequestDelete,
  isDeleting = false,
  canDeleteDecisions = false,
}) {
  const decisionType =
    record?.decisionType ||
    "Recorded";

  const reviewBasis =
    record?.correctiveActionBasis ||
    record?.suggestedHRActionReason ||
    record?.decisionConfidenceReason ||
    record?.recommendationReason ||
    "No review basis was recorded.";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <EmployeeNumberBadge
            value={record?.employeeId}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {record?.employeeName ||
                  "Unknown Employee"}
              </h3>

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
            </div>

            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {record?.company ||
                "Unassigned"}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <FiClock
                size={12}
                aria-hidden="true"
              />
              Reviewed{" "}
              {formatDateTime(
                record?.decidedAt ||
                  record?.createdAt
              )}
            </p>
          </div>
        </div>

        {canDeleteDecisions && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={
              <FiTrash2
                aria-hidden="true"
              />
            }
            loading={isDeleting}
            disabled={isDeleting}
            title="Remove decision record"
            onClick={() =>
              onRequestDelete(record)
            }
          >
            Remove
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:grid-cols-[1fr_1fr_0.8fr]">
        <HistoryField
          label="Original Recommendation"
          value={
            record?.systemRecommendation
          }
        />

        <HistoryField
          label="Final HR Action"
          value={record?.finalAction}
          strong
        />

        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Reviewed By
          </p>

          <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {record?.decidedBy ||
              "HR User"}
          </p>

          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {record?.decidedByRole ||
              "Authorized User"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <FiFileText
              aria-hidden="true"
            />
            HR Notes
          </p>

          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
            {record?.notes ||
              "No HR notes were recorded."}
          </p>
        </div>

        <div className="rounded-xl bg-indigo-50/70 p-3 dark:bg-indigo-950/20">
          <p className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <FiShield
              aria-hidden="true"
            />
            Review Basis
          </p>

          <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-indigo-800/90 dark:text-indigo-300/90">
            {reviewBasis}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function DecisionHistorySection({
  onBackToRecommendations,
  canDeleteDecisions = false,
}) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    decisionFilter,
    setDecisionFilter,
  ] = useState("ALL");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

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

  useEffect(() => {
    const timeoutId =
      globalThis.setTimeout(
        () => {
          setDebouncedSearch(
            search.trim()
          );
        },
        SEARCH_DEBOUNCE_MS
      );

    return () => {
      globalThis.clearTimeout(
        timeoutId
      );
    };
  }, [search]);

  const {
    data: historyData,
    isLoading,
    isFetching,
    error,
    refetch,
  } =
    useKPIDecisionHistoryPageQuery({
      page,

      pageSize:
        HISTORY_PAGE_SIZE,

      search:
        debouncedSearch,

      decisionType:
        decisionFilter,
    });

  const deleteDecisionMutation =
    useDeleteKPIDecisionMutation();

  const history =
    useMemo(() => {
      return Array.isArray(
        historyData?.records
      )
        ? historyData.records.filter(
            Boolean
          )
        : [];
    }, [historyData]);

  const pagination =
    historyData?.pagination ||
    {
      page,
      pageSize:
        HISTORY_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    };

  const summary =
    historyData?.summary ||
    {
      total: 0,
      accepted: 0,
      modified: 0,
      rejected: 0,
    };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    decisionFilter !== "ALL";

  const pageError =
    refreshError ||
    error?.message ||
    "";

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setDecisionFilter("ALL");
    setPage(1);
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
              "Unable to refresh decision history."
          );
        }
      } catch (refreshRequestError) {
        console.error(
          "Decision history refresh error:",
          refreshRequestError
        );

        setRefreshError(
          refreshRequestError?.message ||
            "Unable to refresh decision history."
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
        const shouldMoveToPreviousPage =
          history.length === 1 &&
          page > 1;

        await deleteDecisionMutation.mutateAsync(
          deleteTarget.id
        );

        if (
          shouldMoveToPreviousPage
        ) {
          setPage(
            (currentPage) =>
              Math.max(
                1,
                currentPage - 1
              )
          );
        }

        setDeleteTarget(null);

        setSuccessMessage(
          "The HR decision record was removed."
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
        className="space-y-4"
        aria-labelledby="decision-history-title"
        aria-busy={
          isFetching &&
          !isLoading
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2
                id="decision-history-title"
                className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
              >
                <FiClock
                  className="text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />
                Decision History
              </h2>

              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                Review completed HR decisions and the actions recorded for each employee.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <SummaryItem
                  label="total"
                  value={summary.total}
                  tone="indigo"
                />

                <SummaryItem
                  label="accepted"
                  value={summary.accepted}
                  tone="emerald"
                />

                <SummaryItem
                  label="modified"
                  value={summary.modified}
                  tone="indigo"
                />

                <SummaryItem
                  label="rejected"
                  value={summary.rejected}
                  tone="rose"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={
                  <FiArrowLeft aria-hidden="true" />
                }
                onClick={
                  onBackToRecommendations
                }
              >
                Recommendation Review
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Search
              </label>

              <SearchInput
                label="Search decision history"
                hideLabel
                placeholder="Search employee, final action, reviewer, notes, or company..."
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value
                  );
                  setPage(1);
                }}
                onClear={() => {
                  setSearch("");
                  setDebouncedSearch("");
                  setPage(1);
                }}
              />
            </div>

            <div className="w-full lg:w-[220px]">
              <label
                htmlFor="decision-history-filter"
                className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Decision Type
              </label>

              <select
                id="decision-history-filter"
                value={
                  decisionFilter
                }
                onChange={(event) => {
                  setDecisionFilter(
                    event.target.value
                  );
                  setPage(1);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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

            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {Number(
                  pagination.total || 0
                )} record(s)
              </span>

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
                Clear Filters
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
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            Summary counts show all recorded decisions. Search and filters affect the records listed below.
          </p>
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
        ) : history.length ===
          0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <EmptyState
              icon={
                hasActiveFilters
                  ? "search"
                  : "records"
              }
              title={
                hasActiveFilters
                  ? "No decision records matched"
                  : "No HR decisions recorded yet"
              }
              description={
                hasActiveFilters
                  ? "No completed HR decisions matched the current search and filter."
                  : "Completed decisions will appear here after HR accepts, modifies, or rejects a recommendation in Recommendation Review."
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
          <div className="grid gap-3">
            {history.map(
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
                    canDeleteDecisions={
                      canDeleteDecisions
                    }
                  />
                );
              }
            )}
          </div>
        )}

        {Number(
          pagination.total ||
            0
        ) > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Page{" "}
              {pagination.page || page}{" "}
              of{" "}
              {pagination.totalPages ||
                1}{" "}
              •{" "}
              {pagination.total || 0}{" "}
              matching record(s)
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  isFetching ||
                  page <= 1
                }
                onClick={() =>
                  setPage(
                    (currentPage) =>
                      Math.max(
                        1,
                        currentPage -
                          1
                      )
                  )
                }
              >
                Previous
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  isFetching ||
                  page >=
                    Number(
                      pagination.totalPages ||
                        1
                    )
                }
                onClick={() =>
                  setPage(
                    (currentPage) =>
                      Math.min(
                        Number(
                          pagination.totalPages ||
                            1
                        ),
                        currentPage +
                          1
                      )
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {isFetching &&
          !isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              <FiRefreshCw
                className="animate-spin"
                aria-hidden="true"
              />
              Updating decision history...
            </div>
          )}
      </section>

      <ConfirmDialog
        open={
          canDeleteDecisions &&
          Boolean(deleteTarget)
        }
        title="Remove HR Decision Record"
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
          Remove the recorded HR decision for{" "}
          <strong className="font-semibold text-slate-900 dark:text-white">
            {deleteTarget?.employeeName ||
              "this employee"}
          </strong>
          ?
        </p>

        <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-300">
          This is permanent. If the employee still meets the review conditions, the recommendation may appear again in Recommendation Review.
        </p>

        {deleteDecisionMutation.isError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
          >
            {deleteDecisionMutation
              .error?.message ||
              "The HR decision record could not be removed."}
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