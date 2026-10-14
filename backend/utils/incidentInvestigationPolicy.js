"use strict";

const INVESTIGATOR_ROLES = new Set([
  "HR_MANAGER",
  "HR_COORDINATOR",
]);

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeCompany(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "for review" || normalized === "resolved") {
    return "For Review";
  }

  if (normalized === "investigating") {
    return "Investigating";
  }

  if (normalized === "closed") {
    return "Closed";
  }

  return "Open";
}

function canonicalUserId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const id = Number(normalized);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function getIncidentCreator(incident = {}) {
  return {
    id: canonicalUserId(
      incident.report_creator_id ??
        incident.reportCreatorId ??
        incident.created_by_id ??
        incident.createdById
    ),
    username:
      incident.report_creator_username ??
      incident.reportCreatorUsername ??
      incident.created_by_username ??
      incident.createdByUsername ??
      null,
    name:
      incident.report_creator_name ??
      incident.reportCreatorName ??
      incident.created_by_name ??
      incident.createdByName ??
      null,
    role: normalizeRole(
      incident.report_creator_role ??
        incident.reportCreatorRole ??
        incident.created_by_role ??
        incident.createdByRole
    ),
  };
}

function getReportingPath(incident = {}) {
  const creatorRole =
    getIncidentCreator(incident).role;

  if (creatorRole === "HR_COORDINATOR") {
    return "ONSITE";
  }

  if (["HR_MANAGER", "HR_STAFF"].includes(creatorRole)) {
    return "MAIN_OFFICE";
  }

  return "UNKNOWN";
}

function reject(code, message, statusCode = 403) {
  return {
    allowed: false,
    code,
    message,
    statusCode,
  };
}

function evaluateStartInvestigation({
  actor = {},
  incident = {},
} = {}) {
  const role = normalizeRole(actor.role);
  const actorId = canonicalUserId(
    actor.userId ?? actor.id
  );
  const creator = getIncidentCreator(incident);
  const reportingPath = getReportingPath(incident);

  if (!INVESTIGATOR_ROLES.has(role)) {
    return reject(
      "INVESTIGATOR_ROLE_REQUIRED",
      "Your role is not authorized to start incident investigations."
    );
  }

  if (
    normalizeStatus(incident.status) !== "Open" ||
    incident.investigation_started_at ||
    incident.investigationStartedAt
  ) {
    return reject(
      "INVESTIGATION_ALREADY_STARTED",
      "Another authorized investigator has already started this investigation.",
      409
    );
  }

  if (!creator.id || reportingPath === "UNKNOWN") {
    return reject(
      "REPORT_CREATOR_UNVERIFIABLE",
      "Investigation eligibility cannot be verified because this incident has no canonical report creator record.",
      409
    );
  }

  if (role === "HR_COORDINATOR") {
    const assignedCompany = normalizeCompany(
      actor.assignedCompany ?? actor.assigned_company
    );
    const incidentCompany = normalizeCompany(incident.company);

    if (
      !assignedCompany ||
      !incidentCompany ||
      assignedCompany !== incidentCompany
    ) {
      return reject(
        "INCIDENT_COMPANY_SCOPE_REQUIRED",
        "This incident is outside your assigned company scope."
      );
    }

    return {
      allowed: true,
      code: "ASSIGNED_COMPANY_COORDINATOR_ELIGIBLE",
      reportingPath,
      statusCode: 200,
    };
  }

  if (role === "HR_MANAGER") {
    if (creator.role === "HR_MANAGER") {
      if (!actorId || actorId !== creator.id) {
        return reject(
          "ORIGINAL_MANAGER_CREATOR_REQUIRED",
          "Only the HR Manager who created this report or a same-company HR Coordinator can start its investigation."
        );
      }

      return {
        allowed: true,
        code: "ORIGINAL_MANAGER_CREATOR_ELIGIBLE",
        reportingPath,
        statusCode: 200,
      };
    }

    if (["HR_COORDINATOR", "HR_STAFF"].includes(creator.role)) {
      return {
        allowed: true,
        code: "HR_MANAGER_ELIGIBLE",
        reportingPath,
        statusCode: 200,
      };
    }
  }

  return reject(
    "INVESTIGATION_POLICY_REQUIRED",
    "Your account is not eligible to start this incident investigation."
  );
}

function evaluateProofSubmission({
  actor = {},
  incident = {},
} = {}) {
  const role = normalizeRole(actor.role);
  const actorId = canonicalUserId(
    actor.userId ?? actor.id
  );
  const investigatorId = canonicalUserId(
    incident.investigation_started_by_id ??
      incident.investigationStartedById
  );

  if (!INVESTIGATOR_ROLES.has(role)) {
    return reject(
      "INVESTIGATOR_ROLE_REQUIRED",
      "Your role is not authorized to submit investigation proof."
    );
  }

  if (normalizeStatus(incident.status) !== "Investigating") {
    return reject(
      "INVESTIGATING_STATUS_REQUIRED",
      "Only an Investigating case can be submitted for review.",
      409
    );
  }

  if (!investigatorId) {
    return reject(
      "INVESTIGATOR_ID_REQUIRED",
      "This case has no canonical assigned investigator.",
      409
    );
  }

  if (!actorId || actorId !== investigatorId) {
    return reject(
      "ASSIGNED_INVESTIGATOR_REQUIRED",
      "Only the assigned investigator can submit or resubmit proof for this case."
    );
  }

  if (role === "HR_COORDINATOR") {
    const assignedCompany = normalizeCompany(
      actor.assignedCompany ?? actor.assigned_company
    );
    const incidentCompany = normalizeCompany(incident.company);

    if (
      !assignedCompany ||
      !incidentCompany ||
      assignedCompany !== incidentCompany
    ) {
      return reject(
        "INCIDENT_COMPANY_SCOPE_REQUIRED",
        "This incident is outside your assigned company scope."
      );
    }
  }

  return {
    allowed: true,
    code: "ASSIGNED_INVESTIGATOR_VERIFIED",
    statusCode: 200,
  };
}

function getCreateIncidentActorSelect(
  incidentAlias = "i"
) {
  const eventFilter = `
    FROM incident_timeline AS creator_event
    WHERE creator_event.incident_id = ${incidentAlias}.id
      AND creator_event.action_type = 'CREATE_INCIDENT'
    ORDER BY creator_event.id ASC
    LIMIT 1
  `;

  return `
    (SELECT creator_event.created_by_id ${eventFilter}) AS report_creator_id,
    (SELECT creator_event.created_by_username ${eventFilter}) AS report_creator_username,
    (SELECT creator_event.created_by_name ${eventFilter}) AS report_creator_name,
    (SELECT creator_event.created_by_role ${eventFilter}) AS report_creator_role
  `;
}

module.exports = {
  canonicalUserId,
  evaluateProofSubmission,
  evaluateStartInvestigation,
  getCreateIncidentActorSelect,
  getIncidentCreator,
  getReportingPath,
  normalizeCompany,
  normalizeRole,
  normalizeStatus,
};