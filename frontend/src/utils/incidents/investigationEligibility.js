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

function canonicalId(value) {
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized)
    ? Number(normalized)
    : null;
}

export function canUserStartInvestigation(
  incident,
  user
) {
  if (
    String(incident?.status || "")
      .trim()
      .toLowerCase() !== "open" ||
    incident?.investigationStartedAt ||
    incident?.investigation_started_at
  ) {
    return false;
  }

  const role = normalizeRole(user?.role);
  const reportingPath = String(
    incident?.reportingPath ||
      incident?.reporting_path ||
      "UNKNOWN"
  ).toUpperCase();

  const creatorId = canonicalId(
    incident?.reportCreatorId ??
      incident?.report_creator_id
  );

  if (
    !creatorId ||
    reportingPath === "UNKNOWN"
  ) {
    return false;
  }

  if (role === "HR_COORDINATOR") {
    return (
      Boolean(
        normalizeCompany(
          user?.assignedCompany ??
            user?.assigned_company
        )
      ) &&
      normalizeCompany(
        user?.assignedCompany ??
          user?.assigned_company
      ) ===
        normalizeCompany(
          incident?.company
        )
    );
  }

  if (role !== "HR_MANAGER") {
    return false;
  }

  const userId = canonicalId(
    user?.id ??
      user?.userId ??
      user?.user_id
  );

  const creatorRole = normalizeRole(
    incident?.reportCreatorRole ??
      incident?.report_creator_role
  );

  if (creatorRole === "HR_MANAGER") {
    return Boolean(userId && creatorId === userId);
  }

  return ["HR_COORDINATOR", "HR_STAFF"].includes(
    creatorRole
  );
}

export function canUserSubmitInvestigationProof(
  incident,
  user
) {
  const role = normalizeRole(user?.role);

  if (
    ![
      "HR_MANAGER",
      "HR_COORDINATOR",
    ].includes(role) ||
    String(incident?.status || "")
      .trim()
      .toLowerCase() !== "investigating"
  ) {
    return false;
  }

  const userId = canonicalId(
    user?.id ??
      user?.userId ??
      user?.user_id
  );

  const investigatorId = canonicalId(
    incident?.investigationStartedById ??
      incident?.investigation_started_by_id
  );

  if (
    !userId ||
    !investigatorId ||
    userId !== investigatorId
  ) {
    return false;
  }

  if (role !== "HR_COORDINATOR") {
    return true;
  }

  return (
    normalizeCompany(
      user?.assignedCompany ??
        user?.assigned_company
    ) ===
    normalizeCompany(
      incident?.company
    )
  );
}