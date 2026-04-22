import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import RiskBadge from "./RiskBadge";

export default function RiskTable({ employees = [], getSeverity, getRiskLevel }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("violations_desc");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const processedEmployees = useMemo(() => {
    let filtered = [...employees];

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();
      filtered = filtered.filter(
        (emp) =>
          String(emp.name || "").toLowerCase().includes(keyword) ||
          String(emp.company || "").toLowerCase().includes(keyword)
      );
    }

    if (riskFilter !== "ALL") {
      filtered = filtered.filter(
        (emp) => getRiskLevel(emp.violationCount) === riskFilter
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc":
          return String(b.name || "").localeCompare(String(a.name || ""));
        case "company_asc":
          return String(a.company || "").localeCompare(String(b.company || ""));
        case "company_desc":
          return String(b.company || "").localeCompare(String(a.company || ""));
        case "violations_asc":
          return (a.violationCount || 0) - (b.violationCount || 0);
        case "violations_desc":
        default:
          return (b.violationCount || 0) - (a.violationCount || 0);
      }
    });

    return filtered;
  }, [employees, search, riskFilter, sortBy, getRiskLevel]);

  const totalPages = Math.max(1, Math.ceil(processedEmployees.length / rowsPerPage));

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return processedEmployees.slice(startIndex, endIndex);
  }, [processedEmployees, currentPage, rowsPerPage]);

  const startEntry =
    processedEmployees.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endEntry = Math.min(currentPage * rowsPerPage, processedEmployees.length);

  const handleChangeSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleChangeRiskFilter = (e) => {
    setRiskFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleChangeSort = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-0">
            <div className="relative w-full md:max-w-md xl:max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={handleChangeSearch}
                placeholder="Search employee or company..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={riskFilter}
              onChange={handleChangeRiskFilter}
              className="w-full md:w-52 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Repeat">Repeat</option>
              <option value="Monitor">Monitor</option>
              <option value="Clean">Clean</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 xl:justify-end shrink-0">
            <select
              value={sortBy}
              onChange={handleChangeSort}
              className="w-full sm:w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="violations_desc">Sort: Most Violations</option>
              <option value="violations_asc">Sort: Least Violations</option>
              <option value="name_asc">Sort: Employee A-Z</option>
              <option value="name_desc">Sort: Employee Z-A</option>
              <option value="company_asc">Sort: Company A-Z</option>
              <option value="company_desc">Sort: Company Z-A</option>
            </select>

            <select
              value={rowsPerPage}
              onChange={handleChangeRowsPerPage}
              className="w-full sm:w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">Employee</th>
              <th className="px-6 py-4 text-left">Company</th>
              <th className="px-6 py-4 text-left">Violations</th>
              <th className="px-6 py-4 text-left">Severity</th>
              <th className="px-6 py-4 text-left">Risk Level</th>
            </tr>
          </thead>

          <tbody>
            {paginatedEmployees.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No employee records found.
                </td>
              </tr>
            ) : (
              paginatedEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="px-6 py-4 font-medium">{emp.name}</td>
                  <td className="px-6 py-4">{emp.company}</td>
                  <td className="px-6 py-4">{emp.violationCount}</td>
                  <td className="px-6 py-4">{getSeverity(emp.violationCount)}</td>
                  <td className="px-6 py-4">
                    <RiskBadge level={getRiskLevel(emp.violationCount)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 md:px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing {startEntry} to {endEntry} of {processedEmployees.length} employees
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Previous
          </button>

          <span className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}