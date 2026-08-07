import { DOCUMENT_OPTIONS } from "../../components/employees/employeeConstants";

export const REQUIRED_DOCUMENTS = DOCUMENT_OPTIONS.map(({ name }) => name);

export const EXPIRING_DOCUMENTS = DOCUMENT_OPTIONS
  .filter(({ expirable }) => expirable)
  .map(({ name }) => name);

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Deployed", label: "Deployed" },
  { value: "Floating / Standby", label: "Floating / Standby" },
  { value: "Inactive", label: "Inactive" },
];

export const COMPLIANCE_OPTIONS = [
  { value: "All", label: "All Compliance" },
  { value: "Complete", label: "Complete" },
  { value: "Expiring Soon", label: "Expiring Soon" },
  { value: "Expired", label: "Expired" },
  { value: "Incomplete", label: "Incomplete" },
  { value: "No Data", label: "No Data" },
];

export const EMPLOYEE_SORT_OPTIONS = [
  { value: "latest", label: "Latest Added" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "expired-first", label: "Expired First" },
  { value: "expiring-first", label: "Urgent Compliance First" },
];

const STATUS_ALIASES = {
  deployed: "Deployed",
  floating: "Floating / Standby",
  standby: "Floating / Standby",
  "floating / standby": "Floating / Standby",
  "floating/standby": "Floating / Standby",
  inactive: "Inactive",
  archived: "Inactive",
  terminated: "Inactive",
};

const COMPLIANCE_PRIORITY = {
  Expired: 1,
  "Expiring Soon": 2,
  Incomplete: 3,
  Complete: 4,
  "No Data": 5,
};

const MILLISECONDS_PER_DAY = 86400000;

const NORMALIZED_EXPIRING_DOCUMENTS = new Set(
  EXPIRING_DOCUMENTS.map((name) => String(name).trim().toLowerCase())
);

const NORMALIZED_REQUIRED_DOCUMENTS = REQUIRED_DOCUMENTS.map((name) =>
  String(name).trim().toLowerCase()
);

function compareNames(employeeA, employeeB) {
  return String(employeeA?.name || "").localeCompare(
    String(employeeB?.name || ""),
    undefined,
    { sensitivity: "base" }
  );
}

function getDocumentName(document) {
  return String(document?.name || "").trim().toLowerCase();
}

function buildDocumentMap(documents) {
  const documentMap = new Map();

  if (!Array.isArray(documents)) {
    return documentMap;
  }

  for (const document of documents) {
    if (!document || typeof document !== "object") continue;

    const documentName = getDocumentName(document);

    if (documentName && !documentMap.has(documentName)) {
      documentMap.set(documentName, document);
    }
  }

  return documentMap;
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmployeeStatus(status) {
  const originalStatus = String(status || "").trim();
  const normalizedStatus = originalStatus.toLowerCase();

  if (!normalizedStatus) {
    return "Floating / Standby";
  }

  return STATUS_ALIASES[normalizedStatus] || originalStatus;
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
  if (!value) return null;

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function startOfDay(date = new Date()) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate;
}

export function getDaysUntilExpiration(
  expirationValue,
  referenceDate = new Date()
) {
  const expirationDate = parseDate(expirationValue);

  if (!expirationDate) {
    return null;
  }

  expirationDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expirationDate.getTime() - startOfDay(referenceDate).getTime()) /
      MILLISECONDS_PER_DAY
  );
}

export function getDocumentStatus(document, referenceDate = new Date()) {
  if (!document || !getDocumentFile(document)) {
    return "Missing";
  }

  const documentName = getDocumentName(document);

  if (!NORMALIZED_EXPIRING_DOCUMENTS.has(documentName)) {
    return "Complete";
  }

  const daysUntilExpiration = getDaysUntilExpiration(
    getDocumentExpirationDate(document),
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

  const documentsByName = buildDocumentMap(documents);

  let hasMissing = false;
  let hasExpiringSoon = false;

  for (const requiredDocumentName of NORMALIZED_REQUIRED_DOCUMENTS) {
    const document = documentsByName.get(requiredDocumentName);

    const status = getDocumentStatus(document, referenceDate);

    if (status === "Expired") {
      return "Expired";
    }

    if (status === "Expiring Soon") {
      hasExpiringSoon = true;
    }

    if (status === "Missing" || status === "Missing Expiration") {
      hasMissing = true;
    }
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
  return COMPLIANCE_PRIORITY[status] || 6;
}

export function getEmployeeCreatedTime(employee) {
  const dateValue =
    employee?.createdAt ||
    employee?.created_at ||
    employee?.dateCreated ||
    employee?.date_created;

  return parseDate(dateValue)?.getTime() || 0;
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

  const shouldCheckCompliance = compliance !== "All";

  return employees.filter((employee) => {
    const normalizedStatus = normalizeEmployeeStatus(employee?.status);

    const isArchived =
      Boolean(employee?.archived) || normalizedStatus === "Inactive";

    if (!includeArchived && isArchived) {
      return false;
    }

    const matchesStatus =
      status === "All" ||
      normalizedStatus === normalizeEmployeeStatus(status);

    if (!matchesStatus) {
      return false;
    }

    if (!matchesEmployeeSearch(employee, search)) {
      return false;
    }

    if (!shouldCheckCompliance) {
      return true;
    }

    return getComplianceStatus(employee?.documents) === compliance;
  });
}

export function sortEmployees(employees, sortBy = "latest") {
  if (!Array.isArray(employees)) {
    return [];
  }

  if (sortBy === "name-asc") {
    return [...employees].sort(compareNames);
  }

  if (sortBy === "name-desc") {
    return [...employees].sort((employeeA, employeeB) =>
      compareNames(employeeB, employeeA)
    );
  }

  if (sortBy === "expired-first" || sortBy === "expiring-first") {
    const employeesWithPriority = employees.map((employee, index) => ({
      employee,
      index,
      priority: getCompliancePriority(
        getComplianceStatus(employee?.documents)
      ),
    }));

    employeesWithPriority.sort((itemA, itemB) => {
      const priorityDifference = itemA.priority - itemB.priority;

      if (priorityDifference) {
        return priorityDifference;
      }

      const nameDifference = compareNames(
        itemA.employee,
        itemB.employee
      );

      return nameDifference || itemA.index - itemB.index;
    });

    return employeesWithPriority.map(({ employee }) => employee);
  }

  return [...employees].sort(
    (employeeA, employeeB) =>
      getEmployeeCreatedTime(employeeB) -
      getEmployeeCreatedTime(employeeA)
  );
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
    .map((employee) =>
      Number.parseInt(
        String(employee?.id || "").replace(/\D/g, ""),
        10
      )
    )
    .filter(Number.isFinite);

  const nextNumber = employeeNumbers.length
    ? Math.max(...employeeNumbers) + 1
    : 1;

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