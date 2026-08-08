const db = require("../config/db");

const ALERT_PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const ALLOWED_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
  "SUPER_ADMIN",
]);

const REVIEWER_ROLES = new Set([
  "HR_MANAGER",
  "SUPER_ADMIN",
]);

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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeIdentity(value) {
  return normalizeText(value);
}

function normalizeStatus(value) {
  const status = normalizeText(value);

  if (
    status === "for_review" ||
    status === "for review" ||
    status === "resolved"
  ) {
    return "For Review";
  }

  if (status === "investigating") {
    return "Investigating";
  }

  if (status === "closed") {
    return "Closed";
  }

  if (status === "open") {
    return "Open";
  }

  return value || "Open";
}

function normalizeSeverity(value) {
  const severity = normalizeText(value);

  if (severity === "critical") {
    return "Critical";
  }

  if (severity === "major") {
    return "Major";
  }

  if (severity === "minor") {
    return "Minor";
  }

  return value || "Minor";
}

function isReviewerRole(role) {
  return REVIEWER_ROLES.has(role);
}

function toTimestamp(value) {
  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function cleanAlertKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 180);
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

  return normalizeRole(
    query.role ||
      body.role ||
      "USER"
  );
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

async function tableExists(tableName) {
  const [rows] = await db
    .promise()
    .query(
      "SHOW TABLES LIKE ?",
      [tableName]
    );

  return rows.length > 0;
}

function addAlias(map, key, profile) {
  const alias = normalizeIdentity(key);

  if (!alias || !profile) {
    return;
  }

  map.set(alias, profile);
}

async function getUserNameMap() {
  const userTable =
    (await tableExists("users"))
      ? "users"
      : (await tableExists("user_accounts"))
      ? "user_accounts"
      : null;

  const map = new Map();

  if (!userTable) {
    return map;
  }

  const [rows] = await db
    .promise()
    .query(
      `SELECT * FROM ${userTable}`
    );

  rows.forEach((user) => {
    const profile = {
      name:
        user.full_name ||
        user.fullName ||
        user.fullname ||
        user.display_name ||
        user.displayName ||
        user.name ||
        user.username ||
        "Unknown User",

      username:
        user.username ||
        user.email ||
        "",

      role:
        user.role ||
        user.user_role ||
        user.userRole
          ? normalizeRole(
              user.role ||
                user.user_role ||
                user.userRole
            )
          : "",
    };

    [
      user.id,
      user.user_id,
      user.userId,
      user.employee_id,
      user.employeeId,
      user.username,
      user.email,
      user.name,
      user.full_name,
      user.fullName,
      user.fullname,
      user.display_name,
      user.displayName,
    ].forEach((value) => {
      addAlias(map, value, profile);
    });
  });

  return map;
}

function resolvePersonProfile(
  value,
  userNameMap,
  fallback = "Unknown User"
) {
  const raw = String(value || "").trim();

  if (!raw) {
    return {
      name: fallback,
      username: "",
      role: "",
    };
  }

  const matchedProfile = userNameMap.get(
    normalizeIdentity(raw)
  );

  if (matchedProfile) {
    return matchedProfile;
  }

  return {
    name: raw,
    username: "",
    role: "",
  };
}

function resolvePersonName(
  value,
  userNameMap,
  fallback = "Unknown User"
) {
  return resolvePersonProfile(
    value,
    userNameMap,
    fallback
  ).name;
}

function hasAliasMatch(
  currentUserAliases,
  values = []
) {
  if (!currentUserAliases?.size) {
    return false;
  }

  return values.some((value) =>
    currentUserAliases.has(
      normalizeIdentity(value)
    )
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

function getReviewerValues(incident) {
  return [
    incident.reviewedById,
    incident.reviewed_by_id,

    incident.reviewedByUsername,
    incident.reviewed_by_username,

    incident.reviewedByName,
    incident.reviewed_by_name,
  ];
}

function getLastActorValues(incident) {
  return [
    incident.lastActionById,
    incident.last_action_by_id,

    incident.lastActionByUsername,
    incident.last_action_by_username,

    incident.lastActionByName,
    incident.last_action_by_name,
  ];
}

function getHandlerValues(incident) {
  return [
    ...getInvestigatorValues(incident),
    ...getProofSubmitterValues(incident),
  ];
}

function isReturnedCase(incident) {
  const decision = normalizeText(
    incident.reviewDecision ||
      incident.review_decision
  );

  return (
    decision === "returned" ||
    decision === "rejected"
  );
}

function normalizeEmployee(employee = {}) {
  return {
    ...employee,

    id: employee.id,

    name:
      employee.name ||
      employee.full_name ||
      "Unknown Employee",

    company:
      employee.company || "",

    status:
      employee.status ||
      "Unknown",

    archived:
      employee.archived === true ||
      Number(employee.archived) === 1,
  };
}

function normalizeIncident(
  incident = {},
  userNameMap = new Map()
) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const violation =
    incident.violation_type ||
    incident.violation ||
    "No violation specified";

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

  const reporterProfile = resolvePersonProfile(
    reportedByRaw,
    userNameMap,
    "Unknown Reporter"
  );

  const lastActorProfile = resolvePersonProfile(
    lastActionByRaw,
    userNameMap,
    ""
  );

  const investigatorProfile = resolvePersonProfile(
    investigationByRaw,
    userNameMap,
    ""
  );

  const submitterProfile = resolvePersonProfile(
    resolutionByRaw,
    userNameMap,
    ""
  );

  const reviewerProfile = resolvePersonProfile(
    reviewedByRaw,
    userNameMap,
    ""
  );

  const reportedByName = reporterProfile.name;
  const lastActionByName = lastActorProfile.name;
  const investigationStartedByName = investigatorProfile.name;
  const resolutionSubmittedByName = submitterProfile.name;
  const reviewedByName = reviewerProfile.name;

  return {
    ...incident,

    id: incident.id,

    employeeId:
      incident.employee_id,

    employee_id:
      incident.employee_id,

    employeeName,
    employee: employeeName,

    company:
      incident.company ||
      incident.employeeCompany ||
      "",

    violation,
    violationType: violation,
    violation_type: violation,

    severity:
      normalizeSeverity(
        incident.severity
      ),

    status:
      normalizeStatus(
        incident.status
      ),

    reportedByRaw,

    reported_by_raw:
      reportedByRaw,

    reportedBy:
      reportedByName,

    reportedByName,

    reportedByUsername:
      reporterProfile.username ||
      null,

    reported_by_username:
      reporterProfile.username ||
      null,

    reportedByRole:
      reporterProfile.role ||
      null,

    reported_by_role:
      reporterProfile.role ||
      null,

    reporterName:
      reportedByName,

    reported_by:
      reportedByName,

    date:
      incident.incident_date ||
      incident.created_at,

    incidentDate:
      incident.incident_date ||
      incident.created_at,

    incident_date:
      incident.incident_date,

    createdAt:
      incident.created_at,

    created_at:
      incident.created_at,

    updatedAt:
      incident.updated_at ||
      incident.created_at,

    updated_at:
      incident.updated_at ||
      incident.created_at,

    lastActionById:
      incident.last_action_by_id ||
      null,

    last_action_by_id:
      incident.last_action_by_id ||
      null,

    lastActionByUsername:
      incident.last_action_by_username ||
      null,

    last_action_by_username:
      incident.last_action_by_username ||
      null,

    lastActionByName:
      lastActionByName ||
      null,

    last_action_by_name:
      lastActionByName ||
      null,

    lastActionType:
      incident.last_action_type ||
      null,

    last_action_type:
      incident.last_action_type ||
      null,

    lastActionAt:
      incident.last_action_at ||
      null,

    last_action_at:
      incident.last_action_at ||
      null,

    investigationStartedById:
      incident.investigation_started_by_id ||
      null,

    investigation_started_by_id:
      incident.investigation_started_by_id ||
      null,

    investigationStartedByUsername:
      incident.investigation_started_by_username ||
      null,

    investigation_started_by_username:
      incident.investigation_started_by_username ||
      null,

    investigationStartedByName:
      investigationStartedByName ||
      null,

    investigation_started_by_name:
      investigationStartedByName ||
      null,

    investigationStartedByRole:
      investigatorProfile.role ||
      null,

    investigation_started_by_role:
      investigatorProfile.role ||
      null,

    investigationStartedAt:
      incident.investigation_started_at ||
      null,

    investigation_started_at:
      incident.investigation_started_at ||
      null,

    resolutionSubmittedById:
      incident.resolution_submitted_by_id ||
      null,

    resolution_submitted_by_id:
      incident.resolution_submitted_by_id ||
      null,

    resolutionSubmittedByUsername:
      incident.resolution_submitted_by_username ||
      null,

    resolution_submitted_by_username:
      incident.resolution_submitted_by_username ||
      null,

    resolutionSubmittedByName:
      resolutionSubmittedByName ||
      null,

    resolution_submitted_by_name:
      resolutionSubmittedByName ||
      null,

    resolutionSubmittedByRole:
      submitterProfile.role ||
      null,

    resolution_submitted_by_role:
      submitterProfile.role ||
      null,

    resolutionSubmittedAt:
      incident.resolution_submitted_at ||
      null,

    resolution_submitted_at:
      incident.resolution_submitted_at ||
      null,

    reviewedById:
      incident.reviewed_by_id ||
      null,

    reviewed_by_id:
      incident.reviewed_by_id ||
      null,

    reviewedByUsername:
      incident.reviewed_by_username ||
      null,

    reviewed_by_username:
      incident.reviewed_by_username ||
      null,

    reviewedByName:
      reviewedByName ||
      null,

    reviewed_by_name:
      reviewedByName ||
      null,

    reviewedByRole:
      reviewerProfile.role ||
      null,

    reviewed_by_role:
      reviewerProfile.role ||
      null,

    reviewedAt:
      incident.reviewed_at ||
      null,

    reviewed_at:
      incident.reviewed_at ||
      null,

    reviewDecision:
      incident.review_decision ||
      null,

    review_decision:
      incident.review_decision ||
      null,

    reviewComments:
      incident.review_comments ||
      null,

    review_comments:
      incident.review_comments ||
      null,
  };
}

function isSameEmployee(
  employee,
  incident
) {
  const employeeId =
    String(employee?.id || "");

  const incidentEmployeeId =
    String(
      incident?.employeeId ||
        ""
    );

  const employeeName =
    normalizeText(
      employee?.name
    );

  const incidentEmployeeName =
    normalizeText(
      incident?.employee ||
        incident?.employeeName
    );

  return (
    (
      Boolean(employeeId) &&
      employeeId === incidentEmployeeId
    ) ||
    (
      Boolean(employeeName) &&
      employeeName ===
        incidentEmployeeName
    )
  );
}

function isAlertVisibleForCurrentUser(
  incident,
  role,
  aliases
) {
  if (!ALLOWED_ROLES.has(role)) {
    return false;
  }

  const status =
    normalizeStatus(
      incident.status
    );

  const isReporter =
    hasAliasMatch(
      aliases,
      getReporterValues(incident)
    );

  const isInvestigator =
    hasAliasMatch(
      aliases,
      getInvestigatorValues(incident)
    );

  const isProofSubmitter =
    hasAliasMatch(
      aliases,
      getProofSubmitterValues(incident)
    );

  const isHandler =
    hasAliasMatch(
      aliases,
      getHandlerValues(incident)
    );

  const isReviewer =
    hasAliasMatch(
      aliases,
      getReviewerValues(incident)
    );

  const isLastActor =
    hasAliasMatch(
      aliases,
      getLastActorValues(incident)
    );

  const returnedCase =
    isReturnedCase(incident);

  /*
    NEW INCIDENT

    Recipients:
    - HR Staff
    - HR Manager

    Excluded:
    - Incident creator
    - Super Admin
  */
  if (status === "Open") {
    return (
      [
        "HR_MANAGER",
        "HR_STAFF",
      ].includes(role) &&
      !isReporter &&
      !isLastActor
    );
  }

  /*
    INVESTIGATION STARTED

    Recipients:
    - Incident creator
    - All HR Managers

    Excluded:
    - Assigned investigator
    - Other HR Staff
    - Super Admin
  */
  if (
    status === "Investigating" &&
    !returnedCase
  ) {
    const shouldMonitor =
      isReporter ||
      role === "HR_MANAGER";

    return (
      shouldMonitor &&
      !isInvestigator &&
      !isHandler &&
      !isLastActor
    );
  }

  /*
    CASE RETURNED

    Recipients:
    - Assigned investigator only

    Excluded:
    - Reviewer
    - Other HR users
  */
  if (
    status === "Investigating" &&
    returnedCase
  ) {
    return (
      isInvestigator &&
      !isReviewer &&
      !isLastActor
    );
  }

  /*
    PROOF SUBMITTED

    Recipients:
    - HR Manager
    - Super Admin

    Excluded:
    - Investigator / submitter
  */
  if (status === "For Review") {
    return (
      isReviewerRole(role) &&
      !isProofSubmitter &&
      !isLastActor
    );
  }

  /*
    CASE CLOSED

    Recipients:
    - Incident creator
    - Assigned investigator

    Excluded:
    - Reviewer who closed it
  */
  if (status === "Closed") {
    return (
      (
        isReporter ||
        isHandler
      ) &&
      !isReviewer &&
      !isLastActor
    );
  }

  return false;
}

function getIncidentDate(incident) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    status === "Closed" ||
    isReturnedCase(incident)
  ) {
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

  if (status === "For Review") {
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

  if (status === "Investigating") {
    return (
      incident.investigationStartedAt ||
      incident.investigation_started_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  return (
    incident.createdAt ||
    incident.created_at ||
    incident.incident_date
  );
}

function getIncidentPriority(
  incident,
  role
) {
  const severity =
    normalizeSeverity(
      incident.severity
    );

  const status =
    normalizeStatus(
      incident.status
    );

  if (
    severity === "Critical" &&
    status !== "Closed"
  ) {
    return ALERT_PRIORITY.HIGH;
  }

  if (
    status === "For Review" &&
    isReviewerRole(role)
  ) {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (isReturnedCase(incident)) {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (
    status === "Investigating" ||
    severity === "Major"
  ) {
    return ALERT_PRIORITY.MEDIUM;
  }

  return ALERT_PRIORITY.LOW;
}

function getPriorityRank(priority) {
  if (priority === ALERT_PRIORITY.HIGH) {
    return 3;
  }

  if (priority === ALERT_PRIORITY.MEDIUM) {
    return 2;
  }

  return 1;
}

function getIncidentTitle(
  incident,
  role,
  priority
) {
  const incidentId =
    incident.id
      ? `#${incident.id}`
      : "Incident";

  const status =
    normalizeStatus(
      incident.status
    );

  if (isReturnedCase(incident)) {
    return `Case Returned for Correction ${incidentId}`;
  }

  if (status === "Closed") {
    return `Case Approved and Closed ${incidentId}`;
  }

  if (
    status === "For Review" &&
    isReviewerRole(role)
  ) {
    return priority ===
      ALERT_PRIORITY.HIGH
      ? `Critical Case for Review ${incidentId}`
      : `Case Pending Review ${incidentId}`;
  }

  if (status === "Investigating") {
    return `Investigation Started ${incidentId}`;
  }

  if (
    priority ===
    ALERT_PRIORITY.HIGH
  ) {
    return `Critical Incident Reported ${incidentId}`;
  }

  return `New Incident Reported ${incidentId}`;
}

function getIncidentRecommendedAction(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (isReturnedCase(incident)) {
    return "Review the reviewer comments, revise the proof, and resubmit the case for review.";
  }

  if (status === "Closed") {
    return "Review the completed case record. No further action is required.";
  }

  if (
    status === "For Review" &&
    isReviewerRole(role)
  ) {
    return "Review the submitted proof, then approve and close the case or return it for revision.";
  }

  if (status === "Investigating") {
    return "Monitor the assigned investigation and review its current progress.";
  }

  if (
    normalizeSeverity(
      incident.severity
    ) === "Critical"
  ) {
    return "Review immediately and start the appropriate HR investigation.";
  }

  return "Review the new incident and start an investigation when appropriate.";
}

function getIncidentReason(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (isReturnedCase(incident)) {
    return "Generated because an authorized reviewer returned the case to the assigned investigator for correction.";
  }

  if (status === "Closed") {
    return "Generated because an authorized reviewer approved and closed the case.";
  }

  if (
    status === "For Review" &&
    isReviewerRole(role)
  ) {
    return "Generated because investigation proof was submitted and is waiting for an authorized reviewer.";
  }

  if (status === "Investigating") {
    return "Generated because an HR user started the investigation and the case is now being monitored.";
  }

  return "Generated because a new incident is available for HR investigation.";
}

function getIncidentNavigationAction(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    status === "Investigating" &&
    isReturnedCase(incident)
  ) {
    return "submit-resolution";
  }

  if (
    status === "For Review" &&
    isReviewerRole(role)
  ) {
    return "review";
  }

  if (
    status === "Open" &&
    [
      "HR_MANAGER",
      "HR_STAFF",
    ].includes(role)
  ) {
    return "start-investigation";
  }

  return "view";
}

function buildIncidentAlert(
  incident,
  role
) {
  const priority =
    getIncidentPriority(
      incident,
      role
    );

  const date =
    getIncidentDate(
      incident
    );

  const timestamp =
    toTimestamp(date);

  const status =
    normalizeStatus(
      incident.status
    );

  const severity =
    normalizeSeverity(
      incident.severity
    );

  const reviewDecision =
    incident.reviewDecision ||
    incident.review_decision ||
    "";

  const action =
    getIncidentNavigationAction(
      incident,
      role
    );

  return {
    alertKey:
      cleanAlertKey(
        `INCIDENT:${incident.id}:${status}:${reviewDecision}:${
          incident.lastActionType || ""
        }:${timestamp}`
      ),

    sourceType:
      "INCIDENT",

    priority,

    priorityRank:
      getPriorityRank(priority),

    title:
      getIncidentTitle(
        incident,
        role,
        priority
      ),

    message: `${
      incident.employeeName ||
      "Unknown Employee"
    } • ${
      incident.violationType ||
      "No violation specified"
    }`,

    employee:
      incident.employeeName ||
      "Unknown Employee",

    employeeId:
      incident.employeeId ||
      null,

    incidentId:
      incident.id,

    violation:
      incident.violationType ||
      "-",

    severity,
    status,

    reviewDecision:
      reviewDecision ||
      null,

    reviewComments:
      incident.reviewComments ||
      incident.review_comments ||
      "",

    reportedBy:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    reportedByName:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    reportedByUsername:
      incident.reportedByUsername ||
      incident.reported_by_username ||
      "",

    reportedByRole:
      incident.reportedByRole ||
      incident.reported_by_role ||
      "",

    reporterName:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    investigationBy:
      incident.investigationStartedByName ||
      incident.investigation_started_by_name ||
      "-",

    investigationStartedByName:
      incident.investigationStartedByName ||
      incident.investigation_started_by_name ||
      "-",

    investigationStartedByUsername:
      incident.investigationStartedByUsername ||
      incident.investigation_started_by_username ||
      "",

    investigationStartedByRole:
      incident.investigationStartedByRole ||
      incident.investigation_started_by_role ||
      "",

    submittedBy:
      incident.resolutionSubmittedByName ||
      incident.resolution_submitted_by_name ||
      "-",

    resolutionSubmittedByName:
      incident.resolutionSubmittedByName ||
      incident.resolution_submitted_by_name ||
      "-",

    resolutionSubmittedByUsername:
      incident.resolutionSubmittedByUsername ||
      incident.resolution_submitted_by_username ||
      "",

    resolutionSubmittedByRole:
      incident.resolutionSubmittedByRole ||
      incident.resolution_submitted_by_role ||
      "",

    reviewedBy:
      incident.reviewedByName ||
      incident.reviewed_by_name ||
      "-",

    reviewedByName:
      incident.reviewedByName ||
      incident.reviewed_by_name ||
      "-",

    reviewedByUsername:
      incident.reviewedByUsername ||
      incident.reviewed_by_username ||
      "",

    reviewedByRole:
      incident.reviewedByRole ||
      incident.reviewed_by_role ||
      "",

    date,
    timestamp,

    route:
      "/incidents",

    action,

    navigationAction:
      action,

    workflowAction:
      incident.lastActionType ||
      incident.last_action_type ||
      null,

    recommendedAction:
      getIncidentRecommendedAction(
        incident,
        role
      ),

    reason:
      getIncidentReason(
        incident,
        role
      ),
  };
}

function buildEmployeePatternAlerts(
  activeEmployees,
  visibleIncidents,
  role
) {
  if (
    ![
      "HR_MANAGER",
      "HR_STAFF",
    ].includes(role)
  ) {
    return [];
  }

  const alerts = [];

  activeEmployees.forEach(
    (employee) => {
      const activeCases =
        visibleIncidents.filter(
          (incident) =>
            isSameEmployee(
              employee,
              incident
            ) &&
            [
              "Open",
              "Investigating",
            ].includes(
              normalizeStatus(
                incident.status
              )
            )
        );

      if (activeCases.length < 3) {
        return;
      }

      const criticalCount =
        activeCases.filter(
          (incident) =>
            normalizeSeverity(
              incident.severity
            ) === "Critical"
        ).length;

      const latestIncident =
        [...activeCases].sort(
          (a, b) =>
            toTimestamp(
              getIncidentDate(b)
            ) -
            toTimestamp(
              getIncidentDate(a)
            )
        )[0];

      const timestamp =
        toTimestamp(
          getIncidentDate(
            latestIncident
          )
        );

      const priority =
        activeCases.length >= 5 ||
        criticalCount > 0
          ? ALERT_PRIORITY.HIGH
          : ALERT_PRIORITY.MEDIUM;

      const reporterName =
        latestIncident?.reportedByName ||
        latestIncident?.reporterName ||
        "System Generated";

      alerts.push({
        alertKey:
          cleanAlertKey(
            `EMPLOYEE_PATTERN:${employee.id}:${activeCases.length}:${criticalCount}:${timestamp}`
          ),

        sourceType:
          "EMPLOYEE_PATTERN",

        priority,

        priorityRank:
          getPriorityRank(priority),

        title:
          priority ===
          ALERT_PRIORITY.HIGH
            ? "Smart Alert: Repeated Violation Pattern"
            : "Smart Alert: Employee Requires Monitoring",

        message:
          `${employee.name} has ${activeCases.length} active incident cases.`,

        employee:
          employee.name,

        employeeId:
          employee.id,

        incidentId:
          latestIncident?.id ||
          null,

        violation:
          "Repeated incident pattern",

        severity:
          criticalCount > 0
            ? "Critical"
            : "Major",

        status:
          "Active Pattern",

        reportedBy:
          reporterName,

        reportedByName:
          reporterName,

        reporterName,

        date:
          getIncidentDate(
            latestIncident
          ),

        timestamp,

        route:
          "/incidents",

        action:
          "view",

        navigationAction:
          "view",

        recommendedAction:
          "Review the employee incident pattern and consider HR intervention.",

        reason:
          "The system detected repeated active incident records for the same employee.",
      });
    }
  );

  return alerts;
}

async function fetchBaseData() {
  const [
    userNameMap,
    [employees],
    [incidents],
  ] = await Promise.all([
    getUserNameMap(),

    db
      .promise()
      .query(`
        SELECT
          id,
          name,
          company,
          status,
          archived
        FROM employees
      `),

    db
      .promise()
      .query(`
        SELECT
          i.*,
          e.name AS employeeNameFromEmployee,
          e.company AS employeeCompany,
          e.status AS employeeStatus
        FROM incidents i
        LEFT JOIN employees e
          ON e.id = i.employee_id
        ORDER BY
          COALESCE(
            i.updated_at,
            i.created_at,
            i.incident_date
          ) DESC
      `),
  ]);

  return {
    employees:
      employees.map(
        normalizeEmployee
      ),

    incidents:
      incidents.map(
        (incident) =>
          normalizeIncident(
            incident,
            userNameMap
          )
      ),
  };
}

function buildSmartAlerts({
  employees,
  incidents,
  role,
  currentUserAliases,
}) {
  const activeEmployees =
    employees.filter(
      (employee) =>
        !employee.archived
    );

  const visibleIncidents =
    incidents.filter(
      (incident) => {
        const employeeIsActive =
          activeEmployees.some(
            (employee) =>
              isSameEmployee(
                employee,
                incident
              )
          );

        return (
          employeeIsActive &&
          isAlertVisibleForCurrentUser(
            incident,
            role,
            currentUserAliases
          )
        );
      }
    );

  const alerts = [
    ...visibleIncidents.map(
      (incident) =>
        buildIncidentAlert(
          incident,
          role
        )
    ),

    ...buildEmployeePatternAlerts(
      activeEmployees,
      visibleIncidents,
      role
    ),
  ];

  return alerts.sort((a, b) => {
    if (
      b.priorityRank !==
      a.priorityRank
    ) {
      return (
        b.priorityRank -
        a.priorityRank
      );
    }

    return (
      b.timestamp -
      a.timestamp
    );
  });
}

async function getAlertStates({
  userKey,
  role,
}) {
  const hasTable =
    await tableExists(
      "smart_alert_states"
    );

  if (!hasTable) {
    return new Map();
  }

  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        alert_key,
        is_read,
        is_dismissed,
        read_at,
        dismissed_at
      FROM smart_alert_states
      WHERE
        user_key = ?
        AND role = ?
      `,
      [
        userKey,
        role,
      ]
    );

  return new Map(
    rows.map((row) => [
      row.alert_key,
      row,
    ])
  );
}

function applyAlertStates(
  alerts,
  stateMap
) {
  return alerts.map((alert) => {
    const state =
      stateMap.get(
        alert.alertKey
      );

    return {
      ...alert,

      isRead:
        Number(
          state?.is_read ||
          0
        ) === 1,

      isDismissed:
        Number(
          state?.is_dismissed ||
          0
        ) === 1,

      readAt:
        state?.read_at ||
        null,

      dismissedAt:
        state?.dismissed_at ||
        null,
    };
  });
}

function buildSummary(alerts) {
  return {
    total:
      alerts.length,

    unread:
      alerts.filter(
        (alert) =>
          !alert.isRead
      ).length,

    high:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.HIGH
      ).length,

    medium:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.MEDIUM
      ).length,

    low:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.LOW
      ).length,
  };
}

async function upsertAlertState({
  userKey,
  role,
  alertKey,
  isRead,
  isDismissed,
  skipTableCheck = false,
}) {
  if (!skipTableCheck) {
    const hasTable =
      await tableExists(
        "smart_alert_states"
      );

    if (!hasTable) {
      return;
    }
  }

  await db
    .promise()
    .query(
      `
      INSERT INTO smart_alert_states
      (
        user_key,
        role,
        alert_key,
        is_read,
        is_dismissed,
        read_at,
        dismissed_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        IF(? = 1, NOW(), NULL),
        IF(? = 1, NOW(), NULL)
      )
      ON DUPLICATE KEY UPDATE
        is_read =
          GREATEST(
            is_read,
            VALUES(is_read)
          ),

        is_dismissed =
          GREATEST(
            is_dismissed,
            VALUES(is_dismissed)
          ),

        read_at =
          CASE
            WHEN VALUES(is_read) = 1
              THEN NOW()
            ELSE read_at
          END,

        dismissed_at =
          CASE
            WHEN VALUES(is_dismissed) = 1
              THEN NOW()
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

exports.getSmartAlerts = async (
  req,
  res
) => {
  try {
    const userKey =
      getUserKey(req);

    const role =
      getRole(req);

    const currentUserAliases =
      getCurrentUserAliases(req);

    if (!ALLOWED_ROLES.has(role)) {
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

    const [
      {
        employees,
        incidents,
      },
      stateMap,
    ] = await Promise.all([
      fetchBaseData(),
      getAlertStates({
        userKey,
        role,
      }),
    ]);

    const alerts =
      buildSmartAlerts({
        employees,
        incidents,
        role,
        currentUserAliases,
      });

    const alertsWithState =
      applyAlertStates(
        alerts,
        stateMap
      );

    const unreadAlerts =
      alertsWithState.filter(
        (alert) =>
          !alert.isRead
      );

    const popupAlert =
      unreadAlerts
        .filter(
          (alert) =>
            !alert.isDismissed
        )
        .sort((a, b) => {
          if (
            b.timestamp !==
            a.timestamp
          ) {
            return (
              b.timestamp -
              a.timestamp
            );
          }

          return (
            b.priorityRank -
            a.priorityRank
          );
        })[0] ||
      null;

    return res.json({
      alerts:
        alertsWithState,

      latestAlerts:
        alertsWithState.slice(
          0,
          5
        ),

      unreadCount:
        unreadAlerts.length,

      popupAlert,

      summary:
        buildSummary(
          alertsWithState
        ),
    });
  } catch (error) {
    console.error(
      "GET SMART ALERTS ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.sqlMessage ||
          error.message ||
          "Failed to fetch smart alerts.",
      });
  }
};

exports.markSmartAlertRead = async (
  req,
  res
) => {
  try {
    const alertKey =
      req?.body?.alertKey;

    if (!alertKey) {
      return res
        .status(400)
        .json({
          error:
            "Alert key is required.",
        });
    }

    await upsertAlertState({
      userKey:
        getUserKey(req),

      role:
        getRole(req),

      alertKey,

      isRead:
        true,

      isDismissed:
        false,
    });

    return res.json({
      success: true,

      message:
        "Alert marked as read.",
    });
  } catch (error) {
    console.error(
      "MARK SMART ALERT READ ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.sqlMessage ||
          error.message ||
          "Failed to mark alert as read.",
      });
  }
};

exports.dismissSmartAlert = async (
  req,
  res
) => {
  try {
    const alertKey =
      req?.body?.alertKey;

    if (!alertKey) {
      return res
        .status(400)
        .json({
          error:
            "Alert key is required.",
        });
    }

    await upsertAlertState({
      userKey:
        getUserKey(req),

      role:
        getRole(req),

      alertKey,

      isRead:
        true,

      isDismissed:
        true,
    });

    return res.json({
      success: true,

      message:
        "Alert dismissed.",
    });
  } catch (error) {
    console.error(
      "DISMISS SMART ALERT ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.sqlMessage ||
          error.message ||
          "Failed to dismiss alert.",
      });
  }
};

exports.markAllSmartAlertsRead = async (
  req,
  res
) => {
  try {
    const userKey =
      getUserKey(req);

    const role =
      getRole(req);

    const alertKeys =
      Array.isArray(
        req?.body?.alertKeys
      )
        ? req.body.alertKeys
        : [];

    if (alertKeys.length > 0) {
      const hasTable =
        await tableExists(
          "smart_alert_states"
        );

      if (hasTable) {
        await Promise.all(
          alertKeys.map(
            (alertKey) =>
              upsertAlertState({
                userKey,
                role,
                alertKey,
                isRead: true,
                isDismissed: false,
                skipTableCheck: true,
              })
          )
        );
      }
    }

    return res.json({
      success: true,

      message:
        "All visible alerts marked as read.",
    });
  } catch (error) {
    console.error(
      "MARK ALL SMART ALERTS READ ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.sqlMessage ||
          error.message ||
          "Failed to mark all alerts as read.",
      });
  }
};