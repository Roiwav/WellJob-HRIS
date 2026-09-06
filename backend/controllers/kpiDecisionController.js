const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const KPI_LEVELS = {
  GOOD_STANDING: "Good Standing",
  MINOR_CONCERN: "Minor Concern",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  CRITICAL_CONCERN: "Critical Concern",
};

const RISK_LEVELS = {
  LOW_RISK: "Low Risk",
  MONITOR: "Monitor",
  REPEAT: "Repeat",
  HIGH_RISK: "High Risk",
};

const DECISION_CONFIDENCE = {
  LOW: "Low Confidence",
  MODERATE: "Moderate Confidence",
  HIGH: "High Confidence",
};

const HR_ACTION_WORKFLOW = {
  MONITOR: "Continue Monitoring",
  HUMAN_REVIEW: "Human Review Required",
  HR_VALIDATION: "HR Validation Required",
  INVESTIGATION: "Schedule HR Investigation",
  PIP: "Performance Improvement Review",
  ESCALATION: "Priority HR Escalation",
  SUSPENSION: "Suspension Review",
  TERMINATION: "Termination Review",
};

const SEVERITY_LABELS = {
  NONE: "None",
  MINOR: "Minor",
  MAJOR: "Major",
  CRITICAL: "Critical",
};

const SEVERITY_WEIGHTS = Object.freeze({
  [SEVERITY_LABELS.MINOR]: 1,
  [SEVERITY_LABELS.MAJOR]: 3,
  [SEVERITY_LABELS.CRITICAL]: 5,
});

const RECOMMENDATION_LABELS = {
  RETAIN: "Retain / Maintain Good Standing",
};

const WELLJOB_LOW_KPI_ACTIONS = [
  {
    title: "Verbal Counseling",
    code: "VERBAL_COUNSELING",
  },
  {
    title: "Performance Improvement Plan",
    code: "PERFORMANCE_IMPROVEMENT_PLAN",
  },
  {
    title: "Reassignment of Position",
    code: "REASSIGNMENT_OF_POSITION",
  },
  {
    title: "Seminar & Webinar",
    code: "SEMINAR_WEBINAR",
  },
  {
    title: "Employee Training",
    code: "EMPLOYEE_TRAINING",
  },
];

const ALLOWED_DECISION_TYPES = new Set([
  "Accepted",
  "Modified",
  "Rejected",
]);

const ALLOWED_KPI_LEVELS = new Set(
  Object.values(KPI_LEVELS)
);

const ALLOWED_RISK_LEVELS = new Set(
  Object.values(RISK_LEVELS)
);

const ALLOWED_DECISION_CONFIDENCE = new Set(
  Object.values(DECISION_CONFIDENCE)
);

const ALLOWED_SUGGESTED_HR_ACTIONS = new Set(
  Object.values(HR_ACTION_WORKFLOW)
);

const ALLOWED_SYSTEM_RECOMMENDATIONS = new Set([
  RECOMMENDATION_LABELS.RETAIN,

  ...WELLJOB_LOW_KPI_ACTIONS.map(
    (action) => action.title
  ),
]);

const ALLOWED_FINAL_ACTIONS = new Set([
  ...ALLOWED_SYSTEM_RECOMMENDATIONS,
  ...ALLOWED_SUGGESTED_HR_ACTIONS,
  "No Action Required",
]);

function toCamelCaseRecord(row) {
  return {
    id: row.id,

    employeeId:
      row.employee_id,

    employeeName:
      row.employee_name,

    company:
      row.company ||
      "Unassigned",

    riskLevel:
      row.risk_level ||
      "",

    kpiLevel:
      row.kpi_level ||
      "",

    violationCount:
      Number(
        row.violation_count ||
          0
      ),

    severityScore:
      Number(
        row.severity_score ||
          0
      ),

    criticalIncidentCount:
      Number(
        row.critical_incident_count ||
          0
      ),

    decisionConfidence:
      row.decision_confidence ||
      "",

    suggestedHRAction:
      row.suggested_hr_action ||
      "",

    systemRecommendation:
      row.system_recommendation ||
      "",

    finalAction:
      row.final_action ||
      "",

    decisionType:
      row.decision_type ||
      "Recorded",

    notes:
      row.notes ||
      "",

    decidedBy:
      row.decided_by ||
      "HR User",

    decidedByRole:
      row.decided_by_role ||
      "Authorized User",

    decidedAt:
      row.decided_at,

    status:
      row.status ||
      "Recorded",

    recommendationReason:
      row.recommendation_reason ||
      "",

    decisionConfidenceReason:
      row.decision_confidence_reason ||
      "",

    suggestedHRActionReason:
      row.suggested_hr_action_reason ||
      "",

    correctiveActionBasis:
      row.corrective_action_basis ||
      "",

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function cleanValue(
  value,
  fallback = ""
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const cleaned =
    String(value).trim();

  return cleaned || fallback;
}

function normalizeText(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normalizeComparableText(
  value
) {
  return normalizeText(value)
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}

function getTrustedActor(req) {
  const username =
    cleanValue(
      req.user?.username
    );

  const role =
    cleanValue(
      req.user?.role
    );

  const id =
    req.user?.id ??
    req.user?.userId ??
    null;

  if (
    !username ||
    !role ||
    id === null ||
    id === undefined
  ) {
    return null;
  }

  return {
    id,
    username,
    role,
  };
}

function parseNonNegativeNumber(
  value
) {
  const number =
    Number(
      value ?? 0
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function parseNonNegativeInteger(
  value
) {
  const number =
    parseNonNegativeNumber(
      value
    );

  if (
    number === null ||
    !Number.isInteger(
      number
    )
  ) {
    return null;
  }

  return number;
}

function parsePositiveInteger(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function isAllowedValue(
  value,
  allowedValues
) {
  return allowedValues.has(
    cleanValue(value)
  );
}

function normalizeSeverityLabel(
  level
) {
  const value =
    normalizeComparableText(
      level
    );

  switch (value) {
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
      return SEVERITY_LABELS.NONE;
  }
}

function getSeverityWeight(
  severity
) {
  const normalizedSeverity =
    normalizeSeverityLabel(
      severity
    );

  return (
    SEVERITY_WEIGHTS[
      normalizedSeverity
    ] || 0
  );
}

function getExpectedKPILevel(
  severityScore,
  violationCount
) {
  if (
    severityScore >= 8
  ) {
    return KPI_LEVELS.CRITICAL_CONCERN;
  }

  if (
    severityScore >= 4
  ) {
    return KPI_LEVELS.NEEDS_IMPROVEMENT;
  }

  if (
    violationCount >= 1
  ) {
    return KPI_LEVELS.MINOR_CONCERN;
  }

  return KPI_LEVELS.GOOD_STANDING;
}

function getExpectedRiskLevel(
  kpiLevel,
  violationCount,
  criticalIncidentCount
) {
  if (
    criticalIncidentCount >= 1
  ) {
    return RISK_LEVELS.HIGH_RISK;
  }

  switch (kpiLevel) {
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

function getExpectedDecisionConfidence({
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
}) {
  if (
    criticalIncidentCount >= 1 ||
    severityScore >= 12 ||
    violationCount >= 5 ||
    riskLevel ===
      RISK_LEVELS.HIGH_RISK
  ) {
    return DECISION_CONFIDENCE.HIGH;
  }

  if (
    severityScore >= 4 ||
    violationCount >= 2 ||
    riskLevel ===
      RISK_LEVELS.REPEAT
  ) {
    return DECISION_CONFIDENCE.MODERATE;
  }

  return DECISION_CONFIDENCE.LOW;
}

function getExpectedSuggestedHRAction({
  confidence,
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
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
    riskLevel ===
      RISK_LEVELS.HIGH_RISK
  ) {
    return HR_ACTION_WORKFLOW.SUSPENSION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.HIGH &&
    violationCount >= 3
  ) {
    return HR_ACTION_WORKFLOW.ESCALATION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.MODERATE &&
    violationCount >= 2
  ) {
    return HR_ACTION_WORKFLOW.INVESTIGATION;
  }

  if (
    confidence ===
    DECISION_CONFIDENCE.MODERATE
  ) {
    return HR_ACTION_WORKFLOW.HR_VALIDATION;
  }

  if (
    confidence ===
      DECISION_CONFIDENCE.LOW &&
    violationCount >= 1
  ) {
    return HR_ACTION_WORKFLOW.HUMAN_REVIEW;
  }

  return HR_ACTION_WORKFLOW.MONITOR;
}

function getDecisionConfidenceReason({
  confidence,
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
}) {
  if (
    confidence ===
    DECISION_CONFIDENCE.HIGH
  ) {
    return `High confidence because the employee record shows strong decision indicators such as ${violationCount} violation(s), ${criticalIncidentCount} critical case(s), ${severityScore} severity score, and ${riskLevel} status. HR review is required before final action.`;
  }

  if (
    confidence ===
    DECISION_CONFIDENCE.MODERATE
  ) {
    return `Moderate confidence because the employee has enough recorded concern for HR validation, including ${violationCount} violation(s), ${criticalIncidentCount} critical case(s), and ${severityScore} severity score.`;
  }

  if (
    violationCount >= 1
  ) {
    return "Low confidence because the record shows an early concern only. Human review is recommended before applying any corrective action.";
  }

  return "Low confidence because there is no negative KPI pattern requiring corrective action. The employee may continue under regular monitoring.";
}

function getSuggestedHRActionReason({
  suggestedHRAction,
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
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

function getViolationText(
  incident
) {
  return normalizeText(
    incident?.violation_type ||
      incident?.violation ||
      incident?.violationType ||
      incident?.description ||
      ""
  );
}

function toTitleCase(
  value = ""
) {
  return String(value)
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function getReadableViolationName(
  value = ""
) {
  if (!value) {
    return "Recorded Violation";
  }

  return toTitleCase(value);
}

function getSafeIncidents(
  incidents
) {
  return Array.isArray(
    incidents
  )
    ? incidents.filter(Boolean)
    : [];
}

function countByViolation(
  relatedIncidents = []
) {
  const counts =
    new Map();

  const safeIncidents =
    getSafeIncidents(
      relatedIncidents
    );

  safeIncidents.forEach(
    (incident) => {
      const key =
        getViolationText(
          incident
        );

      if (!key) {
        return;
      }

      counts.set(
        key,
        (counts.get(key) || 0) +
          1
      );
    }
  );

  return counts;
}

function hasRepeatedSameViolation(
  relatedIncidents = []
) {
  const counts =
    countByViolation(
      relatedIncidents
    );

  return Array.from(
    counts.values()
  ).some(
    (count) =>
      count >= 2
  );
}

function getMostCommonViolation(
  relatedIncidents = []
) {
  const counts =
    countByViolation(
      relatedIncidents
    );

  let selected = "";
  let selectedCount = 0;

  counts.forEach(
    (
      count,
      violation
    ) => {
      if (
        count >
        selectedCount
      ) {
        selected =
          violation;

        selectedCount =
          count;
      }
    }
  );

  return {
    violation:
      selected,

    count:
      selectedCount,
  };
}

function hasAttendanceOrPolicyConcern(
  relatedIncidents = []
) {
  return getSafeIncidents(
    relatedIncidents
  ).some(
    (incident) => {
      const text =
        getViolationText(
          incident
        );

      return (
        text.includes(
          "tardiness"
        ) ||
        text.includes(
          "late"
        ) ||
        text.includes(
          "absence"
        ) ||
        text.includes(
          "absenteeism"
        ) ||
        text.includes(
          "awol"
        ) ||
        text.includes(
          "uniform"
        ) ||
        text.includes(
          "mobile"
        ) ||
        text.includes(
          "policy"
        ) ||
        text.includes(
          "attendance"
        )
      );
    }
  );
}

function hasSkillsOrQualityConcern(
  relatedIncidents = []
) {
  return getSafeIncidents(
    relatedIncidents
  ).some(
    (incident) => {
      const text =
        getViolationText(
          incident
        );

      return (
        text.includes(
          "quality"
        ) ||
        text.includes(
          "negligence"
        ) ||
        text.includes(
          "instruction"
        ) ||
        text.includes(
          "safety"
        ) ||
        text.includes(
          "task"
        ) ||
        text.includes(
          "productivity"
        ) ||
        text.includes(
          "performance"
        )
      );
    }
  );
}

function hasPossibleRoleMismatchConcern(
  relatedIncidents = []
) {
  const safeIncidents =
    getSafeIncidents(
      relatedIncidents
    );

  const repeatedSameViolation =
    hasRepeatedSameViolation(
      safeIncidents
    );

  return safeIncidents.some(
    (incident) => {
      const text =
        getViolationText(
          incident
        );

      return (
        repeatedSameViolation &&
        (
          text.includes(
            "negligence"
          ) ||
          text.includes(
            "instruction"
          ) ||
          text.includes(
            "task"
          ) ||
          text.includes(
            "quality"
          ) ||
          text.includes(
            "performance"
          )
        )
      );
    }
  );
}

function getSeverityBreakdown(
  relatedIncidents = []
) {
  return getSafeIncidents(
    relatedIncidents
  ).reduce(
    (
      accumulator,
      incident
    ) => {
      const severity =
        normalizeSeverityLabel(
          incident?.severity
        );

      if (
        severity ===
        SEVERITY_LABELS.CRITICAL
      ) {
        accumulator.critical +=
          1;
      } else if (
        severity ===
        SEVERITY_LABELS.MAJOR
      ) {
        accumulator.major +=
          1;
      } else if (
        severity ===
        SEVERITY_LABELS.MINOR
      ) {
        accumulator.minor +=
          1;
      } else {
        accumulator.none +=
          1;
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
  const breakdown =
    getSeverityBreakdown(
      relatedIncidents
    );

  const parts = [];

  if (
    breakdown.critical >
    0
  ) {
    parts.push(
      `${breakdown.critical} critical`
    );
  }

  if (
    breakdown.major >
    0
  ) {
    parts.push(
      `${breakdown.major} major`
    );
  }

  if (
    breakdown.minor >
    0
  ) {
    parts.push(
      `${breakdown.minor} minor`
    );
  }

  if (
    parts.length === 0
  ) {
    return "no severity-bearing incident";
  }

  return parts.join(", ");
}

function buildDynamicBasis({
  violationCount,
  criticalIncidentCount,
  severityScore,
  normalizedRisk,
  normalizedKPI,
  relatedIncidents,
  commonViolation,
}) {
  const severitySummary =
    buildSeveritySummary(
      relatedIncidents
    );

  const commonViolationName =
    getReadableViolationName(
      commonViolation.violation
    );

  if (
    violationCount === 0
  ) {
    return "No recorded incident, no severity score, and good standing KPI status.";
  }

  if (
    commonViolation.count >=
    2
  ) {
    return `${violationCount} recorded violation(s), including ${commonViolation.count} recurring ${commonViolationName} case(s), with ${severitySummary} classification and a total severity score of ${severityScore}.`;
  }

  if (
    criticalIncidentCount >=
    1
  ) {
    return `${criticalIncidentCount} critical incident(s), ${violationCount} total recorded violation(s), and a severity score of ${severityScore}.`;
  }

  return `${violationCount} recorded violation(s), ${severitySummary} classification, KPI level of ${normalizedKPI}, risk level of ${normalizedRisk}, and total severity score of ${severityScore}.`;
}

function buildDynamicReason({
  primaryCode,
  violationCount,
  criticalIncidentCount,
  severityScore,
  normalizedRisk,
  normalizedKPI,
  relatedIncidents,
  commonViolation,
  repeatedSameViolation,
  attendanceOrPolicyConcern,
}) {
  const commonViolationName =
    getReadableViolationName(
      commonViolation.violation
    );

  const severitySummary =
    buildSeveritySummary(
      relatedIncidents
    );

  if (
    primaryCode ===
    "PERFORMANCE_IMPROVEMENT_PLAN"
  ) {
    if (
      criticalIncidentCount >=
        1 ||
      severityScore >= 8
    ) {
      return `Employee requires a structured Performance Improvement Plan because the record shows ${severitySummary} classification with a total severity score of ${severityScore}, placing the employee under ${normalizedKPI} and ${normalizedRisk}.`;
    }

    if (
      repeatedSameViolation &&
      commonViolation.count >=
        2
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
      commonViolation.count >=
      2
        ? `recurring ${commonViolationName} was detected ${commonViolation.count} time(s)`
        : "repeated task, quality, or performance-related concern was detected";

    return `Employee may need reassignment review because ${baseViolation}. This may indicate possible role mismatch in the current assignment.`;
  }

  if (
    primaryCode ===
    "EMPLOYEE_TRAINING"
  ) {
    return "Employee is recommended for training because the recorded concern is related to task quality, productivity, safety, or competency improvement. Training can help correct the issue before it becomes repeated.";
  }

  if (
    primaryCode ===
    "SEMINAR_WEBINAR"
  ) {
    if (
      repeatedSameViolation &&
      commonViolation.count >=
        2
    ) {
      return `Employee is recommended for a refresher seminar or webinar because recurring ${commonViolationName} was detected ${commonViolation.count} time(s), indicating the need for policy awareness reinforcement.`;
    }

    if (
      attendanceOrPolicyConcern
    ) {
      return "Employee is recommended for a refresher seminar or webinar because the recorded violation is related to attendance, policy compliance, or workplace behavior awareness.";
    }

    return "Employee is recommended for a seminar or webinar to reinforce company policies and prevent repeated KPI standing concerns.";
  }

  if (
    primaryCode ===
    "VERBAL_COUNSELING"
  ) {
    return `Employee is recommended for verbal counseling because there is an early KPI standing concern with ${violationCount} recorded violation(s), allowing HR to correct the issue before it becomes repeated.`;
  }

  return "Employee recommendation is based on the recorded violation pattern, KPI level, risk level, and severity score.";
}

function getActionByCode(
  code
) {
  return (
    WELLJOB_LOW_KPI_ACTIONS.find(
      (action) =>
        action.code ===
        code
    ) ||
    WELLJOB_LOW_KPI_ACTIONS[0]
  );
}

function getCorrectiveActionRecommendation({
  violationCount,
  criticalIncidentCount,
  severityScore,
  riskLevel,
  kpiLevel,
  relatedIncidents,
}) {
  const safeRelatedIncidents =
    getSafeIncidents(
      relatedIncidents
    );

  const isGoodStanding =
    violationCount === 0 &&
    criticalIncidentCount ===
      0 &&
    severityScore === 0 &&
    riskLevel ===
      RISK_LEVELS.LOW_RISK &&
    kpiLevel ===
      KPI_LEVELS.GOOD_STANDING;

  if (isGoodStanding) {
    return {
      recommendation:
        RECOMMENDATION_LABELS.RETAIN,

      recommendationReason:
        "Employee has no recorded violation, no active incident severity score, and may maintain good standing under regular HR monitoring.",

      correctiveActionBasis:
        "No violation, no critical incident, zero severity score, and good standing KPI status.",
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

  let primaryCode =
    "VERBAL_COUNSELING";

  if (
    criticalIncidentCount >=
      1 ||
    severityScore >= 8 ||
    riskLevel ===
      RISK_LEVELS.HIGH_RISK ||
    kpiLevel ===
      KPI_LEVELS.CRITICAL_CONCERN
  ) {
    primaryCode =
      "PERFORMANCE_IMPROVEMENT_PLAN";
  } else if (
    possibleRoleMismatch
  ) {
    primaryCode =
      "REASSIGNMENT_OF_POSITION";
  } else if (
    skillsOrQualityConcern
  ) {
    primaryCode =
      violationCount >= 3 ||
      repeatedSameViolation
        ? "REASSIGNMENT_OF_POSITION"
        : "EMPLOYEE_TRAINING";
  } else if (
    attendanceOrPolicyConcern
  ) {
    primaryCode =
      violationCount >= 3 ||
      repeatedSameViolation
        ? "SEMINAR_WEBINAR"
        : "VERBAL_COUNSELING";
  } else if (
    repeatedSameViolation
  ) {
    primaryCode =
      "SEMINAR_WEBINAR";
  } else if (
    violationCount >= 3 ||
    riskLevel ===
      RISK_LEVELS.REPEAT ||
    kpiLevel ===
      KPI_LEVELS.NEEDS_IMPROVEMENT
  ) {
    primaryCode =
      "PERFORMANCE_IMPROVEMENT_PLAN";
  }

  const primaryAction =
    getActionByCode(
      primaryCode
    );

  const recommendationReason =
    buildDynamicReason({
      primaryCode,
      violationCount,
      criticalIncidentCount,
      severityScore,

      normalizedRisk:
        riskLevel,

      normalizedKPI:
        kpiLevel,

      relatedIncidents:
        safeRelatedIncidents,

      commonViolation,
      repeatedSameViolation,
      attendanceOrPolicyConcern,
    });

  const correctiveActionBasis =
    buildDynamicBasis({
      violationCount,
      criticalIncidentCount,
      severityScore,

      normalizedRisk:
        riskLevel,

      normalizedKPI:
        kpiLevel,

      relatedIncidents:
        safeRelatedIncidents,

      commonViolation,
    });

  return {
    recommendation:
      primaryAction.title,

    recommendationReason,

    correctiveActionBasis,
  };
}

async function getTrustedEmployee(
  employeeId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          name,
          company,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        `,
        [
          employeeId,
        ]
      );

  return (
    rows[0] ||
    null
  );
}

async function getTrustedIncidents(
  employeeId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          violation_type,
          severity,
          description
        FROM incidents
        WHERE employee_id = ?
        ORDER BY id ASC
        `,
        [
          employeeId,
        ]
      );

  return Array.isArray(
    rows
  )
    ? rows
    : [];
}

function buildTrustedDecisionSnapshot(
  incidents
) {
  const relatedIncidents =
    getSafeIncidents(
      incidents
    );

  const violationCount =
    relatedIncidents.length;

  const severityScore =
    relatedIncidents.reduce(
      (
        sum,
        incident
      ) =>
        sum +
        getSeverityWeight(
          incident?.severity
        ),
      0
    );

  const criticalIncidentCount =
    relatedIncidents.filter(
      (incident) =>
        normalizeSeverityLabel(
          incident?.severity
        ) ===
        SEVERITY_LABELS.CRITICAL
    ).length;

  const kpiLevel =
    getExpectedKPILevel(
      severityScore,
      violationCount
    );

  const riskLevel =
    getExpectedRiskLevel(
      kpiLevel,
      violationCount,
      criticalIncidentCount
    );

  const decisionConfidence =
    getExpectedDecisionConfidence({
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
    });

  const suggestedHRAction =
    getExpectedSuggestedHRAction({
      confidence:
        decisionConfidence,

      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
    });

  const correctiveAction =
    getCorrectiveActionRecommendation({
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
      kpiLevel,
      relatedIncidents,
    });

  const decisionConfidenceReason =
    getDecisionConfidenceReason({
      confidence:
        decisionConfidence,

      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
    });

  const suggestedHRActionReason =
    getSuggestedHRActionReason({
      suggestedHRAction,
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
    });

  return {
    violationCount,
    severityScore,
    criticalIncidentCount,
    kpiLevel,
    riskLevel,
    decisionConfidence,
    suggestedHRAction,

    systemRecommendation:
      correctiveAction.recommendation,

    recommendationReason:
      correctiveAction.recommendationReason,

    decisionConfidenceReason,

    suggestedHRActionReason,

    correctiveActionBasis:
      correctiveAction.correctiveActionBasis,
  };
}

function hasSnapshotMismatch({
  submitted,
  trusted,
}) {
  return (
    submitted.violationCount !==
      trusted.violationCount ||

    submitted.severityScore !==
      trusted.severityScore ||

    submitted.criticalIncidentCount !==
      trusted.criticalIncidentCount ||

    submitted.kpiLevel !==
      trusted.kpiLevel ||

    submitted.riskLevel !==
      trusted.riskLevel ||

    submitted.decisionConfidence !==
      trusted.decisionConfidence ||

    submitted.suggestedHRAction !==
      trusted.suggestedHRAction ||

    submitted.systemRecommendation !==
      trusted.systemRecommendation
  );
}

exports.getKpiDecisionHistory =
  async (
    req,
    res
  ) => {
    try {
      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM kpi_decision_history
            ORDER BY
              decided_at DESC,
              id DESC
            `
          );

      return res.json(
        rows.map(
          toCamelCaseRecord
        )
      );
    } catch (error) {
      console.error(
        "GET KPI DECISION HISTORY ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to fetch KPI decision history.",

          message:
            "The KPI decision history records could not be retrieved.",
        });
    }
  };

exports.createKpiDecision =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getTrustedActor(
          req
        );

      if (!actor) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authentication required.",

            message:
              "A verified authenticated user is required to record a KPI decision.",
          });
      }

      const {
        employeeId,

        riskLevel,
        kpiLevel,
        violationCount,
        severityScore,
        criticalIncidentCount,

        decisionConfidence,
        suggestedHRAction,
        systemRecommendation,

        finalAction,
        decisionType,
        notes,
      } = req.body || {};

      const parsedEmployeeId =
        parsePositiveInteger(
          employeeId
        );

      const cleanedFinalAction =
        cleanValue(
          finalAction
        );

      const cleanedDecisionType =
        cleanValue(
          decisionType
        );

      if (
        !parsedEmployeeId ||
        !cleanedFinalAction ||
        !cleanedDecisionType
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Employee ID, final action, and decision type are required.",
          });
      }

      if (
        !ALLOWED_DECISION_TYPES.has(
          cleanedDecisionType
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision type.",
          });
      }

      if (
        !ALLOWED_FINAL_ACTIONS.has(
          cleanedFinalAction
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid final HR action.",
          });
      }

      const cleanedNotes =
        cleanValue(
          notes
        );

      if (
        cleanedDecisionType ===
          "Rejected" &&
        !cleanedNotes
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Rejected recommendations require HR notes.",
          });
      }

      const parsedViolationCount =
        parseNonNegativeInteger(
          violationCount
        );

      const parsedSeverityScore =
        parseNonNegativeNumber(
          severityScore
        );

      const parsedCriticalIncidentCount =
        parseNonNegativeInteger(
          criticalIncidentCount
        );

      if (
        parsedViolationCount ===
          null ||
        parsedSeverityScore ===
          null ||
        parsedCriticalIncidentCount ===
          null
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "KPI numeric values must be valid non-negative numbers. Violation and critical incident counts must be whole numbers.",
          });
      }

      if (
        !isAllowedValue(
          kpiLevel,
          ALLOWED_KPI_LEVELS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid KPI level.",
          });
      }

      if (
        !isAllowedValue(
          riskLevel,
          ALLOWED_RISK_LEVELS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid risk level.",
          });
      }

      if (
        !isAllowedValue(
          decisionConfidence,
          ALLOWED_DECISION_CONFIDENCE
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision confidence.",
          });
      }

      if (
        !isAllowedValue(
          suggestedHRAction,
          ALLOWED_SUGGESTED_HR_ACTIONS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid suggested HR action.",
          });
      }

      if (
        !isAllowedValue(
          systemRecommendation,
          ALLOWED_SYSTEM_RECOMMENDATIONS
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid system recommendation.",
          });
      }

      const trustedEmployee =
        await getTrustedEmployee(
          parsedEmployeeId
        );

      if (!trustedEmployee) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Employee not found.",
          });
      }

      if (
        Number(
          trustedEmployee.archived
        ) === 1
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "Archived employees cannot receive a new KPI decision.",

            message:
              "Restore the employee before recording a new KPI decision.",
          });
      }

      const trustedIncidents =
        await getTrustedIncidents(
          trustedEmployee.id
        );

      const trustedSnapshot =
        buildTrustedDecisionSnapshot(
          trustedIncidents
        );

      const submittedSnapshot = {
        violationCount:
          parsedViolationCount,

        severityScore:
          parsedSeverityScore,

        criticalIncidentCount:
          parsedCriticalIncidentCount,

        kpiLevel:
          cleanValue(
            kpiLevel
          ),

        riskLevel:
          cleanValue(
            riskLevel
          ),

        decisionConfidence:
          cleanValue(
            decisionConfidence
          ),

        suggestedHRAction:
          cleanValue(
            suggestedHRAction
          ),

        systemRecommendation:
          cleanValue(
            systemRecommendation
          ),
      };

      if (
        hasSnapshotMismatch({
          submitted:
            submittedSnapshot,

          trusted:
            trustedSnapshot,
        })
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "KPI decision snapshot is out of date or inconsistent.",

            message:
              "The system-generated KPI recommendation no longer matches the current server data and decision rules. Refresh the KPI data and review the recommendation again.",
          });
      }

      if (
        cleanedDecisionType ===
          "Accepted" &&
        cleanedFinalAction !==
          trustedSnapshot.suggestedHRAction
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Accepted recommendations must use the system-suggested HR action as the final HR action.",
          });
      }

      const trustedEmployeeName =
        cleanValue(
          trustedEmployee.name,
          "Unknown Employee"
        );

      const trustedCompany =
        cleanValue(
          trustedEmployee.company,
          "Unassigned"
        );

      const [result] =
        await db
          .promise()
          .query(
            `
            INSERT INTO kpi_decision_history
            (
              employee_id,
              employee_name,
              company,

              risk_level,
              kpi_level,
              violation_count,
              severity_score,
              critical_incident_count,

              decision_confidence,
              suggested_hr_action,
              system_recommendation,

              final_action,
              decision_type,

              notes,
              decided_by,
              decided_by_role,

              decided_at,
              status,

              recommendation_reason,
              decision_confidence_reason,
              suggested_hr_action_reason,
              corrective_action_basis
            )
            VALUES (
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?,
              ?, ?, ?,
              NOW(), ?,
              ?, ?, ?, ?
            )
            `,
            [
              String(
                trustedEmployee.id
              ),

              trustedEmployeeName,

              trustedCompany,

              trustedSnapshot.riskLevel,

              trustedSnapshot.kpiLevel,

              trustedSnapshot.violationCount,

              trustedSnapshot.severityScore,

              trustedSnapshot.criticalIncidentCount,

              trustedSnapshot.decisionConfidence,

              trustedSnapshot.suggestedHRAction,

              trustedSnapshot.systemRecommendation,

              cleanedFinalAction,

              cleanedDecisionType,

              cleanedNotes,

              actor.username,

              actor.role,

              "Recorded",

              trustedSnapshot.recommendationReason,

              trustedSnapshot.decisionConfidenceReason,

              trustedSnapshot.suggestedHRActionReason,

              trustedSnapshot.correctiveActionBasis,
            ]
          );

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM kpi_decision_history
            WHERE id = ?
            LIMIT 1
            `,
            [
              result.insertId,
            ]
          );

      if (!rows[0]) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "KPI decision was created but could not be retrieved.",
          });
      }

      await logAudit({
        userId:
          actor.id,

        username:
          actor.username,

        role:
          actor.role,

        category:
          AUDIT_CATEGORY.OPERATIONAL,

        action:
          "CREATE_KPI_DECISION",

        description:
          `Recorded ${cleanedDecisionType} KPI decision for ${trustedEmployeeName} (Employee ID ${trustedEmployee.id}). Final HR action: ${cleanedFinalAction}.`,

        fullName:
          actor.username,
      });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "KPI decision recorded successfully.",

          record:
            toCamelCaseRecord(
              rows[0]
            ),
        });
    } catch (error) {
      console.error(
        "CREATE KPI DECISION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to record KPI decision.",

          message:
            "The KPI decision could not be recorded.",
        });
    }
  };

exports.deleteKpiDecision =
  async (
    req,
    res
  ) => {
    try {
      const actor =
        getTrustedActor(
          req
        );

      if (!actor) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authentication required.",

            message:
              "A verified authenticated user is required to remove a KPI decision record.",
          });
      }

      const id =
        parsePositiveInteger(
          req.params.id
        );

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid decision history record ID.",
          });
      }

      const [existingRows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              employee_id,
              employee_name,
              decision_type,
              final_action
            FROM kpi_decision_history
            WHERE id = ?
            LIMIT 1
            `,
            [
              id,
            ]
          );

      const existingRecord =
        existingRows[0];

      if (!existingRecord) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Decision history record not found.",
          });
      }

      const [result] =
        await db
          .promise()
          .query(
            `
            DELETE FROM kpi_decision_history
            WHERE id = ?
            `,
            [
              id,
            ]
          );

      if (
        result.affectedRows ===
        0
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Decision history record not found.",
          });
      }

      await logAudit({
        userId:
          actor.id,

        username:
          actor.username,

        role:
          actor.role,

        category:
          AUDIT_CATEGORY.OPERATIONAL,

        action:
          "DELETE_KPI_DECISION",

        description:
          `Removed KPI decision history record ${id} for ${cleanValue(
            existingRecord.employee_name,
            "Unknown Employee"
          )} (Employee ID ${cleanValue(
            existingRecord.employee_id,
            "Unknown"
          )}). Decision type: ${cleanValue(
            existingRecord.decision_type,
            "Recorded"
          )}; final HR action: ${cleanValue(
            existingRecord.final_action,
            "Unknown"
          )}.`,

        fullName:
          actor.username,
      });

      return res.json({
        success: true,

        message:
          "KPI decision history record removed.",
      });
    } catch (error) {
      console.error(
        "DELETE KPI DECISION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to delete KPI decision history record.",

          message:
            "The KPI decision history record could not be removed.",
        });
    }
  };