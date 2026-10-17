"use strict";

const INVESTIGATOR_ROLES = new Set([
  "HR_MANAGER",
  "HR_COORDINATOR",
]);

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "SUPERADMIN",
      "SUPER_ADMIN",
      "ADMIN",
    ].includes(role)
  ) {
    return "SUPER_ADMIN";
  }

  if (
    [
      "HRMANAGER",
      "HR_MANAGER",
    ].includes(role)
  ) {
    return "HR_MANAGER";
  }

  if (
    [
      "HRSTAFF",
      "HR_STAFF",
    ].includes(role)
  ) {
    return "HR_STAFF";
  }

  if (
    [
      "HRCOORDINATOR",
      "HR_COORDINATOR",
    ].includes(role)
  ) {
    return "HR_COORDINATOR";
  }

  if (
    [
      "ITSUPPORT",
      "IT_SUPPORT",
    ].includes(role)
  ) {
    return "IT_SUPPORT";
  }

  return role;
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

  if (normalized === "for review") {
    return "For Review";
  }

  if (normalized === "investigating") {
    return "Investigating";
  }

  if (
    normalized === "closed" ||
    normalized === "resolved"
  ) {
    return "Closed";
  }

  return "Open";
}

function canonicalUserId(value) {
  const normalized = String(
    value ?? ""
  ).trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const id = Number(normalized);

  return (
    Number.isSafeInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function firstCanonicalUserId(
  ...values
) {
  for (const value of values) {
    const id =
      canonicalUserId(value);

    if (id) {
      return id;
    }
  }

  return null;
}

function firstNonEmptyText(
  ...values
) {
  for (const value of values) {
    const text = String(
      value ?? ""
    ).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function getIncidentCreator(
  incident = {}
) {
  return {
    id:
      firstCanonicalUserId(
        incident.report_creator_id,
        incident.reportCreatorId,
        incident.created_by_id,
        incident.createdById,
        incident.creator_user_id,
        incident.creatorUserId,
        incident.reported_by_user_id,
        incident.reportedByUserId
      ),

    username:
      firstNonEmptyText(
        incident.report_creator_username,
        incident.reportCreatorUsername,
        incident.created_by_username,
        incident.createdByUsername,
        incident.creator_username,
        incident.creatorUsername,
        incident.reported_by_username,
        incident.reportedByUsername
      ) || null,

    name:
      firstNonEmptyText(
        incident.report_creator_name,
        incident.reportCreatorName,
        incident.created_by_name,
        incident.createdByName,
        incident.creator_name,
        incident.creatorName,
        incident.reported_by_name,
        incident.reportedByName
      ) || null,

    role:
      normalizeRole(
        firstNonEmptyText(
          incident.report_creator_role,
          incident.reportCreatorRole,
          incident.created_by_role,
          incident.createdByRole,
          incident.creator_role,
          incident.creatorRole,
          incident.reported_by_role,
          incident.reportedByRole
        )
      ),
  };
}

function getReportingPath(
  incident = {}
) {
  const explicitPath =
    firstNonEmptyText(
      incident.reporting_path,
      incident.reportingPath
    )
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  if (
    [
      "ONSITE",
      "MAIN_OFFICE",
    ].includes(explicitPath)
  ) {
    return explicitPath;
  }

  const creatorRole =
    getIncidentCreator(
      incident
    ).role;

  if (
    creatorRole ===
    "HR_COORDINATOR"
  ) {
    return "ONSITE";
  }

  if (
    [
      "HR_MANAGER",
      "HR_STAFF",
    ].includes(
      creatorRole
    )
  ) {
    return "MAIN_OFFICE";
  }

  return "UNKNOWN";
}

function reject(
  code,
  message,
  statusCode = 403
) {
  return {
    allowed: false,
    code,
    message,
    statusCode,
  };
}

function getActorUserId(
  actor = {}
) {
  return firstCanonicalUserId(
    actor.userId,
    actor.user_id,
    actor.id
  );
}

function getActorAssignedCompany(
  actor = {}
) {
  return normalizeCompany(
    firstNonEmptyText(
      actor.assignedCompany,
      actor.assigned_company,
      actor.company,
      actor.companyName,
      actor.company_name
    )
  );
}

function getIncidentCompany(
  incident = {}
) {
  return normalizeCompany(
    firstNonEmptyText(
      incident.company,
      incident.companyName,
      incident.company_name
    )
  );
}

function hasInvestigationStarted(
  incident = {}
) {
  return Boolean(
    incident.investigation_started_at ||
      incident.investigationStartedAt ||
      incident.investigation?.started_at ||
      incident.investigation?.startedAt
  );
}

function getCanonicalInvestigatorId(
  incident = {}
) {
  return firstCanonicalUserId(
    incident.investigation_started_by_id,
    incident.investigationStartedById,
    incident.investigation?.started_by_id,
    incident.investigation?.startedById
  );
}

/**
 * Determines whether the authenticated actor may claim an Open incident.
 *
 * Policy:
 * - HR Manager:
 *   - may claim their own HR Manager-created report;
 *   - may claim HR Coordinator-created reports;
 *   - may claim reliable legacy HR Staff-created reports;
 *   - may NOT claim another HR Manager's manager-created report.
 *
 * - HR Coordinator:
 *   - may claim an eligible incident only when the incident belongs to
 *     the coordinator's assigned company.
 *
 * - HR Staff / Super Admin / IT Support:
 *   - may not start investigations.
 *
 * Missing or unreliable canonical creator metadata fails closed.
 */
function evaluateStartInvestigation({
  actor = {},
  incident = {},
} = {}) {
  const role =
    normalizeRole(
      actor.role
    );

  const actorId =
    getActorUserId(
      actor
    );

  const creator =
    getIncidentCreator(
      incident
    );

  const reportingPath =
    getReportingPath(
      incident
    );

  if (
    !INVESTIGATOR_ROLES.has(
      role
    )
  ) {
    return reject(
      "INVESTIGATOR_ROLE_REQUIRED",
      "Your role is not authorized to start incident investigations."
    );
  }

  if (
    normalizeStatus(
      incident.status
    ) !== "Open" ||
    hasInvestigationStarted(
      incident
    )
  ) {
    return reject(
      "INVESTIGATION_ALREADY_STARTED",
      "Another authorized investigator has already started this investigation.",
      409
    );
  }

  if (
    !creator.id ||
    !creator.role ||
    reportingPath ===
      "UNKNOWN"
  ) {
    return reject(
      "REPORT_CREATOR_UNVERIFIABLE",
      "Investigation eligibility cannot be verified because this incident has no canonical report creator record.",
      409
    );
  }

  if (
    role ===
    "HR_COORDINATOR"
  ) {
    const assignedCompany =
      getActorAssignedCompany(
        actor
      );

    const incidentCompany =
      getIncidentCompany(
        incident
      );

    if (
      !assignedCompany ||
      !incidentCompany ||
      assignedCompany !==
        incidentCompany
    ) {
      return reject(
        "INCIDENT_COMPANY_SCOPE_REQUIRED",
        "This incident is outside your assigned company scope."
      );
    }

    return {
      allowed: true,
      code:
        "ASSIGNED_COMPANY_COORDINATOR_ELIGIBLE",
      reportingPath,
      statusCode: 200,
    };
  }

  /*
   * HR Manager policy.
   */
  if (
    role ===
    "HR_MANAGER"
  ) {
    if (
      !actorId
    ) {
      return reject(
        "ACTOR_ID_REQUIRED",
        "Investigation eligibility cannot be verified because your authenticated user identity is unavailable.",
        409
      );
    }

    if (
      creator.role ===
      "HR_MANAGER"
    ) {
      if (
        actorId !==
        creator.id
      ) {
        return reject(
          "ORIGINAL_MANAGER_CREATOR_REQUIRED",
          "Only the HR Manager who created this report or a same-company HR Coordinator can start its investigation."
        );
      }

      return {
        allowed: true,
        code:
          "ORIGINAL_MANAGER_CREATOR_ELIGIBLE",
        reportingPath,
        statusCode: 200,
      };
    }

    if (
      [
        "HR_COORDINATOR",
        "HR_STAFF",
      ].includes(
        creator.role
      )
    ) {
      return {
        allowed: true,
        code:
          "HR_MANAGER_ELIGIBLE",
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

/**
 * Only the canonical investigator may submit or resubmit Resolution Proof.
 */
function evaluateProofSubmission({
  actor = {},
  incident = {},
} = {}) {
  const role =
    normalizeRole(
      actor.role
    );

  const actorId =
    getActorUserId(
      actor
    );

  const investigatorId =
    getCanonicalInvestigatorId(
      incident
    );

  if (
    !INVESTIGATOR_ROLES.has(
      role
    )
  ) {
    return reject(
      "INVESTIGATOR_ROLE_REQUIRED",
      "Your role is not authorized to submit investigation proof."
    );
  }

  if (
    normalizeStatus(
      incident.status
    ) !==
    "Investigating"
  ) {
    return reject(
      "INVESTIGATING_STATUS_REQUIRED",
      "Only an Investigating case can be submitted for review.",
      409
    );
  }

  if (
    !investigatorId
  ) {
    return reject(
      "INVESTIGATOR_ID_REQUIRED",
      "This case has no canonical assigned investigator.",
      409
    );
  }

  if (
    !actorId ||
    actorId !==
      investigatorId
  ) {
    return reject(
      "ASSIGNED_INVESTIGATOR_REQUIRED",
      "Only the assigned investigator can submit or resubmit proof for this case."
    );
  }

  if (
    role ===
    "HR_COORDINATOR"
  ) {
    const assignedCompany =
      getActorAssignedCompany(
        actor
      );

    const incidentCompany =
      getIncidentCompany(
        incident
      );

    if (
      !assignedCompany ||
      !incidentCompany ||
      assignedCompany !==
        incidentCompany
    ) {
      return reject(
        "INCIDENT_COMPANY_SCOPE_REQUIRED",
        "This incident is outside your assigned company scope."
      );
    }
  }

  return {
    allowed: true,
    code:
      "ASSIGNED_INVESTIGATOR_VERIFIED",
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