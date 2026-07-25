export const REQUIRED_DOCUMENTS = [
  "Resume",
  "NSO/PSA",
  "SSS (ID or E1 form)",
  "Pag-IBIG (ID or MDRF Form)",
  "PhilHealth (ID or MDF Form)",
  "Diploma",
  "Cedula",
  "Barangay Clearance",
  "NBI/Police Clearance",
];

export const EXPIRING_DOCUMENTS = [
  "Barangay Clearance",
  "NBI/Police Clearance",
];

export const EMPLOYEE_STATUS_OPTIONS = [
  {
    value: "All",
    label: "All Status",
  },
  {
    value: "Deployed",
    label: "Deployed",
  },
  {
    value: "Floating / Standby",
    label: "Floating / Standby",
  },
  {
    value: "Inactive",
    label: "Inactive",
  },
];

export const COMPLIANCE_OPTIONS = [
  {
    value: "All",
    label: "All Compliance",
  },
  {
    value: "Complete",
    label: "Complete",
  },
  {
    value: "Expiring Soon",
    label: "Expiring Soon",
  },
  {
    value: "Expired",
    label: "Expired",
  },
  {
    value: "Incomplete",
    label: "Incomplete",
  },
  {
    value: "No Data",
    label: "No Data",
  },
];

export const EMPLOYEE_SORT_OPTIONS = [
  {
    value: "latest",
    label: "Latest Added",
  },
  {
    value: "name-asc",
    label: "Name A-Z",
  },
  {
    value: "name-desc",
    label: "Name Z-A",
  },
  {
    value: "expired-first",
    label: "Expired First",
  },
  {
    value: "expiring-first",
    label: "Urgent Compliance First",
  },
];

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmployeeStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "Floating / Standby";
  }

  if (normalized === "deployed") {
    return "Deployed";
  }

  if (
    normalized === "floating" ||
    normalized === "standby" ||
    normalized === "floating / standby" ||
    normalized === "floating/standby"
  ) {
    return "Floating / Standby";
  }

  if (
    normalized === "inactive" ||
    normalized === "archived" ||
    normalized === "terminated"
  ) {
    return "Inactive";
  }

  return String(status).trim();
}

export function getDocumentFile(document) {
  if (!document || typeof document !== "object") {
    return "";
  }

  return (
    document.filePath ||
    document.file_path ||
    document.file ||
    document.url ||
    document.documentUrl ||
    ""
  );
}

export function getDocumentExpirationDate(document) {
  if (!document || typeof document !== "object") {
    return "";
  }

  return (
    document.expirationDate ||
    document.expiration_date ||
    document.expiryDate ||
    document.expiry_date ||
    document.expiresAt ||
    document.expires_at ||
    ""
  );
}

export function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

export function startOfDay(date = new Date()) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate;
}

export function getDaysUntilExpiration(expirationValue, referenceDate = new Date()) {
  const expirationDate = parseDate(expirationValue);

  if (!expirationDate) {
    return null;
  }

  expirationDate.setHours(0, 0, 0, 0);

  const today = startOfDay(referenceDate);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.ceil(
    (expirationDate.getTime() - today.getTime()) / millisecondsPerDay
  );
}

export function getDocumentStatus(document, referenceDate = new Date()) {
  const hasFile = Boolean(getDocumentFile(document));

  if (!document || !hasFile) {
    return "Missing";
  }

  const documentName = String(document.name || "").trim();

  if (!EXPIRING_DOCUMENTS.includes(documentName)) {
    return "Complete";
  }

  const expirationValue = getDocumentExpirationDate(document);
  const daysUntilExpiration = getDaysUntilExpiration(
    expirationValue,
    referenceDate
  );

  if (daysUntilExpiration === null) {
    return "Missing Expiration";
  }

  if (daysUntilExpiration < 0) {
    return "Expired";
  }

  if (daysUntilExpiration <= 30) {
    return "Expiring Soon";
  }

  return "Complete";
}

export function getComplianceStatus(documents, referenceDate = new Date()) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return "No Data";
  }

  let hasMissing = false;
  let hasExpired = false;
  let hasExpiringSoon = false;

  REQUIRED_DOCUMENTS.forEach((requiredDocumentName) => {
    const document = documents.find(
      (item) =>
        String(item?.name || "").trim().toLowerCase() ===
        requiredDocumentName.toLowerCase()
    );

    const documentStatus = getDocumentStatus(document, referenceDate);

    if (documentStatus === "Expired") {
      hasExpired = true;
      return;
    }

    if (documentStatus === "Expiring Soon") {
      hasExpiringSoon = true;
      return;
    }

    if (
      documentStatus === "Missing" ||
      documentStatus === "Missing Expiration"
    ) {
      hasMissing = true;
    }
  });

  if (hasExpired) {
    return "Expired";
  }

  if (hasExpiringSoon) {
    return "Expiring Soon";
  }

  if (hasMissing) {
    return "Incomplete";
  }

  return "Complete";
}

export function getCompliancePriority(status) {
  const priorityMap = {
    Expired: 1,
    "Expiring Soon": 2,
    Incomplete: 3,
    Complete: 4,
    "No Data": 5,
  };

  return priorityMap[status] || 6;
}

export function getEmployeeCreatedTime(employee) {
  const dateValue =
    employee?.createdAt ||
    employee?.created_at ||
    employee?.dateCreated ||
    employee?.date_created;

  const parsedDate = parseDate(dateValue);

  return parsedDate ? parsedDate.getTime() : 0;
}

export function matchesEmployeeSearch(employee, searchValue) {
  const rawSearch = String(searchValue || "").toLowerCase().trim();

  if (!rawSearch) {
    return true;
  }

  const normalizedSearch = normalizeText(searchValue);
  const searchTerms = normalizedSearch
    ? normalizedSearch.split(/\s+/).filter(Boolean)
    : [];

  const normalizedName = normalizeText(employee?.name);
  const employeeId = String(employee?.id || "").toLowerCase();
  const company = String(employee?.company || "").toLowerCase();
  const position = String(employee?.position || "").toLowerCase();

  const matchesName =
    searchTerms.length === 0 ||
    searchTerms.every((term) => normalizedName.includes(term));

  return (
    matchesName ||
    employeeId.includes(rawSearch) ||
    company.includes(rawSearch) ||
    position.includes(rawSearch)
  );
}

export function filterEmployees(
  employees,
  {
    search = "",
    status = "All",
    compliance = "All",
    includeArchived = false,
  } = {}
) {
  if (!Array.isArray(employees)) {
    return [];
  }

  return employees.filter((employee) => {
    const isArchived =
      Boolean(employee?.archived) ||
      normalizeEmployeeStatus(employee?.status) === "Inactive";

    if (!includeArchived && isArchived) {
      return false;
    }

    const matchesSearch = matchesEmployeeSearch(employee, search);

    const normalizedStatus = normalizeEmployeeStatus(employee?.status);
    const matchesStatus =
      status === "All" || normalizedStatus === normalizeEmployeeStatus(status);

    const complianceStatus = getComplianceStatus(employee?.documents);
    const matchesCompliance =
      compliance === "All" || complianceStatus === compliance;

    return matchesSearch && matchesStatus && matchesCompliance;
  });
}

export function sortEmployees(employees, sortBy = "latest") {
  if (!Array.isArray(employees)) {
    return [];
  }

  return [...employees].sort((employeeA, employeeB) => {
    const nameA = String(employeeA?.name || "");
    const nameB = String(employeeB?.name || "");

    switch (sortBy) {
      case "name-asc":
        return nameA.localeCompare(nameB, undefined, {
          sensitivity: "base",
        });

      case "name-desc":
        return nameB.localeCompare(nameA, undefined, {
          sensitivity: "base",
        });

      case "expired-first":
      case "expiring-first": {
        const complianceA = getComplianceStatus(employeeA?.documents);
        const complianceB = getComplianceStatus(employeeB?.documents);

        const priorityDifference =
          getCompliancePriority(complianceA) -
          getCompliancePriority(complianceB);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return nameA.localeCompare(nameB, undefined, {
          sensitivity: "base",
        });
      }

      case "latest":
      default:
        return (
          getEmployeeCreatedTime(employeeB) -
          getEmployeeCreatedTime(employeeA)
        );
    }
  });
}

export function getFilteredAndSortedEmployees(
  employees,
  {
    search = "",
    status = "All",
    compliance = "All",
    sortBy = "latest",
    includeArchived = false,
  } = {}
) {
  const filteredEmployees = filterEmployees(employees, {
    search,
    status,
    compliance,
    includeArchived,
  });

  return sortEmployees(filteredEmployees, sortBy);
}

export function generateEmployeeId(employees, prefix = "EMP") {
  if (!Array.isArray(employees) || employees.length === 0) {
    return `${prefix}001`;
  }

  const employeeNumbers = employees
    .map((employee) => {
      const rawId = String(employee?.id || "");
      const numericValue = rawId.replace(/\D/g, "");

      return Number.parseInt(numericValue, 10);
    })
    .filter((number) => Number.isFinite(number));

  const nextNumber =
    employeeNumbers.length > 0 ? Math.max(...employeeNumbers) + 1 : 1;

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

export function hasActiveEmployeeFilters({
  search = "",
  status = "All",
  compliance = "All",
  sortBy = "latest",
} = {}) {
  return Boolean(
    String(search).trim() ||
      status !== "All" ||
      compliance !== "All" ||
      sortBy !== "latest"
  );
}

export function getEmployeeDisplayName(employee) {
  return String(employee?.name || "Unknown Employee").trim();
}

export function getEmployeeCompany(employee) {
  return String(employee?.company || "Unassigned").trim();
}

export function getEmployeeStatusSummary(employees) {
  if (!Array.isArray(employees)) {
    return {
      total: 0,
      deployed: 0,
      floating: 0,
      inactive: 0,
    };
  }

  return employees.reduce(
    (summary, employee) => {
      const status = normalizeEmployeeStatus(employee?.status);

      summary.total += 1;

      if (status === "Deployed") {
        summary.deployed += 1;
      } else if (status === "Floating / Standby") {
        summary.floating += 1;
      } else if (status === "Inactive") {
        summary.inactive += 1;
      }

      return summary;
    },
    {
      total: 0,
      deployed: 0,
      floating: 0,
      inactive: 0,
    }
  );
}