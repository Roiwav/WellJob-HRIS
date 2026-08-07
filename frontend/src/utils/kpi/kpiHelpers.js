import { getSeverityWeight } from "../configStorage";

export const EMPLOYEES_KEY = "legacy_employees_disabled";
export const INCIDENTS_KEY = "legacy_incidents_disabled";

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

export const DECISION_CONFIDENCE = {
  LOW: "Low Confidence",
  MODERATE: "Moderate Confidence",
  HIGH: "High Confidence",
};

export const HR_ACTION_WORKFLOW = {
  MONITOR: "Continue Monitoring",
  HUMAN_REVIEW: "Human Review Required",
  HR_VALIDATION: "HR Validation Required",
  INVESTIGATION: "Schedule HR Investigation",
  PIP: "Performance Improvement Review",
  ESCALATION: "Priority HR Escalation",
  SUSPENSION: "Suspension Review",
  TERMINATION: "Termination Review",
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

export function safeParse() {
  return [];
}

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeStatus(status) {
  const value = normalizeComparableText(status);

  if (
    value === "resolved" ||
    value === "for review"
  ) {
    return "For Review";
  }

  if (value === "closed") {
    return "Closed";
  }

  if (value === "investigating") {
    return "Investigating";
  }

  return "Open";
}

export function normalizeKPILevel(level) {
  const value = normalizeComparableText(level);

  switch (value) {
    case "clean":
    case "good":
    case "good standing":
      return KPI_LEVELS.GOOD_STANDING;

    case "low":
    case "minor":
    case "minor concern":
      return KPI_LEVELS.MINOR_CONCERN;

    case "medium":
    case "improvement":
    case "needs improvement":
      return KPI_LEVELS.NEEDS_IMPROVEMENT;

    case "high":
    case "critical":
    case "critical concern":
      return KPI_LEVELS.CRITICAL_CONCERN;

    default:
      return level || KPI_LEVELS.GOOD_STANDING;
  }
}

export function normalizeRiskLevel(level) {
  const value = normalizeComparableText(level);

  switch (value) {
    case "clean":
    case "low":
    case "low risk":
      return RISK_LEVELS.LOW_RISK;

    case "monitor":
    case "monitoring":
      return RISK_LEVELS.MONITOR;

    case "repeat":
    case "repeat offender":
      return RISK_LEVELS.REPEAT;

    case "critical":
    case "high":
    case "high risk":
      return RISK_LEVELS.HIGH_RISK;

    default:
      return level || RISK_LEVELS.LOW_RISK;
  }
}

export function normalizeSeverityLabel(level) {
  const value = normalizeComparableText(level);

  switch (value) {
    case "clean":
    case "none":
      return SEVERITY_LABELS.NONE;

    case "minor":
    case "low":
      return SEVERITY_LABELS.MINOR;

    case "major":
    case "medium":
      return SEVERITY_LABELS.MAJOR;

    case "critical":
    case "high":
      return SEVERITY_LABELS.CRITICAL;

    default:
      return level || SEVERITY_LABELS.NONE;
  }
}

export function normalizeRecommendation(recommendation) {
  const value = normalizeComparableText(recommendation);

  if (
    value === "retain" ||
    value === "retain / maintain good standing" ||
    value === "retain maintain good standing"
  ) {
    return RECOMMENDATION_LABELS.RETAIN;
  }

  return recommendation || RECOMMENDATION_LABELS.RETAIN;
}

export function getEmployeeId(employee, index = 0) {
  return (
    employee?.id ||
    employee?.employeeId ||
    employee?.employee_id ||
    `EMP-${index + 1}`
  );
}

export function getEmployeeName(employee) {
  return (
    employee?.name ||
    employee?.full_name ||
    employee?.fullName ||
    "Unknown Employee"
  );
}

export function isSameEmployee(
  employee,
  incident,
  index = 0
) {
  const employeeId = String(
    getEmployeeId(employee, index)
  );

  const employeeName = normalizeText(
    getEmployeeName(employee)
  );

  const incidentEmployeeId = String(
    incident?.employeeId ||
      incident?.employee_id ||
      incident?.empId ||
      ""
  );

  const incidentEmployeeName = normalizeText(
    incident?.employee ||
      incident?.employeeName ||
      incident?.name
  );

  return (
    employeeId === incidentEmployeeId ||
    employeeName === incidentEmployeeName
  );
}

export function getKPILevelByScore(
  severityScore,
  violationCount
) {
  if (severityScore >= 8) {
    return KPI_LEVELS.CRITICAL_CONCERN;
  }

  if (severityScore >= 4) {
    return KPI_LEVELS.NEEDS_IMPROVEMENT;
  }

  if (violationCount >= 1) {
    return KPI_LEVELS.MINOR_CONCERN;
  }

  return KPI_LEVELS.GOOD_STANDING;
}

export function getRiskLevelByKPI(
  kpiLevel,
  violationCount,
  criticalCount
) {
  const normalizedKPI = normalizeKPILevel(kpiLevel);

  if (criticalCount >= 1) {
    return RISK_LEVELS.HIGH_RISK;
  }

  switch (normalizedKPI) {
    case KPI_LEVELS.CRITICAL_CONCERN:
      return RISK_LEVELS.HIGH_RISK;

    case KPI_LEVELS.NEEDS_IMPROVEMENT:
      return RISK_LEVELS.REPEAT;

    case KPI_LEVELS.MINOR_CONCERN:
      return RISK_LEVELS.MONITOR;

    default:
      return violationCount > 0
        ? RISK_LEVELS.MONITOR
        : RISK_LEVELS.LOW_RISK;
  }
}

export function getSeverityLabelByScore(
  severityScore,
  violationCount
) {
  if (severityScore >= 8) {
    return SEVERITY_LABELS.CRITICAL;
  }

  if (severityScore >= 4) {
    return SEVERITY_LABELS.MAJOR;
  }

  if (violationCount >= 1) {
    return SEVERITY_LABELS.MINOR;
  }

  return SEVERITY_LABELS.NONE;
}

export function getDecisionConfidence({
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
}) {
  if (
    criticalIncidentCount >= 1 ||
    severityScore >= 12 ||
    violationCount >= 5 ||
    riskLevel === RISK_LEVELS.HIGH_RISK
  ) {
    return DECISION_CONFIDENCE.HIGH;
  }

  if (
    severityScore >= 4 ||
    violationCount >= 2 ||
    riskLevel === RISK_LEVELS.REPEAT
  ) {
    return DECISION_CONFIDENCE.MODERATE;
  }

  return DECISION_CONFIDENCE.LOW;
}

export function getSuggestedHRAction({
  confidence = DECISION_CONFIDENCE.LOW,
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
}) {
  if (
    criticalIncidentCount >= 1 &&
    violationCount >= 5 &&
    severityScore >= 12
  ) {
    return HR_ACTION_WORKFLOW.TERMINATION;
  }

  if (
    criticalIncidentCount >= 1 ||
    riskLevel === RISK_LEVELS.HIGH_RISK
  ) {
    return HR_ACTION_WORKFLOW.SUSPENSION;
  }

  if (
    confidence === DECISION_CONFIDENCE.HIGH &&
    violationCount >= 3
  ) {
    return HR_ACTION_WORKFLOW.ESCALATION;
  }

  if (
    confidence === DECISION_CONFIDENCE.MODERATE &&
    violationCount >= 2
  ) {
    return HR_ACTION_WORKFLOW.INVESTIGATION;
  }

  if (confidence === DECISION_CONFIDENCE.MODERATE) {
    return HR_ACTION_WORKFLOW.HR_VALIDATION;
  }

  if (
    confidence === DECISION_CONFIDENCE.LOW &&
    violationCount >= 1
  ) {
    return HR_ACTION_WORKFLOW.HUMAN_REVIEW;
  }

  return HR_ACTION_WORKFLOW.MONITOR;
}

export function getDecisionConfidenceReason({
  confidence = DECISION_CONFIDENCE.LOW,
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
}) {
  if (confidence === DECISION_CONFIDENCE.HIGH) {
    return `High confidence because the employee record shows strong decision indicators such as ${violationCount} violation(s), ${criticalIncidentCount} critical case(s), ${severityScore} severity score, and ${riskLevel} status. HR review is required before final action.`;
  }

  if (confidence === DECISION_CONFIDENCE.MODERATE) {
    return `Moderate confidence because the employee has enough recorded concern for HR validation, including ${violationCount} violation(s), ${criticalIncidentCount} critical case(s), and ${severityScore} severity score.`;
  }

  if (violationCount >= 1) {
    return "Low confidence because the record shows an early concern only. Human review is recommended before applying any corrective action.";
  }

  return "Low confidence because there is no negative KPI pattern requiring corrective action. The employee may continue under regular monitoring.";
}

export function getSuggestedHRActionReason({
  suggestedHRAction = HR_ACTION_WORKFLOW.MONITOR,
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
}) {
  switch (suggestedHRAction) {
    case HR_ACTION_WORKFLOW.TERMINATION:
      return `Termination review is suggested because the employee has severe indicators such as ${violationCount} violation(s), ${criticalIncidentCount} critical case(s), and ${severityScore} severity score. This is only for HR Manager validation and not an automatic termination decision.`;

    case HR_ACTION_WORKFLOW.SUSPENSION:
      return "Suspension review is suggested because the employee has a critical incident or high-risk evaluation. Final action must still be validated by HR management.";

    case HR_ACTION_WORKFLOW.ESCALATION:
      return "Priority HR escalation is suggested because the employee has repeated concerns with strong decision indicators. The case should be reviewed immediately.";

    case HR_ACTION_WORKFLOW.INVESTIGATION:
      return "HR investigation is suggested because the employee has repeated or moderate KPI concerns that require validation and documentation.";

    case HR_ACTION_WORKFLOW.HR_VALIDATION:
      return "HR validation is suggested because the system detected a moderate concern that needs confirmation before final action.";

    case HR_ACTION_WORKFLOW.HUMAN_REVIEW:
      return "Human review is suggested because the employee has an early concern but the record is not yet strong enough for a higher-level action.";

    case HR_ACTION_WORKFLOW.PIP:
      return "Performance improvement review is suggested because the employee has KPI concerns that may require structured monitoring and improvement targets.";

    case HR_ACTION_WORKFLOW.MONITOR:
    default:
      return `Continue monitoring is suggested because the employee does not currently show a strong negative KPI or risk pattern. Current risk level: ${riskLevel}.`;
  }
}

export function getDecisionConfidenceClasses(
  confidence
) {
  switch (confidence) {
    case DECISION_CONFIDENCE.HIGH:
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300";

    case DECISION_CONFIDENCE.MODERATE:
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";

    case DECISION_CONFIDENCE.LOW:
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300";
  }
}

export function getSuggestedHRActionClasses(action) {
  switch (action) {
    case HR_ACTION_WORKFLOW.TERMINATION:
    case HR_ACTION_WORKFLOW.SUSPENSION:
    case HR_ACTION_WORKFLOW.ESCALATION:
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";

    case HR_ACTION_WORKFLOW.INVESTIGATION:
    case HR_ACTION_WORKFLOW.HR_VALIDATION:
    case HR_ACTION_WORKFLOW.PIP:
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";

    case HR_ACTION_WORKFLOW.HUMAN_REVIEW:
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300";

    case HR_ACTION_WORKFLOW.MONITOR:
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
}

function getActionByCode(code) {
  return (
    WELLJOB_LOW_KPI_ACTIONS.find(
      (action) => action.code === code
    ) || WELLJOB_LOW_KPI_ACTIONS[0]
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

function toTitleCase(value = "") {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getReadableViolationName(value = "") {
  if (!value) {
    return "Recorded Violation";
  }

  return toTitleCase(value);
}

function getSafeIncidents(incidents) {
  return Array.isArray(incidents)
    ? incidents.filter(Boolean)
    : [];
}

function countByViolation(relatedIncidents = []) {
  const counts = new Map();
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  safeIncidents.forEach((incident) => {
    const key = getViolationText(incident);

    if (!key) {
      return;
    }

    counts.set(
      key,
      (counts.get(key) || 0) + 1
    );
  });

  return counts;
}

function hasRepeatedSameViolation(
  relatedIncidents = []
) {
  const counts = countByViolation(
    relatedIncidents
  );

  return Array.from(counts.values()).some(
    (count) => count >= 2
  );
}

function getMostCommonViolation(
  relatedIncidents = []
) {
  const counts = countByViolation(
    relatedIncidents
  );

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

function hasAttendanceOrPolicyConcern(
  relatedIncidents = []
) {
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  return safeIncidents.some((incident) => {
    const text = getViolationText(incident);

    return (
      text.includes("tardiness") ||
      text.includes("late") ||
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

function hasSkillsOrQualityConcern(
  relatedIncidents = []
) {
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  return safeIncidents.some((incident) => {
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

function hasPossibleRoleMismatchConcern(
  relatedIncidents = []
) {
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  const repeatedSameViolation =
    hasRepeatedSameViolation(safeIncidents);

  return safeIncidents.some((incident) => {
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

function getSeverityBreakdown(
  relatedIncidents = []
) {
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  return safeIncidents.reduce(
    (accumulator, incident) => {
      const severity = normalizeSeverityLabel(
        incident?.severity
      );

      if (severity === SEVERITY_LABELS.CRITICAL) {
        accumulator.critical += 1;
      } else if (
        severity === SEVERITY_LABELS.MAJOR
      ) {
        accumulator.major += 1;
      } else if (
        severity === SEVERITY_LABELS.MINOR
      ) {
        accumulator.minor += 1;
      } else {
        accumulator.none += 1;
      }

      return accumulator;
    },
    {
      critical: 0,
      major: 0,
      minor: 0,
      none: 0,
    }
  );
}

function buildSeveritySummary(
  relatedIncidents = []
) {
  const breakdown = getSeverityBreakdown(
    relatedIncidents
  );

  const parts = [];

  if (breakdown.critical > 0) {
    parts.push(`${breakdown.critical} critical`);
  }

  if (breakdown.major > 0) {
    parts.push(`${breakdown.major} major`);
  }

  if (breakdown.minor > 0) {
    parts.push(`${breakdown.minor} minor`);
  }

  if (parts.length === 0) {
    return "no severity-bearing incident";
  }

  return parts.join(", ");
}

function buildDynamicBasis({
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  normalizedRisk = RISK_LEVELS.LOW_RISK,
  normalizedKPI = KPI_LEVELS.GOOD_STANDING,
  relatedIncidents = [],
  commonViolation = {
    violation: "",
    count: 0,
  },
}) {
  const severitySummary = buildSeveritySummary(
    relatedIncidents
  );

  const commonViolationName =
    getReadableViolationName(
      commonViolation.violation
    );

  if (violationCount === 0) {
    return "No recorded incident, no severity score, and good standing KPI status.";
  }

  if (commonViolation.count >= 2) {
    return `${violationCount} recorded violation(s), including ${commonViolation.count} recurring ${commonViolationName} case(s), with ${severitySummary} classification and a total severity score of ${severityScore}.`;
  }

  if (criticalIncidentCount >= 1) {
    return `${criticalIncidentCount} critical incident(s), ${violationCount} total recorded violation(s), and a severity score of ${severityScore}.`;
  }

  return `${violationCount} recorded violation(s), ${severitySummary} classification, KPI level of ${normalizedKPI}, risk level of ${normalizedRisk}, and total severity score of ${severityScore}.`;
}

function buildDynamicReason({
  primaryCode,
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  normalizedRisk = RISK_LEVELS.LOW_RISK,
  normalizedKPI = KPI_LEVELS.GOOD_STANDING,
  relatedIncidents = [],
  commonViolation = {
    violation: "",
    count: 0,
  },
  repeatedSameViolation = false,
  attendanceOrPolicyConcern = false,
}) {
  const commonViolationName =
    getReadableViolationName(
      commonViolation.violation
    );

  const severitySummary = buildSeveritySummary(
    relatedIncidents
  );

  if (
    primaryCode ===
    "PERFORMANCE_IMPROVEMENT_PLAN"
  ) {
    if (
      criticalIncidentCount >= 1 ||
      severityScore >= 8
    ) {
      return `Employee requires a structured Performance Improvement Plan because the record shows ${severitySummary} classification with a total severity score of ${severityScore}, placing the employee under ${normalizedKPI} and ${normalizedRisk}.`;
    }

    if (
      repeatedSameViolation &&
      commonViolation.count >= 2
    ) {
      return `Employee requires a Performance Improvement Plan because recurring ${commonViolationName} was detected ${commonViolation.count} time(s), showing a repeated KPI standing concern.`;
    }

    return `Employee requires a Performance Improvement Plan because there are ${violationCount} recorded violation(s), resulting in ${normalizedKPI} and ${normalizedRisk} status.`;
  }

  if (
    primaryCode ===
    "REASSIGNMENT_OF_POSITION"
  ) {
    const baseViolation =
      commonViolation.count >= 2
        ? `recurring ${commonViolationName} was detected ${commonViolation.count} time(s)`
        : "repeated task, quality, or performance-related concern was detected";

    return `Employee may need reassignment review because ${baseViolation}. This may indicate possible role mismatch in the current assignment.`;
  }

  if (primaryCode === "EMPLOYEE_TRAINING") {
    return "Employee is recommended for training because the recorded concern is related to task quality, productivity, safety, or competency improvement. Training can help correct the issue before it becomes repeated.";
  }

  if (primaryCode === "SEMINAR_WEBINAR") {
    if (
      repeatedSameViolation &&
      commonViolation.count >= 2
    ) {
      return `Employee is recommended for a refresher seminar or webinar because recurring ${commonViolationName} was detected ${commonViolation.count} time(s), indicating the need for policy awareness reinforcement.`;
    }

    if (attendanceOrPolicyConcern) {
      return "Employee is recommended for a refresher seminar or webinar because the recorded violation is related to attendance, policy compliance, or workplace behavior awareness.";
    }

    return "Employee is recommended for a seminar or webinar to reinforce company policies and prevent repeated KPI standing concerns.";
  }

  if (primaryCode === "VERBAL_COUNSELING") {
    return `Employee is recommended for verbal counseling because there is an early KPI standing concern with ${violationCount} recorded violation(s), allowing HR to correct the issue before it becomes repeated.`;
  }

  return "Employee recommendation is based on the recorded violation pattern, KPI level, risk level, and severity score.";
}

export function getCorrectiveActionRecommendation({
  violationCount = 0,
  criticalIncidentCount = 0,
  severityScore = 0,
  riskLevel = RISK_LEVELS.LOW_RISK,
  kpiLevel = KPI_LEVELS.GOOD_STANDING,
  relatedIncidents = [],
}) {
  const safeRelatedIncidents = getSafeIncidents(
    relatedIncidents
  );

  const normalizedRisk =
    normalizeRiskLevel(riskLevel);

  const normalizedKPI =
    normalizeKPILevel(kpiLevel);

  const isGoodStanding =
    violationCount === 0 &&
    criticalIncidentCount === 0 &&
    severityScore === 0 &&
    normalizedRisk === RISK_LEVELS.LOW_RISK &&
    normalizedKPI === KPI_LEVELS.GOOD_STANDING;

  if (isGoodStanding) {
    return {
      recommendation:
        RECOMMENDATION_LABELS.RETAIN,

      recommendationReason:
        "Employee has no recorded violation, no active incident severity score, and may maintain good standing under regular HR monitoring.",

      correctiveActionCode: "RETAIN",

      correctiveAction:
        RECOMMENDATION_LABELS.RETAIN,

      correctiveActionDescription:
        "No corrective action is required for this employee.",

      correctiveActionReason:
        "No corrective action is required because the employee has no recorded KPI standing concern.",

      correctiveActionBasis:
        "No violation, no critical incident, zero severity score, and good standing KPI status.",

      applicableActions: [],
    };
  }

  const repeatedSameViolation =
    hasRepeatedSameViolation(
      safeRelatedIncidents
    );

  const commonViolation =
    getMostCommonViolation(
      safeRelatedIncidents
    );

  const attendanceOrPolicyConcern =
    hasAttendanceOrPolicyConcern(
      safeRelatedIncidents
    );

  const skillsOrQualityConcern =
    hasSkillsOrQualityConcern(
      safeRelatedIncidents
    );

  const possibleRoleMismatch =
    hasPossibleRoleMismatchConcern(
      safeRelatedIncidents
    );

  let primaryCode = "VERBAL_COUNSELING";

  if (
    criticalIncidentCount >= 1 ||
    severityScore >= 8 ||
    normalizedRisk === RISK_LEVELS.HIGH_RISK ||
    normalizedKPI === KPI_LEVELS.CRITICAL_CONCERN
  ) {
    primaryCode =
      "PERFORMANCE_IMPROVEMENT_PLAN";
  } else if (possibleRoleMismatch) {
    primaryCode =
      "REASSIGNMENT_OF_POSITION";
  } else if (skillsOrQualityConcern) {
    primaryCode =
      violationCount >= 3 ||
      repeatedSameViolation
        ? "REASSIGNMENT_OF_POSITION"
        : "EMPLOYEE_TRAINING";
  } else if (attendanceOrPolicyConcern) {
    primaryCode =
      violationCount >= 3 ||
      repeatedSameViolation
        ? "SEMINAR_WEBINAR"
        : "VERBAL_COUNSELING";
  } else if (repeatedSameViolation) {
    primaryCode = "SEMINAR_WEBINAR";
  } else if (
    violationCount >= 3 ||
    normalizedRisk === RISK_LEVELS.REPEAT ||
    normalizedKPI === KPI_LEVELS.NEEDS_IMPROVEMENT
  ) {
    primaryCode =
      "PERFORMANCE_IMPROVEMENT_PLAN";
  }

  const primaryAction =
    getActionByCode(primaryCode);

  const reason = buildDynamicReason({
    primaryCode,
    violationCount,
    criticalIncidentCount,
    severityScore,
    normalizedRisk,
    normalizedKPI,
    relatedIncidents: safeRelatedIncidents,
    commonViolation,
    repeatedSameViolation,
    attendanceOrPolicyConcern,
  });

  const basis = buildDynamicBasis({
    violationCount,
    criticalIncidentCount,
    severityScore,
    normalizedRisk,
    normalizedKPI,
    relatedIncidents: safeRelatedIncidents,
    commonViolation,
  });

  const applicableActions =
    WELLJOB_LOW_KPI_ACTIONS.filter(
      (action) => {
        if (action.code === primaryCode) {
          return true;
        }

        if (
          action.code === "VERBAL_COUNSELING" &&
          violationCount >= 1 &&
          violationCount <= 2
        ) {
          return true;
        }

        if (
          action.code ===
            "PERFORMANCE_IMPROVEMENT_PLAN" &&
          (violationCount >= 3 ||
            criticalIncidentCount >= 1 ||
            normalizedRisk ===
              RISK_LEVELS.HIGH_RISK ||
            normalizedRisk ===
              RISK_LEVELS.REPEAT ||
            normalizedKPI ===
              KPI_LEVELS.NEEDS_IMPROVEMENT ||
            normalizedKPI ===
              KPI_LEVELS.CRITICAL_CONCERN)
        ) {
          return true;
        }

        if (
          action.code ===
            "REASSIGNMENT_OF_POSITION" &&
          possibleRoleMismatch
        ) {
          return true;
        }

        if (
          action.code === "SEMINAR_WEBINAR" &&
          (attendanceOrPolicyConcern ||
            repeatedSameViolation)
        ) {
          return true;
        }

        if (
          action.code === "EMPLOYEE_TRAINING" &&
          skillsOrQualityConcern
        ) {
          return true;
        }

        return false;
      }
    );

  return {
    recommendation: primaryAction.title,
    recommendationReason: reason,
    correctiveActionCode: primaryAction.code,
    correctiveAction: primaryAction.title,
    correctiveActionDescription:
      primaryAction.shortDescription,
    correctiveActionReason: reason,
    correctiveActionBasis: basis,
    applicableActions,
  };
}

export function getDSSRecommendation(employee) {
  return getCorrectiveActionRecommendation(
    employee || {}
  ).recommendation;
}

export function getDSSReason(employee) {
  return getCorrectiveActionRecommendation(
    employee || {}
  ).recommendationReason;
}

export function getAlertClasses(level) {
  switch (level) {
    case "HIGH":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300";

    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300";

    case "LOW":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300";
  }
}

export function getMonthLabel(dateString) {
  if (!dateString) {
    return "N/A";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-US", {
    month: "short",
  });
}

function getIncidentDateValue(incident) {
  return (
    incident?.reportedAt ||
    incident?.date ||
    incident?.createdAt ||
    null
  );
}

function getLatestIncidentDate(
  relatedIncidents = []
) {
  const safeIncidents = getSafeIncidents(
    relatedIncidents
  );

  let latestValue = null;
  let latestTimestamp = -1;

  safeIncidents.forEach((incident) => {
    const candidate =
      getIncidentDateValue(incident);

    if (!candidate) {
      return;
    }

    const timestamp = new Date(
      candidate
    ).getTime();

    if (
      Number.isNaN(timestamp) ||
      timestamp <= latestTimestamp
    ) {
      return;
    }

    latestTimestamp = timestamp;
    latestValue = candidate;
  });

  return latestValue;
}

export function buildKPIEmployees(
  employeesRaw = [],
  incidentsRaw = []
) {
  const safeEmployees =
    Array.isArray(employeesRaw)
      ? employeesRaw.filter(Boolean)
      : [];

  const safeIncidents =
    Array.isArray(incidentsRaw)
      ? incidentsRaw.filter(Boolean)
      : [];

  return safeEmployees.map(
    (employee, index) => {
      const employeeId = getEmployeeId(
        employee,
        index
      );

      const employeeName =
        getEmployeeName(employee);

      const relatedIncidents =
        safeIncidents.filter((incident) =>
          isSameEmployee(
            {
              ...employee,
              id: employeeId,
              name: employeeName,
            },
            incident,
            index
          )
        );

      const totalSeverityScore =
        relatedIncidents.reduce(
          (sum, incident) => {
            const normalizedSeverity =
              normalizeSeverityLabel(
                incident?.severity
              );

            return (
              sum +
              (Number(
                getSeverityWeight(
                  normalizedSeverity
                )
              ) || 0)
            );
          },
          0
        );

      const criticalCount =
        relatedIncidents.filter(
          (incident) =>
            normalizeSeverityLabel(
              incident?.severity
            ) ===
            SEVERITY_LABELS.CRITICAL
        ).length;

      const openCount =
        relatedIncidents.filter((incident) =>
          [
            "Open",
            "Investigating",
            "For Review",
          ].includes(
            normalizeStatus(
              incident?.status
            )
          )
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

      const correctiveAction =
        getCorrectiveActionRecommendation({
          violationCount:
            relatedIncidents.length,
          criticalIncidentCount:
            criticalCount,
          severityScore:
            totalSeverityScore,
          riskLevel,
          kpiLevel,
          relatedIncidents,
        });

      const decisionConfidence =
        getDecisionConfidence({
          violationCount:
            relatedIncidents.length,
          criticalIncidentCount:
            criticalCount,
          severityScore:
            totalSeverityScore,
          riskLevel,
        });

      const suggestedHRAction =
        getSuggestedHRAction({
          confidence: decisionConfidence,
          violationCount:
            relatedIncidents.length,
          criticalIncidentCount:
            criticalCount,
          severityScore:
            totalSeverityScore,
          riskLevel,
        });

      const decisionConfidenceReason =
        getDecisionConfidenceReason({
          confidence: decisionConfidence,
          violationCount:
            relatedIncidents.length,
          criticalIncidentCount:
            criticalCount,
          severityScore:
            totalSeverityScore,
          riskLevel,
        });

      const suggestedHRActionReason =
        getSuggestedHRActionReason({
          suggestedHRAction,
          violationCount:
            relatedIncidents.length,
          criticalIncidentCount:
            criticalCount,
          severityScore:
            totalSeverityScore,
          riskLevel,
        });

      return {
        id: employeeId,
        name: employeeName,

        company:
          employee?.company ||
          employee?.clientCompany ||
          "Unassigned",

        status:
          employee?.status ||
          "Unknown",

        isDeployed:
          normalizeText(
            employee?.status
          ) === "deployed",

        violationCount:
          relatedIncidents.length,

        openIncidentCount: openCount,
        criticalIncidentCount:
          criticalCount,
        severityScore:
          totalSeverityScore,

        severityLabel:
          getSeverityLabelByScore(
            totalSeverityScore,
            relatedIncidents.length
          ),

        kpiLevel,
        riskLevel,
        decisionConfidence,
        decisionConfidenceReason,
        suggestedHRAction,
        suggestedHRActionReason,

        lastIncidentDate:
          getLatestIncidentDate(
            relatedIncidents
          ),

        relatedIncidents,

        recommendation:
          correctiveAction.recommendation,

        recommendationReason:
          correctiveAction.recommendationReason,

        correctiveActionCode:
          correctiveAction.correctiveActionCode,

        correctiveAction:
          correctiveAction.correctiveAction,

        correctiveActionDescription:
          correctiveAction.correctiveActionDescription,

        correctiveActionReason:
          correctiveAction.correctiveActionReason,

        correctiveActionBasis:
          correctiveAction.correctiveActionBasis,

        applicableActions:
          correctiveAction.applicableActions,
      };
    }
  );
}

export function buildViolationTrend(
  incidentsRaw = []
) {
  const safeIncidents =
    Array.isArray(incidentsRaw)
      ? incidentsRaw.filter(Boolean)
      : [];

  const monthMap = MONTHS.reduce(
    (accumulator, month) => {
      accumulator[month] = 0;
      return accumulator;
    },
    {}
  );

  safeIncidents.forEach((incident) => {
    const month = getMonthLabel(
      getIncidentDateValue(incident)
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
  const safeEmployees =
    Array.isArray(employees)
      ? employees.filter(Boolean)
      : [];

  const safeIncidents =
    Array.isArray(incidentsRaw)
      ? incidentsRaw.filter(Boolean)
      : [];

  const safeTotalEmployees = Math.max(
    0,
    Number(totalEmployees || 0)
  );

  return MONTHS.map((month) => {
    const monthIncidentEmployeeIds =
      new Set();

    safeIncidents.forEach((incident) => {
      const incidentMonth = getMonthLabel(
        getIncidentDateValue(incident)
      );

      if (incidentMonth !== month) {
        return;
      }

      const matchedEmployeeIndex =
        safeEmployees.findIndex(
          (employee, index) =>
            isSameEmployee(
              employee,
              incident,
              index
            )
        );

      if (matchedEmployeeIndex < 0) {
        return;
      }

      monthIncidentEmployeeIds.add(
        String(
          getEmployeeId(
            safeEmployees[
              matchedEmployeeIndex
            ],
            matchedEmployeeIndex
          )
        )
      );
    });

    const goodStandingEmployees = Math.max(
      safeTotalEmployees -
        monthIncidentEmployeeIds.size,
      0
    );

    return {
      month,

      compliance:
        safeTotalEmployees > 0
          ? Math.round(
              (goodStandingEmployees /
                safeTotalEmployees) *
                100
            )
          : 0,
    };
  });
}

export function buildUtilizationTrend({
  totalEmployees = 0,
  deployedEmployees = 0,
}) {
  const safeTotalEmployees = Math.max(
    0,
    Number(totalEmployees || 0)
  );

  const safeDeployedEmployees = Math.max(
    0,
    Number(deployedEmployees || 0)
  );

  const currentMonth = new Date().toLocaleString(
    "en-US",
    {
      month: "short",
    }
  );

  return MONTHS.map((month) => ({
    month,

    utilization:
      month === currentMonth &&
      safeTotalEmployees > 0
        ? Math.round(
            (safeDeployedEmployees /
              safeTotalEmployees) *
              100
          )
        : 0,
  }));
}