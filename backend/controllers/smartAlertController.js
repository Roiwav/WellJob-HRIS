const db = require("../config/db");

const ALERT_PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

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
    query.username ||
    body.username ||
    query.userId ||
    body.userId ||
    "UNKNOWN_USER"
  );
}

function getRole(req) {
  const query = req?.query || {};
  const body = req?.body || {};

  return query.role || body.role || "USER";
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
      query.username,
      body.username,
      query.userName,
      body.userName,
      query.fullName,
      body.fullName,
      query.name,
      body.name,
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

async function getReporterNameMap() {
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
      user.name ||
      user.full_name ||
      user.fullName ||
      user.fullname ||
      user.display_name ||
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
  });

  return map;
}

function resolveReporterName(reporterRaw, reporterNameMap) {
  const raw = String(reporterRaw || "").trim();

  if (!raw) return "Unknown Reporter";

  return reporterNameMap.get(normalizeIdentity(raw)) || raw;
}

function isOwnReportedIncident(incident, currentUserAliases) {
  if (!currentUserAliases || currentUserAliases.size === 0) return false;

  const possibleReporterValues = [
    incident.reportedBy,
    incident.reportedByName,
    incident.reporterName,
    incident.reported_by,
    incident.createdBy,
    incident.created_by,
  ];

  return possibleReporterValues.some((value) =>
    currentUserAliases.has(normalizeIdentity(value))
  );
}

function getIncidentTimeByRole(incident, role) {
  const raw =
    role === "SUPER_ADMIN"
      ? incident.resolution_submitted_at ||
        incident.reviewed_at ||
        incident.updated_at ||
        incident.created_at ||
        incident.incident_date
      : incident.updated_at || incident.created_at || incident.incident_date;

  return toTimestamp(raw);
}

function getIncidentDateByRole(incident, role) {
  if (role === "SUPER_ADMIN") {
    return (
      incident.resolution_submitted_at ||
      incident.updated_at ||
      incident.created_at ||
      incident.incident_date
    );
  }

  return incident.updated_at || incident.created_at || incident.incident_date;
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

function normalizeIncident(incident, reporterNameMap = new Map()) {
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

  const reportedByName = resolveReporterName(reportedByRaw, reporterNameMap);

  return {
    ...incident,
    id: incident.id,
    employeeId: incident.employee_id,
    employeeName,
    employee: employeeName,
    company: incident.company || incident.employeeCompany || "",
    violation,
    violationType: violation,
    severity: normalizeSeverity(incident.severity),
    status: normalizeStatus(incident.status),
    reportedBy: reportedByRaw,
    reportedByName,
    reporterName: reportedByName,
    date: incident.incident_date || incident.created_at,
    createdAt: incident.created_at,
    updatedAt: incident.updated_at || incident.created_at,
  };
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

function isAlertVisibleForRole(incident, role) {
  const status = normalizeStatus(incident.status);

  if (role === "IT_SUPPORT") return false;

  if (role === "SUPER_ADMIN") {
    return status === "For Review";
  }

  if (role === "HR_MANAGER" || role === "HR_STAFF") {
    return ["Open", "Investigating"].includes(status);
  }

  return false;
}

function getIncidentPriority(incident, role) {
  const severity = normalizeSeverity(incident.severity);
  const status = normalizeStatus(incident.status);

  if (severity === "Critical") return ALERT_PRIORITY.HIGH;

  if (role === "SUPER_ADMIN" && status === "For Review") {
    return ALERT_PRIORITY.MEDIUM;
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

function getIncidentRecommendedAction(incident, role, priority) {
  const status = normalizeStatus(incident.status);

  if (role === "SUPER_ADMIN") {
    return "Review submitted case and approve or return for revision.";
  }

  if (priority === ALERT_PRIORITY.HIGH) {
    return "Review immediately and prioritize HR intervention.";
  }

  if (status === "Investigating") {
    return "Continue investigation and update case progress.";
  }

  return "Monitor case and update incident status when action is taken.";
}

function buildIncidentAlert(incident, role) {
  const priority = getIncidentPriority(incident, role);
  const timestamp = getIncidentTimeByRole(incident, role);
  const status = normalizeStatus(incident.status);
  const severity = normalizeSeverity(incident.severity);

  const reporterName =
    incident.reportedByName ||
    incident.reporterName ||
    incident.reportedBy ||
    "Unknown Reporter";

  const alertKey = cleanAlertKey(
    `INCIDENT:${incident.id}:${status}:${severity}:${timestamp}`
  );

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
    reportedBy: reporterName,
    reportedByName: reporterName,
    reporterName,
    date: getIncidentDateByRole(incident, role),
    timestamp,
    route: "/incidents",
    recommendedAction: getIncidentRecommendedAction(incident, role, priority),
    reason:
      priority === ALERT_PRIORITY.HIGH
        ? "Critical severity or priority case detected by the system."
        : "Incident status and severity require monitoring based on role rules.",
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
  const reporterNameMap = await getReporterNameMap();

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
      normalizeIncident(incident, reporterNameMap)
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
      isAlertVisibleForRole(incident, role) &&
      !isOwnReportedIncident(incident, currentUserAliases)
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
    res.status(500).json({ error: "Failed to fetch smart alerts." });
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
    res.status(500).json({ error: "Failed to mark alert as read." });
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
    res.status(500).json({ error: "Failed to dismiss alert." });
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
    res.status(500).json({ error: "Failed to mark all alerts as read." });
  }
};