import { NORMALIZED_VIOLATION_RULES } from "../data/violationRules";

const SEVERITY_SCORE = {
  Minor: 1,
  Major: 2,
  Critical: 3,
};

const SLA_DAYS = {
  Minor: 7,
  Major: 5,
  Critical: 2,
};

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function flattenViolationRules() {
  return NORMALIZED_VIOLATION_RULES.flatMap((group) =>
    group.rows.map((rule) => ({
      ...rule,
      category: group.category,
      key: `${group.category}-${rule.section}-${rule.violation}`,
    }))
  );
}

export function findViolationRule(violationName) {
  const target = normalizeText(violationName);
  return flattenViolationRules().find(
    (rule) => normalizeText(rule.violation) === target
  );
}

export function getIncidentEmployeeKey(incident) {
  return String(
    incident?.employeeId ||
      incident?.employee_id ||
      incident?.employeeID ||
      incident?.employee ||
      ""
  ).trim();
}

export function getIncidentViolationKey(incident) {
  return String(
    incident?.violation ||
      incident?.violationType ||
      incident?.violation_type ||
      ""
  ).trim();
}

export function getPreviousSameViolationCount(
  existingIncidents = [],
  employeeId,
  violationName,
  currentIncidentId = null
) {
  const targetEmployee = String(employeeId || "").trim();
  const targetViolation = String(violationName || "").trim();

  if (!targetEmployee || !targetViolation) return 0;

  return existingIncidents.filter((incident) => {
    const sameEmployee = getIncidentEmployeeKey(incident) === targetEmployee;
    const sameViolation = getIncidentViolationKey(incident) === targetViolation;
    const notCurrent = currentIncidentId
      ? String(incident.id) !== String(currentIncidentId)
      : true;

    return sameEmployee && sameViolation && notCurrent;
  }).length;
}

export function getNextOffenseCount(
  existingIncidents = [],
  employeeId,
  violationName,
  currentIncidentId = null
) {
  return (
    getPreviousSameViolationCount(
      existingIncidents,
      employeeId,
      violationName,
      currentIncidentId
    ) + 1
  );
}

export function getPenaltyByOffense(penalties = [], offenseCount = 1) {
  if (!Array.isArray(penalties) || penalties.length === 0) return null;

  const exactPenalty = penalties.find(
    (penalty) => Number(penalty?.offenseNo) === Number(offenseCount)
  );

  return exactPenalty || penalties[penalties.length - 1];
}

export function getPenaltyText(penalty) {
  if (!penalty) return "";
  if (typeof penalty === "string") return penalty;
  return penalty.action || "";
}

function getHigherSeverity(current, next) {
  const currentScore = SEVERITY_SCORE[current] || 1;
  const nextScore = SEVERITY_SCORE[next] || 1;
  return nextScore > currentScore ? next : current;
}

export function computeAutoSeverity({
  baseSeverity = "Minor",
  offenseCount = 1,
  sanction = "",
  description = "",
}) {
  let severity = baseSeverity || "Minor";
  const sanctionText = normalizeText(sanction);
  const desc = normalizeText(description);

  if (
    sanctionText.includes("dismissal") ||
    sanctionText.includes("rta") ||
    sanctionText.includes("termination")
  ) {
    severity = getHigherSeverity(severity, "Critical");
  }

  if (offenseCount >= 4) {
    severity = getHigherSeverity(severity, "Critical");
  } else if (offenseCount >= 3) {
    severity = getHigherSeverity(severity, "Major");
  }

  const criticalKeywords = [
    "injury",
    "accident",
    "hospital",
    "unsafe",
    "hazard",
    "harassment",
    "theft",
    "fraud",
    "violence",
    "threat",
    "cut",
    "wound",
    "bleeding",
  ];

  if (criticalKeywords.some((keyword) => desc.includes(keyword))) {
    severity = getHigherSeverity(severity, "Critical");
  }

  return severity;
}

export function getCaseAgeDays(incident) {
  const startDate = toDate(incident?.reportedAt || incident?.date);
  if (!startDate) return 0;

  const now = new Date();
  const diff = now.getTime() - startDate.getTime();

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getCaseAging(incident) {
  const ageDays = getCaseAgeDays(incident);
  const severity = incident?.severity || "Minor";
  const slaDays = SLA_DAYS[severity] || 7;
  const isClosed = incident?.status === "Closed";

  let bucket = "0–2 days";
  if (ageDays >= 3 && ageDays <= 7) bucket = "3–7 days";
  if (ageDays >= 8 && ageDays <= 30) bucket = "8–30 days";
  if (ageDays > 30) bucket = "30+ days";

  return {
    ageDays,
    bucket,
    slaDays,
    isOverdue: !isClosed && ageDays > slaDays,
    remainingDays: Math.max(0, slaDays - ageDays),
  };
}

export function getRecommendation({
  severity = "Minor",
  offenseCount = 1,
  sanction = "",
  status = "Open",
}) {
  if (status === "Closed") {
    return "Case is already closed. Keep record for audit and future reference.";
  }

  if (severity === "Critical") {
    return "Immediate HR review required. Prioritize investigation, secure evidence, and escalate to Super Admin.";
  }

  if (offenseCount >= 4) {
    return "Repeated offense detected. Recommend management review and stronger disciplinary action based on policy.";
  }

  if (severity === "Major") {
    return "Start investigation promptly and prepare supporting documents before submitting for review.";
  }

  if (sanction) {
    return `Recommended action: ${sanction}. Monitor employee record for repeated violations.`;
  }

  return "Review the case details and proceed with the standard disciplinary workflow.";
}

export function getSmartAlerts(incident) {
  const alerts = [];
  const aging = getCaseAging(incident);
  const severity = incident?.severity || "Minor";
  const status = incident?.status || "Open";

  if (severity === "Critical" && status !== "Closed") {
    alerts.push({
      id: "critical-case",
      level: "critical",
      title: "Critical incident",
      message: "This case requires immediate review and prioritization.",
    });
  }

  if (aging.isOverdue) {
    alerts.push({
      id: "overdue-case",
      level: "warning",
      title: "Overdue case",
      message: `This case is ${aging.ageDays} day(s) old and exceeded the ${aging.slaDays}-day target.`,
    });
  }

  if (status === "For Review") {
    alerts.push({
      id: "for-review",
      level: "info",
      title: "Pending Super Admin review",
      message: "Resolution proof has been submitted and is waiting for final review.",
    });
  }

  if (Number(incident?.offenseCount || 1) >= 3) {
    alerts.push({
      id: "repeat-offense",
      level: "warning",
      title: "Repeated offense",
      message: `This is the employee's ${incident.offenseCount} offense for the same violation.`,
    });
  }

  return alerts;
}

export function enrichIncidentIntelligence(incident, existingIncidents = []) {
  const rule = findViolationRule(incident?.violation);
  const penalties = incident?.penalties || rule?.penalties || [];

  const offenseCount =
    incident?.offenseCount ||
    getNextOffenseCount(
      existingIncidents,
      incident?.employeeId,
      incident?.violation,
      incident?.id
    );

  const selectedPenalty =
    incident?.selectedPenalty || getPenaltyByOffense(penalties, offenseCount);

  const sanction =
    incident?.sanction ||
    getPenaltyText(selectedPenalty) ||
    rule?.penaltyLevel ||
    "";

  const severity = computeAutoSeverity({
    baseSeverity: rule?.severity || incident?.severity || "Minor",
    offenseCount,
    sanction,
    description: incident?.description,
  });

  const enriched = {
    ...incident,
    violationCategory: incident?.violationCategory || rule?.category || "",
    violationSection: incident?.violationSection || rule?.section || "",
    violationDescription:
      incident?.violationDescription || rule?.description || "",
    penaltyLevel: incident?.penaltyLevel || rule?.penaltyLevel || "",
    penalties,
    offenseCount,
    selectedPenalty,
    sanction,
    severity,
  };

  const aging = getCaseAging(enriched);

  return {
    ...enriched,
    caseAgeDays: aging.ageDays,
    caseAgeBucket: aging.bucket,
    slaDays: aging.slaDays,
    isOverdue: aging.isOverdue,
    recommendation: getRecommendation(enriched),
    smartAlerts: getSmartAlerts(enriched),
  };
}