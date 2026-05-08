import { getSeverityWeight } from "../configStorage";

export const EMPLOYEES_KEY = "employees";
export const INCIDENTS_KEY = "incidents";

export const KPI_LEVELS = {
  GOOD_STANDING: "Good Standing",
  MINOR_CONCERN: "Minor Concern",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  CRITICAL_CONCERN: "Critical Concern",
};

export const RISK_LEVELS = {
  LOW_RISK: "Low Risk",
  MONITOR: "Monitor",
  REPEAT: "Repeat",
  HIGH_RISK: "High Risk",
};

export const SEVERITY_LABELS = {
  NONE: "None",
  MINOR: "Minor",
  MAJOR: "Major",
  CRITICAL: "Critical",
};

export const RECOMMENDATION_LABELS = {
  RETAIN: "Retain / Maintain Good Standing",
};

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

export const WELLJOB_LOW_KPI_ACTIONS = [
  {
    title: "Verbal Counseling",
    code: "VERBAL_COUNSELING",
    shortDescription:
      "Initial coaching or reminder for employees with early signs of KPI standing concern or minor performance concern.",
  },
  {
    title: "Performance Improvement Plan",
    code: "PERFORMANCE_IMPROVEMENT_PLAN",
    shortDescription:
      "Structured monitoring plan with target goals, review period, and expected improvement.",
  },
  {
    title: "Reassignment of Position",
    code: "REASSIGNMENT_OF_POSITION",
    shortDescription:
      "Review possible role mismatch and consider reassignment when the employee may perform better in another position or deployment assignment.",
  },
  {
    title: "Seminar & Webinar",
    code: "SEMINAR_WEBINAR",
    shortDescription:
      "Policy refresher or awareness session for recurring behavioral, attendance, or compliance-related concerns.",
  },
  {
    title: "Employee Training",
    code: "EMPLOYEE_TRAINING",
    shortDescription:
      "Skills-based training for quality, productivity, safety, task handling, or competency improvement.",
  },
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

export function normalizeKPILevel(level) {
  switch (level) {
    case "Clean":
      return KPI_LEVELS.GOOD_STANDING;
    case "Low":
      return KPI_LEVELS.MINOR_CONCERN;
    case "Medium":
      return KPI_LEVELS.NEEDS_IMPROVEMENT;
    case "High":
      return KPI_LEVELS.CRITICAL_CONCERN;
    default:
      return level || KPI_LEVELS.GOOD_STANDING;
  }
}

export function normalizeRiskLevel(level) {
  if (level === "Clean") return RISK_LEVELS.LOW_RISK;
  return level || RISK_LEVELS.LOW_RISK;
}

export function normalizeSeverityLabel(level) {
  if (level === "Clean") return SEVERITY_LABELS.NONE;
  return level || SEVERITY_LABELS.NONE;
}

export function normalizeRecommendation(recommendation) {
  if (recommendation === "Retain") return RECOMMENDATION_LABELS.RETAIN;
  return recommendation || RECOMMENDATION_LABELS.RETAIN;
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
  if (severityScore >= 8) return KPI_LEVELS.CRITICAL_CONCERN;
  if (severityScore >= 4) return KPI_LEVELS.NEEDS_IMPROVEMENT;
  if (violationCount >= 1) return KPI_LEVELS.MINOR_CONCERN;
  return KPI_LEVELS.GOOD_STANDING;
}

export function getRiskLevelByKPI(kpiLevel, violationCount, criticalCount) {
  const normalizedKPI = normalizeKPILevel(kpiLevel);

  if (criticalCount >= 1) return RISK_LEVELS.HIGH_RISK;

  switch (normalizedKPI) {
    case KPI_LEVELS.CRITICAL_CONCERN:
      return RISK_LEVELS.HIGH_RISK;
    case KPI_LEVELS.NEEDS_IMPROVEMENT:
      return RISK_LEVELS.REPEAT;
    case KPI_LEVELS.MINOR_CONCERN:
      return RISK_LEVELS.MONITOR;
    default:
      return violationCount > 0 ? RISK_LEVELS.MONITOR : RISK_LEVELS.LOW_RISK;
  }
}

export function getSeverityLabelByScore(severityScore, violationCount) {
  if (severityScore >= 8) return SEVERITY_LABELS.CRITICAL;
  if (severityScore >= 4) return SEVERITY_LABELS.MAJOR;
  if (violationCount >= 1) return SEVERITY_LABELS.MINOR;
  return SEVERITY_LABELS.NONE;
}

function getActionByCode(code) {
  return (
    WELLJOB_LOW_KPI_ACTIONS.find((action) => action.code === code) ||
    WELLJOB_LOW_KPI_ACTIONS[0]
  );
}

function getViolationText(incident) {
  return normalizeText(
    incident?.violation ||
      incident?.violationType ||
      incident?.violation_type ||
      incident?.description ||
      ""
  );
}

function countByViolation(relatedIncidents = []) {
  const counts = new Map();

  relatedIncidents.forEach((incident) => {
    const key = getViolationText(incident);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return counts;
}

function hasRepeatedSameViolation(relatedIncidents = []) {
  const counts = countByViolation(relatedIncidents);
  return Array.from(counts.values()).some((count) => count >= 2);
}

function getMostCommonViolation(relatedIncidents = []) {
  const counts = countByViolation(relatedIncidents);

  let selected = "";
  let selectedCount = 0;

  counts.forEach((count, violation) => {
    if (count > selectedCount) {
      selected = violation;
      selectedCount = count;
    }
  });

  return {
    violation: selected,
    count: selectedCount,
  };
}

function hasAttendanceOrPolicyConcern(relatedIncidents = []) {
  return relatedIncidents.some((incident) => {
    const text = getViolationText(incident);

    return (
      text.includes("tardiness") ||
      text.includes("absence") ||
      text.includes("absenteeism") ||
      text.includes("awol") ||
      text.includes("uniform") ||
      text.includes("mobile") ||
      text.includes("policy") ||
      text.includes("attendance")
    );
  });
}

function hasSkillsOrQualityConcern(relatedIncidents = []) {
  return relatedIncidents.some((incident) => {
    const text = getViolationText(incident);

    return (
      text.includes("quality") ||
      text.includes("negligence") ||
      text.includes("instruction") ||
      text.includes("safety") ||
      text.includes("task") ||
      text.includes("productivity") ||
      text.includes("performance")
    );
  });
}

function hasPossibleRoleMismatchConcern(relatedIncidents = []) {
  const repeatedSameViolation = hasRepeatedSameViolation(relatedIncidents);

  return relatedIncidents.some((incident) => {
    const text = getViolationText(incident);

    return (
      repeatedSameViolation &&
      (text.includes("negligence") ||
        text.includes("instruction") ||
        text.includes("task") ||
        text.includes("quality") ||
        text.includes("performance"))
    );
  });
}

export function getCorrectiveActionRecommendation({
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
  kpiLevel = KPI_LEVELS.GOOD_STANDING,
  relatedIncidents = [],
}) {
  const normalizedRisk = normalizeRiskLevel(riskLevel);
  const normalizedKPI = normalizeKPILevel(kpiLevel);

  const isGoodStanding =
    violationCount === 0 &&
    criticalIncidentCount === 0 &&
    severityScore === 0 &&
    normalizedRisk === RISK_LEVELS.LOW_RISK &&
    normalizedKPI === KPI_LEVELS.GOOD_STANDING;

  if (isGoodStanding) {
    return {
      recommendation: RECOMMENDATION_LABELS.RETAIN,
      recommendationReason:
        "Employee has no recorded violation and may maintain good standing under regular HR monitoring.",
      correctiveActionCode: "RETAIN",
      correctiveAction: RECOMMENDATION_LABELS.RETAIN,
      correctiveActionDescription:
        "No corrective action is required for this employee.",
      correctiveActionReason:
        "No corrective action is required because the employee has no recorded KPI standing concern.",
      correctiveActionBasis:
        "No violation, no critical incident, and good standing KPI status.",
      applicableActions: [],
    };
  }

  const repeatedSameViolation = hasRepeatedSameViolation(relatedIncidents);
  const commonViolation = getMostCommonViolation(relatedIncidents);
  const attendanceOrPolicyConcern =
    hasAttendanceOrPolicyConcern(relatedIncidents);
  const skillsOrQualityConcern = hasSkillsOrQualityConcern(relatedIncidents);
  const possibleRoleMismatch =
    hasPossibleRoleMismatchConcern(relatedIncidents);

  let primaryCode = "VERBAL_COUNSELING";
  let reason =
    "Employee has a minor KPI standing concern. Initial coaching or verbal counseling is recommended before the concern becomes repeated.";
  let basis = `${violationCount} recorded violation(s).`;

  if (
    criticalIncidentCount >= 1 ||
    severityScore >= 8 ||
    normalizedRisk === RISK_LEVELS.HIGH_RISK ||
    normalizedKPI === KPI_LEVELS.CRITICAL_CONCERN
  ) {
    primaryCode = "PERFORMANCE_IMPROVEMENT_PLAN";
    reason =
      "Employee has a critical KPI standing concern and needs a structured improvement plan with close HR monitoring.";
    basis = `${criticalIncidentCount} critical incident(s), severity score of ${severityScore}, and risk level of ${normalizedRisk}.`;
  } else if (possibleRoleMismatch) {
    primaryCode = "REASSIGNMENT_OF_POSITION";
    reason =
      "Employee shows repeated task or performance-related concerns that may indicate possible role mismatch.";
    basis =
      commonViolation.count > 1
        ? `Recurring concern detected: ${commonViolation.violation}.`
        : `${violationCount} recorded performance-related concern(s).`;
  } else if (
    violationCount >= 3 ||
    normalizedRisk === RISK_LEVELS.REPEAT ||
    normalizedKPI === KPI_LEVELS.NEEDS_IMPROVEMENT
  ) {
    primaryCode = "PERFORMANCE_IMPROVEMENT_PLAN";
    reason =
      "Employee has repeated KPI standing concerns and needs measurable improvement targets and monitoring.";
    basis = `${violationCount} recorded violation(s) and ${normalizedRisk} risk level.`;
  } else if (skillsOrQualityConcern) {
    primaryCode = "EMPLOYEE_TRAINING";
    reason =
      "Employee concern appears connected to task quality, safety, productivity, or competency gaps. Skills-based training is recommended.";
    basis = `${violationCount} recorded skills or quality-related concern(s).`;
  } else if (attendanceOrPolicyConcern || repeatedSameViolation) {
    primaryCode = "SEMINAR_WEBINAR";
    reason =
      "Employee concern appears connected to attendance, policy awareness, or recurring behavior. A refresher seminar or webinar is recommended.";
    basis =
      commonViolation.count > 1
        ? `Recurring concern detected: ${commonViolation.violation}.`
        : `${violationCount} recorded policy or attendance-related concern(s).`;
  }

  const primaryAction = getActionByCode(primaryCode);

  const applicableActions = WELLJOB_LOW_KPI_ACTIONS.filter((action) => {
    if (action.code === primaryCode) return true;

    if (
      action.code === "VERBAL_COUNSELING" &&
      violationCount >= 1 &&
      violationCount <= 2
    ) {
      return true;
    }

    if (
      action.code === "PERFORMANCE_IMPROVEMENT_PLAN" &&
      (violationCount >= 3 ||
        criticalIncidentCount >= 1 ||
        normalizedRisk === RISK_LEVELS.HIGH_RISK ||
        normalizedRisk === RISK_LEVELS.REPEAT ||
        normalizedKPI === KPI_LEVELS.NEEDS_IMPROVEMENT ||
        normalizedKPI === KPI_LEVELS.CRITICAL_CONCERN)
    ) {
      return true;
    }

    if (action.code === "REASSIGNMENT_OF_POSITION" && possibleRoleMismatch) {
      return true;
    }

    if (
      action.code === "SEMINAR_WEBINAR" &&
      (attendanceOrPolicyConcern || repeatedSameViolation)
    ) {
      return true;
    }

    if (action.code === "EMPLOYEE_TRAINING" && skillsOrQualityConcern) {
      return true;
    }

    return false;
  });

  return {
    recommendation: primaryAction.title,
    recommendationReason: reason,
    correctiveActionCode: primaryAction.code,
    correctiveAction: primaryAction.title,
    correctiveActionDescription: primaryAction.shortDescription,
    correctiveActionReason: reason,
    correctiveActionBasis: basis,
    applicableActions,
  };
}

export function getDSSRecommendation(emp) {
  return getCorrectiveActionRecommendation(emp).recommendation;
}

export function getDSSReason(emp) {
  return getCorrectiveActionRecommendation(emp).recommendationReason;
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
      (incident) => incident.severity === SEVERITY_LABELS.CRITICAL
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

    const correctiveAction = getCorrectiveActionRecommendation({
      violationCount: relatedIncidents.length,
      criticalIncidentCount: criticalCount,
      severityScore: totalSeverityScore,
      riskLevel,
      kpiLevel,
      relatedIncidents,
    });

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
      relatedIncidents,
      recommendation: correctiveAction.recommendation,
      recommendationReason: correctiveAction.recommendationReason,
      correctiveActionCode: correctiveAction.correctiveActionCode,
      correctiveAction: correctiveAction.correctiveAction,
      correctiveActionDescription: correctiveAction.correctiveActionDescription,
      correctiveActionReason: correctiveAction.correctiveActionReason,
      correctiveActionBasis: correctiveAction.correctiveActionBasis,
      applicableActions: correctiveAction.applicableActions,
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

    const goodStandingEmployees = Math.max(
      totalEmployees - monthIncidentEmployeeIds.size,
      0
    );

    return {
      month,
      compliance:
        totalEmployees > 0
          ? Math.round((goodStandingEmployees / totalEmployees) * 100)
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