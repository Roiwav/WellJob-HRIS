const SEVERITY_POINTS = Object.freeze({
  Minor: 1,
  Major: 3,
  Critical: 5,
});

const ACTIVE_STATUSES = new Set([
  "open",
  "investigating",
  "for review",
]);

const RESOLVED_STATUSES = new Set([
  "closed",
  "resolved",
]);

const SCORING_POLICY_VERSION = "INCIDENT_DECAY_V1";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeSeverity(value) {
  switch (normalizeText(value)) {
    case "critical":
    case "high":
      return "Critical";
    case "major":
    case "medium":
      return "Major";
    case "minor":
    case "low":
      return "Minor";
    default:
      return "None";
  }
}

function normalizeStatus(value) {
  const normalized = normalizeText(value);

  if (RESOLVED_STATUSES.has(normalized)) {
    return "Resolved";
  }
  if (normalized === "investigating") {
    return "Investigating";
  }
  if (normalized === "for review") {
    return "For Review";
  }
  return "Open";
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getIncidentDate(incident) {
  return toValidDate(
    incident?.incidentDate ||
      incident?.incident_date ||
      incident?.date ||
      incident?.reportedAt ||
      incident?.reported_at ||
      incident?.createdAt ||
      incident?.created_at
  );
}

function getResolutionDate(incident) {
  return (
    toValidDate(
      incident?.reviewedAt ||
        incident?.reviewed_at ||
        incident?.resolutionSubmittedAt ||
        incident?.resolution_submitted_at ||
        incident?.updatedAt ||
        incident?.updated_at
    ) || getIncidentDate(incident)
  );
}

function getCompletedMonths(fromValue, toValue) {
  const rawFrom = toValidDate(fromValue);
  const rawTo = toValidDate(toValue);

  const from = rawFrom
    ? new Date(
        Date.UTC(
          rawFrom.getUTCFullYear(),
          rawFrom.getUTCMonth(),
          rawFrom.getUTCDate()
        )
      )
    : null;
  const to = rawTo
    ? new Date(
        Date.UTC(
          rawTo.getUTCFullYear(),
          rawTo.getUTCMonth(),
          rawTo.getUTCDate()
        )
      )
    : null;

  if (!from || !to || to < from) {
    return null;
  }

  let wholeMonths =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());

  const anchor = new Date(from.getTime());
  anchor.setUTCMonth(anchor.getUTCMonth() + wholeMonths);

  if (anchor > to) {
    wholeMonths -= 1;
    anchor.setTime(from.getTime());
    anchor.setUTCMonth(anchor.getUTCMonth() + wholeMonths);
  }

  const nextAnchor = new Date(anchor.getTime());
  nextAnchor.setUTCMonth(nextAnchor.getUTCMonth() + 1);
  const interval = nextAnchor.getTime() - anchor.getTime();
  const elapsed = to.getTime() - anchor.getTime();
  const fraction = interval > 0 ? elapsed / interval : 0;

  return Math.max(0, wholeMonths + fraction);
}

function getDecayMultiplier(ageInMonths) {
  if (ageInMonths === null || ageInMonths <= 3) {
    return 1;
  }
  if (ageInMonths <= 6) {
    return 0.75;
  }
  if (ageInMonths <= 9) {
    return 0.5;
  }
  if (ageInMonths <= 12) {
    return 0.25;
  }
  return 0;
}

function roundScore(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function scoreIncident(incident, evaluationDate = new Date()) {
  const severity = normalizeSeverity(incident?.severity);
  const status = normalizeStatus(incident?.status);
  const basePoints = SEVERITY_POINTS[severity] || 0;
  const isResolved = status === "Resolved";
  const resolutionDate = isResolved ? getResolutionDate(incident) : null;
  const ageInMonths = isResolved
    ? getCompletedMonths(resolutionDate, evaluationDate)
    : 0;
  const decayMultiplier = isResolved
    ? getDecayMultiplier(ageInMonths)
    : 1;
  const activePoints = roundScore(basePoints * decayMultiplier);

  return {
    ...incident,
    normalizedSeverity: severity,
    normalizedStatus: status,
    basePoints,
    activePoints,
    decayMultiplier,
    ageInMonths,
    isResolved,
    isActive: activePoints > 0,
    incidentDate: getIncidentDate(incident),
    resolutionDate,
  };
}

function getBehaviorTrend(scoredIncidents, evaluationDate) {
  if (scoredIncidents.length === 0) {
    return "Good Standing";
  }

  const validIncidentDates = scoredIncidents
    .map((incident) => incident.incidentDate)
    .filter(Boolean)
    .sort((first, second) => second - first);

  if (validIncidentDates.length === 0) {
    return "Insufficient Data";
  }

  const monthsWithoutNewIncident = getCompletedMonths(
    validIncidentDates[0],
    evaluationDate
  );
  const hasUnresolvedIncident = scoredIncidents.some(
    (incident) => !incident.isResolved
  );

  if (hasUnresolvedIncident || monthsWithoutNewIncident < 3) {
    return "Worsening";
  }
  if (monthsWithoutNewIncident >= 6) {
    return "Improving";
  }
  return "Stable";
}

function calculateEmployeeSeveritySnapshot(
  incidents = [],
  evaluationDate = new Date()
) {
  const evaluatedAt = toValidDate(evaluationDate) || new Date();
  const safeIncidents = Array.isArray(incidents)
    ? incidents.filter(Boolean)
    : [];
  const scoredIncidents = safeIncidents.map((incident) =>
    scoreIncident(incident, evaluatedAt)
  );
  const activeIncidents = scoredIncidents.filter(
    (incident) => incident.isActive
  );
  const validIncidentDates = scoredIncidents
    .map((incident) => incident.incidentDate)
    .filter(Boolean)
    .sort((first, second) => second - first);
  const latestIncidentDate = validIncidentDates[0] || null;

  return {
    historicalViolationCount: scoredIncidents.length,
    activeViolationCount: activeIncidents.length,
    historicalSeverityScore: roundScore(
      scoredIncidents.reduce(
        (sum, incident) => sum + incident.basePoints,
        0
      )
    ),
    activeSeverityScore: roundScore(
      activeIncidents.reduce(
        (sum, incident) => sum + incident.activePoints,
        0
      )
    ),
    historicalCriticalIncidentCount: scoredIncidents.filter(
      (incident) => incident.normalizedSeverity === "Critical"
    ).length,
    activeCriticalIncidentCount: activeIncidents.filter(
      (incident) => incident.normalizedSeverity === "Critical"
    ).length,
    openIncidentCount: scoredIncidents.filter((incident) =>
      ACTIVE_STATUSES.has(normalizeText(incident.normalizedStatus))
    ).length,
    behaviorTrend: getBehaviorTrend(scoredIncidents, evaluatedAt),
    monthsWithoutNewIncident: latestIncidentDate
      ? Math.floor(
          getCompletedMonths(latestIncidentDate, evaluatedAt)
        )
      : null,
    latestIncidentDate: latestIncidentDate
      ? latestIncidentDate.toISOString()
      : null,
    evaluatedAt: evaluatedAt.toISOString(),
    scoringPolicyVersion: SCORING_POLICY_VERSION,
    scoredIncidents,
  };
}

module.exports = {
  SCORING_POLICY_VERSION,
  SEVERITY_POINTS,
  calculateEmployeeSeveritySnapshot,
  getCompletedMonths,
  getDecayMultiplier,
  normalizeSeverity,
  normalizeStatus,
  scoreIncident,
};