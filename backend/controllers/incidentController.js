const db = require("../config/db");
const { logAudit, AUDIT_CATEGORY } = require("../utils/auditLogger");

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

const WORKFLOW_ACTION = {
  START: "START_INVESTIGATION",
  SUBMIT_RESOLUTION: "SUBMIT_RESOLUTION",
  SUBMIT_INVESTIGATION: "SUBMIT_INVESTIGATION",
  RETURN: "RETURN_INCIDENT",
  CLOSE: "CLOSE_INCIDENT",
};

const INVESTIGATOR_ROLES = new Set(["HR_MANAGER", "HR_STAFF"]);
const REVIEWER_ROLES = new Set(["HR_MANAGER", "SUPER_ADMIN"]);

function toNullable(value) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeDate(value) {
  if (!value) return null;

  const dateString = String(value).trim();
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return dateString.slice(0, 10);
}

function normalizeStatus(value) {
  const status = String(value || "").trim();
  const normalized = status.toLowerCase();

  if (!status) return "Open";
  if (normalized === "for_review") return "For Review";
  if (normalized === "for review") return "For Review";
  if (normalized === "resolved") return "Closed";
  if (normalized === "closed") return "Closed";
  if (normalized === "investigating") return "Investigating";
  if (normalized === "open") return "Open";

  return status;
}

function normalizeSeverity(value) {
  const severity = String(value || "").trim();
  return severity || "Minor";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (["SUPERADMIN", "SUPER_ADMIN", "ADMIN"].includes(role)) {
    return "SUPER_ADMIN";
  }

  if (["HRMANAGER", "HR_MANAGER"].includes(role)) {
    return "HR_MANAGER";
  }

  if (["HRSTAFF", "HR_STAFF"].includes(role)) {
    return "HR_STAFF";
  }

  if (["ITSUPPORT", "IT_SUPPORT"].includes(role)) {
    return "IT_SUPPORT";
  }

  return role || "USER";
}

function isInvestigatorRole(role) {
  return INVESTIGATOR_ROLES.has(normalizeRole(role));
}

function isReviewerRole(role) {
  return REVIEWER_ROLES.has(normalizeRole(role));
}

function normalizeWorkflowAction(value, status) {
  const action = String(value || "").trim().toUpperCase();

  if (Object.values(WORKFLOW_ACTION).includes(action)) {
    return action;
  }

  return getActionTypeFromStatus(status);
}

function getWorkflowTargetStatus(actionType, requestedStatus) {
  switch (actionType) {
    case WORKFLOW_ACTION.START:
      return "Investigating";

    case WORKFLOW_ACTION.SUBMIT_RESOLUTION:
    case WORKFLOW_ACTION.SUBMIT_INVESTIGATION:
      return "For Review";

    case WORKFLOW_ACTION.RETURN:
      return "Investigating";

    case WORKFLOW_ACTION.CLOSE:
      return "Closed";

    default:
      return normalizeStatus(requestedStatus);
  }
}

function isDeployedEmployee(employee) {
  const status = normalizeText(employee?.status);
  return status === "deployed";
}

function buildEvidenceFromReq(req) {
  if (!req.files || !Array.isArray(req.files)) return [];

  return req.files.map((file) => ({
    fileName: file.originalname,
    filePath: String(file.path || "").replace(/\\/g, "/"),
  }));
}

function normalizeEmployeeLookupId(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^EMP[-\s]?\d+$/i.test(raw)) {
    return raw.replace(/^EMP[-\s]?/i, "").replace(/^0+/, "") || raw;
  }

  return raw.replace(/^0+/, "") || raw;
}

function isActiveDeploymentRow(deployment) {
  const status = normalizeText(
    deployment.status ||
      deployment.deployment_status ||
      deployment.deploymentStatus
  );

  return ["active", "deployed", "active deployed", "ongoing"].includes(status);
}

async function tableExists(tableName) {
  const [rows] = await db.promise().query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function ensureIncidentTimelineTable() {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS incident_timeline (
      id INT AUTO_INCREMENT PRIMARY KEY,
      incident_id INT NOT NULL,
      action_type VARCHAR(80) NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT NULL,
      created_by_id VARCHAR(50) NULL,
      created_by_username VARCHAR(100) NULL,
      created_by_name VARCHAR(150) NULL,
      created_by_role VARCHAR(80) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_incident_timeline_incident_id (incident_id),
      CONSTRAINT fk_incident_timeline_incident
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
        ON DELETE CASCADE
    )
  `);
}

async function getActiveDeploymentForEmployee(employeeId) {
  const normalizedEmployeeId = String(employeeId || "").trim();

  if (!normalizedEmployeeId) return null;

  const hasDeploymentsTable = await tableExists("deployments");
  if (!hasDeploymentsTable) return null;

  const [rows] = await db.promise().query(
    `
    SELECT *
    FROM deployments
    WHERE CAST(employee_id AS CHAR) = ?
    ORDER BY created_at DESC, id DESC
    `,
    [normalizedEmployeeId]
  );

  return rows.find(isActiveDeploymentRow) || null;
}

function serializeEvidenceItem(item) {
  return {
    id: item.id,
    fileName: item.file_name,
    filePath: item.file_path,
    url: `${API_BASE}/${item.file_path}`,
  };
}

function serializeTimelineItem(item) {
  return {
    id: item.id,

    incidentId: item.incident_id,
    incident_id: item.incident_id,

    actionType: item.action_type,
    action_type: item.action_type,

    title: item.title,
    description: item.description || "",

    createdById: item.created_by_id || null,
    created_by_id: item.created_by_id || null,

    createdByUsername: item.created_by_username || null,
    created_by_username: item.created_by_username || null,

    createdByName: item.created_by_name || "System",
    created_by_name: item.created_by_name || "System",

    createdByRole: item.created_by_role || null,
    created_by_role: item.created_by_role || null,

    createdAt: item.created_at,
    created_at: item.created_at,
  };
}

async function getTimelineByIncidentId(incidentId) {
  await ensureIncidentTimelineTable();

  const [rows] = await db.promise().query(
    `
    SELECT *
    FROM incident_timeline
    WHERE incident_id = ?
    ORDER BY created_at ASC, id ASC
    `,
    [incidentId]
  );

  return rows.map(serializeTimelineItem);
}

async function getTimelineByIncidentIds(
  incidentIds = [],
  { ensureTable = true } = {}
) {
  if (ensureTable) {
    await ensureIncidentTimelineTable();
  }

  if (!incidentIds.length) return new Map();

  const [rows] = await db.promise().query(
    `
    SELECT *
    FROM incident_timeline
    WHERE incident_id IN (?)
    ORDER BY created_at ASC, id ASC
    `,
    [incidentIds]
  );

  return rows.reduce((map, row) => {
    const key = String(row.incident_id);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(serializeTimelineItem(row));
    return map;
  }, new Map());
}

async function addTimelineEvent({
  incidentId,
  actionType,
  title,
  description,
  actor,
}) {
  await ensureIncidentTimelineTable();

  await db.promise().query(
    `
    INSERT INTO incident_timeline
    (
      incident_id,
      action_type,
      title,
      description,
      created_by_id,
      created_by_username,
      created_by_name,
      created_by_role
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      incidentId,
      actionType,
      title,
      description || null,
      actor?.userId || null,
      actor?.username || null,
      actor?.fullName || "System",
      actor?.role || null,
    ]
  );
}

function getTimelineTitle(actionType, existingIncident) {
  const wasReturned =
    String(existingIncident?.review_decision || "").toLowerCase() ===
      "returned" ||
    String(existingIncident?.review_decision || "").toLowerCase() ===
      "rejected";

  switch (actionType) {
    case "CREATE_INCIDENT":
      return "Reported";

    case WORKFLOW_ACTION.START:
      return "Investigation Started";

    case WORKFLOW_ACTION.SUBMIT_RESOLUTION:
    case WORKFLOW_ACTION.SUBMIT_INVESTIGATION:
      return wasReturned ? "Proof Resubmitted" : "Proof Submitted";

    case WORKFLOW_ACTION.RETURN:
      return "Returned by Reviewer";

    case WORKFLOW_ACTION.CLOSE:
      return "Approved and Closed";

    default:
      return "Incident Updated";
  }
}

function getTimelineDescription(actionType, actor, details = {}) {
  const actorName = actor?.fullName || "System";

  switch (actionType) {
    case "CREATE_INCIDENT":
      return `Reported by ${actorName}.`;

    case WORKFLOW_ACTION.START:
      return `${actorName} started the investigation.`;

    case WORKFLOW_ACTION.SUBMIT_RESOLUTION:
    case WORKFLOW_ACTION.SUBMIT_INVESTIGATION:
      return `${actorName} submitted proof for authorized reviewer assessment.`;

    case WORKFLOW_ACTION.RETURN:
      return details?.comments
        ? `${actorName} returned the case for correction: ${details.comments}`
        : `${actorName} returned the case for correction.`;

    case WORKFLOW_ACTION.CLOSE:
      return `${actorName} approved and closed the case.`;

    default:
      return `${actorName} updated the incident record.`;
  }
}

function serializeIncident(incident, evidence = [], timelineEvents = []) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const actionTaken = incident.action_taken || "";

  const investigation = incident.investigation_started_at
    ? {
        startedAt: incident.investigation_started_at,
        startedById: incident.investigation_started_by_id,
        startedByUsername: incident.investigation_started_by_username,
        startedByName: incident.investigation_started_by_name,
      }
    : null;

  const resolution = incident.resolution_submitted_at
    ? {
        submittedAt: incident.resolution_submitted_at,
        submittedById: incident.resolution_submitted_by_id,
        submittedByUsername: incident.resolution_submitted_by_username,
        submittedByName: incident.resolution_submitted_by_name,
        actionTaken: incident.action_taken || "",
        remarks: incident.resolution_notes || "",
        proofFiles: evidence.map(serializeEvidenceItem),
      }
    : null;

  const review =
    incident.reviewed_at || incident.review_decision
      ? {
          reviewedAt: incident.reviewed_at,
          reviewedById: incident.reviewed_by_id,
          reviewedByUsername: incident.reviewed_by_username,
          reviewedByName: incident.reviewed_by_name,
          decision: incident.review_decision,
          comments: incident.review_comments,
        }
      : null;

  return {
    id: incident.id,

    employeeId: incident.employee_id,
    employee_id: incident.employee_id,

    employee: employeeName,
    employeeName,

    company: incident.company || incident.employeeCompany || "",
    employeeStatus: incident.employeeStatus || "",

    violation: incident.violation_type || "",
    violationType: incident.violation_type || "",
    violation_type: incident.violation_type || "",

    severity: incident.severity || "Minor",
    status: incident.status || "Open",

    date: incident.incident_date,
    incidentDate: incident.incident_date,
    incident_date: incident.incident_date,
    reportedAt: incident.created_at || incident.incident_date,

    location: incident.location || "",
    description: incident.description || "",

    reportedBy: incident.reported_by || "",
    reportedByName: incident.reported_by || "",
    reported_by: incident.reported_by || "",

    actionTaken,
    action_taken: actionTaken,
    sanction: actionTaken,

    recommendation: incident.recommendation || "",

    resolutionNotes: incident.resolution_notes || "",
    resolution_notes: incident.resolution_notes || "",

    investigation,
    resolution,
    review,

    investigationStartedAt: incident.investigation_started_at || null,
    investigation_started_at: incident.investigation_started_at || null,

    investigationStartedById:
      incident.investigation_started_by_id || null,
    investigation_started_by_id:
      incident.investigation_started_by_id || null,

    investigationStartedByUsername:
      incident.investigation_started_by_username || null,
    investigation_started_by_username:
      incident.investigation_started_by_username || null,

    investigationStartedByName:
      incident.investigation_started_by_name || null,
    investigation_started_by_name:
      incident.investigation_started_by_name || null,

    resolutionSubmittedAt:
      incident.resolution_submitted_at || null,
    resolution_submitted_at:
      incident.resolution_submitted_at || null,

    resolutionSubmittedById:
      incident.resolution_submitted_by_id || null,
    resolution_submitted_by_id:
      incident.resolution_submitted_by_id || null,

    resolutionSubmittedByUsername:
      incident.resolution_submitted_by_username || null,
    resolution_submitted_by_username:
      incident.resolution_submitted_by_username || null,

    resolutionSubmittedByName:
      incident.resolution_submitted_by_name || null,
    resolution_submitted_by_name:
      incident.resolution_submitted_by_name || null,

    reviewedAt: incident.reviewed_at || null,
    reviewed_at: incident.reviewed_at || null,

    reviewedById: incident.reviewed_by_id || null,
    reviewed_by_id: incident.reviewed_by_id || null,

    reviewedByUsername: incident.reviewed_by_username || null,
    reviewed_by_username: incident.reviewed_by_username || null,

    reviewedByName: incident.reviewed_by_name || null,
    reviewed_by_name: incident.reviewed_by_name || null,

    reviewDecision: incident.review_decision || null,
    review_decision: incident.review_decision || null,

    reviewComments: incident.review_comments || null,
    review_comments: incident.review_comments || null,

    createdAt: incident.created_at,
    created_at: incident.created_at,

    updatedAt: incident.updated_at,
    updated_at: incident.updated_at,

    lastActionById: incident.last_action_by_id || null,
    last_action_by_id: incident.last_action_by_id || null,

    lastActionByUsername: incident.last_action_by_username || null,
    last_action_by_username: incident.last_action_by_username || null,

    lastActionByName: incident.last_action_by_name || null,
    last_action_by_name: incident.last_action_by_name || null,

    lastActionType: incident.last_action_type || null,
    last_action_type: incident.last_action_type || null,

    lastActionAt: incident.last_action_at || null,
    last_action_at: incident.last_action_at || null,

    evidence: evidence.map(serializeEvidenceItem),

    timelineEvents,
    timeline_events: timelineEvents,
    timeline: timelineEvents,
  };
}

async function getIncidentWithEvidence(id) {
  const [rows] = await db.promise().query(
    `
    SELECT
      i.*,
      e.name AS employeeNameFromEmployee,
      e.company AS employeeCompany,
      e.status AS employeeStatus
    FROM incidents i
    LEFT JOIN employees e ON e.id = i.employee_id
    WHERE i.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (rows.length === 0) return null;

  const [[evidence], timelineEvents] = await Promise.all([
    db.promise().query(
      `
      SELECT *
      FROM incident_evidence
      WHERE incident_id = ?
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    ),
    getTimelineByIncidentId(id),
  ]);

  return serializeIncident(rows[0], evidence, timelineEvents);
}

async function resolveActorFullName({ userId, username, fullName }) {
  const cleanUserId = toNullable(userId);
  const cleanUsername = toNullable(username);
  const cleanFullName = toNullable(fullName);

  if (
    cleanFullName &&
    cleanFullName !== cleanUsername &&
    cleanFullName !== "Unknown User"
  ) {
    return cleanFullName;
  }

  const hasUsersTable = await tableExists("users");

  if (!hasUsersTable) {
    return cleanFullName || cleanUsername || "Unknown User";
  }

  const [users] = await db.promise().query(`SELECT * FROM users`);

  const matchedUser = users.find((user) => {
    const possibleIds = [
      user.id,
      user.user_id,
      user.userId,
      user.employee_id,
      user.employeeId,
    ].map((item) => String(item || "").trim());

    const possibleUsernames = [
      user.username,
      user.email,
      user.name,
      user.full_name,
      user.fullName,
      user.fullname,
      user.display_name,
    ].map((item) => String(item || "").trim().toLowerCase());

    return (
      (!!cleanUserId && possibleIds.includes(String(cleanUserId))) ||
      (!!cleanUsername &&
        possibleUsernames.includes(String(cleanUsername).toLowerCase()))
    );
  });

  if (!matchedUser) {
    return cleanFullName || cleanUsername || "Unknown User";
  }

  return (
    toNullable(matchedUser.full_name) ||
    toNullable(matchedUser.fullName) ||
    toNullable(matchedUser.fullname) ||
    toNullable(matchedUser.name) ||
    toNullable(matchedUser.display_name) ||
    cleanFullName ||
    cleanUsername ||
    "Unknown User"
  );
}

async function getActor(req) {
  const body = req.body || {};
  const authenticatedUser = req.user || req.auth?.user || {};

  const userId =
    authenticatedUser.userId ||
    authenticatedUser.user_id ||
    authenticatedUser.id ||
    body.userId ||
    body.user_id ||
    null;

  const username =
    authenticatedUser.username ||
    authenticatedUser.email ||
    body.username ||
    null;

  const fullName =
    authenticatedUser.fullName ||
    authenticatedUser.full_name ||
    authenticatedUser.displayName ||
    authenticatedUser.display_name ||
    authenticatedUser.name ||
    body.fullName ||
    body.full_name ||
    body.name ||
    body.displayName ||
    body.display_name ||
    body.username ||
    "Unknown User";

  const role = normalizeRole(
    authenticatedUser.role ||
      authenticatedUser.userRole ||
      body.role ||
      "USER"
  );

  return {
    userId,
    username,
    fullName: await resolveActorFullName({
      userId,
      username,
      fullName,
    }),
    role,
  };
}

function looksLikeUsername(value) {
  const cleanValue = String(value || "").trim().toLowerCase();

  return (
    /^(hm|hr|it)\d+$/i.test(cleanValue) ||
    cleanValue === "admin" ||
    cleanValue === "superadmin"
  );
}

function getSafePersonName(inputName, actor) {
  const value = toNullable(inputName);
  const username = toNullable(actor?.username);
  const fullName = toNullable(actor?.fullName);

  if (!value) return fullName || username || "Unknown User";

  const sameAsUsername =
    username && value.toLowerCase() === username.toLowerCase();

  if (sameAsUsername || looksLikeUsername(value)) {
    return fullName || value;
  }

  return value;
}

function getActionTypeFromStatus(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "Investigating") {
    return WORKFLOW_ACTION.START;
  }

  if (normalizedStatus === "For Review") {
    return WORKFLOW_ACTION.SUBMIT_INVESTIGATION;
  }

  if (normalizedStatus === "Closed") {
    return WORKFLOW_ACTION.CLOSE;
  }

  return "UPDATE_INCIDENT";
}

async function safeLogAudit(payload) {
  try {
    await logAudit(payload);
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error);
  }
}

// GET ALL INCIDENTS
exports.getIncidents = async (req, res) => {
  try {
    await ensureIncidentTimelineTable();

    const [incidents] = await db.promise().query(`
      SELECT
        i.*,
        e.name AS employeeNameFromEmployee,
        e.company AS employeeCompany,
        e.status AS employeeStatus
      FROM incidents i
      LEFT JOIN employees e ON e.id = i.employee_id
      ORDER BY i.created_at DESC, i.id DESC
    `);

    if (incidents.length === 0) {
      return res.json([]);
    }

    const incidentIds = incidents.map((incident) => incident.id);

    const [[evidence], timelineMap] = await Promise.all([
      db.promise().query(
        `
        SELECT *
        FROM incident_evidence
        WHERE incident_id IN (?)
        ORDER BY created_at DESC, id DESC
        `,
        [incidentIds]
      ),
      getTimelineByIncidentIds(incidentIds, { ensureTable: false }),
    ]);

    const evidenceMap = evidence.reduce((map, item) => {
      const key = String(item.incident_id);

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(item);
      return map;
    }, {});

    const result = incidents.map((incident) => {
      const incidentEvidence = evidenceMap[String(incident.id)] || [];
      const timelineEvents = timelineMap.get(String(incident.id)) || [];

      return serializeIncident(incident, incidentEvidence, timelineEvents);
    });

    return res.json(result);
  } catch (err) {
    console.error("GET INCIDENTS ERROR:", err);

    return res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to fetch incidents",
    });
  }
};

// GET INCIDENTS BY EMPLOYEE
exports.getIncidentsByEmployee = async (req, res) => {
  try {
    await ensureIncidentTimelineTable();

    const { employeeId } = req.params;
    const { name } = req.query;

    const rawEmployeeId = String(employeeId || "").trim();
    const lookupEmployeeId = normalizeEmployeeLookupId(rawEmployeeId);
    const employeeName = String(name || "").trim().toLowerCase();

    if (!lookupEmployeeId && !employeeName) {
      return res.status(400).json({
        error: "Employee ID or employee name is required",
      });
    }

    const conditions = [];
    const params = [];

    if (lookupEmployeeId) {
      conditions.push("CAST(i.employee_id AS CHAR) = ?");
      params.push(lookupEmployeeId);
    }

    if (employeeName) {
      conditions.push("LOWER(TRIM(i.employee_name)) = ?");
      params.push(employeeName);
    }

    const [incidents] = await db.promise().query(
      `
      SELECT
        i.*,
        e.name AS employeeNameFromEmployee,
        e.company AS employeeCompany,
        e.status AS employeeStatus
      FROM incidents i
      LEFT JOIN employees e ON e.id = i.employee_id
      WHERE ${conditions.join(" OR ")}
      ORDER BY
        i.incident_date ASC,
        i.created_at ASC,
        i.id ASC
      `,
      params
    );

    if (incidents.length === 0) {
      return res.json([]);
    }

    const incidentIds = incidents.map((incident) => incident.id);

    const [[evidence], timelineMap] = await Promise.all([
      db.promise().query(
        `
        SELECT *
        FROM incident_evidence
        WHERE incident_id IN (?)
        ORDER BY created_at DESC, id DESC
        `,
        [incidentIds]
      ),
      getTimelineByIncidentIds(incidentIds, { ensureTable: false }),
    ]);

    const evidenceMap = evidence.reduce((map, item) => {
      const key = String(item.incident_id);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(item);
      return map;
    }, new Map());

    const result = incidents.map((incident) => {
      const incidentKey = String(incident.id);
      const incidentEvidence = evidenceMap.get(incidentKey) || [];

      return serializeIncident(
        incident,
        incidentEvidence,
        timelineMap.get(incidentKey) || []
      );
    });

    return res.json(result);
  } catch (err) {
    console.error("GET INCIDENTS BY EMPLOYEE ERROR:", err);

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Failed to fetch employee incidents",
    });
  }
};

// GET ONE INCIDENT
exports.getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;

    const incident = await getIncidentWithEvidence(id);

    if (!incident) {
      return res.status(404).json({
        error: "Incident not found",
      });
    }

    return res.json(incident);
  } catch (err) {
    console.error("GET INCIDENT ERROR:", err);

    return res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to fetch incident",
    });
  }
};

// CREATE INCIDENT
exports.createIncident = async (req, res) => {
  try {
    await ensureIncidentTimelineTable();

    const {
      employeeId,
      employee_id,
      employee,
      employeeName,
      company,
      violation,
      violationType,
      severity,
      status,
      date,
      incidentDate,
      location,
      description,
      reportedBy,
      actionTaken,
      recommendation,
      resolutionNotes,
    } = req.body || {};

    const actor = await getActor(req);
    const finalEmployeeId = employeeId || employee_id;

    if (!finalEmployeeId) {
      return res.status(400).json({
        error: "Employee is required.",
      });
    }

    const [employeeRows] = await db.promise().query(
      `SELECT * FROM employees WHERE id = ? LIMIT 1`,
      [finalEmployeeId]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({
        error: "Selected employee not found.",
      });
    }

    const employeeRecord = employeeRows[0];

    if (!isDeployedEmployee(employeeRecord)) {
      return res.status(400).json({
        error:
          "Incident cannot be created for floating or standby employees. Please select a deployed employee.",
      });
    }

    const activeDeployment = await getActiveDeploymentForEmployee(
      finalEmployeeId
    );

    const finalEmployeeName =
      employeeName || employee || employeeRecord.name || null;

    const finalCompany =
      company ||
      activeDeployment?.company ||
      employeeRecord.company ||
      activeDeployment?.client_company ||
      null;

    const finalViolation = violationType || violation;

    if (!finalViolation) {
      return res.status(400).json({
        error: "Violation type is required.",
      });
    }

    const finalDate = normalizeDate(incidentDate || date);

    if (!finalDate) {
      return res.status(400).json({
        error: "Incident date is required.",
      });
    }

    const normalizedStatus = normalizeStatus(status);
    const finalReportedBy = getSafePersonName(reportedBy, actor);

    const [result] = await db.promise().query(
      `
      INSERT INTO incidents
      (
        employee_id,
        employee_name,
        company,
        violation_type,
        severity,
        status,
        incident_date,
        location,
        description,
        reported_by,
        action_taken,
        recommendation,
        resolution_notes,
        last_action_by_id,
        last_action_by_username,
        last_action_by_name,
        last_action_type,
        last_action_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        finalEmployeeId,
        finalEmployeeName,
        finalCompany,
        finalViolation,
        normalizeSeverity(severity),
        normalizedStatus,
        finalDate,
        location || null,
        description || null,
        finalReportedBy,
        actionTaken || null,
        recommendation || null,
        resolutionNotes || null,
        actor.userId,
        actor.username,
        actor.fullName,
        "CREATE_INCIDENT",
      ]
    );

    const incidentId = result.insertId;
    const evidenceFiles = buildEvidenceFromReq(req);

    for (const file of evidenceFiles) {
      await db.promise().query(
        `
        INSERT INTO incident_evidence
        (incident_id, file_name, file_path)
        VALUES (?, ?, ?)
        `,
        [incidentId, file.fileName, file.filePath]
      );
    }

    await addTimelineEvent({
      incidentId,
      actionType: "CREATE_INCIDENT",
      title: "Reported",
      description: `Reported by ${finalReportedBy}.`,
      actor,
    });

    await safeLogAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "ADD_INCIDENT",
      description: `${actor.fullName} created incident record for ${finalEmployeeName}.`,
    });

    const createdIncident = await getIncidentWithEvidence(incidentId);

    return res.status(201).json({
      success: true,
      message: "Incident created successfully",
      id: incidentId,
      incidentId,
      incident: createdIncident,
    });
  } catch (err) {
    console.error("CREATE INCIDENT ERROR:", err);

    return res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to create incident",
    });
  }
};

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function buildActorAliases(actor) {
  return new Set(
    [actor?.userId, actor?.username, actor?.fullName]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
}

function hasActorMatch(actor, values = []) {
  const aliases = buildActorAliases(actor);

  return values.some((value) => aliases.has(normalizeIdentity(value)));
}

function getAssignedInvestigatorValues(incident) {
  return [
    incident.investigation_started_by_id,
    incident.investigation_started_by_username,
    incident.investigation_started_by_name,

    incident.last_action_type === WORKFLOW_ACTION.START
      ? incident.last_action_by_id
      : null,

    incident.last_action_type === WORKFLOW_ACTION.START
      ? incident.last_action_by_username
      : null,

    incident.last_action_type === WORKFLOW_ACTION.START
      ? incident.last_action_by_name
      : null,
  ].filter(Boolean);
}

// UPDATE INCIDENT
exports.updateIncident = async (req, res) => {
  try {
    await ensureIncidentTimelineTable();

    const { id } = req.params;

    const {
      employeeId,
      employee_id,
      employee,
      employeeName,
      company,
      violation,
      violationType,
      severity,
      status,
      date,
      incidentDate,
      location,
      description,
      reportedBy,
      actionTaken,
      recommendation,
      resolutionNotes,
      workflowAction,
    } = req.body || {};

    const actor = await getActor(req);
    const finalEmployeeId = employeeId || employee_id;

    if (!finalEmployeeId) {
      return res.status(400).json({
        error: "Employee is required.",
      });
    }

    const [employeeRows] = await db.promise().query(
      `SELECT * FROM employees WHERE id = ? LIMIT 1`,
      [finalEmployeeId]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({
        error: "Selected employee not found.",
      });
    }

    const employeeRecord = employeeRows[0];

    if (!isDeployedEmployee(employeeRecord)) {
      return res.status(400).json({
        error:
          "Incident cannot be assigned to floating or standby employees. Please select a deployed employee.",
      });
    }

    const activeDeployment = await getActiveDeploymentForEmployee(
      finalEmployeeId
    );

    const finalEmployeeName =
      employeeName || employee || employeeRecord.name || null;

    const finalCompany =
      company ||
      activeDeployment?.company ||
      employeeRecord.company ||
      activeDeployment?.client_company ||
      null;

    const finalViolation = violationType || violation;
    const finalDate = normalizeDate(incidentDate || date);

    if (!finalViolation) {
      return res.status(400).json({
        error: "Violation type is required.",
      });
    }

    if (!finalDate) {
      return res.status(400).json({
        error: "Incident date is required.",
      });
    }

    const normalizedStatus = normalizeStatus(status);
    const actionType =
      workflowAction || getActionTypeFromStatus(normalizedStatus);
    const finalReportedBy = getSafePersonName(reportedBy, actor);

    await db.promise().query(
      `
      UPDATE incidents
      SET
        employee_id = ?,
        employee_name = ?,
        company = ?,
        violation_type = ?,
        severity = ?,
        status = ?,
        incident_date = ?,
        location = ?,
        description = ?,
        reported_by = ?,
        action_taken = ?,
        recommendation = ?,
        resolution_notes = ?,
        last_action_by_id = ?,
        last_action_by_username = ?,
        last_action_by_name = ?,
        last_action_type = ?,
        last_action_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        finalEmployeeId,
        finalEmployeeName,
        finalCompany,
        finalViolation,
        normalizeSeverity(severity),
        normalizedStatus,
        finalDate,
        location || null,
        description || null,
        finalReportedBy,
        actionTaken || null,
        recommendation || null,
        resolutionNotes || null,
        actor.userId,
        actor.username,
        actor.fullName,
        actionType,
        id,
      ]
    );

    const evidenceFiles = buildEvidenceFromReq(req);

    for (const file of evidenceFiles) {
      await db.promise().query(
        `
        INSERT INTO incident_evidence
        (incident_id, file_name, file_path)
        VALUES (?, ?, ?)
        `,
        [id, file.fileName, file.filePath]
      );
    }

    await safeLogAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: actionType,
      description: `${actor.fullName} updated incident record for ${finalEmployeeName}.`,
    });

    const updatedIncident = await getIncidentWithEvidence(id);

    return res.json({
      success: true,
      message: "Incident updated successfully",
      incident: updatedIncident,
    });
  } catch (err) {
    console.error("UPDATE INCIDENT ERROR:", err);

    return res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to update incident",
    });
  }
};

// UPDATE STATUS ONLY
exports.updateIncidentStatus = async (req, res) => {
  try {
    await ensureIncidentTimelineTable();

    const { id } = req.params;

    const {
      status,
      workflowAction,
      resolutionNotes,
      actionTaken,
      recommendation,
    } = req.body || {};

    const actor = await getActor(req);
    const actionType = normalizeWorkflowAction(workflowAction, status);
    const normalizedStatus = getWorkflowTargetStatus(actionType, status);
    const evidenceFiles = buildEvidenceFromReq(req);

    const [existingRows] = await db.promise().query(
      `SELECT * FROM incidents WHERE id = ? LIMIT 1`,
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: "Incident not found.",
      });
    }

    const existingIncident = existingRows[0];
    const existingStatus = normalizeStatus(existingIncident.status);

    const investigatorValues =
      getAssignedInvestigatorValues(existingIncident);

    const cleanResolutionNotes = toNullable(resolutionNotes);
    const cleanActionTaken = toNullable(actionTaken);
    const cleanRecommendation = toNullable(recommendation);

    if (existingStatus === "Closed") {
      return res.status(409).json({
        error: "This case is already closed and can no longer be modified.",
      });
    }

    if (actionType === WORKFLOW_ACTION.START) {
      if (!isInvestigatorRole(actor.role)) {
        return res.status(403).json({
          error:
            "Only an HR Manager or HR Staff user can start an investigation.",
        });
      }

      if (
        existingStatus !== "Open" ||
        existingIncident.investigation_started_at
      ) {
        return res.status(409).json({
          error: "Only an Open case can begin investigation.",
        });
      }
    }

    if (
      actionType === WORKFLOW_ACTION.SUBMIT_RESOLUTION ||
      actionType === WORKFLOW_ACTION.SUBMIT_INVESTIGATION
    ) {
      if (!isInvestigatorRole(actor.role)) {
        return res.status(403).json({
          error:
            "Only an HR Manager or HR Staff user can submit investigation proof.",
        });
      }

      if (existingStatus !== "Investigating") {
        return res.status(409).json({
          error:
            "Only an Investigating case can be submitted for review.",
        });
      }

      if (investigatorValues.length === 0) {
        return res.status(409).json({
          error:
            "This case has no assigned investigator. Start the investigation before submitting proof.",
        });
      }

      if (!hasActorMatch(actor, investigatorValues)) {
        return res.status(403).json({
          error:
            "Only the HR user assigned to this investigation can submit or resubmit proof.",
        });
      }

      if (!cleanActionTaken) {
        return res.status(400).json({
          error:
            "Action taken is required before submitting the case for review.",
        });
      }

      if (!cleanResolutionNotes) {
        return res.status(400).json({
          error:
            "Resolution remarks are required before submitting the case for review.",
        });
      }

      if (evidenceFiles.length === 0) {
        return res.status(400).json({
          error:
            "At least one valid proof file is required before submitting the case for review.",
        });
      }
    }

    if (
      actionType === WORKFLOW_ACTION.CLOSE ||
      actionType === WORKFLOW_ACTION.RETURN
    ) {
      if (!isReviewerRole(actor.role)) {
        return res.status(403).json({
          error:
            "Only an HR Manager or Super Admin can review submitted incident cases.",
        });
      }

      if (existingStatus !== "For Review") {
        return res.status(409).json({
          error:
            "Only a case marked For Review can be approved or returned.",
        });
      }

      if (
        actionType === WORKFLOW_ACTION.RETURN &&
        !cleanResolutionNotes
      ) {
        return res.status(400).json({
          error:
            "A return comment is required before sending the case back.",
        });
      }
    }

    const allowedActions = new Set([
      WORKFLOW_ACTION.START,
      WORKFLOW_ACTION.SUBMIT_RESOLUTION,
      WORKFLOW_ACTION.SUBMIT_INVESTIGATION,
      WORKFLOW_ACTION.CLOSE,
      WORKFLOW_ACTION.RETURN,
      "UPDATE_INCIDENT",
    ]);

    if (!allowedActions.has(actionType)) {
      return res.status(400).json({
        error: "Unsupported incident workflow action.",
      });
    }

    const updateFields = [
      "status = ?",
      "resolution_notes = COALESCE(?, resolution_notes)",
      "action_taken = COALESCE(?, action_taken)",
      "recommendation = COALESCE(?, recommendation)",
      "last_action_by_id = ?",
      "last_action_by_username = ?",
      "last_action_by_name = ?",
      "last_action_type = ?",
      "last_action_at = NOW()",
      "updated_at = NOW()",
    ];

    const params = [
      normalizedStatus,
      cleanResolutionNotes,
      cleanActionTaken,
      cleanRecommendation,
      actor.userId,
      actor.username,
      actor.fullName,
      actionType,
    ];

    if (actionType === WORKFLOW_ACTION.START) {
      updateFields.push(
        "investigation_started_by_id = ?",
        "investigation_started_by_username = ?",
        "investigation_started_by_name = ?",
        "investigation_started_at = NOW()",
        "reviewed_by_id = NULL",
        "reviewed_by_username = NULL",
        "reviewed_by_name = NULL",
        "reviewed_at = NULL",
        "review_decision = NULL",
        "review_comments = NULL"
      );

      params.push(actor.userId, actor.username, actor.fullName);
    }

    if (
      actionType === WORKFLOW_ACTION.SUBMIT_RESOLUTION ||
      actionType === WORKFLOW_ACTION.SUBMIT_INVESTIGATION
    ) {
      updateFields.push(
        "resolution_submitted_by_id = ?",
        "resolution_submitted_by_username = ?",
        "resolution_submitted_by_name = ?",
        "resolution_submitted_at = NOW()",
        "reviewed_by_id = NULL",
        "reviewed_by_username = NULL",
        "reviewed_by_name = NULL",
        "reviewed_at = NULL",
        "review_decision = NULL",
        "review_comments = NULL"
      );

      params.push(actor.userId, actor.username, actor.fullName);
    }

    if (actionType === WORKFLOW_ACTION.CLOSE) {
      updateFields.push(
        "reviewed_by_id = ?",
        "reviewed_by_username = ?",
        "reviewed_by_name = ?",
        "reviewed_at = NOW()",
        "review_decision = ?",
        "review_comments = ?"
      );

      params.push(
        actor.userId,
        actor.username,
        actor.fullName,
        "Approved",
        cleanResolutionNotes || "Proof reviewed and approved."
      );
    }

    if (actionType === WORKFLOW_ACTION.RETURN) {
      updateFields.push(
        "reviewed_by_id = ?",
        "reviewed_by_username = ?",
        "reviewed_by_name = ?",
        "reviewed_at = NOW()",
        "review_decision = ?",
        "review_comments = ?"
      );

      params.push(
        actor.userId,
        actor.username,
        actor.fullName,
        "Returned",
        cleanResolutionNotes
      );
    }

    params.push(id);

    await db.promise().query(
      `
      UPDATE incidents
      SET ${updateFields.join(", ")}
      WHERE id = ?
      `,
      params
    );

    if (
      actionType === WORKFLOW_ACTION.SUBMIT_RESOLUTION ||
      actionType === WORKFLOW_ACTION.SUBMIT_INVESTIGATION
    ) {
      for (const file of evidenceFiles) {
        await db.promise().query(
          `
          INSERT INTO incident_evidence
          (incident_id, file_name, file_path)
          VALUES (?, ?, ?)
          `,
          [id, file.fileName, file.filePath]
        );
      }
    }

    await addTimelineEvent({
      incidentId: id,
      actionType,
      title: getTimelineTitle(actionType, existingIncident),
      description: getTimelineDescription(actionType, actor, {
        comments: cleanResolutionNotes,
      }),
      actor,
    });

    await safeLogAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: actionType,
      description: `${actor.fullName} updated incident #${id} to ${normalizedStatus}.`,
    });

    const updatedIncident = await getIncidentWithEvidence(id);

    return res.json({
      success: true,
      message: "Incident status updated successfully",
      incident: updatedIncident,
    });
  } catch (err) {
    console.error("UPDATE INCIDENT STATUS ERROR:", err);

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Failed to update incident status",
    });
  }
};

// DELETE INCIDENT
exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .promise()
      .query(`DELETE FROM incident_evidence WHERE incident_id = ?`, [id]);

    await db.promise().query(`DELETE FROM incidents WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: "Incident deleted successfully",
    });
  } catch (err) {
    console.error("DELETE INCIDENT ERROR:", err);

    return res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to delete incident",
    });
  }
};