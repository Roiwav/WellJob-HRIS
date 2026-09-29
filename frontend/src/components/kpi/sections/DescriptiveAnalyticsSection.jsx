import { useMemo, useState } from "react";
import { FiInfo } from "react-icons/fi";
import RoleGuard from "../../auth/RoleGuard";
import AnalyticsTrendsSection from "./AnalyticsTrendsSection";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  INITIAL_KPI_FILTERS,
  buildFilteredKpiCsv,
  describeKpiData,
  deploymentStatusOf,
  employeeCompanyOf,
  employeeIdOf,
  employeeNameOf,
  kpiLevelOf,
  riskLevelOf,
  topEmployeesWithEvidence,
} from "../../../utils/kpi/descriptiveAnalytics";
import {
  buildKPILevelDistribution,
  buildRiskLevelDistribution,
} from "../../../utils/kpi/kpiHelpers";
const inputClass = [
  "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5",
  "text-sm font-medium text-slate-800 outline-none transition",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
].join(" ");
const panelClass =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5";
function uniqueValues(values) {
  return [
    ...new Set(
      values
        .map((value) =>
          String(value ?? "").trim()
        )
        .filter(Boolean)
    ),
  ].sort((a, b) =>
    a.localeCompare(b)
  );
}
function Field({
  label,
  children,
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
function Metric({
  label,
  value,
  note,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold leading-none tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>

      {note && (
        <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}

function EmptyMessage({
  children,
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
      <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
        {children}
      </p>
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
    () =>
      describeKpiData(
        employees,
        incidents,
        filters
      ),
    [employees, incidents, filters]
  );
  const companies = useMemo(
    () =>
      uniqueValues(
        sourceEmployees.map(
          employeeCompanyOf
        )
      ),
    [sourceEmployees]
  );
  const employeeOptions = useMemo(
    () =>
      sourceEmployees
        .filter(
          (employee) =>
            !filters.company ||
            employeeCompanyOf(
              employee
            ).toLowerCase() ===
              filters.company.toLowerCase()
        )
        .map((employee) => ({
          id: employeeIdOf(employee),
          name: employeeNameOf(employee),
        }))
        .filter(({ id }) => id)
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    [sourceEmployees, filters.company]
  );
  const riskOptions = useMemo(
    () =>
      uniqueValues(
        [
          ...sourceEmployees,
          ...employees,
        ]
          .map(riskLevelOf)
          .filter(
            (value) =>
              value !== "Not available"
          )
      ),
    [sourceEmployees, employees]
  );
  const kpiOptions = useMemo(
    () =>
      uniqueValues(
        [
          ...sourceEmployees,
          ...employees,
        ]
          .map(kpiLevelOf)
          .filter(
            (value) =>
              value !== "Not available"
          )
      ),
    [sourceEmployees, employees]
  );
  const hasAdditionalFilters = Boolean(
    filters.deploymentStatus ||
      filters.severity ||
      filters.kpiLevel
  );
  const [showMoreFilters, setShowMoreFilters] = useState(
    () => hasAdditionalFilters
  );
  const ranked = useMemo(
    () =>
      topEmployeesWithEvidence(
        employees,
        incidents,
        5
      ),
    [employees, incidents]
  );
  const incidentSeverityBreakdown = useMemo(
    () => {
      const counts = {
        Minor: 0,
        Major: 0,
        Critical: 0,
        Other: 0,
      };
      incidents.forEach((incident) => {
        const severity =
          String(
            incident?.severity || ""
          ).trim();
        if (
          severity === "Minor" ||
          severity === "Major" ||
          severity === "Critical"
        ) {
          counts[severity] += 1;
        } else {
          counts.Other += 1;
        }
      });
      return counts;
    },
    [incidents]
  );
  const analyticsDistributions = useMemo(
    () => ({
      kpiLevelDistribution:
        buildKPILevelDistribution(
          employees
        ),
      riskLevelDistribution:
        buildRiskLevelDistribution(
          employees
        ),
    }),
    [employees]
  );
  function update(name, value) {
    if (
      typeof onFiltersChange !==
      "function"
    ) {
      return;
    }
    onFiltersChange(
      (previous) => ({
        ...previous,
        [name]: value,
        ...(name === "company"
          ? { employeeId: "" }
          : {}),
      })
    );
  }
  function exportCsv() {
    const csv =
      buildFilteredKpiCsv(
        employees,
        incidents,
        filters
      );
    const blob =
      new Blob(
        [csv],
        {
          type: "text/csv;charset=utf-8;",
        }
      );
    const url =
      URL.createObjectURL(blob);
    const link =
      document.createElement("a");
    link.href = url;
    link.download =
      `WELLJOB-KPI-Filtered-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="min-w-0 space-y-4"
      aria-label="KPI descriptive analytics"
    >
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Workforce Analytics
        </h2>
        <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          Filter the current KPI report to review a specific group of employees and incident records.
          Company and deployment information reflect the current employee
          record, while date filters apply to recorded incident dates.
        </p>
      </div>
      <div className={panelClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Report Filters
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Use the common filters below to narrow the current KPI report.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onFiltersChange?.({
                  ...INITIAL_KPI_FILTERS,
                });
                setShowMoreFilters(false);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset Filters
            </button>
            <RoleGuard
              permission={
                PERMISSIONS.CAN_EXPORT_PDF
              }
            >
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              >
                Export Results (CSV)
              </button>
            </RoleGuard>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-3">
            <Field label="Company / Client">
              <select
                className={inputClass}
                value={
                  filters.company || ""
                }
                onChange={(event) =>
                  update(
                    "company",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All companies
                </option>
                {companies.map(
                  (company) => (
                    <option
                      key={company}
                      value={company}
                    >
                      {company}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
          <div className="min-w-0 xl:col-span-3">
            <Field label="Employee">
              <select
                className={inputClass}
                value={
                  filters.employeeId || ""
                }
                onChange={(event) =>
                  update(
                    "employeeId",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All employees
                </option>
                {employeeOptions.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.name} (#{employee.id})
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
          <div className="min-w-0 md:col-span-2 xl:col-span-4">
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Incident Period
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0">
                  <span className="sr-only">
                    Incident start date
                  </span>
                  <input
                    className={inputClass}
                    aria-label="Incident start date"
                    type="date"
                    value={
                      filters.startDate || ""
                    }
                    max={
                      filters.endDate ||
                      undefined
                    }
                    onChange={(event) =>
                      update(
                        "startDate",
                        event.target.value
                      )
                    }
                  />
                </label>
                <label className="min-w-0">
                  <span className="sr-only">
                    Incident end date
                  </span>
                  <input
                    className={inputClass}
                    aria-label="Incident end date"
                    type="date"
                    value={
                      filters.endDate || ""
                    }
                    min={
                      filters.startDate ||
                      undefined
                    }
                    onChange={(event) =>
                      update(
                        "endDate",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="min-w-0 xl:col-span-2">
            <Field label="Risk Level">
              <select
                className={inputClass}
                value={
                  filters.riskLevel || ""
                }
                onChange={(event) =>
                  update(
                    "riskLevel",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All risk levels
                </option>
                {riskOptions.map(
                  (level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            aria-expanded={showMoreFilters}
            aria-controls="analytics-more-filters"
            onClick={() =>
              setShowMoreFilters(
                (current) => !current
              )
            }
            className="inline-flex w-fit items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
          >
            {showMoreFilters
              ? "Hide Additional Filters"
              : "More Filters"}
            {!showMoreFilters &&
              hasAdditionalFilters && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Active
                </span>
              )}
          </button>
          <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            Incident dates use the occurrence date, or the reported date when an occurrence date is unavailable.
          </p>
        </div>
        {showMoreFilters && (
          <div
            id="analytics-more-filters"
            className="mt-3 grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/35 sm:grid-cols-3"
          >
            <Field label="Deployment Status">
              <select
                className={inputClass}
                value={
                  filters.deploymentStatus ||
                  ""
                }
                onChange={(event) =>
                  update(
                    "deploymentStatus",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All statuses
                </option>
                <option value="Deployed">
                  Deployed
                </option>
                <option value="Not deployed">
                  Not deployed
                </option>
                <option value="Unknown">
                  Status unavailable
                </option>
              </select>
            </Field>
            <Field label="Incident Severity">
              <select
                className={inputClass}
                value={
                  filters.severity || ""
                }
                onChange={(event) =>
                  update(
                    "severity",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All severities
                </option>
                <option value="Minor">
                  Minor
                </option>
                <option value="Major">
                  Major
                </option>
                <option value="Critical">
                  Critical
                </option>
              </select>
            </Field>
            <Field label="KPI Standing">
              <select
                className={inputClass}
                value={
                  filters.kpiLevel || ""
                }
                onChange={(event) =>
                  update(
                    "kpiLevel",
                    event.target.value
                  )
                }
              >
                <option value="">
                  All KPI standings
                </option>
                {kpiOptions.map(
                  (level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
        )}
      </div>
      <div className={panelClass}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Filtered Workforce Snapshot
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              A quick summary of the employees and incident records included by the current Analytics filters.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Employees in View"
            value={report.totalEmployees}
            note="Employees included by the current filters"
          />
          <Metric
            label="Incident Records"
            value={report.incidentCount}
            note="Incident records matching the current filters"
          />
          <Metric
            label="Employees with Matching Incidents"
            value={report.affected}
            note="Employees with at least one incident record in this filtered view"
          />
          <Metric
            label="Employees with No Matching Incident Records"
            value={report.incidentFree}
            note={
              report.incidentFreeRate ===
              null
                ? "No employees match the current filters"
                : `${report.incidentFreeRate.toFixed(
                    1
                  )}% of employees in view have no incident record matching the current filters`
            }
          />
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/35">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Matching Incident Severity
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  {incidentSeverityBreakdown.Minor} Minor
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                  {incidentSeverityBreakdown.Major} Major
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 dark:bg-rose-400" />
                  {incidentSeverityBreakdown.Critical} Critical
                </span>
                {incidentSeverityBreakdown.Other > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                    {incidentSeverityBreakdown.Other} Other / Unspecified
                  </span>
                )}
              </div>
            </div>
            <div className="flex max-w-2xl items-start gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <FiInfo
                className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"
                size={14}
                aria-hidden="true"
              />
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                No matching incident records means no incident matched the current
                Analytics filters for those employees. It does not mean the
                employee has never had an incident or confirm strong job
                performance.
              </p>
            </div>
          </div>
        </div>
      </div>
      <AnalyticsTrendsSection
        kpiLevelDistribution={
          analyticsDistributions.kpiLevelDistribution
        }
        riskLevelDistribution={
          analyticsDistributions.riskLevelDistribution
        }
      />
      {ranked.length > 0 && (
        <div className={panelClass}>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recorded Performance Scores
            </h3>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              This section appears only when a separate numeric performance score
              is available in the selected employee records. The score is not
              calculated from incidents, severity, KPI standing, or risk level.
              Confirm the approved score scale before interpreting higher values.
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {ranked.map(
              ({
                employee,
                score,
                explanation,
              }) => (
                <article
                  key={
                    employeeIdOf(employee)
                  }
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {employeeNameOf(
                          employee
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {employeeCompanyOf(
                          employee
                        ) ||
                          "Company not recorded"}
                        {" • "}
                        {kpiLevelOf(employee)}
                        {" • "}
                        {riskLevelOf(employee)}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-right dark:bg-indigo-950/30">
                      <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                        Recorded score
                      </p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-indigo-700 dark:text-indigo-200">
                        {score}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {explanation}
                  </p>
                </article>
              )
            )}
          </div>
        </div>
      )}
      <div className={panelClass}>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Employee KPI Overview
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Review the employee records behind the current analytical scope,
            including deployment status, matching incidents, KPI standing, and
            risk level.
          </p>
        </div>
        {employees.length === 0 ? (
          <div className="mt-3">
            <EmptyMessage>
              No employees match the selected filters.
            </EmptyMessage>
          </div>
        ) : (
          <div className="mt-3 max-h-[500px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    Employee
                  </th>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    Company
                  </th>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    Deployment
                  </th>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    Matching Incidents
                  </th>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    KPI Standing
                  </th>
                  <th
                    scope="col"
                    className="p-3"
                  >
                    Risk Level
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map(
                  (employee) => (
                    <tr
                      key={
                        employeeIdOf(
                          employee
                        )
                      }
                      className="text-slate-700 dark:text-slate-200"
                    >
                      <td className="p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="inline-flex min-w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {employeeIdOf(
                              employee
                            )}
                          </span>
                          <span className="min-w-0 font-medium text-slate-900 dark:text-slate-100">
                            {employeeNameOf(
                              employee
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {employeeCompanyOf(
                          employee
                        ) || "—"}
                      </td>
                      <td className="p-3">
                        {deploymentStatusOf(
                          employee
                        )}
                      </td>
                      <td className="p-3 tabular-nums">
                        {report.incidentCounts.get(
                          employeeIdOf(
                            employee
                          )
                        ) || 0}
                      </td>
                      <td className="p-3">
                        {kpiLevelOf(
                          employee
                        )}
                      </td>
                      <td className="p-3">
                        {riskLevelOf(
                          employee
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}