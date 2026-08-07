import {
  useMemo,
  useState,
} from "react";
import {
  FiAlertCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiThumbsUp,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import FilterBar from "../../ui/FilterBar";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";

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

const FINAL_ACTION_OPTIONS =
  Array.from(
    new Set([
      RECOMMENDATION_LABELS.RETAIN,
      ...WELLJOB_LOW_KPI_ACTIONS.map(
        (action) => action.title
      ),
      ...Object.values(
        HR_ACTION_WORKFLOW
      ),
      "Suspension Review",
      "Termination Review",
      "No Action Required",
    ])
  );

const INPUT_CLASS_NAME = [
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3",
  "text-sm font-semibold text-slate-700 outline-none transition",
  "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10",
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-500",
].join(" ");

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

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase()
    )
    .join("");
}

function isPendingRecommendation(
  employee
) {
  const recommendation = String(
    employee?.recommendation || ""
  );

  const suggestedHRAction =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  const hasConcern =
    Number(
      employee?.violationCount || 0
    ) > 0 ||
    Number(
      employee?.criticalIncidentCount ||
        0
    ) > 0 ||
    employee?.riskLevel ===
      "High Risk" ||
    employee?.riskLevel ===
      "Repeat";

  const isRetain =
    recommendation ===
      RECOMMENDATION_LABELS.RETAIN ||
    recommendation === "Retain" ||
    recommendation ===
      "Retain / Maintain Good Standing";

  return (
    hasConcern &&
    (!isRetain ||
      suggestedHRAction !==
        HR_ACTION_WORKFLOW.MONITOR)
  );
}

function StatusBadge({
  children,
  className,
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

function DecisionModal({
  employee,
  mode,
  user,
  onClose,
  onSaved,
}) {
  const createDecisionMutation =
    useCreateKPIDecisionMutation();

  const systemRecommendation =
    employee?.recommendation ||
    RECOMMENDATION_LABELS.RETAIN;

  const systemSuggestedAction =
    employee?.suggestedHRAction ||
    HR_ACTION_WORKFLOW.MONITOR;

  const [
    finalAction,
    setFinalAction,
  ] = useState(() => {
    if (mode === "reject") {
      return "No Action Required";
    }

    if (mode === "modify") {
      return systemRecommendation;
    }

    return systemSuggestedAction;
  });

  const [notes, setNotes] =
    useState("");

  const modeConfig = {
    accept: {
      title:
        "Accept System Suggestion",
      icon: (
        <FiThumbsUp
          aria-hidden="true"
        />
      ),
      tone: "success",
      panelClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300",
      buttonLabel:
        "Accept Recommendation",
      buttonVariant: "success",
      decisionType: "Accepted",
    },

    modify: {
      title:
        "Modify Final HR Action",
      icon: (
        <FiEdit3
          aria-hidden="true"
        />
      ),
      tone: "warning",
      panelClassName:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
      buttonLabel:
        "Save Modified Action",
      buttonVariant: "primary",
      decisionType: "Modified",
    },

    reject: {
      title:
        "Reject System Suggestion",
      icon: (
        <FiXCircle
          aria-hidden="true"
        />
      ),
      tone: "warning",
      panelClassName:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
      buttonLabel:
        "Reject Recommendation",
      buttonVariant: "warning",
      decisionType: "Rejected",
    },
  };

  const config =
    modeConfig[mode] ||
    modeConfig.accept;

  const isPending =
    createDecisionMutation.isPending;

  const isRejectMissingNotes =
    mode === "reject" &&
    !notes.trim();

  const handleSave = async () => {
    if (
      isRejectMissingNotes ||
      isPending ||
      !employee
    ) {
      return;
    }

    const payload = {
      employeeId: employee.id,
      employeeName: employee.name,

      company:
        employee.company ||
        "Unassigned",

      riskLevel:
        employee.riskLevel ||
        "Low Risk",

      kpiLevel:
        employee.kpiLevel ||
        "Good Standing",

      violationCount: Number(
        employee.violationCount || 0
      ),

      severityScore: Number(
        employee.severityScore || 0
      ),

      criticalIncidentCount: Number(
        employee.criticalIncidentCount ||
          0
      ),

      decisionConfidence:
        employee.decisionConfidence ||
        DECISION_CONFIDENCE.LOW,

      suggestedHRAction:
        systemSuggestedAction,

      systemRecommendation,
      finalAction,

      decisionType:
        config.decisionType,

      notes:
        notes.trim() ||
        `${config.decisionType} based on HR review of the system-generated recommendation.`,

      decidedBy:
        user?.name ||
        user?.username ||
        "HR User",

      decidedByRole:
        user?.role ||
        "Authorized User",

      recommendationReason:
        employee.recommendationReason ||
        employee.correctiveActionReason ||
        "",

      decisionConfidenceReason:
        employee.decisionConfidenceReason ||
        "",

      suggestedHRActionReason:
        employee.suggestedHRActionReason ||
        "",

      correctiveActionBasis:
        employee.correctiveActionBasis ||
        "",
    };

    try {
      const result =
        await createDecisionMutation.mutateAsync(
          payload
        );

      onSaved?.(
        result?.record || result
      );
    } catch (error) {
      console.error(
        "KPI decision save error:",
        error
      );
    }
  };

  return (
    <Dialog
      open={Boolean(employee)}
      onClose={onClose}
      title={config.title}
      description="This records HR validation of the system-generated recommendation."
      tone={config.tone}
      size="lg"
      preventClose={isPending}
      closeOnOverlay={!isPending}
      closeOnEscape={!isPending}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant={
              config.buttonVariant
            }
            leftIcon={config.icon}
            loading={isPending}
            disabled={
              isRejectMissingNotes ||
              isPending
            }
            onClick={handleSave}
          >
            {config.buttonLabel}
          </Button>
        </>
      }
    >
      {employee && (
        <div className="space-y-5">
          <section
            className={[
              "rounded-2xl border p-4",
              config.panelClassName,
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg dark:bg-slate-950/30"
                aria-hidden="true"
              >
                {config.icon}
              </div>

              <div>
                <p className="font-extrabold">
                  {config.title}
                </p>

                <p className="mt-1 text-xs font-semibold opacity-80">
                  Review the system
                  output and record the
                  authorized HR decision.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                aria-hidden="true"
              >
                {getInitials(
                  employee.name
                )}
              </div>

              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  {employee.name ||
                    "Unknown Employee"}
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Employee ID:{" "}
                  {formatEmployeeId(
                    employee.id
                  )}{" "}
                  •{" "}
                  {employee.company ||
                    "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  System Recommendation
                </p>

                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {
                    systemRecommendation
                  }
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-xs dark:bg-slate-900">
                <p className="font-extrabold uppercase tracking-wide text-slate-400">
                  Suggested Next Step
                </p>

                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {
                    systemSuggestedAction
                  }
                </p>
              </div>
            </div>
          </section>

          <div>
            <label
              htmlFor="kpi-final-hr-action"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Final HR Action
            </label>

            <select
              id="kpi-final-hr-action"
              value={finalAction}
              disabled={
                mode === "accept" ||
                isPending
              }
              className={
                INPUT_CLASS_NAME
              }
              onChange={(event) =>
                setFinalAction(
                  event.target.value
                )
              }
            >
              {FINAL_ACTION_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                )
              )}
            </select>

            {mode === "accept" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Accepted
                recommendations use
                the system-suggested
                next step as the final
                HR action.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="kpi-hr-decision-notes"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              HR Notes{" "}
              {mode === "reject"
                ? "(Required)"
                : "(Optional)"}
            </label>

            <textarea
              id="kpi-hr-decision-notes"
              value={notes}
              rows={4}
              disabled={isPending}
              placeholder={
                mode === "reject"
                  ? "Explain why HR rejected the system suggestion..."
                  : "Add HR validation notes..."
              }
              className={`${INPUT_CLASS_NAME} resize-y font-normal`}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
            />
          </div>

          {isRejectMissingNotes && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
            >
              Rejection requires HR
              notes for
              accountability.
            </div>
          )}

          {createDecisionMutation.isError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
            >
              {createDecisionMutation
                .error?.message ||
                "Failed to save KPI decision."}
            </div>
          )}

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
            <div className="flex items-start gap-3">
              <FiShield
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <p>
                This action records
                HR’s final review. The
                system recommendation
                remains
                decision-support
                information and does
                not take effect
                without authorized HR
                validation.
              </p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default function RecommendationReviewSection({
  employees = [],
  user,
  onDecisionSaved,
}) {
  const [search, setSearch] =
    useState("");

  const [
    selectedReview,
    setSelectedReview,
  ] = useState(null);

  const safeEmployees =
    useMemo(() => {
      return Array.isArray(employees)
        ? employees
        : [];
    }, [employees]);

  const {
    data:
      decisionHistoryData,
    isLoading:
      isHistoryLoading,
    isFetching:
      isHistoryFetching,
    error: historyError,
    refetch:
      refetchDecisionHistory,
  } =
    useKPIDecisionHistoryQuery();

  const decisionHistory =
    useMemo(() => {
      return Array.isArray(
        decisionHistoryData
      )
        ? decisionHistoryData
        : [];
    }, [decisionHistoryData]);

  const decidedEmployeeIds =
    useMemo(() => {
      return new Set(
        decisionHistory.map(
          (record) =>
            String(
              record.employeeId
            )
        )
      );
    }, [decisionHistory]);

  const allPendingEmployees =
    useMemo(() => {
      return safeEmployees
        .filter(
          isPendingRecommendation
        )
        .filter(
          (employee) =>
            !decidedEmployeeIds.has(
              String(employee.id)
            )
        )
        .sort(
          (first, second) => {
            const firstScore =
              Number(
                first.severityScore ||
                  0
              ) +
              Number(
                first.violationCount ||
                  0
              ) +
              Number(
                first.criticalIncidentCount ||
                  0
              ) *
                3;

            const secondScore =
              Number(
                second.severityScore ||
                  0
              ) +
              Number(
                second.violationCount ||
                  0
              ) +
              Number(
                second.criticalIncidentCount ||
                  0
              ) *
                3;

            return (
              secondScore -
              firstScore
            );
          }
        );
    }, [
      decidedEmployeeIds,
      safeEmployees,
    ]);

  const pendingEmployees =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearchText(search);

      const searchTerms =
        normalizedSearch
          ? normalizedSearch.split(/\s+/)
          : [];

      if (
        searchTerms.length === 0
      ) {
        return allPendingEmployees;
      }

      return allPendingEmployees.filter(
        (employee) => {
          const searchableText =
            normalizeSearchText(
              [
                employee.name,
                employee.id,
                formatEmployeeId(
                  employee.id
                ),
                employee.company,
                employee.kpiLevel,
                employee.riskLevel,
                employee.decisionConfidence,
                employee.suggestedHRAction,
                employee.recommendation,
                employee.recommendationReason,
                employee.correctiveActionReason,
                employee.suggestedHRActionReason,
                employee.decisionConfidenceReason,
                employee.correctiveActionBasis,
                employee.violationCount,
                employee.criticalIncidentCount,
                employee.severityScore,
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
      allPendingEmployees,
      search,
    ]);

  const hasSearch =
    Boolean(search.trim());

  const handleSaved = (record) => {
    setSelectedReview(null);
    onDecisionSaved?.(record);
  };

  const handleRetryHistory =
    async () => {
      if (isHistoryFetching) {
        return;
      }

      await refetchDecisionHistory();
    };

  return (
    <>
      <section
        className="space-y-5"
        aria-labelledby="recommendation-review-title"
        aria-busy={isHistoryLoading}
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2
                id="recommendation-review-title"
                className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"
              >
                <FiShield
                  className="text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />

                Recommendation Review
                Queue
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                HR validates
                system-generated
                recommendations here.
                Accepted, modified, or
                rejected decisions will
                appear in Decision
                History.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Pending
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {
                    allPendingEmployees.length
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Recorded
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  {
                    decisionHistory.length
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70">
                <p className="text-[11px] font-extrabold uppercase">
                  Review
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  HR
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <FilterBar
              resultCount={
                pendingEmployees.length
              }
              resultLabel="recommendation"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    !hasSearch ||
                    isHistoryLoading
                  }
                  onClick={() =>
                    setSearch("")
                  }
                >
                  Clear Search
                </Button>
              }
            >
              <div className="w-full sm:col-span-2 xl:w-[520px]">
                <SearchInput
                  label="Search pending recommendations"
                  hideLabel
                  placeholder="Search employee, ID, company, action, confidence, or risk..."
                  value={search}
                  disabled={
                    isHistoryLoading
                  }
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
            </FilterBar>
          </div>
        </div>

        {historyError && (
          <ErrorState
            compact
            title="Decision history error"
            message={
              historyError.message ||
              "Failed to load decision history."
            }
            retryLabel="Reload review queue"
            onRetry={
              handleRetryHistory
            }
          />
        )}

        {isHistoryLoading ? (
          <LoadingSkeleton
            rows={5}
            columns={4}
            showHeader
          />
        ) : pendingEmployees.length ===
          0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <EmptyState
              icon={
                hasSearch
                  ? "search"
                  : "records"
              }
              title={
                hasSearch
                  ? "No recommendations matched"
                  : "No pending recommendations"
              }
              description={
                hasSearch
                  ? "No pending HR recommendations matched the current search."
                  : "Accepted, modified, or rejected items are removed from this queue and appear in Decision History."
              }
              secondaryActionLabel={
                hasSearch
                  ? "Clear search"
                  : ""
              }
              onSecondaryAction={
                hasSearch
                  ? () =>
                      setSearch("")
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingEmployees.map(
              (employee) => {
                const confidence =
                  employee.decisionConfidence ||
                  DECISION_CONFIDENCE.LOW;

                const suggestedHRAction =
                  employee.suggestedHRAction ||
                  HR_ACTION_WORKFLOW.MONITOR;

                return (
                  <article
                    key={
                      employee.id ||
                      employee.employeeId ||
                      employee.name
                    }
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          aria-hidden="true"
                        >
                          {getInitials(
                            employee.name
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {employee.name ||
                              "Unknown Employee"}
                          </h3>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            ID:{" "}
                            {formatEmployeeId(
                              employee.id
                            )}{" "}
                            •{" "}
                            {employee.company ||
                              "Unassigned"}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusBadge
                              className={getDecisionConfidenceClasses(
                                confidence
                              )}
                            >
                              <FiZap
                                size={12}
                                aria-hidden="true"
                              />

                              {confidence}
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

                              {
                                suggestedHRAction
                              }
                            </StatusBadge>

                            <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                              <FiAlertCircle
                                size={12}
                                aria-hidden="true"
                              />

                              {employee.violationCount ||
                                0}{" "}
                              violation(s)
                            </StatusBadge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          leftIcon={
                            <FiThumbsUp
                              aria-hidden="true"
                            />
                          }
                          onClick={() =>
                            setSelectedReview({
                              employee,
                              mode: "accept",
                            })
                          }
                        >
                          Accept
                        </Button>

                        <Button
                          type="button"
                          variant="warning"
                          size="sm"
                          leftIcon={
                            <FiEdit3
                              aria-hidden="true"
                            />
                          }
                          onClick={() =>
                            setSelectedReview({
                              employee,
                              mode: "modify",
                            })
                          }
                        >
                          Modify
                        </Button>

                        <Button
                          type="button"
                          variant="warning"
                          size="sm"
                          leftIcon={
                            <FiXCircle
                              aria-hidden="true"
                            />
                          }
                          onClick={() =>
                            setSelectedReview({
                              employee,
                              mode: "reject",
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <FiFileText
                            aria-hidden="true"
                          />

                          Recommendation
                          Reason
                        </p>

                        <p className="line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {employee.recommendationReason ||
                            employee.correctiveActionReason ||
                            "No recommendation reason available."}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <FiClock
                            aria-hidden="true"
                          />

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
              }
            )}
          </div>
        )}

        {isHistoryFetching &&
          !isHistoryLoading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
            >
              <FiRefreshCw
                className="animate-spin"
                aria-hidden="true"
              />

              Updating recommendation
              queue...
            </div>
          )}
      </section>

      {selectedReview && (
        <DecisionModal
          key={`${selectedReview.employee.id}-${selectedReview.mode}`}
          employee={
            selectedReview.employee
          }
          mode={
            selectedReview.mode
          }
          user={user}
          onClose={() =>
            setSelectedReview(null)
          }
          onSaved={handleSaved}
        />
      )}
    </>
  );
}