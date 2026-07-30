import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFilter,
  FiSearch,
  FiShield,
  FiSliders,
  FiZap,
} from "react-icons/fi";

import RiskBadge from "../badges/RiskBadge";
import KPIBadge from "../badges/KPIBadge";
import EmployeeKpiDetailsModal from "../modals/EmployeeKpiDetailsModal";

import {
  getSeverityClasses,
  getRecommendationClasses,
  getRecommendationWeight,
  getRiskTableSummary,
} from "../../../utils/kpi/riskTableHelpers";

import {
  DECISION_CONFIDENCE,
  HR_ACTION_WORKFLOW,
  RECOMMENDATION_LABELS,
  getDecisionConfidenceClasses,
  getSuggestedHRActionClasses,
} from "../../../utils/kpi/kpiHelpers";

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

function getActionGroup(recommendation) {
  const value = String(recommendation || "").toLowerCase();

  if (
    value.includes("retain") ||
    value.includes("maintain") ||
    value.includes("good standing")
  ) {
    return ACTION_GROUPS.MAINTAIN;
  }

  if (value.includes("counsel")) return ACTION_GROUPS.COUNSELING;

  if (value.includes("pip") || value.includes("performance improvement")) {
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

function getActionGroupLabel(group) {
  switch (group) {
    case ACTION_GROUPS.MAINTAIN:
      return "Maintain";
    case ACTION_GROUPS.COUNSELING:
      return "Counseling";
    case ACTION_GROUPS.PIP:
      return "PIP";
    case ACTION_GROUPS.DEVELOPMENT:
      return "Development";
    default:
      return "All Actions";
  }
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

function getPriorityAccent(emp) {
  const risk = emp?.riskLevel || "";
  const severity = emp?.severityLabel || "";

  if (
    risk === "High Risk" ||
    severity === "Critical"
  ) {
    return "border-l-red-500";
  }

  if (risk === "Repeat") {
    return "border-l-amber-500";
  }

  return "border-l-indigo-500";
}

function DecisionConfidenceBadge({ confidence }) {
  const value = confidence || DECISION_CONFIDENCE.LOW;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-5 ${getDecisionConfidenceClasses(
        value
      )}`}
      title={value}
    >
      <FiZap size={12} />
      <span className="truncate">{value}</span>
    </span>
  );
}

function SuggestedActionBadge({ action }) {
  const value = action || HR_ACTION_WORKFLOW.MONITOR;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-5 ${getSuggestedHRActionClasses(
        value
      )}`}
      title={value}
    >
      <FiShield size={12} />
      <span className="truncate">{value}</span>
    </span>
  );
}

function RecommendationBadge({ recommendation }) {
  const value = recommendation || RECOMMENDATION_LABELS.RETAIN;
  const isRetain =
    value === RECOMMENDATION_LABELS.RETAIN || value === "Retain";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-5 ${getRecommendationClasses(
        value
      )}`}
      title={value}
    >
      {isRetain ? <FiCheckCircle size={12} /> : <FiAlertCircle size={12} />}
      <span className="truncate">{value}</span>
    </span>
  );
}

function StatChip({
  label,
  value,
  tone = "slate",
  active = false,
  onClick,
  title,
}) {
  const tones = {
    emerald:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15",
    amber:
      "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15",
    red:
      "border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15",
    indigo:
      "border-indigo-500/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/15",
    slate:
      "border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-900",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title || label}
      className={`rounded-2xl border px-3 py-2 text-left transition ${
        tones[tone] || tones.slate
      } ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : ""
      } ${
        active
          ? "ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-slate-950 dark:ring-offset-slate-950"
          : ""
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black leading-none">{value}</p>
    </Component>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
    >
      {children}
    </select>
  );
}

export default function RiskTable({
  employees = [],
  getSeverity,
  getRiskLevel,
}) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL");
  const [workflowFilter, setWorkflowFilter] = useState("ALL");
  const [recommendationFilter, setRecommendationFilter] = useState("ALL");
  const [actionGroupFilter, setActionGroupFilter] = useState(ACTION_GROUPS.ALL);
  const [sortBy, setSortBy] = useState("decision_desc");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const handleActionGroupClick = (group) => {
    setActionGroupFilter((current) =>
      current === group ? ACTION_GROUPS.ALL : group
    );
    setRecommendationFilter("ALL");
    setCurrentPage(1);
  };

  const clearActionGroupFilter = () => {
    setActionGroupFilter(ACTION_GROUPS.ALL);
    setCurrentPage(1);
  };

  const processedEmployees = useMemo(() => {
    let filtered = [...employees];

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      filtered = filtered.filter((emp) =>
        [
          emp.name,
          emp.id,
          emp.company,
          emp.kpiLevel,
          emp.riskLevel,
          emp.decisionConfidence,
          emp.suggestedHRAction,
          emp.decisionConfidenceReason,
          emp.suggestedHRActionReason,
          emp.recommendation,
          emp.recommendationReason,
          emp.correctiveAction,
          emp.correctiveActionReason,
          emp.correctiveActionBasis,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      );
    }

    if (riskFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) =>
          (emp.riskLevel || getRiskLevel(emp.violationCount)) === riskFilter
      );
    }

    if (confidenceFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) =>
          (emp.decisionConfidence || DECISION_CONFIDENCE.LOW) ===
          confidenceFilter
      );
    }

    if (workflowFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) =>
          (emp.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR) ===
          workflowFilter
      );
    }

    if (actionGroupFilter !== ACTION_GROUPS.ALL) {
      filtered = filtered.filter(
        (emp) =>
          getActionGroup(emp.recommendation || RECOMMENDATION_LABELS.RETAIN) ===
          actionGroupFilter
      );
    }

    if (recommendationFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) =>
          (emp.recommendation || RECOMMENDATION_LABELS.RETAIN) ===
          recommendationFilter
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "decision_desc":
          return (
            getConfidenceWeight(b.decisionConfidence) -
              getConfidenceWeight(a.decisionConfidence) ||
            getWorkflowWeight(b.suggestedHRAction) -
              getWorkflowWeight(a.suggestedHRAction) ||
            (b.severityScore || 0) - (a.severityScore || 0)
          );

        case "workflow_desc":
          return (
            getWorkflowWeight(b.suggestedHRAction) -
              getWorkflowWeight(a.suggestedHRAction) ||
            getConfidenceWeight(b.decisionConfidence) -
              getConfidenceWeight(a.decisionConfidence)
          );

        case "name_asc":
          return String(a.name || "").localeCompare(String(b.name || ""));

        case "name_desc":
          return String(b.name || "").localeCompare(String(a.name || ""));

        case "violations_asc":
          return (a.violationCount || 0) - (b.violationCount || 0);

        case "violations_desc":
          return (b.violationCount || 0) - (a.violationCount || 0);

        case "recommendation_desc":
        default:
          return (
            getRecommendationWeight(b.recommendation) -
              getRecommendationWeight(a.recommendation) ||
            getConfidenceWeight(b.decisionConfidence) -
              getConfidenceWeight(a.decisionConfidence)
          );
      }
    });

    return filtered;
  }, [
    employees,
    search,
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

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return processedEmployees.slice(startIndex, startIndex + rowsPerPage);
  }, [processedEmployees, currentPage, rowsPerPage]);

  const startEntry =
    processedEmployees.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;

  const endEntry = Math.min(
    currentPage * rowsPerPage,
    processedEmployees.length
  );

  const summary = useMemo(() => {
    return getRiskTableSummary(employees);
  }, [employees]);

  const decisionSummary = useMemo(() => {
    return {
      high: employees.filter(
        (emp) => emp.decisionConfidence === DECISION_CONFIDENCE.HIGH
      ).length,
      moderate: employees.filter(
        (emp) => emp.decisionConfidence === DECISION_CONFIDENCE.MODERATE
      ).length,
      low: employees.filter(
        (emp) => emp.decisionConfidence === DECISION_CONFIDENCE.LOW
      ).length,
      pending: employees.filter((emp) => {
        const action = emp.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;
        return action !== HR_ACTION_WORKFLOW.MONITOR;
      }).length,
    };
  }, [employees]);

  return (
    <>
      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <FiShield />
              </div>

              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  HR Decision Support Risk Table
                </h3>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Employee-level KPI evaluation with decision confidence,
                  suggested HR action, and recommended action.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
              <StatChip
                label="For HR Action"
                value={decisionSummary.pending}
                tone="amber"
              />
              <StatChip
                label="High Confidence"
                value={decisionSummary.high}
                tone="indigo"
              />
              <StatChip
                label="Moderate"
                value={decisionSummary.moderate}
                tone="amber"
              />
              <StatChip
                label="Low"
                value={decisionSummary.low}
                tone="slate"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatChip
              label="Maintain"
              value={summary.maintain}
              tone="emerald"
              active={actionGroupFilter === ACTION_GROUPS.MAINTAIN}
              onClick={() => handleActionGroupClick(ACTION_GROUPS.MAINTAIN)}
              title="Show employees under Maintain recommendation"
            />

            <StatChip
              label="Counseling"
              value={summary.counseling}
              tone="indigo"
              active={actionGroupFilter === ACTION_GROUPS.COUNSELING}
              onClick={() => handleActionGroupClick(ACTION_GROUPS.COUNSELING)}
              title="Show employees under Counseling recommendation"
            />

            <StatChip
              label="PIP"
              value={summary.improvement}
              tone="amber"
              active={actionGroupFilter === ACTION_GROUPS.PIP}
              onClick={() => handleActionGroupClick(ACTION_GROUPS.PIP)}
              title="Show employees under Performance Improvement Plan"
            />

            <StatChip
              label="Development"
              value={summary.development}
              tone="indigo"
              active={actionGroupFilter === ACTION_GROUPS.DEVELOPMENT}
              onClick={() => handleActionGroupClick(ACTION_GROUPS.DEVELOPMENT)}
              title="Show employees under Development recommendation"
            />

            {actionGroupFilter !== ACTION_GROUPS.ALL && (
              <button
                type="button"
                onClick={clearActionGroupFilter}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Clear: {getActionGroupLabel(actionGroupFilter)}
              </button>
            )}
          </div>
        </div>

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FiSliders />
              Filters and Search
            </div>

            <div className="grid gap-3">
              <div className="relative min-w-0">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search employee, ID, company, KPI, risk, confidence, action, or recommendation..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                <FilterSelect
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
                  value={recommendationFilter}
                  onChange={(event) => {
                    setRecommendationFilter(event.target.value);
                    setActionGroupFilter(ACTION_GROUPS.ALL);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All HR Actions</option>
                  {RECOMMENDATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="decision_desc">Sort: Decision Priority</option>
                  <option value="workflow_desc">Sort: Next Step Priority</option>
                  <option value="recommendation_desc">Sort: HR Action</option>
                  <option value="violations_desc">Sort: Most Violations</option>
                  <option value="violations_asc">Sort: Least Violations</option>
                  <option value="name_asc">Sort: Employee A-Z</option>
                  <option value="name_desc">Sort: Employee Z-A</option>
                </FilterSelect>

                <FilterSelect
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </FilterSelect>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-black">Employee</th>
                <th className="px-3 py-3 text-center font-black">
                  Indicators
                </th>
                <th className="px-3 py-3 text-center font-black">
                  Evaluation
                </th>
                <th className="px-3 py-3 text-center font-black">
                  Recommended Action
                </th>
                <th className="px-3 py-3 text-center font-black">View</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <FiFilter />
                    </div>

                    <p className="font-black text-slate-700 dark:text-slate-200">
                      No employee records found.
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Try adjusting the search or filter options.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => {
                  const severity =
                    emp.severityLabel || getSeverity(emp.violationCount);

                  const riskLevel =
                    emp.riskLevel || getRiskLevel(emp.violationCount);

                  const recommendation =
                    emp.recommendation || RECOMMENDATION_LABELS.RETAIN;

                  const decisionConfidence =
                    emp.decisionConfidence || DECISION_CONFIDENCE.LOW;

                  const suggestedHRAction =
                    emp.suggestedHRAction || HR_ACTION_WORKFLOW.MONITOR;

                  return (
                    <tr
                      key={emp.id}
                      className={`border-l-4 ${getPriorityAccent(
                        emp
                      )} bg-white align-middle transition hover:bg-indigo-50/40 dark:bg-slate-900 dark:hover:bg-slate-800/60`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {getInitials(emp.name)}
                          </div>

                          <div className="min-w-0">
                            <p className="line-clamp-2 font-black leading-5 text-slate-900 dark:text-white">
                              {emp.name || "Unknown Employee"}
                            </p>

                            <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                              ID: {formatEmployeeId(emp.id)}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                              {emp.company || "Unassigned"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {emp.violationCount || 0} vio.
                          </span>

                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${getSeverityClasses(
                              severity
                            )}`}
                          >
                            {severity}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <KPIBadge level={emp.kpiLevel || "Good Standing"} />
                          <RiskBadge level={riskLevel} />
                          <DecisionConfidenceBadge
                            confidence={decisionConfidence}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <RecommendationBadge
                            recommendation={recommendation}
                          />
                          <SuggestedActionBadge action={suggestedHRAction} />
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white"
                          title="View KPI decision basis and employee details"
                        >
                          <FiEye size={15} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Showing {startEntry} to {endEntry} of {processedEmployees.length}{" "}
            employees
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiChevronLeft size={15} />
              Previous
            </button>

            <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
              <FiChevronRight size={15} />
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