export const SCORING_POLICY_VERSION =
  "INCIDENT_DECAY_V1";

const SEVERITY_POINTS = Object.freeze({
  Minor: 1,
  Major: 3,
  Critical: 5,
});

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

function isResolvedStatus(value) {
  return ["closed", "resolved"].includes(
    normalizeText(value)
  );
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

function getMonthAge(fromValue, toValue) {
  const rawFrom = toValidDate(fromValue);
  const rawTo = toValidDate(toValue);

  if (!rawFrom || !rawTo) {
    return null;
  }

  const from = new Date(Date.UTC(
    rawFrom.getUTCFullYear(),
    rawFrom.getUTCMonth(),
    rawFrom.getUTCDate()
  ));
  const to = new Date(Date.UTC(
    rawTo.getUTCFullYear(),
    rawTo.getUTCMonth(),
    rawTo.getUTCDate()
  ));

  if (to < from) {
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

  return Math.max(
    0,
    wholeMonths + (interval > 0 ? elapsed / interval : 0)
  );
}

function getDecayMultiplier(ageInMonths) {
  if (ageInMonths === null || ageInMonths <= 3) return 1;
  if (ageInMonths <= 6) return 0.75;
  if (ageInMonths <= 9) return 0.5;
  if (ageInMonths <= 12) return 0.25;
  return 0;
}

function roundScore(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateSeveritySnapshot(
  incidents = [],
  evaluationDate = new Date()
) {
  const evaluatedAt = toValidDate(evaluationDate) || new Date();
  const safeIncidents = Array.isArray(incidents)
    ? incidents.filter(Boolean)
    : [];
  const scoredIncidents = safeIncidents.map((incident) => {
    const normalizedSeverity = normalizeSeverity(incident?.severity);
    const basePoints = SEVERITY_POINTS[normalizedSeverity] || 0;
    const isResolved = isResolvedStatus(incident?.status);
    const incidentDate = getIncidentDate(incident);
    const resolutionDate = isResolved
      ? getResolutionDate(incident)
      : null;
    const ageInMonths = isResolved
      ? getMonthAge(resolutionDate, evaluatedAt)
      : 0;
    const decayMultiplier = isResolved
      ? getDecayMultiplier(ageInMonths)
      : 1;
    const activePoints = roundScore(
      basePoints * decayMultiplier
    );

    return {
      ...incident,
      normalizedSeverity,
      basePoints,
      activePoints,
      decayMultiplier,
      ageInMonths,
      isResolved,
      isActive: activePoints > 0,
      incidentDate,
      resolutionDate,
    };
  });
  const activeIncidents = scoredIncidents.filter(
    (incident) => incident.isActive
  );
  const validDates = scoredIncidents
    .map((incident) => incident.incidentDate)
    .filter(Boolean)
    .sort((first, second) => second - first);
  const latestIncidentDate = validDates[0] || null;
  const monthAge = latestIncidentDate
    ? getMonthAge(latestIncidentDate, evaluatedAt)
    : null;
  const hasUnresolvedIncident = scoredIncidents.some(
    (incident) => !incident.isResolved
  );
  let behaviorTrend = "Good Standing";

  if (scoredIncidents.length > 0 && !latestIncidentDate) {
    behaviorTrend = "Insufficient Data";
  } else if (
    scoredIncidents.length > 0 &&
    (hasUnresolvedIncident || monthAge < 3)
  ) {
    behaviorTrend = "Worsening";
  } else if (scoredIncidents.length > 0 && monthAge >= 6) {
    behaviorTrend = "Improving";
  } else if (scoredIncidents.length > 0) {
    behaviorTrend = "Stable";
  }

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
    behaviorTrend,
    monthsWithoutNewIncident:
      monthAge === null ? null : Math.floor(monthAge),
    latestIncidentDate: latestIncidentDate
      ? latestIncidentDate.toISOString()
      : null,
    scoringPolicyVersion: SCORING_POLICY_VERSION,
    scoredIncidents,
    activeIncidents,
  };
}