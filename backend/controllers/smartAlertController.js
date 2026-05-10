const db = require("../config/db");

const ALERT_PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (value === "SUPERADMIN" || value === "SUPER_ADMIN" || value === "ADMIN") {
    return "SUPER_ADMIN";
  }

  if (value === "HR_MANAGER" || value === "HRMANAGER") {
    return "HR_MANAGER";
  }

  if (value === "HR_STAFF" || value === "HRSTAFF") {
    return "HR_STAFF";
  }

  if (value === "IT_SUPPORT" || value === "ITSUPPORT") {
    return "IT_SUPPORT";
  }

  return value || "USER";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "For Review";
  if (value === "for_review") return "For Review";
  if (value === "for review") return "For Review";
  if (value === "closed") return "Closed";
  if (value === "investigating") return "Investigating";
  if (value === "open") return "Open";

  return status || "Open";
}

function normalizeSeverity(severity) {
  const value = normalizeText(severity);

  if (value === "critical") return "Critical";
  if (value === "major") return "Major";
  if (value === "minor") return "Minor";

  return severity || "Minor";
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function getUserKey(req) {
  const query = req?.query || {};
  const body = req?.body || {};

  return (
    query.userKey ||
    body.userKey ||
    query.userId ||
    body.userId ||
    query.username ||
    body.username ||
    "UNKNOWN_USER"
  );
}

function getRole(req) {
  const query = req?.query || {};
  const body = req?.body || {};

  return normalizeRole(query.role || body.role || "USER");
}

function getCurrentUserAliases(req) {
  const query = req?.query || {};
  const body = req?.body || {};

  return new Set(
    [
      query.userKey,
      body.userKey,

      query.userId,
      body.userId,
      query.id,
      body.id,

      query.username,
      body.username,
      query.userName,
      body.userName,

      query.fullName,
      body.fullName,
      query.full_name,
      body.full_name,
      query.name,
      body.name,
      query.displayName,
      body.displayName,
      query.display_name,
      body.display_name,
    ]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
}

function cleanAlertKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 180);
}

function toTimestamp(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

async function tableExists(tableName) {
  const [rows] = await db.promise().query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

function addAlias(map, key, displayName) {
  const normalizedKey = normalizeIdentity(key);
  const normalizedName = String(displayName || "").trim();

  if (normalizedKey && normalizedName) {
    map.set(normalizedKey, normalizedName);
  }
}

async function getUserNameMap() {
  const userTable = (await tableExists("users"))
    ? "users"
    : (await tableExists("user_accounts"))
    ? "user_accounts"
    : null;

  const map = new Map();

  if (!userTable) return map;

  const [rows] = await db.promise().query(`SELECT * FROM ${userTable}`);

  rows.forEach((user) => {
    const displayName =
      user.full_name ||
      user.fullName ||
      user.fullname ||
      user.display_name ||
      user.displayName ||
      user.name ||
      user.username ||
      "Unknown User";

    addAlias(map, user.id, displayName);
    addAlias(map, user.user_id, displayName);
    addAlias(map, user.userId, displayName);
    addAlias(map, user.employee_id, displayName);
    addAlias(map, user.employeeId, displayName);
    addAlias(map, user.username, displayName);
    addAlias(map, user.email, displayName);
    addAlias(map, user.name, displayName);
    addAlias(map, user.full_name, displayName);
    addAlias(map, user.fullName, displayName);
    addAlias(map, user.fullname, displayName);
    addAlias(map, user.display_name, displayName);
    addAlias(map, user.displayName, displayName);
  });

  return map;
}

function resolvePersonName(rawValue, userNameMap, fallback = "Unknown User") {
  const raw = String(rawValue || "").trim();

  if (!raw) return fallback;

  return userNameMap.get(normalizeIdentity(raw)) || raw;
}

function hasAliasMatch(currentUserAliases, values = []) {
  if (!currentUserAliases || currentUserAliases.size === 0) return false;

  return values.some((value) =>
    currentUserAliases.has(normalizeIdentity(value))
  );
}

function getReporterValues(incident) {
  return [
    incident.reportedByRaw,
    incident.reported_by_raw,
    incident.reportedBy,
    incident.reportedByName,
    incident.reporterName,
    incident.reported_by,
    incident.createdBy,
    incident.created_by,
  ];
}

function getInvestigatorValues(incident) {
  return [
    incident.investigationStartedById,
    incident.investigation_started_by_id,
    incident.investigationStartedByUsername,
    incident.investigation_started_by_username,
    incident.investigationStartedByName,
    incident.investigation_started_by_name,
  ];
}

function getProofSubmitterValues(incident) {
  return [
    incident.resolutionSubmittedById,
    incident.resolution_submitted_by_id,
    incident.resolutionSubmittedByUsername,
    incident.resolution_submitted_by_username,
    incident.resolutionSubmittedByName,
    incident.resolution_submitted_by_name,
  ];
}

function getHandlerValues(incident) {
  return [...getProofSubmitterValues(incident), ...getInvestigatorValues(incident)];
}

function getLastActionValues(incident) {
  return [
    incident.lastActionById,
    incident.last_action_by_id,
    incident.lastActionByUsername,
    incident.last_action_by_username,
    incident.lastActionByName,
    incident.last_action_by_name,
  ];
}

function isReturnedCase(incident) {
  const decision = normalizeText(
    incident.reviewDecision || incident.review_decision || ""
  );

  return decision === "returned" || decision === "rejected";
}

function isCurrentUserReporter(incident, currentUserAliases) {
  return hasAliasMatch(currentUserAliases, getReporterValues(incident));
}

function isCurrentUserHandler(incident, currentUserAliases) {
  return hasAliasMatch(currentUserAliases, getHandlerValues(incident));
}

function isCurrentUserLastActor(incident, currentUserAliases) {
  return hasAliasMatch(currentUserAliases, getLastActionValues(incident));
}

function isSameEmployee(employee, incident) {
  const employeeId = String(employee?.id || "");
  const employeeName = normalizeText(employee?.name || "");

  const incidentEmployeeId = String(incident?.employeeId || "");
  const incidentEmployeeName = normalizeText(
    incident?.employee || incident?.employeeName || ""
  );

  return (
    (!!employeeId && employeeId === incidentEmployeeId) ||
    (!!employeeName && employeeName === incidentEmployeeName)
  );
}

function normalizeEmployee(employee) {
  return {
    ...employee,
    id: employee.id,
    name: employee.name || employee.full_name || "Unknown Employee",
    company: employee.company || "",
    status: employee.status || "Unknown",
    archived: isArchivedEmployee(employee),
  };
}

function normalizeIncident(incident, userNameMap = new Map()) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const violation =
    incident.violation_type || incident.violation || "No violation specified";

  const reportedByRaw =
    incident.reported_by ||
    incident.reportedBy ||
    incident.created_by ||
    incident.createdBy ||
    "Unknown Reporter";

  const lastActionByRaw =
    incident.last_action_by_name ||
    incident.last_action_by_username ||
    incident.last_action_by_id ||
    "";

  const investigationByRaw =
    incident.investigation_started_by_name ||
    incident.investigation_started_by_username ||
    incident.investigation_started_by_id ||
    "";

  const resolutionByRaw =
    incident.resolution_submitted_by_name ||
    incident.resolution_submitted_by_username ||
    incident.resolution_submitted_by_id ||
    "";

  const reviewedByRaw =
    incident.reviewed_by_name ||
    incident.reviewed_by_username ||
    incident.reviewed_by_id ||
    "";

  const reportedByName = resolvePersonName(
    reportedByRaw,
    userNameMap,
    "Unknown Reporter"
  );

  const lastActionByName = resolvePersonName(lastActionByRaw, userNameMap, "");
  const investigationStartedByName = resolvePersonName(
    investigationByRaw,
    userNameMap,
    ""
  );
  const resolutionSubmittedByName = resolvePersonName(
    resolutionByRaw,
    userNameMap,
    ""
  );
  const reviewedByName = resolvePersonName(reviewedByRaw, userNameMap, "");

  return {
    ...incident,

    id: incident.id,

    employeeId: incident.employee_id,
    employee_id: incident.employee_id,

    employeeName,
    employee: employeeName,

    company: incident.company || incident.employeeCompany || "",

    violation,
    violationType: violation,
    violation_type: violation,

    severity: normalizeSeverity(incident.severity),
    status: normalizeStatus(incident.status),

    reportedByRaw,
    reported_by_raw: reportedByRaw,
    reportedBy: reportedByName,
    reportedByName,
    reporterName: reportedByName,
    reported_by: reportedByName,

    date: incident.incident_date || incident.created_at,
    incidentDate: incident.incident_date || incident.created_at,
    incident_date: incident.incident_date,

    createdAt: incident.created_at,
    created_at: incident.created_at,
    updatedAt: incident.updated_at || incident.created_at,
    updated_at: incident.updated_at || incident.created_at,

    lastActionById: incident.last_action_by_id || null,
    last_action_by_id: incident.last_action_by_id || null,
    lastActionByUsername: incident.last_action_by_username || null,
    last_action_by_username: incident.last_action_by_username || null,
    lastActionByName: lastActionByName || null,
    last_action_by_name: lastActionByName || null,
    lastActionType: incident.last_action_type || null,
    last_action_type: incident.last_action_type || null,
    lastActionAt: incident.last_action_at || null,
    last_action_at: incident.last_action_at || null,

    investigationStartedById: incident.investigation_started_by_id || null,
    investigation_started_by_id: incident.investigation_started_by_id || null,
    investigationStartedByUsername:
      incident.investigation_started_by_username || null,
    investigation_started_by_username:
      incident.investigation_started_by_username || null,
    investigationStartedByName: investigationStartedByName || null,
    investigation_started_by_name: investigationStartedByName || null,
    investigationStartedAt: incident.investigation_started_at || null,
    investigation_started_at: incident.investigation_started_at || null,

    resolutionSubmittedById: incident.resolution_submitted_by_id || null,
    resolution_submitted_by_id: incident.resolution_submitted_by_id || null,
    resolutionSubmittedByUsername:
      incident.resolution_submitted_by_username || null,
    resolution_submitted_by_username:
      incident.resolution_submitted_by_username || null,
    resolutionSubmittedByName: resolutionSubmittedByName || null,
    resolution_submitted_by_name: resolutionSubmittedByName || null,
    resolutionSubmittedAt: incident.resolution_submitted_at || null,
    resolution_submitted_at: incident.resolution_submitted_at || null,

    reviewedById: incident.reviewed_by_id || null,
    reviewed_by_id: incident.reviewed_by_id || null,
    reviewedByUsername: incident.reviewed_by_username || null,
    reviewed_by_username: incident.reviewed_by_username || null,
    reviewedByName: reviewedByName || null,
    reviewed_by_name: reviewedByName || null,
    reviewedAt: incident.reviewed_at || null,
    reviewed_at: incident.reviewed_at || null,
    reviewDecision: incident.review_decision || null,
    review_decision: incident.review_decision || null,
    reviewComments: incident.review_comments || null,
    review_comments: incident.review_comments || null,
  };
}

function isAlertVisibleForCurrentUser(incident, role, currentUserAliases) {
  const status = normalizeStatus(incident.status);

  if (role === "IT_SUPPORT") return false;

  if (role === "SUPER_ADMIN") {
    return status === "For Review";
  }

  if (!["HR_MANAGER", "HR_STAFF"].includes(role)) return false;

  const isReporter = isCurrentUserReporter(incident, currentUserAliases);
  const isHandler = isCurrentUserHandler(incident, currentUserAliases);
  const isLastActor = isCurrentUserLastActor(incident, currentUserAliases);
  const returnedCase = isReturnedCase(incident);

  if (status === "Open") {
    return !isReporter && !isLastActor;
  }

  if (status === "Investigating") {
    if (returnedCase) {
      return isHandler && !isLastActor;
    }

    return !isLastActor;
  }

  if (status === "Closed") {
    return (isReporter || isHandler) && !isLastActor;
  }

  return false;
}

function getIncidentTimeByRole(incident, role) {
  const status = normalizeStatus(incident.status);

  if (status === "Closed" || isReturnedCase(incident)) {
    return toTimestamp(
      incident.reviewedAt ||
        incident.reviewed_at ||
        incident.lastActionAt ||
        incident.last_action_at ||
        incident.updatedAt ||
        incident.updated_at ||
        incident.createdAt ||
        incident.created_at ||
        incident.incident_date
    );
  }

  if (role === "SUPER_ADMIN") {
    return toTimestamp(
      incident.resolutionSubmittedAt ||
        incident.resolution_submitted_at ||
        incident.updatedAt ||
        incident.updated_at ||
        incident.createdAt ||
        incident.created_at ||
        incident.incident_date
    );
  }

  return toTimestamp(
    incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
  );
}

function getIncidentDateByRole(incident, role) {
  const status = normalizeStatus(incident.status);

  if (status === "Closed" || isReturnedCase(incident)) {
    return (
      incident.reviewedAt ||
      incident.reviewed_at ||
      incident.lastActionAt ||
      incident.last_action_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  if (role === "SUPER_ADMIN") {
    return (
      incident.resolutionSubmittedAt ||
      incident.resolution_submitted_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  return (
    incident.updatedAt ||
    incident.updated_at ||
    incident.createdAt ||
    incident.created_at ||
    incident.incident_date
  );
}

function getIncidentPriority(incident, role) {
  const severity = normalizeSeverity(incident.severity);
  const status = normalizeStatus(incident.status);

  if (severity === "Critical" && status !== "Closed") return ALERT_PRIORITY.HIGH;

  if (role === "SUPER_ADMIN" && status === "For Review") {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (isReturnedCase(incident)) {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (status === "Closed") {
    return ALERT_PRIORITY.LOW;
  }

  if (severity === "Major" || status === "Investigating") {
    return ALERT_PRIORITY.MEDIUM;
  }

  return ALERT_PRIORITY.LOW;
}

function getPriorityRank(priority) {
  switch (priority) {
    case ALERT_PRIORITY.HIGH:
      return 3;
    case ALERT_PRIORITY.MEDIUM:
      return 2;
    case ALERT_PRIORITY.LOW:
    default:
      return 1;
  }
}

function getIncidentTitle(incident, role, priority) {
  const incidentId = incident.id ? `#${incident.id}` : "Incident";
  const status = normalizeStatus(incident.status);

  if (isReturnedCase(incident)) {
    return `Case Returned for Correction ${incidentId}`;
  }

  if (status === "Closed") {
    return `Case Approved and Closed ${incidentId}`;
  }

  if (role === "SUPER_ADMIN") {
    return priority === ALERT_PRIORITY.HIGH
      ? `Critical Case for Review ${incidentId}`
      : `Case Pending Review ${incidentId}`;
  }

  if (priority === ALERT_PRIORITY.HIGH) {
    return `Smart Alert: Critical Incident ${incidentId}`;
  }

  if (priority === ALERT_PRIORITY.MEDIUM) {
    return `Smart Alert: Case Needs Follow-up ${incidentId}`;
  }

  return `Monitoring Alert ${incidentId}`;
}

function getIncidentRecommendedAction(incident, role) {
  const status = normalizeStatus(incident.status);

  if (isReturnedCase(incident)) {
    return "Review Super Admin comments, revise the proof, and resubmit the case for review.";
  }

  if (status === "Closed") {
    return "No further action required. The case has been approved and completed.";
  }

  if (role === "SUPER_ADMIN") {
    return "Review submitted case and approve or return for revision.";
  }

  if (normalizeSeverity(incident.severity) === "Critical") {
    return "Review immediately and prioritize HR intervention.";
  }

  if (status === "Investigating") {
    return "Continue investigation and update case progress.";
  }

  return "Monitor case and update incident status when action is taken.";
}

function buildIncidentReason(incident, role, priority) {
  const status = normalizeStatus(incident.status);
  const severity = normalizeSeverity(incident.severity);

  if (isReturnedCase(incident)) {
    return "Generated because Super Admin returned this case for correction.";
  }

  if (status === "Closed") {
    return "Generated because Super Admin approved and closed this case.";
  }

  if (role === "SUPER_ADMIN" && status === "For Review") {
    return "Generated because proof was submitted and the case is waiting for Super Admin review.";
  }

  if (severity === "Critical" && status === "Open") {
    return "Generated because this incident is marked Critical and still Open.";
  }

  if (severity === "Critical" && status === "Investigating") {
    return "Generated because this Critical incident is currently under investigation.";
  }

  if (status === "Open") {
    return "Generated because this incident is still Open and needs HR monitoring.";
  }

  if (status === "Investigating") {
    return "Generated because this case is currently under investigation.";
  }

  return "Generated based on the current incident status and recorded case data.";
}

function buildIncidentAlert(incident, role) {
  const priority = getIncidentPriority(incident, role);
  const timestamp = getIncidentTimeByRole(incident, role);
  const status = normalizeStatus(incident.status);
  const severity = normalizeSeverity(incident.severity);
  const reviewDecision = incident.reviewDecision || incident.review_decision || "";

  const alertKey = cleanAlertKey(
    `INCIDENT:${incident.id}:${status}:${reviewDecision}:${severity}:${timestamp}`
  );

  const investigationBy =
    incident.investigationStartedByName ||
    incident.investigation_started_by_name ||
    "-";

  const submittedBy =
    incident.resolutionSubmittedByName ||
    incident.resolution_submitted_by_name ||
    "-";

  const reviewedBy =
    incident.reviewedByName || incident.reviewed_by_name || "-";

  return {
    alertKey,
    sourceType: "INCIDENT",
    priority,
    priorityRank: getPriorityRank(priority),

    title: getIncidentTitle(incident, role, priority),
    message: `${incident.employeeName || "Unknown Employee"} • ${
      incident.violationType || "No violation specified"
    }`,

    employee: incident.employeeName || "Unknown Employee",
    employeeId: incident.employeeId || null,

    incidentId: incident.id,
    violation: incident.violationType || "-",
    severity,
    status,

    reviewDecision: reviewDecision || null,
    reviewComments: incident.reviewComments || incident.review_comments || "",

    reportedBy: incident.reportedByName || incident.reporterName || "-",
    reportedByName: incident.reportedByName || incident.reporterName || "-",
    reporterName: incident.reportedByName || incident.reporterName || "-",

    investigationBy,
    investigationStartedByName: investigationBy,

    submittedBy,
    resolutionSubmittedByName: submittedBy,

    reviewedBy,
    reviewedByName: reviewedBy,

    date: getIncidentDateByRole(incident, role),
    timestamp,

    route: "/incidents",

    recommendedAction: getIncidentRecommendedAction(incident, role),
    reason: buildIncidentReason(incident, role, priority),
  };
}

function buildEmployeePatternAlerts(activeEmployees, visibleIncidents, role) {
  if (!["HR_MANAGER", "HR_STAFF"].includes(role)) return [];

  const alerts = [];

  activeEmployees.forEach((employee) => {
    const employeeIncidents = visibleIncidents.filter((incident) =>
      isSameEmployee(employee, incident)
    );

    const activeCases = employeeIncidents.filter((incident) =>
      ["Open", "Investigating"].includes(normalizeStatus(incident.status))
    );

    if (activeCases.length < 3) return;

    const criticalCount = activeCases.filter(
      (incident) => normalizeSeverity(incident.severity) === "Critical"
    ).length;

    const latestIncident = [...activeCases].sort(
      (a, b) => getIncidentTimeByRole(b, role) - getIncidentTimeByRole(a, role)
    )[0];

    const latestTime = getIncidentTimeByRole(latestIncident, role);

    const priority =
      activeCases.length >= 5 || criticalCount > 0
        ? ALERT_PRIORITY.HIGH
        : ALERT_PRIORITY.MEDIUM;

    const reporterName =
      latestIncident?.reportedByName ||
      latestIncident?.reporterName ||
      latestIncident?.reportedBy ||
      "System Generated";

    alerts.push({
      alertKey: cleanAlertKey(
        `EMPLOYEE_PATTERN:${employee.id}:${activeCases.length}:${criticalCount}:${latestTime}`
      ),
      sourceType: "EMPLOYEE_PATTERN",
      priority,
      priorityRank: getPriorityRank(priority),
      title:
        priority === ALERT_PRIORITY.HIGH
          ? "Smart Alert: Repeated Violation Pattern"
          : "Smart Alert: Employee Requires Monitoring",
      message: `${employee.name} has ${activeCases.length} active incident cases.`,
      employee: employee.name,
      employeeId: employee.id,
      incidentId: latestIncident?.id || null,
      violation: "Repeated incident pattern",
      severity: criticalCount > 0 ? "Critical" : "Major",
      status: "Active Pattern",
      reportedBy: reporterName,
      reportedByName: reporterName,
      reporterName,
      date: latestIncident?.updatedAt || latestIncident?.createdAt,
      timestamp: latestTime,
      route: "/incidents",
      recommendedAction:
        "Review employee incident pattern and consider HR intervention.",
      reason:
        "The system detected repeated active incident records for the same employee.",
    });
  });

  return alerts;
}

async function fetchBaseData() {
  const userNameMap = await getUserNameMap();

  const [employees] = await db.promise().query(`
    SELECT id, name, company, status, archived
    FROM employees
  `);

  const [incidents] = await db.promise().query(`
    SELECT
      i.*,
      e.name AS employeeNameFromEmployee,
      e.company AS employeeCompany,
      e.status AS employeeStatus
    FROM incidents i
    LEFT JOIN employees e ON e.id = i.employee_id
    ORDER BY COALESCE(i.updated_at, i.created_at, i.incident_date) DESC
  `);

  return {
    employees: employees.map(normalizeEmployee),
    incidents: incidents.map((incident) =>
      normalizeIncident(incident, userNameMap)
    ),
  };
}

function buildSmartAlerts({ employees, incidents, role, currentUserAliases }) {
  const activeEmployees = employees.filter((employee) => !employee.archived);

  const visibleIncidents = incidents.filter((incident) => {
    const employeeIsActive = activeEmployees.some((employee) =>
      isSameEmployee(employee, incident)
    );

    return (
      employeeIsActive &&
      isAlertVisibleForCurrentUser(incident, role, currentUserAliases)
    );
  });

  const incidentAlerts = visibleIncidents.map((incident) =>
    buildIncidentAlert(incident, role)
  );

  const patternAlerts = buildEmployeePatternAlerts(
    activeEmployees,
    visibleIncidents,
    role
  );

  return [...incidentAlerts, ...patternAlerts].sort((a, b) => {
    if (b.priorityRank !== a.priorityRank) {
      return b.priorityRank - a.priorityRank;
    }

    return b.timestamp - a.timestamp;
  });
}

async function getAlertStates({ userKey, role }) {
  const hasTable = await tableExists("smart_alert_states");

  if (!hasTable) return new Map();

  const [rows] = await db.promise().query(
    `
    SELECT *
    FROM smart_alert_states
    WHERE user_key = ? AND role = ?
    `,
    [userKey, role]
  );

  return new Map(rows.map((row) => [row.alert_key, row]));
}

function applyAlertStates(alerts, stateMap) {
  return alerts.map((alert) => {
    const state = stateMap.get(alert.alertKey);

    return {
      ...alert,
      isRead: Number(state?.is_read || 0) === 1,
      isDismissed: Number(state?.is_dismissed || 0) === 1,
      readAt: state?.read_at || null,
      dismissedAt: state?.dismissed_at || null,
    };
  });
}

function buildSummary(alerts) {
  return {
    total: alerts.length,
    unread: alerts.filter((alert) => !alert.isRead).length,
    high: alerts.filter((alert) => alert.priority === ALERT_PRIORITY.HIGH)
      .length,
    medium: alerts.filter((alert) => alert.priority === ALERT_PRIORITY.MEDIUM)
      .length,
    low: alerts.filter((alert) => alert.priority === ALERT_PRIORITY.LOW).length,
  };
}

async function upsertAlertState({
  userKey,
  role,
  alertKey,
  isRead,
  isDismissed,
}) {
  const hasTable = await tableExists("smart_alert_states");

  if (!hasTable) return;

  await db.promise().query(
    `
    INSERT INTO smart_alert_states
      (user_key, role, alert_key, is_read, is_dismissed, read_at, dismissed_at)
    VALUES
      (?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), IF(? = 1, NOW(), NULL))
    ON DUPLICATE KEY UPDATE
      is_read = GREATEST(is_read, VALUES(is_read)),
      is_dismissed = GREATEST(is_dismissed, VALUES(is_dismissed)),
      read_at = CASE
        WHEN VALUES(is_read) = 1 THEN NOW()
        ELSE read_at
      END,
      dismissed_at = CASE
        WHEN VALUES(is_dismissed) = 1 THEN NOW()
        ELSE dismissed_at
      END,
      updated_at = NOW()
    `,
    [
      userKey,
      role,
      alertKey,
      isRead ? 1 : 0,
      isDismissed ? 1 : 0,
      isRead ? 1 : 0,
      isDismissed ? 1 : 0,
    ]
  );
}

exports.getSmartAlerts = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const currentUserAliases = getCurrentUserAliases(req);

    if (!["HR_MANAGER", "HR_STAFF", "SUPER_ADMIN"].includes(role)) {
      return res.json({
        alerts: [],
        latestAlerts: [],
        unreadCount: 0,
        popupAlert: null,
        summary: {
          total: 0,
          unread: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      });
    }

    const { employees, incidents } = await fetchBaseData();

    const alerts = buildSmartAlerts({
      employees,
      incidents,
      role,
      currentUserAliases,
    });

    const stateMap = await getAlertStates({ userKey, role });
    const alertsWithState = applyAlertStates(alerts, stateMap);

    const unreadAlerts = alertsWithState.filter((alert) => !alert.isRead);

    const popupAlert =
      unreadAlerts
        .filter((alert) => !alert.isDismissed)
        .sort((a, b) => {
          const timeA = Number(a.timestamp || 0);
          const timeB = Number(b.timestamp || 0);

          if (timeB !== timeA) return timeB - timeA;

          return Number(b.priorityRank || 0) - Number(a.priorityRank || 0);
        })[0] || null;

    res.json({
      alerts: alertsWithState,
      latestAlerts: alertsWithState.slice(0, 5),
      unreadCount: unreadAlerts.length,
      popupAlert,
      summary: buildSummary(alertsWithState),
    });
  } catch (err) {
    console.error("GET SMART ALERTS ERROR:", err);
    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to fetch smart alerts.",
    });
  }
};

exports.markSmartAlertRead = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const alertKey = req?.body?.alertKey;

    if (!alertKey) {
      return res.status(400).json({ error: "Alert key is required." });
    }

    await upsertAlertState({
      userKey,
      role,
      alertKey,
      isRead: true,
      isDismissed: false,
    });

    res.json({ success: true, message: "Alert marked as read." });
  } catch (err) {
    console.error("MARK SMART ALERT READ ERROR:", err);
    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to mark alert as read.",
    });
  }
};

exports.dismissSmartAlert = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const alertKey = req?.body?.alertKey;

    if (!alertKey) {
      return res.status(400).json({ error: "Alert key is required." });
    }

    await upsertAlertState({
      userKey,
      role,
      alertKey,
      isRead: true,
      isDismissed: true,
    });

    res.json({ success: true, message: "Alert dismissed." });
  } catch (err) {
    console.error("DISMISS SMART ALERT ERROR:", err);
    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to dismiss alert.",
    });
  }
};

exports.markAllSmartAlertsRead = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const alertKeys = Array.isArray(req?.body?.alertKeys)
      ? req.body.alertKeys
      : [];

    await Promise.all(
      alertKeys.map((alertKey) =>
        upsertAlertState({
          userKey,
          role,
          alertKey,
          isRead: true,
          isDismissed: false,
        })
      )
    );

    res.json({
      success: true,
      message: "All visible alerts marked as read.",
    });
  } catch (err) {
    console.error("MARK ALL SMART ALERTS READ ERROR:", err);
    res.status(500).json({
      error:
        err.sqlMessage || err.message || "Failed to mark all alerts as read.",
    });
  }
};