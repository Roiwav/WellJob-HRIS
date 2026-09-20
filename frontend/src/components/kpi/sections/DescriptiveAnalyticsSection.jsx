import { useMemo } from "react";
import RoleGuard from "../../auth/RoleGuard";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  INITIAL_KPI_FILTERS,
  buildFilteredKpiCsv,
  describeKpiData,
  deploymentStatusOf,
  employeeCompanyOf,
  employeeIdOf,
  employeeNameOf,
  incidentEmployeeIdOf,
  kpiLevelOf,
  riskLevelOf,
  topEmployeesWithEvidence,
} from "../../../utils/kpi/descriptiveAnalytics";

const inputClass =
  "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white";
const panelClass =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-5";

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="block text-xs font-semibold text-gray-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, note }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800/60">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{note}</p>}
    </div>
  );
}

export default function DescriptiveAnalyticsSection({
  sourceEmployees = [],
  employees = [],
  incidents = [],
  filters = INITIAL_KPI_FILTERS,
  onFiltersChange,
}) {
  const report = useMemo(
    () => describeKpiData(employees, incidents, filters),
    [employees, incidents, filters]
  );

  const companies = useMemo(
    () => uniqueValues(sourceEmployees.map(employeeCompanyOf)),
    [sourceEmployees]
  );
  const employeeOptions = useMemo(
    () => sourceEmployees
      .filter((employee) => !filters.company || employeeCompanyOf(employee).toLowerCase() === filters.company.toLowerCase())
      .map((employee) => ({ id: employeeIdOf(employee), name: employeeNameOf(employee) }))
      .filter(({ id }) => id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [sourceEmployees, filters.company]
  );

  // Options represent the *existing* computed categories, not invented categories.
  const riskOptions = useMemo(
    () => uniqueValues([...sourceEmployees, ...employees].map(riskLevelOf).filter((v) => v !== "Not available")),
    [sourceEmployees, employees]
  );
  const kpiOptions = useMemo(
    () => uniqueValues([...sourceEmployees, ...employees].map(kpiLevelOf).filter((v) => v !== "Not available")),
    [sourceEmployees, employees]
  );
  const ranked = useMemo(
    () => topEmployeesWithEvidence(employees, incidents, 5),
    [employees, incidents]
  );

  function update(name, value) {
    if (typeof onFiltersChange !== "function") return;
    onFiltersChange((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "company" ? { employeeId: "" } : {}),
    }));
  }

  function exportCsv() {
    const csv = buildFilteredKpiCsv(employees, incidents, filters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `WELLJOB-KPI-Filtered-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="min-w-0 space-y-5" aria-label="KPI descriptive analytics">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Filtering &amp; Descriptive Analytics</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Describe the selected workforce using recorded employee and incident data. Date filters apply to recorded incident occurrence dates (or reported dates when the
          occurrence date is unavailable); company and deployment status reflect current records.
        </p>
      </div>

      <div className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900 dark:text-white">Filters</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onFiltersChange?.({ ...INITIAL_KPI_FILTERS })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800">
              Reset filters
            </button>
            <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
              <button type="button" onClick={exportCsv}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Export filtered CSV
              </button>
            </RoleGuard>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Company / Client">
            <select className={inputClass} value={filters.company || ""} onChange={(event) => update("company", event.target.value)}>
              <option value="">All companies</option>
              {companies.map((company) => <option key={company} value={company}>{company}</option>)}
            </select>
          </Field>
          <Field label="Employee">
            <select className={inputClass} value={filters.employeeId || ""} onChange={(event) => update("employeeId", event.target.value)}>
              <option value="">All employees</option>
              {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} (#{employee.id})</option>)}
            </select>
          </Field>
          <Field label="Incident start date">
            <input className={inputClass} type="date" value={filters.startDate || ""} max={filters.endDate || undefined}
              onChange={(event) => update("startDate", event.target.value)} />
          </Field>
          <Field label="Incident end date">
            <input className={inputClass} type="date" value={filters.endDate || ""} min={filters.startDate || undefined}
              onChange={(event) => update("endDate", event.target.value)} />
          </Field>
          <Field label="Deployment status">
            <select className={inputClass} value={filters.deploymentStatus || ""} onChange={(event) => update("deploymentStatus", event.target.value)}>
              <option value="">All statuses</option>
              <option value="Deployed">Deployed</option>
              <option value="Not deployed">Not deployed</option>
              <option value="Unknown">Status unavailable</option>
            </select>
          </Field>
          <Field label="Incident severity">
            <select className={inputClass} value={filters.severity || ""} onChange={(event) => update("severity", event.target.value)}>
              <option value="">All severities</option>
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
              <option value="Critical">Critical</option>
            </select>
          </Field>
          <Field label="Risk level">
            <select className={inputClass} value={filters.riskLevel || ""} onChange={(event) => update("riskLevel", event.target.value)}>
              <option value="">All risk levels</option>
              {riskOptions.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </Field>
          <Field label="KPI level">
            <select className={inputClass} value={filters.kpiLevel || ""} onChange={(event) => update("kpiLevel", event.target.value)}>
              <option value="">All KPI levels</option>
              {kpiOptions.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Matching employees" value={report.totalEmployees} note="Current employee roster" />
        <Metric label="Matching incident reports" value={report.incidentCount} note="Incident records in selected scope" />
        <Metric label="Employees with incidents" value={report.affected} note="Unique employees, not report count" />
        <Metric label="No matching incidents" value={report.incidentFree} note={report.incidentFreeRate === null ? "No matching employees" : `${report.incidentFreeRate.toFixed(1)}% of matching employees`} />
      </div>

      <div className={panelClass}>
        <h3 className="font-bold text-gray-900 dark:text-white">Automated descriptive insight</h3>
        <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-slate-200">{report.description}</p>
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          {report.deployed} matching employee(s) have recorded deployed status; {report.unknownDeployment} have unknown deployment status.
          Zero matching incidents does not establish excellent performance or confirm that no incident occurred.
          KPI/risk levels are recalculated from all incident severities in the selected date range;
          severity filters select matching reports and employees without erasing other severities from KPI computations.
        </p>
      </div>

      <div className={panelClass}>
        <div className="mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white">Top Performing Employees — Recorded Performance Score</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Only employees with a separately recorded numeric performance score can appear here.
            The list is sorted by score (higher first); verify that your company's approved score scale uses higher = better.
            The recorded performance score reflects the available source record and is not recomputed by the incident-date filter.
            Incident severity/KPI risk scores are not treated as positive job performance.
          </p>
        </div>
        {ranked.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            No separate numeric employee performance score is available in the selected records.
            A top-performance ranking cannot be produced from incident counts or severity scores alone.
            Displaying the evidence-based employee overview below instead.
          </p>
        ) : (
          <div className="space-y-3">
            {ranked.map(({ employee, score, explanation }, index) => (
              <article key={employeeIdOf(employee)} className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{index + 1}. {employeeNameOf(employee)}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{employeeCompanyOf(employee) || "Company not recorded"} · {kpiLevelOf(employee)} · {riskLevelOf(employee)}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">Performance score: {score}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-slate-200">{explanation}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={panelClass}>
        <h3 className="font-bold text-gray-900 dark:text-white">Employee performance record overview</h3>
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">No employees match the selected filters.</p>
        ) : (
          <div className="mt-3 max-h-[500px] overflow-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-100 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="p-3">Employee</th><th className="p-3">Company</th><th className="p-3">Deployment</th>
                  <th className="p-3">Matching incidents</th><th className="p-3">KPI / Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {employees.map((employee) => (
                  <tr key={employeeIdOf(employee)} className="text-gray-700 dark:text-slate-200">
                    <td className="p-3 font-medium">{employeeNameOf(employee)}</td>
                    <td className="p-3">{employeeCompanyOf(employee) || "—"}</td>
                    <td className="p-3">{deploymentStatusOf(employee)}</td>
                    <td className="p-3 tabular-nums">{report.incidentCounts.get(employeeIdOf(employee)) || 0}</td>
                    <td className="p-3">{kpiLevelOf(employee)} / {riskLevelOf(employee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
