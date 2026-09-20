/**
 * WELLJOB — read-only analytical view of the existing KPI engine.
 * The official KPI decision queue is never modified by these filters.
 * IMPORTANT: company/deployment are CURRENT roster values, not historical assignments.
 */
export const INITIAL_KPI_FILTERS = Object.freeze({
  company: "",
  employeeId: "",
  startDate: "",
  endDate: "",
  deploymentStatus: "",
  severity: "",
  riskLevel: "",
  kpiLevel: "",
});

const text = (value) => String(value ?? "").trim();
const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();

export function employeeIdOf(employee) {
  return text(employee?.id ?? employee?.employeeId ?? employee?.employee_id);
}

export function incidentEmployeeIdOf(incident) {
  return text(incident?.employeeId ?? incident?.employee_id ?? incident?.empId ?? incident?.employeeID);
}

export function employeeCompanyOf(employee) {
  const company = employee?.company ?? employee?.clientCompany ?? employee?.client_company;
  if (company && typeof company === "object") {
    return text(company.name ?? company.company_name);
  }
  return text(company);
}

export function employeeNameOf(employee) {
  const direct = text(employee?.name ?? employee?.full_name ?? employee?.fullName ?? employee?.employeeName ?? employee?.employee_name);
  if (direct && direct !== "Unknown Employee") return direct;
  const complete = [employee?.firstName ?? employee?.first_name, employee?.lastName ?? employee?.last_name]
    .map(text).filter(Boolean).join(" ");
  return complete || direct || `Employee #${employeeIdOf(employee) || "unknown"}`;
}

export function deploymentStatusOf(employee) {
  const explicit = text(employee?.deploymentStatus ?? employee?.deployment_status).toLowerCase();
  const status = explicit || text(employee?.status).toLowerCase();
  if (["deployed", "on deployment", "assigned"].includes(status)) return "Deployed";
  if (["available", "not deployed", "undeployed", "floating", "unassigned"].includes(status)) return "Not deployed";
  if (!explicit && employee?.isDeployed === true) return "Deployed";
  // buildKPIEmployees sets isDeployed=false for an unknown status such as "Active";
  // false here is not sufficient evidence to label an employee "Not deployed".
  return "Unknown"; // Active employment alone does not establish deployment.
}

export function riskLevelOf(employee) {
  return text(employee?.riskLevel ?? employee?.risk_level) || "Not available";
}

export function kpiLevelOf(employee) {
  return text(employee?.kpiLevel ?? employee?.KPILevel ?? employee?.kpi_level) || "Not available";
}

/** Only a separate recorded performance score is eligible for the performance list.
 * An incident penalty / severity score is NOT a positive job-performance score.
 * Verify that larger values mean better performance before presenting the ordering.
 */
export function existingKpiScoreOf(employee) {
  const value = employee?.clientPerformanceScore ?? employee?.client_performance_score
    ?? employee?.performanceScore ?? employee?.performance_score;
  if (value === null || value === undefined || text(value) === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function incidentDateOf(incident) {
  // Prefer the incident occurrence date. Some APIs only provide a reported date.
  const value = incident?.incidentDate ?? incident?.incident_date
    ?? incident?.date ?? incident?.reportedAt ?? incident?.reported_at;
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  const match = text(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function incidentSeverityOf(incident) {
  return text(incident?.severity) || "Not specified";
}

function inPeriod(incident, filters) {
  if (!filters.startDate && !filters.endDate) return true;
  const date = incidentDateOf(incident);
  // Unknown date must never silently be treated as occurring inside a chosen window.
  if (!date) return false;
  if (filters.startDate && date < filters.startDate) return false;
  if (filters.endDate && date > filters.endDate) return false;
  return true;
}

function isArchived(employee) {
  return employee?.archived === true || employee?.isArchived === true ||
    Number(employee?.archived) === 1 || Number(employee?.isArchived) === 1;
}

export function filterKpiRecords({ employees = [], incidents = [], filters = {}, buildKPIEmployees }) {
  if (typeof buildKPIEmployees !== "function") {
    throw new TypeError("Pass the existing buildKPIEmployees function.");
  }
  const f = { ...INITIAL_KPI_FILTERS, ...filters };
  if (f.startDate && f.endDate && f.startDate > f.endDate) {
    return { employees: [], incidents: [] };
  }
  const roster = (Array.isArray(employees) ? employees : []).filter((employee) => {
    if (!employee || isArchived(employee)) return false;
    if (f.company && !same(employeeCompanyOf(employee), f.company)) return false;
    if (f.employeeId && employeeIdOf(employee) !== text(f.employeeId)) return false;
    if (f.deploymentStatus && !same(deploymentStatusOf(employee), f.deploymentStatus)) return false;
    return true;
  });

  const rosterIds = new Set(roster.map(employeeIdOf).filter(Boolean));
  const periodIncidents = (Array.isArray(incidents) ? incidents : []).filter((incident) => {
    const employeeId = incidentEmployeeIdOf(incident);
    return Boolean(employeeId && rosterIds.has(employeeId) && inPeriod(incident, f));
  });

  // The period KPI must account for ALL incident severities.
  // Selecting "Critical" should not accidentally erase recorded minor/major incidents
  // from the KPI score and show a misleading risk level.
  const computed = buildKPIEmployees(roster, periodIncidents);
  if (!Array.isArray(computed)) throw new TypeError("buildKPIEmployees must return an array.");

  const rawById = new Map(roster.map((employee) => [employeeIdOf(employee), employee]));
  const matchingIncidents = f.severity
    ? periodIncidents.filter((incident) => same(incidentSeverityOf(incident), f.severity))
    : periodIncidents;
  const matchingEmployeeIds = new Set(matchingIncidents.map(incidentEmployeeIdOf));

  const filteredEmployees = computed
    .map((employee) => ({ ...rawById.get(employeeIdOf(employee)), ...employee }))
    .filter((employee) => {
      if (f.severity && !matchingEmployeeIds.has(employeeIdOf(employee))) return false;
      if (f.riskLevel && !same(riskLevelOf(employee), f.riskLevel)) return false;
      if (f.kpiLevel && !same(kpiLevelOf(employee), f.kpiLevel)) return false;
      return true;
    });

  const selectedIds = new Set(filteredEmployees.map(employeeIdOf).filter(Boolean));
  return {
    employees: filteredEmployees,
    // Charts describe the filtered employee cohort (KPI computed from all incident severities in period).
    // Incident summary and CSV show only reports that match the incident-severity filter.
    incidents: matchingIncidents.filter((incident) => selectedIds.has(incidentEmployeeIdOf(incident))),
  };
}

export function describeKpiData(employees = [], incidents = [], filters = {}) {
  const incidentCounts = new Map();
  const severityTotals = { Minor: 0, Major: 0, Critical: 0, Other: 0 };
  const roster = Array.isArray(employees) ? employees : [];
  const included = new Set(roster.map(employeeIdOf).filter(Boolean));
  const matchedIncidents = (Array.isArray(incidents) ? incidents : []).filter((incident) =>
    included.has(incidentEmployeeIdOf(incident))
  );
  for (const incident of matchedIncidents) {
    const employeeId = incidentEmployeeIdOf(incident);
    incidentCounts.set(employeeId, (incidentCounts.get(employeeId) || 0) + 1);
    const key = ["Minor", "Major", "Critical"].find((level) => same(incidentSeverityOf(incident), level));
    severityTotals[key || "Other"] += 1;
  }
  const totalEmployees = roster.length;
  const affected = roster.filter((employee) => (incidentCounts.get(employeeIdOf(employee)) || 0) > 0).length;
  const noMatching = totalEmployees - affected;
  const noMatchingRate = totalEmployees ? 100 * noMatching / totalEmployees : null;
  const deployed = roster.filter((employee) => deploymentStatusOf(employee) === "Deployed").length;
  const unknownDeployment = roster.filter((employee) => deploymentStatusOf(employee) === "Unknown").length;
  const period = filters.startDate || filters.endDate
    ? `between ${filters.startDate || "the earliest recorded date"} and ${filters.endDate || "the latest recorded date"}`
    : "across available recorded dates";
  const severity = filters.severity ? ` with ${filters.severity.toLowerCase()} severity` : "";
  const company = filters.company ? ` currently assigned to ${filters.company}` : " in the selected workforce";
  const description = totalEmployees === 0
    ? "No employees match the selected filters. Adjust or reset the filters to review the available records."
    : `Among ${totalEmployees} matching employee(s)${company}, ${affected} have at least one matching incident record${severity} ${period}. ${noMatching} have no matching incident (${noMatchingRate.toFixed(1)}%). ${matchedIncidents.length} incident report(s) match the selected scope: ${severityTotals.Minor} minor, ${severityTotals.Major} major, ${severityTotals.Critical} critical, and ${severityTotals.Other} other/unspecified.`;
  return {
    totalEmployees, affected, incidentFree: noMatching, incidentFreeRate: noMatchingRate,
    incidentCount: matchedIncidents.length, deployed, unknownDeployment,
    severityTotals, description, incidentCounts,
  };
}

export function performanceExplanation(employee, matchingIncidents = []) {
  const breakdown = new Map();
  for (const incident of matchingIncidents) {
    const label = incidentSeverityOf(incident);
    breakdown.set(label, (breakdown.get(label) || 0) + 1);
  }
  const performanceScore = existingKpiScoreOf(employee);
  const scoreText = performanceScore === null
    ? "No separate numeric employee/client performance score is available."
    : `Recorded employee/client performance score: ${performanceScore} (verify the applicable scoring rubric).`;
  const incidentText = matchingIncidents.length === 0
    ? "No incident reports match the selected filters."
    : `${matchingIncidents.length} incident(s) match the filters (${[...breakdown].map(([name, count]) => `${count} ${name.toLowerCase()}`).join(", ")}).`;
  return `${scoreText} ${incidentText} Current deployment status: ${deploymentStatusOf(employee)}. Incident and deployment records alone do not establish overall job performance.`;
}

export function topEmployeesWithEvidence(employees = [], incidents = [], limit = 5) {
  const grouped = new Map();
  for (const incident of incidents) {
    const employeeId = incidentEmployeeIdOf(incident);
    if (!employeeId) continue;
    if (!grouped.has(employeeId)) grouped.set(employeeId, []);
    grouped.get(employeeId).push(incident);
  }
  return (Array.isArray(employees) ? employees : [])
    .filter((employee) => existingKpiScoreOf(employee) !== null)
    .sort((a, b) => existingKpiScoreOf(b) - existingKpiScoreOf(a)
      || employeeNameOf(a).localeCompare(employeeNameOf(b)))
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((employee) => ({
      employee,
      score: existingKpiScoreOf(employee),
      incidents: grouped.get(employeeIdOf(employee)) || [],
      explanation: performanceExplanation(employee, grouped.get(employeeIdOf(employee)) || []),
    }));
}

export function csvCell(value) {
  const valueText = text(value);
  const safeText = /^[\s]*[=+@\-\t\r]/.test(valueText) ? `'${valueText}` : valueText;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildFilteredKpiCsv(employees = [], incidents = [], filters = {}) {
  const report = describeKpiData(employees, incidents, filters);
  const byEmployee = new Map();
  for (const incident of incidents) {
    const employeeId = incidentEmployeeIdOf(incident);
    if (!byEmployee.has(employeeId)) byEmployee.set(employeeId, []);
    byEmployee.get(employeeId).push(incident);
  }
  const rows = [
    ["Report scope", "Current employee roster; occurrence/reported dates for incidents"],
    ["From date", filters.startDate || "All dates"],
    ["To date", filters.endDate || "All dates"],
    ["Company", filters.company || "All"],
    ["Incident severity", filters.severity || "All"],
    ["Matching employees", report.totalEmployees],
    ["Matching incident reports", report.incidentCount],
    [],
    ["Employee ID", "Employee", "Company", "Current deployment", "Period KPI level", "Period risk level", "Recorded performance score (source record; not date-filtered)", "Matching incidents", "Description"],
    ...employees.map((employee) => {
      const ownIncidents = byEmployee.get(employeeIdOf(employee)) || [];
      return [employeeIdOf(employee), employeeNameOf(employee), employeeCompanyOf(employee),
        deploymentStatusOf(employee), kpiLevelOf(employee), riskLevelOf(employee),
        existingKpiScoreOf(employee) ?? "", ownIncidents.length, performanceExplanation(employee, ownIncidents)];
    }),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
