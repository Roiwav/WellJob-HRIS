const db = require("../config/db");

const PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const CATEGORY = {
  WORKFORCE: "Workforce",
  INCIDENT: "Incident Prevention",
  COMPLIANCE: "Compliance",
  DEPLOYMENT: "Deployment",
};

const ALLOWED_ROLES = ["HR_MANAGER", "SUPER_ADMIN"];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLabel(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeCompany(value) {
  const company = normalizeLabel(value, "Unassigned");
  return company === "null" || company === "undefined" ? "Unassigned" : company;
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

function getUserKey(req) {
  return (
    req.query.userKey ||
    req.body.userKey ||
    req.query.username ||
    req.body.username ||
    req.query.userId ||
    req.body.userId ||
    "UNKNOWN_USER"
  );
}

function getRole(req) {
  return req.query.role || req.body.role || "USER";
}

function cleanKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 180);
}

function toTimestamp(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getPriorityRank(priority) {
  switch (priority) {
    case PRIORITY.HIGH:
      return 3;
    case PRIORITY.MEDIUM:
      return 2;
    case PRIORITY.LOW:
    default:
      return 1;
  }
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function isActiveIncident(incident) {
  const status = normalizeStatus(incident.status);
  return ["Open", "Investigating", "For Review"].includes(status);
}

function isAbsenceRelated(violation) {
  const text = normalizeText(violation);

  return [
    "absent",
    "absence",
    "absenteeism",
    "no call",
    "no show",
    "tardiness",
    "late",
    "undertime",
  ].some((keyword) => text.includes(keyword));
}

function isComplianceDocumentExpiring(expirationDate) {
  if (!expirationDate) return false;

  const expiry = new Date(expirationDate);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

  return diffDays >= 0 && diffDays <= 30;
}

function isComplianceDocumentExpired(expirationDate) {
  if (!expirationDate) return false;

  const expiry = new Date(expirationDate);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  return expiry.getTime() < today.getTime();
}

async function tableExists(tableName) {
  const [rows] = await db.promise().query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

function normalizeEmployee(employee) {
  return {
    ...employee,
    id: employee.id || employee.employee_id || employee.employeeId,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    company: normalizeCompany(employee.company || employee.clientCompany),
    status: employee.status || "Unknown",
    archived: isArchivedEmployee(employee),
  };
}

function normalizeIncident(incident) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const violation =
    incident.violation_type ||
    incident.violation ||
    incident.violationType ||
    "No violation specified";

  const date =
    incident.updated_at ||
    incident.created_at ||
    incident.incident_date ||
    incident.date ||
    new Date().toISOString();

  return {
    ...incident,
    id: incident.id,
    employeeId: incident.employee_id || incident.employeeId,
    employeeName,
    company: normalizeCompany(incident.company || incident.employeeCompany),
    violation,
    severity: normalizeSeverity(incident.severity),
    status: normalizeStatus(incident.status),
    date,
    timestamp: toTimestamp(date),
  };
}

async function fetchEmployees() {
  const [rows] = await db.promise().query("SELECT * FROM employees");
  return rows.map(normalizeEmployee).filter((employee) => !employee.archived);
}

async function fetchIncidents() {
  const [rows] = await db.promise().query(`
    SELECT
      i.*,
      e.name AS employeeNameFromEmployee,
      e.company AS employeeCompany
    FROM incidents i
    LEFT JOIN employees e ON e.id = i.employee_id
  `);

  return rows.map(normalizeIncident).filter(isActiveIncident);
}

async function fetchEmployeeDocuments() {
  const exists = await tableExists("employee_documents");

  if (!exists) return [];

  const [rows] = await db.promise().query(`
    SELECT
      d.*,
      e.name AS employeeName,
      e.company AS employeeCompany
    FROM employee_documents d
    LEFT JOIN employees e ON e.id = d.employee_id
  `);

  return rows.map((document) => ({
    ...document,
    employeeId: document.employee_id,
    employeeName: document.employeeName || "Unknown Employee",
    company: normalizeCompany(document.employeeCompany),
    name: document.name || document.document_name || "Document",
    filePath: document.file_path || document.file || null,
    expirationDate:
      document.expiration_date ||
      document.expirationDate ||
      document.expires_at ||
      null,
  }));
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function latestTimestamp(items) {
  return Math.max(...items.map((item) => Number(item.timestamp || 0)), 0);
}

function createSuggestion({
  category,
  priority,
  title,
  company,
  issue,
  recommendation,
  reason,
  metrics = [],
  sourceType,
  timestamp,
}) {
  const finalCompany = normalizeCompany(company);
  const finalTimestamp = Number(timestamp || Date.now());

  return {
    suggestionKey: cleanKey(
      `${sourceType}:${finalCompany}:${title}:${finalTimestamp}:${metrics
        .map((m) => `${m.label}-${m.value}`)
        .join(":")}`
    ),
    category,
    priority,
    priorityRank: getPriorityRank(priority),
    title,
    company: finalCompany,
    issue,
    recommendation,
    reason,
    metrics,
    sourceType,
    timestamp: finalTimestamp,
    generatedAt: new Date(finalTimestamp).toISOString(),
  };
}

function buildAbsenteeismSuggestions(incidents) {
  const absenceIncidents = incidents.filter((incident) =>
    isAbsenceRelated(incident.violation)
  );

  const byCompany = groupBy(absenceIncidents, (incident) => incident.company);
  const suggestions = [];

  for (const [company, companyIncidents] of byCompany.entries()) {
    if (company === "Unassigned") continue;
    if (companyIncidents.length < 3) continue;

    const criticalCount = companyIncidents.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    const priority =
      companyIncidents.length >= 8 || criticalCount > 0
        ? PRIORITY.HIGH
        : PRIORITY.MEDIUM;

    suggestions.push(
      createSuggestion({
        category: CATEGORY.WORKFORCE,
        priority,
        title: "Absenteeism Pattern Detected",
        company,
        issue: `${companyIncidents.length} active absence or attendance-related record(s) detected.`,
        recommendation:
          "Review attendance pattern, assign reserve manpower if needed, and consider additional hiring or reliever allocation when staffing continuity is affected.",
        reason:
          "The system detected repeated absence or attendance-related incidents from the same client company, which may affect deployment continuity.",
        metrics: [
          { label: "Attendance Cases", value: companyIncidents.length },
          { label: "Critical", value: criticalCount },
        ],
        sourceType: "ABSENTEEISM_PATTERN",
        timestamp: latestTimestamp(companyIncidents),
      })
    );
  }

  return suggestions;
}

function buildRepeatedViolationSuggestions(incidents) {
  const byCompanyViolation = groupBy(incidents, (incident) => {
    const violation = normalizeText(incident.violation).slice(0, 80);
    return `${incident.company}__${violation}`;
  });

  const suggestions = [];

  for (const [key, violationIncidents] of byCompanyViolation.entries()) {
    if (violationIncidents.length < 5) continue;

    const [company] = key.split("__");
    if (company === "Unassigned") continue;

    const sample = violationIncidents[0];
    const criticalCount = violationIncidents.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    suggestions.push(
      createSuggestion({
        category: CATEGORY.INCIDENT,
        priority:
          criticalCount > 0 || violationIncidents.length >= 10
            ? PRIORITY.HIGH
            : PRIORITY.MEDIUM,
        title: "Repeated Violation Pattern",
        company,
        issue: `${violationIncidents.length} similar violation record(s): ${sample.violation}`,
        recommendation:
          "Conduct policy re-orientation, supervisor coaching, and closer monitoring to prevent repeated violations.",
        reason:
          "The system detected recurring incidents with the same violation type within the same client company.",
        metrics: [
          { label: "Similar Cases", value: violationIncidents.length },
          { label: "Critical", value: criticalCount },
        ],
        sourceType: "REPEATED_VIOLATION",
        timestamp: latestTimestamp(violationIncidents),
      })
    );
  }

  return suggestions;
}

function buildCompanyIncidentLoadSuggestions(incidents) {
  const byCompany = groupBy(incidents, (incident) => incident.company);
  const suggestions = [];

  for (const [company, companyIncidents] of byCompany.entries()) {
    if (company === "Unassigned") continue;
    if (companyIncidents.length < 10) continue;

    const criticalCount = companyIncidents.filter(
      (incident) => incident.severity === "Critical"
    ).length;

    const majorCount = companyIncidents.filter(
      (incident) => incident.severity === "Major"
    ).length;

    suggestions.push(
      createSuggestion({
        category: CATEGORY.INCIDENT,
        priority:
          criticalCount >= 2 || companyIncidents.length >= 15
            ? PRIORITY.HIGH
            : PRIORITY.MEDIUM,
        title: "High Incident Concentration",
        company,
        issue: `${companyIncidents.length} active incident record(s) detected for this company.`,
        recommendation:
          "Review company-level work conditions, coordinate with the site supervisor, and prepare a preventive action plan.",
        reason:
          "The system detected a high concentration of active incident records in one client company.",
        metrics: [
          { label: "Active Cases", value: companyIncidents.length },
          { label: "Major", value: majorCount },
          { label: "Critical", value: criticalCount },
        ],
        sourceType: "COMPANY_INCIDENT_LOAD",
        timestamp: latestTimestamp(companyIncidents),
      })
    );
  }

  return suggestions;
}

function buildComplianceSuggestions(documents) {
  if (!documents.length) return [];

  const flaggedDocuments = documents.filter((document) => {
    const missingFile = !document.filePath;
    const expired = isComplianceDocumentExpired(document.expirationDate);
    const expiring = isComplianceDocumentExpiring(document.expirationDate);

    return missingFile || expired || expiring;
  });

  const byCompany = groupBy(flaggedDocuments, (document) => document.company);
  const suggestions = [];

  for (const [company, docs] of byCompany.entries()) {
    if (company === "Unassigned") continue;
    if (docs.length < 5) continue;

    const missing = docs.filter((doc) => !doc.filePath).length;
    const expired = docs.filter((doc) =>
      isComplianceDocumentExpired(doc.expirationDate)
    ).length;
    const expiring = docs.filter((doc) =>
      isComplianceDocumentExpiring(doc.expirationDate)
    ).length;

    suggestions.push(
      createSuggestion({
        category: CATEGORY.COMPLIANCE,
        priority: expired > 0 || docs.length >= 10 ? PRIORITY.MEDIUM : PRIORITY.LOW,
        title: "Compliance Follow-up Needed",
        company,
        issue: `${docs.length} compliance document concern(s) detected.`,
        recommendation:
          "Follow up missing, expired, or soon-to-expire documents to maintain employee work eligibility.",
        reason:
          "The system detected compliance records that may require HR follow-up based on document availability and expiration dates.",
        metrics: [
          { label: "Document Issues", value: docs.length },
          { label: "Missing", value: missing },
          { label: "Expired", value: expired },
          { label: "Expiring", value: expiring },
        ],
        sourceType: "COMPLIANCE_REVIEW",
        timestamp: Date.now(),
      })
    );
  }

  return suggestions;
}

function buildDeploymentPoolSuggestions(employees, incidents) {
  const floatingEmployees = employees.filter((employee) => {
    const status = normalizeText(employee.status);
    return (
      status.includes("floating") ||
      status.includes("standby") ||
      status.includes("available") ||
      status.includes("unassigned")
    );
  });

  if (floatingEmployees.length < 10) return [];

  const absenceCount = incidents.filter((incident) =>
    isAbsenceRelated(incident.violation)
  ).length;

  if (absenceCount < 5) return [];

  return [
    createSuggestion({
      category: CATEGORY.DEPLOYMENT,
      priority: PRIORITY.MEDIUM,
      title: "Reserve Workforce Allocation Suggested",
      company: "Workforce Pool",
      issue: `${floatingEmployees.length} floating/available employee(s) and ${absenceCount} attendance-related incident(s) detected.`,
      recommendation:
        "Review available workforce pool and consider assigning relievers before requesting new hiring.",
      reason:
        "The system detected available workers while attendance-related cases may affect deployment continuity.",
      metrics: [
        { label: "Available Pool", value: floatingEmployees.length },
        { label: "Attendance Cases", value: absenceCount },
      ],
      sourceType: "DEPLOYMENT_POOL",
      timestamp: Date.now(),
    }),
  ];
}

function buildSmartSuggestions({ employees, incidents, documents }) {
  const suggestions = [
    ...buildAbsenteeismSuggestions(incidents),
    ...buildRepeatedViolationSuggestions(incidents),
    ...buildCompanyIncidentLoadSuggestions(incidents),
    ...buildComplianceSuggestions(documents),
    ...buildDeploymentPoolSuggestions(employees, incidents),
  ];

  const unique = new Map();

  suggestions.forEach((suggestion) => {
    const dedupeKey = `${suggestion.sourceType}:${suggestion.company}:${suggestion.title}`;
    const existing = unique.get(dedupeKey);

    if (!existing || suggestion.priorityRank > existing.priorityRank) {
      unique.set(dedupeKey, suggestion);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    if (b.priorityRank !== a.priorityRank) {
      return b.priorityRank - a.priorityRank;
    }

    return b.timestamp - a.timestamp;
  });
}

async function getSuggestionStates({ userKey, role }) {
  const [rows] = await db.promise().query(
    `
    SELECT *
    FROM smart_suggestion_states
    WHERE user_key = ? AND role = ?
    `,
    [userKey, role]
  );

  return new Map(rows.map((row) => [row.suggestion_key, row]));
}

function applySuggestionStates(suggestions, stateMap) {
  return suggestions.map((suggestion) => {
    const state = stateMap.get(suggestion.suggestionKey);

    return {
      ...suggestion,
      isReviewed: Number(state?.is_reviewed || 0) === 1,
      isDismissed: Number(state?.is_dismissed || 0) === 1,
      actionType: state?.action_type || null,
      actionNotes: state?.action_notes || null,
      dismissReason: state?.dismiss_reason || null,
      reviewedAt: state?.reviewed_at || null,
      dismissedAt: state?.dismissed_at || null,
    };
  });
}

function buildSummary(suggestions) {
  const active = suggestions.filter(
    (suggestion) => !suggestion.isDismissed && !suggestion.isReviewed
  );

  const reviewed = suggestions.filter(
    (suggestion) => !suggestion.isDismissed && suggestion.isReviewed
  );

  const dismissed = suggestions.filter((suggestion) => suggestion.isDismissed);

  return {
    total: suggestions.length,
    active: active.length,
    reviewed: reviewed.length,
    dismissed: dismissed.length,
    high: active.filter((suggestion) => suggestion.priority === PRIORITY.HIGH)
      .length,
    medium: active.filter(
      (suggestion) => suggestion.priority === PRIORITY.MEDIUM
    ).length,
    low: active.filter((suggestion) => suggestion.priority === PRIORITY.LOW)
      .length,
    workforce: active.filter(
      (suggestion) => suggestion.category === CATEGORY.WORKFORCE
    ).length,
    incident: active.filter(
      (suggestion) => suggestion.category === CATEGORY.INCIDENT
    ).length,
    compliance: active.filter(
      (suggestion) => suggestion.category === CATEGORY.COMPLIANCE
    ).length,
  };
}

async function upsertSuggestionState({
  userKey,
  role,
  suggestionKey,
  isReviewed,
  isDismissed,
  actionType = null,
  actionNotes = null,
  dismissReason = null,
}) {
  await db.promise().query(
    `
    INSERT INTO smart_suggestion_states
      (
        user_key,
        role,
        suggestion_key,
        is_reviewed,
        is_dismissed,
        action_type,
        action_notes,
        dismiss_reason,
        reviewed_at,
        dismissed_at
      )
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), IF(? = 1, NOW(), NULL))
    ON DUPLICATE KEY UPDATE
      is_reviewed = VALUES(is_reviewed),
      is_dismissed = VALUES(is_dismissed),
      action_type = VALUES(action_type),
      action_notes = VALUES(action_notes),
      dismiss_reason = VALUES(dismiss_reason),
      reviewed_at = CASE
        WHEN VALUES(is_reviewed) = 1 THEN NOW()
        ELSE reviewed_at
      END,
      dismissed_at = CASE
        WHEN VALUES(is_dismissed) = 1 THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    `,
    [
      userKey,
      role,
      suggestionKey,
      isReviewed ? 1 : 0,
      isDismissed ? 1 : 0,
      actionType,
      actionNotes,
      dismissReason,
      isReviewed ? 1 : 0,
      isDismissed ? 1 : 0,
    ]
  );
}

exports.getSmartSuggestions = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);

    if (!ALLOWED_ROLES.includes(role)) {
      return res.json({
        suggestions: [],
        latestSuggestions: [],
        summary: {
          total: 0,
          active: 0,
          reviewed: 0,
          high: 0,
          medium: 0,
          low: 0,
          workforce: 0,
          incident: 0,
          compliance: 0,
        },
      });
    }

    const [employees, incidents, documents] = await Promise.all([
      fetchEmployees(),
      fetchIncidents(),
      fetchEmployeeDocuments(),
    ]);

    const suggestions = buildSmartSuggestions({
      employees,
      incidents,
      documents,
    });

    const stateMap = await getSuggestionStates({ userKey, role });
    const suggestionsWithState = applySuggestionStates(suggestions, stateMap);

    res.json({
      suggestions: suggestionsWithState,
      latestSuggestions: suggestionsWithState
        .filter((suggestion) => !suggestion.isDismissed)
        .slice(0, 5),
      summary: buildSummary(suggestionsWithState),
    });
  } catch (err) {
    console.error("GET SMART SUGGESTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch smart suggestions." });
  }
};

exports.takeSmartSuggestionAction = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const { suggestionKey, actionType, actionNotes } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: "You are not allowed to take action on suggestions." });
    }

    if (!suggestionKey) {
      return res.status(400).json({ error: "Suggestion key is required." });
    }

    if (!String(actionType || "").trim()) {
      return res.status(400).json({ error: "Action type is required." });
    }

    if (!String(actionNotes || "").trim()) {
      return res.status(400).json({ error: "Action notes are required." });
    }

    await upsertSuggestionState({
      userKey,
      role,
      suggestionKey,
      isReviewed: true,
      isDismissed: false,
      actionType: String(actionType).trim(),
      actionNotes: String(actionNotes).trim(),
      dismissReason: null,
    });

    res.json({
      success: true,
      message: "Preventive action saved successfully.",
    });
  } catch (err) {
    console.error("TAKE SMART SUGGESTION ACTION ERROR:", err);
    res.status(500).json({ error: "Failed to save suggestion action." });
  }
};

exports.markSmartSuggestionReviewed = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const { suggestionKey, actionType, actionNotes } = req.body;

    if (!suggestionKey) {
      return res.status(400).json({ error: "Suggestion key is required." });
    }

    await upsertSuggestionState({
      userKey,
      role,
      suggestionKey,
      isReviewed: true,
      isDismissed: false,
      actionType: actionType || "HR Acknowledged",
      actionNotes:
        actionNotes ||
        "HR acknowledged the smart suggestion for monitoring.",
      dismissReason: null,
    });

    res.json({ success: true, message: "Suggestion marked as reviewed." });
  } catch (err) {
    console.error("MARK SMART SUGGESTION REVIEWED ERROR:", err);
    res.status(500).json({ error: "Failed to mark suggestion as reviewed." });
  }
};

exports.dismissSmartSuggestion = async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const role = getRole(req);
    const { suggestionKey, dismissReason } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: "You are not allowed to dismiss suggestions." });
    }

    if (!suggestionKey) {
      return res.status(400).json({ error: "Suggestion key is required." });
    }

    if (!String(dismissReason || "").trim()) {
      return res.status(400).json({ error: "Dismiss reason is required." });
    }

    await upsertSuggestionState({
      userKey,
      role,
      suggestionKey,
      isReviewed: false,
      isDismissed: true,
      actionType: null,
      actionNotes: null,
      dismissReason: String(dismissReason).trim(),
    });

    res.json({ success: true, message: "Suggestion dismissed." });
  } catch (err) {
    console.error("DISMISS SMART SUGGESTION ERROR:", err);
    res.status(500).json({ error: "Failed to dismiss suggestion." });
  }
};