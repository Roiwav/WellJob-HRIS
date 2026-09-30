import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiEye,
  FiFilter,
} from "react-icons/fi";

import Button from "../../ui/Button";
import SearchInput from "../../ui/SearchInput";

import RiskBadge from "../badges/RiskBadge";
import KPIBadge from "../badges/KPIBadge";
import EmployeeKpiDetailsModal from "../modals/EmployeeKpiDetailsModal";

import {
  getRecommendationClasses,
  getRecommendationWeight,
} from "../../../utils/kpi/riskTableHelpers";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  RECOMMENDATION_LABELS,
} from "../../../utils/kpi/kpiHelpers";

const ACTION_GROUPS = {
  ALL: "ALL",
  MAINTAIN: "MAINTAIN",
  COUNSELING: "COUNSELING",
  PIP: "PIP",
  DEVELOPMENT: "DEVELOPMENT",
};

const RECOMMENDATION_OPTIONS = Array.from(
  new Set(
    [
      RECOMMENDATION_LABELS.RETAIN,
      "Verbal Counseling",
      "Performance Improvement Plan",
      "Reassignment of Position",
      "Seminar & Webinar",
      "Employee Training",
    ].filter(Boolean)
  )
);

const CONFIDENCE_OPTIONS = Array.from(
  new Set(
    [
      DECISION_CONFIDENCE.HIGH,
      DECISION_CONFIDENCE.MODERATE,
      DECISION_CONFIDENCE.LOW,
    ].filter(Boolean)
  )
);

const WORKFLOW_OPTIONS = Array.from(
  new Set(
    [
      HR_ACTION_WORKFLOW.TERMINATION,
      HR_ACTION_WORKFLOW.SUSPENSION,
      HR_ACTION_WORKFLOW.ESCALATION,
      HR_ACTION_WORKFLOW.INVESTIGATION,
      HR_ACTION_WORKFLOW.HR_VALIDATION,
      HR_ACTION_WORKFLOW.PIP,
      HR_ACTION_WORKFLOW.HUMAN_REVIEW,
      HR_ACTION_WORKFLOW.MONITOR,
    ].filter(Boolean)
  )
);

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function getActionGroup(recommendation) {
  const value = String(recommendation || "").toLowerCase();

  if (
    value.includes("retain") ||
    value.includes("maintain") ||
    value.includes("good standing")
  ) {
    return ACTION_GROUPS.MAINTAIN;
  }

  if (value.includes("counsel")) {
    return ACTION_GROUPS.COUNSELING;
  }

  if (
    value.includes("pip") ||
    value.includes("performance improvement")
  ) {
    return ACTION_GROUPS.PIP;
  }

  if (
    value.includes("development") ||
    value.includes("training") ||
    value.includes("seminar") ||
    value.includes("webinar") ||
    value.includes("reassignment")
  ) {
    return ACTION_GROUPS.DEVELOPMENT;
  }

  return ACTION_GROUPS.DEVELOPMENT;
}

function getConfidenceWeight(confidence) {
  switch (confidence) {
    case DECISION_CONFIDENCE.HIGH:
      return 3;

    case DECISION_CONFIDENCE.MODERATE:
      return 2;

    case DECISION_CONFIDENCE.LOW:
    default:
      return 1;
  }
}

function getWorkflowWeight(action) {
  switch (action) {
    case HR_ACTION_WORKFLOW.TERMINATION:
      return 8;

    case HR_ACTION_WORKFLOW.SUSPENSION:
      return 7;

    case HR_ACTION_WORKFLOW.ESCALATION:
      return 6;

    case HR_ACTION_WORKFLOW.INVESTIGATION:
      return 5;

    case HR_ACTION_WORKFLOW.HR_VALIDATION:
      return 4;

    case HR_ACTION_WORKFLOW.PIP:
      return 3;

    case HR_ACTION_WORKFLOW.HUMAN_REVIEW:
      return 2;

    case HR_ACTION_WORKFLOW.MONITOR:
    default:
      return 1;
  }
}

function RecommendationBadge({ recommendation }) {
  const value =
    recommendation || RECOMMENDATION_LABELS.RETAIN;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${getRecommendationClasses(
        value
      )}`}
      title={value}
    >
      <span className="truncate">{value}</span>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {label}
      </span>

      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      >
        {children}
      </select>
    </label>
  );
}

export default function RiskTable({
  employees = [],
  getRiskLevel,
}) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL");
  const [workflowFilter, setWorkflowFilter] = useState("ALL");
  const [recommendationFilter, setRecommendationFilter] =
    useState("ALL");
  const [actionGroupFilter, setActionGroupFilter] = useState(
    ACTION_GROUPS.ALL
  );
  const [sortBy, setSortBy] = useState("decision_desc");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] =
    useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState(false);

  const deferredSearch = useDeferredValue(search);

  const safeEmployees = useMemo(() => {
    return Array.isArray(employees)
      ? employees.filter(Boolean)
      : [];
  }, [employees]);

  const handleClearAllFilters = () => {
    setSearch("");
    setRiskFilter("ALL");
    setConfidenceFilter("ALL");
    setWorkflowFilter("ALL");
    setRecommendationFilter("ALL");
    setActionGroupFilter(ACTION_GROUPS.ALL);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    riskFilter !== "ALL" ||
    confidenceFilter !== "ALL" ||
    workflowFilter !== "ALL" ||
    recommendationFilter !== "ALL" ||
    actionGroupFilter !== ACTION_GROUPS.ALL;

  const processedEmployees = useMemo(() => {
    let filtered = [...safeEmployees];

    const keyword = normalizeSearchText(deferredSearch);

    if (keyword) {
      filtered = filtered.filter((employee) => {
        const searchableText = normalizeSearchText(
          [
            employee?.name,
            employee?.id,
            formatEmployeeId(employee?.id),
            employee?.company,
            employee?.kpiLevel,
            employee?.riskLevel,
            employee?.decisionConfidence,
            employee?.suggestedHRAction,
            employee?.decisionConfidenceReason,
            employee?.suggestedHRActionReason,
            employee?.recommendation,
            employee?.recommendationReason,
            employee?.correctiveAction,
            employee?.correctiveActionReason,
            employee?.correctiveActionBasis,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !== undefined &&
                value !== ""
            )
            .join(" ")
        );

        return searchableText.includes(keyword);
      });
    }

    if (riskFilter !== "ALL") {
      filtered = filtered.filter(
        (employee) =>
          (employee?.riskLevel ||
            getRiskLevel(employee?.violationCount)) ===
          riskFilter
      );
    }

    if (confidenceFilter !== "ALL") {
      filtered = filtered.filter(
        (employee) =>
          (employee?.decisionConfidence ||
            DECISION_CONFIDENCE.LOW) === confidenceFilter
      );
    }

    if (workflowFilter !== "ALL") {
      filtered = filtered.filter(
        (employee) =>
          (employee?.suggestedHRAction ||
            HR_ACTION_WORKFLOW.MONITOR) === workflowFilter
      );
    }

    if (actionGroupFilter !== ACTION_GROUPS.ALL) {
      filtered = filtered.filter(
        (employee) =>
          getActionGroup(
            employee?.recommendation ||
              RECOMMENDATION_LABELS.RETAIN
          ) === actionGroupFilter
      );
    }

    if (recommendationFilter !== "ALL") {
      filtered = filtered.filter(
        (employee) =>
          (employee?.recommendation ||
            RECOMMENDATION_LABELS.RETAIN) ===
          recommendationFilter
      );
    }

    filtered.sort((first, second) => {
      switch (sortBy) {
        case "decision_desc":
          return (
            getConfidenceWeight(second?.decisionConfidence) -
              getConfidenceWeight(first?.decisionConfidence) ||
            getWorkflowWeight(second?.suggestedHRAction) -
              getWorkflowWeight(first?.suggestedHRAction) ||
            Number(second?.severityScore || 0) -
              Number(first?.severityScore || 0)
          );

        case "workflow_desc":
          return (
            getWorkflowWeight(second?.suggestedHRAction) -
              getWorkflowWeight(first?.suggestedHRAction) ||
            getConfidenceWeight(second?.decisionConfidence) -
              getConfidenceWeight(first?.decisionConfidence)
          );

        case "name_asc":
          return String(first?.name || "").localeCompare(
            String(second?.name || "")
          );

        case "name_desc":
          return String(second?.name || "").localeCompare(
            String(first?.name || "")
          );

        case "violations_asc":
          return (
            Number(first?.violationCount || 0) -
            Number(second?.violationCount || 0)
          );

        case "violations_desc":
          return (
            Number(second?.violationCount || 0) -
            Number(first?.violationCount || 0)
          );

        case "recommendation_desc":
        default:
          return (
            getRecommendationWeight(second?.recommendation) -
              getRecommendationWeight(first?.recommendation) ||
            getConfidenceWeight(second?.decisionConfidence) -
              getConfidenceWeight(first?.decisionConfidence)
          );
      }
    });

    return filtered;
  }, [
    safeEmployees,
    deferredSearch,
    riskFilter,
    confidenceFilter,
    workflowFilter,
    actionGroupFilter,
    recommendationFilter,
    sortBy,
    getRiskLevel,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(processedEmployees.length / rowsPerPage)
  );

  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    totalPages
  );

  const paginatedEmployees = useMemo(() => {
    const startIndex =
      (safeCurrentPage - 1) * rowsPerPage;

    return processedEmployees.slice(
      startIndex,
      startIndex + rowsPerPage
    );
  }, [
    processedEmployees,
    safeCurrentPage,
    rowsPerPage,
  ]);

  const startEntry =
    processedEmployees.length === 0
      ? 0
      : (safeCurrentPage - 1) * rowsPerPage + 1;

  const endEntry = Math.min(
    safeCurrentPage * rowsPerPage,
    processedEmployees.length
  );

  return (
    <>
      <section
        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        aria-labelledby="risk-table-title"
      >
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3
                id="risk-table-title"
                className="text-base font-black text-slate-900 dark:text-white"
              >
                Employee Records
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Scan current KPI and risk status. Open View for the complete decision basis and HR action details.
              </p>
            </div>

            <span className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-0">
              {processedEmployees.length} employee(s)
            </span>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/25 sm:px-5">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Search
                </span>

                <SearchInput
                  label="Search employee risk records"
                  hideLabel
                  placeholder="Search name, employee number, company, KPI, risk, or action..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  onClear={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:w-[620px]">
                <FilterSelect
                  label="Risk Level"
                  value={riskFilter}
                  onChange={(event) => {
                    setRiskFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="High Risk">High Risk</option>
                  <option value="Repeat">Repeat</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Low Risk">Low Risk</option>
                </FilterSelect>

                <FilterSelect
                  label="Recommendation Group"
                  value={actionGroupFilter}
                  onChange={(event) => {
                    setActionGroupFilter(event.target.value);
                    setRecommendationFilter("ALL");
                    setCurrentPage(1);
                  }}
                >
                  <option value={ACTION_GROUPS.ALL}>All Groups</option>
                  <option value={ACTION_GROUPS.MAINTAIN}>
                    Maintain
                  </option>
                  <option value={ACTION_GROUPS.COUNSELING}>
                    Counseling
                  </option>
                  <option value={ACTION_GROUPS.PIP}>PIP</option>
                  <option value={ACTION_GROUPS.DEVELOPMENT}>
                    Development
                  </option>
                </FilterSelect>

                <FilterSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="decision_desc">
                    Decision Priority
                  </option>
                  <option value="workflow_desc">
                    Next Step Priority
                  </option>
                  <option value="recommendation_desc">
                    Recommendation
                  </option>
                  <option value="violations_desc">
                    Most Violations
                  </option>
                  <option value="violations_asc">
                    Least Violations
                  </option>
                  <option value="name_asc">
                    Employee A-Z
                  </option>
                  <option value="name_desc">
                    Employee Z-A
                  </option>
                </FilterSelect>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowAdvancedFilters((current) => !current)
                }
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                aria-expanded={showAdvancedFilters}
              >
                {showAdvancedFilters ? (
                  <FiChevronUp aria-hidden="true" />
                ) : (
                  <FiChevronDown aria-hidden="true" />
                )}
                More filters
              </button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasActiveFilters}
                onClick={handleClearAllFilters}
              >
                Clear filters
              </Button>
            </div>

            {showAdvancedFilters && (
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
                <FilterSelect
                  label="Decision Confidence"
                  value={confidenceFilter}
                  onChange={(event) => {
                    setConfidenceFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All Confidence</option>

                  {CONFIDENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  label="Suggested Next Step"
                  value={workflowFilter}
                  onChange={(event) => {
                    setWorkflowFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All Next Steps</option>

                  {WORKFLOW_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  label="Exact Recommendation"
                  value={recommendationFilter}
                  onChange={(event) => {
                    setRecommendationFilter(event.target.value);
                    setActionGroupFilter(ACTION_GROUPS.ALL);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">
                    All Recommendations
                  </option>

                  {RECOMMENDATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Employee KPI standing, risk level, recommendation, and details
            </caption>

            <thead className="text-xs text-slate-600 dark:text-slate-300">
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 z-20 w-[330px] border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  Employee
                </th>

                <th
                  scope="col"
                  className="sticky top-0 z-20 w-[180px] border-b border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  KPI Standing
                </th>

                <th
                  scope="col"
                  className="sticky top-0 z-20 w-[180px] border-b border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  Risk
                </th>

                <th
                  scope="col"
                  className="sticky top-0 z-20 w-[220px] border-b border-slate-200 bg-slate-100 px-3 py-3 text-left font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  Recommendation
                </th>

                <th
                  scope="col"
                  className="sticky top-0 z-20 w-[100px] border-b border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center"
                  >
                    <div
                      className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"
                      aria-hidden="true"
                    >
                      <FiFilter />
                    </div>

                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      No employee records found.
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Adjust the search or filters to see more records.
                    </p>

                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                        onClick={handleClearAllFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee, index) => {
                  const riskLevel =
                    employee?.riskLevel ||
                    getRiskLevel(employee?.violationCount);

                  const recommendation =
                    employee?.recommendation ||
                    RECOMMENDATION_LABELS.RETAIN;

                  return (
                    <tr
                      key={
                        employee?.id ||
                        employee?.employeeId ||
                        `${employee?.name || "employee"}-${index}`
                      }
                      className="bg-white align-middle transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70"
                    >
                      <td className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                            title={`Employee number ${formatEmployeeId(
                              employee?.id
                            )}`}
                          >
                            {formatEmployeeId(employee?.id)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              {employee?.name || "Unknown Employee"}
                            </p>

                            <p
                              className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                              title={employee?.company || "No company assigned"}
                            >
                              {employee?.company || "Not assigned"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="border-b border-slate-200 px-3 py-3.5 text-center dark:border-slate-800">
                        <KPIBadge
                          level={
                            employee?.kpiLevel ||
                            "Good Standing"
                          }
                        />
                      </td>

                      <td className="border-b border-slate-200 px-3 py-3.5 text-center dark:border-slate-800">
                        <div className="flex flex-col items-center gap-1.5">
                          <RiskBadge level={riskLevel} />

                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {Number(employee?.violationCount) || 0} violation(s)
                          </span>
                        </div>
                      </td>

                      <td className="border-b border-slate-200 px-3 py-3.5 dark:border-slate-800">
                        <RecommendationBadge
                          recommendation={recommendation}
                        />
                      </td>

                      <td className="border-b border-slate-200 px-3 py-3.5 text-center dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmployee(employee)
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
                          title="View complete KPI decision support details"
                        >
                          <FiEye size={14} aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3.5 dark:border-slate-800 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {startEntry}–{endEntry} of{" "}
              {processedEmployees.length} employees
            </p>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Rows per page
              <select
                aria-label="Select rows per page"
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentPage(
                  Math.max(safeCurrentPage - 1, 1)
                )
              }
              disabled={safeCurrentPage === 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiChevronLeft size={14} aria-hidden="true" />
              Previous
            </button>

            <span
              className="min-w-[92px] text-center text-xs font-bold text-slate-600 dark:text-slate-300"
              aria-live="polite"
            >
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage(
                  Math.min(
                    safeCurrentPage + 1,
                    totalPages
                  )
                )
              }
              disabled={safeCurrentPage === totalPages}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
              <FiChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {selectedEmployee && (
        <EmployeeKpiDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}