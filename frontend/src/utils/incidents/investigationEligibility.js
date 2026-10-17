function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    ["SUPERADMIN", "SUPER_ADMIN", "ADMIN"].includes(
      normalized
    )
  ) {
    return "SUPER_ADMIN";
  }

  if (
    ["HRMANAGER", "HR_MANAGER"].includes(
      normalized
    )
  ) {
    return "HR_MANAGER";
  }

  if (
    ["HRSTAFF", "HR_STAFF"].includes(
      normalized
    )
  ) {
    return "HR_STAFF";
  }

  if (
    ["HRCOORDINATOR", "HR_COORDINATOR"].includes(
      normalized
    )
  ) {
    return "HR_COORDINATOR";
  }

  return normalized;
}

function normalizeCompany(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isSafeInteger(numericValue) &&
    numericValue > 0
    ? numericValue
    : null;
}

function firstCanonicalId(...values) {
  for (const value of values) {
    const id = canonicalId(value);

    if (id) {
      return id;
    }
  }

  return null;
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function getUserId(user) {
  return firstCanonicalId(
    user?.id,
    user?.userId,
    user?.user_id
  );
}

function getUserAssignedCompany(user) {
  return normalizeCompany(
    firstNonEmptyText(
      user?.assignedCompany,
      user?.assigned_company,
      user?.company,
      user?.companyName,
      user?.company_name
    )
  );
}

function getIncidentCompany(incident) {
  return normalizeCompany(
    firstNonEmptyText(
      incident?.company,
      incident?.companyName,
      incident?.company_name
    )
  );
}

function getIncidentCreatorId(incident) {
  return firstCanonicalId(
    incident?.reportCreatorId,
    incident?.report_creator_id,

    // Compatibility aliases for older / summary payloads.
    incident?.creatorUserId,
    incident?.creator_user_id,
    incident?.createdByUserId,
    incident?.created_by_user_id,
    incident?.createdById,
    incident?.created_by_id,
    incident?.reportedByUserId,
    incident?.reported_by_user_id
  );
}

function getIncidentCreatorRole(incident) {
  return normalizeRole(
    firstNonEmptyText(
      incident?.reportCreatorRole,
      incident?.report_creator_role,

      // Compatibility aliases for older / summary payloads.
      incident?.creatorRole,
      incident?.creator_role,
      incident?.createdByRole,
      incident?.created_by_role,
      incident?.reportedByRole,
      incident?.reported_by_role
    )
  );
}

function getReportingPath(incident) {
  return String(
    firstNonEmptyText(
      incident?.reportingPath,
      incident?.reporting_path
    ) || "UNKNOWN"
  )
    .trim()
    .toUpperCase();
}

function hasInvestigationStarted(incident) {
  return Boolean(
    incident?.investigationStartedAt ||
      incident?.investigation_started_at ||
      incident?.investigation?.startedAt ||
      incident?.investigation?.started_at
  );
}

function getInvestigatorId(incident) {
  return firstCanonicalId(
    incident?.investigationStartedById,
    incident?.investigation_started_by_id,
    incident?.investigation?.startedById,
    incident?.investigation?.started_by_id
  );
}

/**
 * Frontend visibility helper for the Start Investigation action.
 *
 * Backend remains the final authority.
 *
 * Policy:
 * - HR Coordinator:
 *   May start an eligible Open incident only when it belongs to the
 *   coordinator's assigned company.
 *
 * - HR Manager:
 *   May start an incident they personally created as HR Manager.
 *   May start HR Coordinator-created incidents.
 *   May start reliable legacy HR Staff-created incidents.
 *   May not claim another HR Manager's manager-created incident.
 *
 * - HR Staff / Super Admin / IT Support:
 *   No Start Investigation authority.
 *
 * Creator ID and reporting path are required for every investigation
 * claimant. Creator role is additionally required for HR Manager claims
 * because manager eligibility depends on who created the report.
 */
export function canUserStartInvestigation(
  incident,
  user
) {
  const status = String(
    incident?.status || ""
  )
    .trim()
    .toLowerCase();

  if (
    status !== "open" ||
    hasInvestigationStarted(incident)
  ) {
    return false;
  }

  const role = normalizeRole(user?.role);

  if (
    ![
      "HR_MANAGER",
      "HR_COORDINATOR",
    ].includes(role)
  ) {
    return false;
  }

  const creatorId =
    getIncidentCreatorId(incident);

  const reportingPath =
    getReportingPath(incident);

  /*
   * Shared fail-closed requirements.
   *
   * Coordinator authorization does not depend on creator role; it depends
   * on a reliable creator identity, reporting path, and company scope.
   */
  if (
    !creatorId ||
    reportingPath === "UNKNOWN"
  ) {
    return false;
  }

  if (role === "HR_COORDINATOR") {
    const assignedCompany =
      getUserAssignedCompany(user);

    const incidentCompany =
      getIncidentCompany(incident);

    return Boolean(
      assignedCompany &&
        incidentCompany &&
        assignedCompany === incidentCompany
    );
  }

  /*
   * HR Manager authorization depends on canonical creator role.
   * Missing / unreliable creator role must fail closed here.
   */
  const creatorRole =
    getIncidentCreatorRole(incident);

  if (!creatorRole) {
    return false;
  }

  const userId = getUserId(user);

  if (!userId) {
    return false;
  }

  /*
   * Manager-created report:
   * only the original HR Manager creator may claim it.
   */
  if (creatorRole === "HR_MANAGER") {
    return creatorId === userId;
  }

  /*
   * HR Manager may claim coordinator-created incidents and reliable
   * legacy HR Staff-created incidents.
   */
  return [
    "HR_COORDINATOR",
    "HR_STAFF",
  ].includes(creatorRole);
}

/**
 * Only the canonical investigator may submit / resubmit Resolution Proof.
 */
export function canUserSubmitInvestigationProof(
  incident,
  user
) {
  const role = normalizeRole(user?.role);

  const status = String(
    incident?.status || ""
  )
    .trim()
    .toLowerCase();

  if (
    ![
      "HR_MANAGER",
      "HR_COORDINATOR",
    ].includes(role) ||
    status !== "investigating"
  ) {
    return false;
  }

  const userId =
    getUserId(user);

  const investigatorId =
    getInvestigatorId(incident);

  if (
    !userId ||
    !investigatorId ||
    userId !== investigatorId
  ) {
    return false;
  }

  /*
   * HR Manager canonical investigators are not company-scoped here.
   */
  if (role === "HR_MANAGER") {
    return true;
  }

  /*
   * HR Coordinator canonical investigators remain scoped to their
   * assigned company.
   */
  const assignedCompany =
    getUserAssignedCompany(user);

  const incidentCompany =
    getIncidentCompany(incident);

  return Boolean(
    assignedCompany &&
      incidentCompany &&
      assignedCompany === incidentCompany
  );
}