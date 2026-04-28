import { getSeverityWeight } from "../configStorage";

export const EMPLOYEES_KEY = "employees";
export const INCIDENTS_KEY = "incidents";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse ${key}:`, error);
    return [];
  }
}

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "For Review";
  if (value === "for_review") return "For Review";
  if (value === "closed") return "Closed";
  if (value === "investigating") return "Investigating";

  return "Open";
}

export function getEmployeeId(emp, index = 0) {
  return emp.id || emp.employeeId || emp.employee_id || `EMP-${index + 1}`;
}

export function getEmployeeName(emp) {
  return emp.name || emp.full_name || emp.fullName || "Unknown Employee";
}

export function isSameEmployee(emp, incident, index = 0) {
  const employeeId = String(getEmployeeId(emp, index));
  const employeeName = normalizeText(getEmployeeName(emp));

  const incidentEmployeeId = String(
    incident.employeeId || incident.employee_id || incident.empId || ""
  );

  const incidentEmployeeName = normalizeText(
    incident.employee || incident.employeeName || incident.name
  );

  return (
    employeeId === incidentEmployeeId ||
    employeeName === incidentEmployeeName
  );
}

export function getKPILevelByScore(severityScore, violationCount) {
  if (severityScore >= 8) return "High";
  if (severityScore >= 4) return "Medium";
  if (violationCount >= 1) return "Low";
  return "Clean";
}

export function getRiskLevelByKPI(kpiLevel, violationCount, criticalCount) {
  if (criticalCount >= 1) return "High Risk";

  switch (kpiLevel) {
    case "High":
      return "High Risk";
    case "Medium":
      return "Repeat";
    case "Low":
      return "Monitor";
    default:
      return violationCount > 0 ? "Monitor" : "Clean";
  }
}

export function getSeverityLabelByScore(severityScore, violationCount) {
  if (severityScore >= 8) return "Critical";
  if (severityScore >= 4) return "Major";
  if (violationCount >= 1) return "Minor";
  return "Clean";
}

export function getDSSRecommendation(emp) {
  if (emp.criticalIncidentCount >= 2) return "Termination Review";

  if (emp.criticalIncidentCount >= 1 || emp.riskLevel === "High Risk") {
    return "Suspension Review";
  }

  if (emp.violationCount >= 3 || emp.riskLevel === "Repeat") {
    return "Final Warning";
  }

  if (emp.violationCount >= 1 || emp.riskLevel === "Monitor") {
    return "Monitor Employee";
  }

  return "Retain";
}

export function getDSSReason(emp) {
  if (emp.criticalIncidentCount >= 2) {
    return `Employee has ${emp.criticalIncidentCount} critical incident(s), requiring termination review.`;
  }

  if (emp.criticalIncidentCount >= 1 || emp.riskLevel === "High Risk") {
    return "Employee has critical or high-risk incident records requiring suspension review.";
  }

  if (emp.violationCount >= 3 || emp.riskLevel === "Repeat") {
    return "Employee has repeated violations and should receive final warning.";
  }

  if (emp.violationCount >= 1 || emp.riskLevel === "Monitor") {
    return "Employee has recorded violation(s) and should be monitored.";
  }

  return "Employee has no recorded violation and may be retained.";
}

export function getAlertClasses(level) {
  switch (level) {
    case "HIGH":
      return "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300";
    case "MEDIUM":
      return "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300";
    case "LOW":
      return "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300";
    default:
      return "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300";
  }
}

export function getMonthLabel(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-US", { month: "short" });
}

export function buildKPIEmployees(employeesRaw = [], incidentsRaw = []) {
  return employeesRaw.map((emp, index) => {
    const employeeId = getEmployeeId(emp, index);
    const employeeName = getEmployeeName(emp);

    const relatedIncidents = incidentsRaw.filter((incident) =>
      isSameEmployee(
        { ...emp, id: employeeId, name: employeeName },
        incident,
        index
      )
    );

    const totalSeverityScore = relatedIncidents.reduce((sum, incident) => {
      return sum + getSeverityWeight(incident.severity);
    }, 0);

    const criticalCount = relatedIncidents.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    const openCount = relatedIncidents.filter((incident) =>
      ["Open", "Investigating", "For Review"].includes(incident.status)
    ).length;

    const kpiLevel = getKPILevelByScore(
      totalSeverityScore,
      relatedIncidents.length
    );

    const riskLevel = getRiskLevelByKPI(
      kpiLevel,
      relatedIncidents.length,
      criticalCount
    );

    return {
      id: employeeId,
      name: employeeName,
      company: emp.company || emp.clientCompany || "Unassigned",
      status: emp.status || "Unknown",
      isDeployed: normalizeText(emp.status) === "deployed",
      violationCount: relatedIncidents.length,
      openIncidentCount: openCount,
      criticalIncidentCount: criticalCount,
      severityScore: totalSeverityScore,
      severityLabel: getSeverityLabelByScore(
        totalSeverityScore,
        relatedIncidents.length
      ),
      kpiLevel,
      riskLevel,
      lastIncidentDate:
        relatedIncidents[0]?.reportedAt || relatedIncidents[0]?.date || null,
      recommendation: getDSSRecommendation({
        violationCount: relatedIncidents.length,
        criticalIncidentCount: criticalCount,
        riskLevel,
      }),
      recommendationReason: getDSSReason({
        violationCount: relatedIncidents.length,
        criticalIncidentCount: criticalCount,
        riskLevel,
      }),
    };
  });
}

export function buildViolationTrend(incidentsRaw = []) {
  const monthMap = MONTHS.reduce((acc, month) => {
    acc[month] = 0;
    return acc;
  }, {});

  incidentsRaw.forEach((incident) => {
    const month = getMonthLabel(
      incident.reportedAt || incident.date || incident.createdAt
    );

    if (monthMap[month] !== undefined) {
      monthMap[month] += 1;
    }
  });

  return MONTHS.map((month) => ({
    month,
    violations: monthMap[month],
  }));
}

export function buildComplianceTrend({
  employees = [],
  incidentsRaw = [],
  totalEmployees = 0,
}) {
  return MONTHS.map((month) => {
    const monthIncidentEmployeeIds = new Set();

    incidentsRaw.forEach((incident) => {
      const incidentMonth = getMonthLabel(
        incident.reportedAt || incident.date || incident.createdAt
      );

      if (incidentMonth === month) {
        const matchedEmployee = employees.find((emp) =>
          isSameEmployee(emp, incident)
        );

        if (matchedEmployee) {
          monthIncidentEmployeeIds.add(matchedEmployee.id);
        }
      }
    });

    const cleanEmployees = Math.max(
      totalEmployees - monthIncidentEmployeeIds.size,
      0
    );

    return {
      month,
      compliance:
        totalEmployees > 0
          ? Math.round((cleanEmployees / totalEmployees) * 100)
          : 0,
    };
  });
}

export function buildUtilizationTrend({
  totalEmployees = 0,
  deployedEmployees = 0,
}) {
  const currentMonth = new Date().toLocaleString("en-US", { month: "short" });

  return MONTHS.map((month) => ({
    month,
    utilization:
      month === currentMonth && totalEmployees > 0
        ? Math.round((deployedEmployees / totalEmployees) * 100)
        : 0,
  }));
}