"use strict";

const MOVEMENT_TYPE = Object.freeze({
  SCHEDULED: "Scheduled for Deployment",
  DEPLOYED: "Successfully Deployed",
  NO_SHOW: "No Show",
  WITHDRAWN: "Withdrawn",
  TRANSFERRED: "Transferred / Reassigned",
  DEPLOYMENT_ENDED: "Deployment Ended / Pulled Out",
  OTHER_COMPLETION: "Other Deployment Completion",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
  AWOL: "AWOL",
  OTHER_SEPARATION: "Other Separation",
});

const EVENT_SORT_PRIORITY = Object.freeze({
  [MOVEMENT_TYPE.RESIGNED]: 90,
  [MOVEMENT_TYPE.TERMINATED]: 90,
  [MOVEMENT_TYPE.AWOL]: 90,
  [MOVEMENT_TYPE.OTHER_SEPARATION]: 90,
  [MOVEMENT_TYPE.TRANSFERRED]: 80,
  [MOVEMENT_TYPE.DEPLOYMENT_ENDED]: 80,
  [MOVEMENT_TYPE.OTHER_COMPLETION]: 80,
  [MOVEMENT_TYPE.DEPLOYED]: 70,
  [MOVEMENT_TYPE.NO_SHOW]: 60,
  [MOVEMENT_TYPE.WITHDRAWN]: 50,
  [MOVEMENT_TYPE.SCHEDULED]: 40,
});

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCompanyFilter(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalizeComparable(normalized) === "all") {
    return null;
  }
  return normalized;
}

function companyMatches(value, filter) {
  if (!filter) return true;
  return normalizeComparable(value) === normalizeComparable(filter);
}

function getAssignmentMovement(status, endReason, endRemarks) {
  const normalizedStatus = normalizeComparable(status);
  const normalizedReason = normalizeComparable(endReason);
  const remarks = normalizeText(endRemarks);

  if (normalizedReason === "resigned" || normalizedReason === "resignation") {
    return MOVEMENT_TYPE.RESIGNED;
  }
  if (normalizedReason === "terminated" || normalizedReason === "termination") {
    return MOVEMENT_TYPE.TERMINATED;
  }
  if (normalizedReason === "awol") {
    return MOVEMENT_TYPE.AWOL;
  }
  if (normalizedStatus === "completed") {
    if (normalizedReason === "transferred / reassigned") {
      return MOVEMENT_TYPE.TRANSFERRED;
    }
    if (
      normalizedReason === "completed contract" ||
      normalizedReason === "end of assignment / pulled out by client"
    ) {
      return MOVEMENT_TYPE.DEPLOYMENT_ENDED;
    }
    return MOVEMENT_TYPE.OTHER_COMPLETION;
  }
  if (
    remarks.startsWith("[Other Separation]") ||
    ["cancelled", "canceled", "separated", "ended"].includes(normalizedStatus)
  ) {
    return MOVEMENT_TYPE.OTHER_SEPARATION;
  }
  return null;
}

function getAssignmentDisplayReason(movement, rawReason) {
  const reason = normalizeText(rawReason);
  if (normalizeComparable(reason) === "completed contract") {
    return "Deployment Ended";
  }
  if (reason) return reason;
  if (movement === MOVEMENT_TYPE.OTHER_COMPLETION) {
    return "Deployment completed";
  }
  if (movement === MOVEMENT_TYPE.OTHER_SEPARATION) {
    return "Other separation";
  }
  return movement;
}

function getAssignmentEventKey(assignmentId, movement) {
  const suffix = [
    MOVEMENT_TYPE.RESIGNED,
    MOVEMENT_TYPE.TERMINATED,
    MOVEMENT_TYPE.AWOL,
    MOVEMENT_TYPE.OTHER_SEPARATION,
  ].includes(movement)
    ? "separation"
    : "completed";
  return `assignment-${Number(assignmentId)}-${suffix}`;
}

function createSummaryBucket() {
  return {
    totalEvents: 0,
    scheduled: 0,
    successfullyDeployed: 0,
    noShow: 0,
    withdrawn: 0,
    transferredReassigned: 0,
    deploymentEnded: 0,
    otherCompletion: 0,
    resigned: 0,
    terminated: 0,
    awol: 0,
    otherSeparation: 0,
  };
}

const SUMMARY_KEY_BY_MOVEMENT = Object.freeze({
  [MOVEMENT_TYPE.SCHEDULED]: "scheduled",
  [MOVEMENT_TYPE.DEPLOYED]: "successfullyDeployed",
  [MOVEMENT_TYPE.NO_SHOW]: "noShow",
  [MOVEMENT_TYPE.WITHDRAWN]: "withdrawn",
  [MOVEMENT_TYPE.TRANSFERRED]: "transferredReassigned",
  [MOVEMENT_TYPE.DEPLOYMENT_ENDED]: "deploymentEnded",
  [MOVEMENT_TYPE.OTHER_COMPLETION]: "otherCompletion",
  [MOVEMENT_TYPE.RESIGNED]: "resigned",
  [MOVEMENT_TYPE.TERMINATED]: "terminated",
  [MOVEMENT_TYPE.AWOL]: "awol",
  [MOVEMENT_TYPE.OTHER_SEPARATION]: "otherSeparation",
});

function addToSummary(bucket, movement) {
  const key = SUMMARY_KEY_BY_MOVEMENT[movement];
  if (!bucket || !key) return;
  bucket.totalEvents += 1;
  bucket[key] += 1;
}

function buildSummary(events) {
  const overall = createSummaryBucket();
  const companyMap = new Map();
  for (const event of events) {
    const company = normalizeText(event?.company) || "Unassigned";
    const comparable = normalizeComparable(company);
    if (!companyMap.has(comparable)) {
      companyMap.set(comparable, { company, ...createSummaryBucket() });
    }
    addToSummary(overall, event.movement);
    addToSummary(companyMap.get(comparable), event.movement);
  }
  const companies = Array.from(companyMap.values()).sort(
    (a, b) => b.totalEvents - a.totalEvents || a.company.localeCompare(b.company)
  );
  const companyTotals = companies.reduce((total, company) => {
    for (const key of Object.keys(total)) total[key] += Number(company[key] || 0);
    return total;
  }, createSummaryBucket());
  return {
    overall,
    companies,
    companyTotals,
    totalsMatch: Object.keys(overall).every(
      (key) => Number(overall[key]) === Number(companyTotals[key])
    ),
  };
}

function getSortTimestamp(event) {
  const value = normalizeText(event?.occurredAt);
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareEventsNewestFirst(first, second) {
  const timestampDifference = getSortTimestamp(second) - getSortTimestamp(first);
  if (timestampDifference) return timestampDifference;
  const businessDateDifference = normalizeText(second?.businessDate).localeCompare(
    normalizeText(first?.businessDate)
  );
  if (businessDateDifference) return businessDateDifference;
  const priorityDifference =
    Number(EVENT_SORT_PRIORITY[second?.movement] || 0) -
    Number(EVENT_SORT_PRIORITY[first?.movement] || 0);
  if (priorityDifference) return priorityDifference;
  const sourceIdDifference = Number(second?.sourceId || 0) - Number(first?.sourceId || 0);
  if (sourceIdDifference) return sourceIdDifference;
  return normalizeText(first?.eventKey || first?.id).localeCompare(
    normalizeText(second?.eventKey || second?.id)
  );
}

function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = normalizeText(event?.eventKey || event?.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function paginateEvents(events, page, pageSize) {
  const total = events.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  return {
    events: events.slice(offset, offset + pageSize),
    pagination: { page: safePage, pageSize, total, totalPages },
  };
}

module.exports = {
  MOVEMENT_TYPE,
  normalizeText,
  normalizeComparable,
  normalizeCompanyFilter,
  companyMatches,
  getAssignmentMovement,
  getAssignmentDisplayReason,
  getAssignmentEventKey,
  createSummaryBucket,
  addToSummary,
  buildSummary,
  compareEventsNewestFirst,
  deduplicateEvents,
  paginateEvents,
};