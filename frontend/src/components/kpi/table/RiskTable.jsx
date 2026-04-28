import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEye,
  FiFilter,
  FiSearch,
  FiShield,
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

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

export default function RiskTable({ employees = [], getSeverity, getRiskLevel }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [recommendationFilter, setRecommendationFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("recommendation_desc");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const processedEmployees = useMemo(() => {
    let filtered = [...employees];

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      filtered = filtered.filter(
        (emp) =>
          String(emp.name || "").toLowerCase().includes(keyword) ||
          String(emp.id || "").toLowerCase().includes(keyword) ||
          String(emp.company || "").toLowerCase().includes(keyword) ||
          String(emp.kpiLevel || "").toLowerCase().includes(keyword) ||
          String(emp.riskLevel || "").toLowerCase().includes(keyword) ||
          String(emp.recommendation || "").toLowerCase().includes(keyword) ||
          String(emp.recommendationReason || "").toLowerCase().includes(keyword)
      );
    }

    if (riskFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) =>
          (emp.riskLevel || getRiskLevel(emp.violationCount)) === riskFilter
      );
    }

    if (recommendationFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) => (emp.recommendation || "Retain") === recommendationFilter
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
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
            getRecommendationWeight(a.recommendation)
          );
      }
    });

    return filtered;
  }, [employees, search, riskFilter, recommendationFilter, sortBy, getRiskLevel]);

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

  return (
    <>
      <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <FiShield />
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  HR Decision Support Risk Table
                </h3>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Provides employee-level KPI evaluation with recommended
                  actions and full decision reasons.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Retain" value={summary.retain} tone="emerald" />
              <MiniStat label="Monitor" value={summary.monitor} tone="sky" />
              <MiniStat label="Warning" value={summary.warning} tone="amber" />
              <MiniStat label="Serious" value={summary.serious} tone="rose" />
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:w-80">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search employee, ID, company, KPI, risk..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>

              <select
                value={riskFilter}
                onChange={(event) => {
                  setRiskFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 md:w-48 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="High Risk">High Risk</option>
                <option value="Repeat">Repeat</option>
                <option value="Monitor">Monitor</option>
                <option value="Clean">Clean</option>
              </select>

              <select
                value={recommendationFilter}
                onChange={(event) => {
                  setRecommendationFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 md:w-56 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">All Recommendations</option>
                <option value="Retain">Retain</option>
                <option value="Monitor Employee">Monitor Employee</option>
                <option value="Final Warning">Final Warning</option>
                <option value="Suspension Review">Suspension Review</option>
                <option value="Termination Review">Termination Review</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:w-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="recommendation_desc">
                  Sort: Highest Recommendation
                </option>
                <option value="violations_desc">Sort: Most Violations</option>
                <option value="violations_asc">Sort: Least Violations</option>
                <option value="name_asc">Sort: Employee A-Z</option>
                <option value="name_desc">Sort: Employee Z-A</option>
              </select>

              <select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:w-32 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>
          </div>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
              <col className="w-[19%]" />
              <col className="w-[6%]" />
            </colgroup>

            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-4">Employee</th>
                <th className="px-4 py-4">Violations</th>
                <th className="px-4 py-4">Severity</th>
                <th className="px-4 py-4">KPI Level</th>
                <th className="px-4 py-4">Risk Level</th>
                <th className="px-4 py-4">Recommended Action</th>
                <th className="px-4 py-4">Reason</th>
                <th className="px-4 py-4 text-center">View</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <FiFilter />
                    </div>

                    <p className="font-semibold text-slate-700 dark:text-slate-200">
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
                  const recommendation = emp.recommendation || "Retain";

                  return (
                    <tr
                      key={emp.id}
                      className="bg-white align-top transition hover:bg-indigo-50/40 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-4">
                        <p className="break-words font-bold text-slate-900 dark:text-white">
                          {emp.name}
                        </p>

                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Employee ID: {formatEmployeeId(emp.id)}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {emp.violationCount || 0}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getSeverityClasses(
                            severity
                          )}`}
                        >
                          {severity}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <KPIBadge level={emp.kpiLevel || "Clean"} />
                      </td>

                      <td className="px-4 py-4">
                        <RiskBadge level={riskLevel} />
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-normal rounded-full border px-3 py-1 text-xs font-bold leading-5 ${getRecommendationClasses(
                            recommendation
                          )}`}
                        >
                          {recommendation === "Retain" ? (
                            <FiCheckCircle size={12} />
                          ) : (
                            <FiAlertCircle size={12} />
                          )}

                          {recommendation}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="whitespace-normal text-xs leading-6 text-slate-500 dark:text-slate-400">
                          {emp.recommendationReason ||
                            "No recommendation reason available."}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white"
                          title="View employee KPI details"
                        >
                          <FiEye size={16} />
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {startEntry} to {endEntry} of {processedEmployees.length}{" "}
            employees
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Previous
            </button>

            <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeKpiDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}

function MiniStat({ label, value, tone }) {
  const styles = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70",
    sky: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800/70",
    amber:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/70",
    rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800/70",
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${styles[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}