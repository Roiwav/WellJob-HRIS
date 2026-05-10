const db = require("../config/db");
const { logAudit, AUDIT_CATEGORY } = require("../utils/auditLogger");

const API_BASE = "http://localhost:5000";

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

  if (!status) return "Open";
  if (status === "for_review") return "For Review";
  if (status === "for review") return "For Review";
  if (status === "resolved") return "Closed";

  return status;
}

function normalizeSeverity(value) {
  const severity = String(value || "").trim();

  if (!severity) return "Minor";

  return severity;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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

function serializeIncident(incident, evidence = []) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const actionTaken = incident.action_taken || "";

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
    reportedAt: incident.incident_date,

    location: incident.location || "",
    description: incident.description || "",
    reportedBy: incident.reported_by || "",
    reported_by: incident.reported_by || "",

    actionTaken,
    action_taken: actionTaken,
    sanction: actionTaken,

    recommendation: incident.recommendation || "",

    resolutionNotes: incident.resolution_notes || "",
    resolution_notes: incident.resolution_notes || "",

    createdAt: incident.created_at,
    created_at: incident.created_at,
    updatedAt: incident.updated_at,
    updated_at: incident.updated_at,

    evidence: evidence.map(serializeEvidenceItem),
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

  const [evidence] = await db.promise().query(
    `
    SELECT *
    FROM incident_evidence
    WHERE incident_id = ?
    ORDER BY created_at DESC, id DESC
    `,
    [id]
  );

  return serializeIncident(rows[0], evidence);
}

function getActor(req) {
  const body = req.body || {};

  return {
    userId: body.userId || body.user_id || null,
    username: body.username || null,
    fullName:
      body.fullName ||
      body.full_name ||
      body.name ||
      body.username ||
      "Unknown User",
    role: body.role || null,
  };
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

    const [evidence] = await db.promise().query(
      `
      SELECT * 
      FROM incident_evidence
      WHERE incident_id IN (?)
      ORDER BY created_at DESC, id DESC
      `,
      [incidentIds]
    );

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
      return serializeIncident(incident, incidentEvidence);
    });

    res.json(result);
  } catch (err) {
    console.error("GET INCIDENTS ERROR:", err);
    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to fetch incidents",
    });
  }
};

// GET INCIDENTS BY EMPLOYEE
exports.getIncidentsByEmployee = async (req, res) => {
  try {
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

    const [evidence] = await db.promise().query(
      `
      SELECT *
      FROM incident_evidence
      WHERE incident_id IN (?)
      ORDER BY created_at DESC, id DESC
      `,
      [incidentIds]
    );

    const result = incidents.map((incident) => {
      const incidentEvidence = evidence.filter(
        (item) => Number(item.incident_id) === Number(incident.id)
      );

      return serializeIncident(incident, incidentEvidence);
    });

    res.json(result);
  } catch (err) {
    console.error("GET INCIDENTS BY EMPLOYEE ERROR:", err);
    res.status(500).json({
      error:
        err.sqlMessage || err.message || "Failed to fetch employee incidents",
    });
  }
};

// GET ONE INCIDENT
exports.getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;

    const incident = await getIncidentWithEvidence(id);

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json(incident);
  } catch (err) {
    console.error("GET INCIDENT ERROR:", err);
    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to fetch incident",
    });
  }
};

// CREATE INCIDENT
exports.createIncident = async (req, res) => {
  try {
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

    const actor = getActor(req);
    const finalEmployeeId = employeeId || employee_id;

    if (!finalEmployeeId) {
      return res.status(400).json({ error: "Employee is required." });
    }

    const [employeeRows] = await db.promise().query(
      `SELECT * FROM employees WHERE id = ? LIMIT 1`,
      [finalEmployeeId]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({ error: "Selected employee not found." });
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
      return res.status(400).json({ error: "Violation type is required." });
    }

    const finalDate = normalizeDate(incidentDate || date);

    if (!finalDate) {
      return res.status(400).json({ error: "Incident date is required." });
    }

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
        resolution_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalEmployeeId,
        finalEmployeeName,
        finalCompany,
        finalViolation,
        normalizeSeverity(severity),
        normalizeStatus(status),
        finalDate,
        location || null,
        description || null,
        reportedBy || null,
        actionTaken || null,
        recommendation || null,
        resolutionNotes || null,
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

    res.status(201).json({
      success: true,
      message: "Incident created successfully",
      id: incidentId,
      incidentId,
      incident: createdIncident,
    });
  } catch (err) {
    console.error("CREATE INCIDENT ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to create incident",
    });
  }
};

// UPDATE INCIDENT
exports.updateIncident = async (req, res) => {
  try {
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
    } = req.body || {};

    const actor = getActor(req);
    const finalEmployeeId = employeeId || employee_id;

    if (!finalEmployeeId) {
      return res.status(400).json({ error: "Employee is required." });
    }

    const [employeeRows] = await db.promise().query(
      `SELECT * FROM employees WHERE id = ? LIMIT 1`,
      [finalEmployeeId]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({ error: "Selected employee not found." });
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
      return res.status(400).json({ error: "Violation type is required." });
    }

    if (!finalDate) {
      return res.status(400).json({ error: "Incident date is required." });
    }

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
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        finalEmployeeId,
        finalEmployeeName,
        finalCompany,
        finalViolation,
        normalizeSeverity(severity),
        normalizeStatus(status),
        finalDate,
        location || null,
        description || null,
        reportedBy || null,
        actionTaken || null,
        recommendation || null,
        resolutionNotes || null,
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
      action: "UPDATE_INCIDENT",
      description: `${actor.fullName} updated incident record for ${finalEmployeeName}.`,
    });

    const updatedIncident = await getIncidentWithEvidence(id);

    res.json({
      success: true,
      message: "Incident updated successfully",
      incident: updatedIncident,
    });
  } catch (err) {
    console.error("UPDATE INCIDENT ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to update incident",
    });
  }
};

// UPDATE STATUS ONLY
exports.updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, actionTaken, recommendation } =
      req.body || {};

    await db.promise().query(
      `
      UPDATE incidents
      SET
        status = ?,
        resolution_notes = COALESCE(?, resolution_notes),
        action_taken = COALESCE(?, action_taken),
        recommendation = COALESCE(?, recommendation),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        normalizeStatus(status),
        resolutionNotes || null,
        actionTaken || null,
        recommendation || null,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Incident status updated successfully",
    });
  } catch (err) {
    console.error("UPDATE INCIDENT STATUS ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to update incident status",
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

    res.json({
      success: true,
      message: "Incident deleted successfully",
    });
  } catch (err) {
    console.error("DELETE INCIDENT ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Failed to delete incident",
    });
  }
};