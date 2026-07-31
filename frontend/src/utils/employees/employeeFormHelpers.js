import {
  DOCUMENT_OPTIONS,
  MIN_DEPLOYED_DOCUMENTS,
  normalizeName,
  toProperName,
} from "../../components/employees/employeeConstants";

export const EMPLOYEE_API_URL =
  "http://localhost:5000/api/employees";

export const ALLOWED_DOCUMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
];

export const MAX_DOCUMENT_SIZE =
  5 * 1024 * 1024;

export const INITIAL_EMPLOYEE_FORM_ERRORS = {
  name: "",
  company: "",
  contractStart: "",
  duplicateId: "",
  duplicateConfirm: "",
  documents: {},
};

function isFile(value) {
  return (
    typeof File !== "undefined" &&
    value instanceof File
  );
}

function isBlob(value) {
  return (
    typeof Blob !== "undefined" &&
    value instanceof Blob
  );
}

function getEmployeeId(employee) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

function normalizeEmployeeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getEmployeeApiError(
  error,
  fallback = "Something went wrong."
) {
  if (error?.response?.status === 503) {
    return "System is currently under maintenance. Please try again later.";
  }

  if (
    error?.code === "ECONNABORTED" ||
    error?.name === "AbortError"
  ) {
    return "The server took too long to respond. Please try again.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export function parseEmployeeDocuments(
  documents
) {
  if (Array.isArray(documents)) {
    return documents;
  }

  if (typeof documents !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(documents);
    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function getExistingDocumentPath(
  document
) {
  if (
    !document ||
    typeof document !== "object"
  ) {
    return "";
  }

  return (
    document.filePath ||
    document.file_path ||
    document.url ||
    document.fileUrl ||
    document.file_url ||
    ""
  );
}

export function getDocumentExpirationValue(
  document
) {
  if (
    !document ||
    typeof document !== "object"
  ) {
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

export function normalizeDateInput(value) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).slice(0, 10);
  }

  const year = parsedDate.getFullYear();
  const month = String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    parsedDate.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createEmployeeDocuments(
  existingDocuments = []
) {
  const currentDocuments =
    parseEmployeeDocuments(
      existingDocuments
    );

  return DOCUMENT_OPTIONS.map(
    (option) => {
      const matchedDocument =
        currentDocuments.find(
          (document) =>
            normalizeName(
              document?.name
            ) ===
            normalizeName(option.name)
        );

      return {
        name: option.name,
        expirable: option.expirable,
        checked: Boolean(
          matchedDocument
        ),
        expirationDate:
          normalizeDateInput(
            getDocumentExpirationValue(
              matchedDocument
            )
          ),
        filePath:
          getExistingDocumentPath(
            matchedDocument
          ),
        file: null,
      };
    }
  );
}

export function createInitialEmployeeFormData(
  employee = null
) {
  if (!employee) {
    return {
      name: "",
      status: "Deployed",
      company: "",
      contractStart: "",
      documents:
        createEmployeeDocuments(),
    };
  }

  const status =
    employee?.status ===
    "Floating / Standby"
      ? "Floating / Standby"
      : "Deployed";

  return {
    name:
      employee?.name ||
      employee?.fullName ||
      employee?.fullname ||
      "",

    status,

    company:
      status === "Deployed"
        ? String(
            employee?.company || ""
          )
        : "",

    contractStart:
      status === "Deployed"
        ? normalizeDateInput(
            employee?.contractStart ||
              employee?.contract_start ||
              employee?.deploymentStart ||
              employee?.deployment_start
          )
        : "",

    documents:
      createEmployeeDocuments(
        employee?.documents
      ),
  };
}

export function validateEmployeeDocumentFile(
  file
) {
  if (!file) {
    return "";
  }

  if (
    !ALLOWED_DOCUMENT_TYPES.includes(
      file.type
    )
  ) {
    return "Only PNG, JPEG, and PDF files are allowed.";
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return "File must be less than 5MB.";
  }

  return "";
}

export function hasDocumentFile(
  document
) {
  return Boolean(
    isFile(document?.file) ||
      document?.filePath ||
      document?.file_path ||
      document?.url
  );
}

export function isDocumentComplete(
  document
) {
  return Boolean(
    document?.checked &&
      hasDocumentFile(document) &&
      (
        !document.expirable ||
        document.expirationDate
      )
  );
}

export function getSelectedDocuments(
  documents = []
) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.filter(
    (document) => document?.checked
  );
}

export function getCompletedDocuments(
  documents = []
) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.filter(
    isDocumentComplete
  );
}

export function findDuplicateEmployee({
  employees = [],
  employeeName = "",
  excludedEmployeeId = "",
}) {
  const normalizedInput =
    normalizeName(employeeName);

  const excludedId =
    normalizeEmployeeId(
      excludedEmployeeId
    );

  if (!normalizedInput) {
    return null;
  }

  return (
    employees.find((employee) => {
      const employeeId =
        normalizeEmployeeId(
          getEmployeeId(employee)
        );

      if (
        excludedId &&
        employeeId === excludedId
      ) {
        return false;
      }

      return (
        normalizeName(
          employee?.name
        ) === normalizedInput
      );
    }) || null
  );
}

export function employeeIdExists({
  employees = [],
  employeeId = "",
  excludedEmployeeId = "",
}) {
  const targetId =
    normalizeEmployeeId(employeeId);

  const excludedId =
    normalizeEmployeeId(
      excludedEmployeeId
    );

  if (!targetId) {
    return false;
  }

  return employees.some((employee) => {
    const currentId =
      normalizeEmployeeId(
        getEmployeeId(employee)
      );

    if (
      excludedId &&
      currentId === excludedId
    ) {
      return false;
    }

    return currentId === targetId;
  });
}

export function validateEmployeeForm({
  formData,
  employees = [],
  employeeId = "",
  excludedEmployeeId = "",
  duplicateEmployee = null,
  duplicateConfirmed = false,
}) {
  const errors = {
    ...INITIAL_EMPLOYEE_FORM_ERRORS,
    documents: {},
  };

  const name = String(
    formData?.name || ""
  )
    .trim()
    .replace(/\s+/g, " ");

  const company = String(
    formData?.company || ""
  ).trim();

  const isDeployed =
    formData?.status === "Deployed";

  if (!name) {
    errors.name =
      "Full name is required.";
  } else if (
    !/^[A-Za-zÑñ\s.'-]+$/.test(name)
  ) {
    errors.name =
      "Full name may only contain letters, spaces, apostrophes, periods, and hyphens.";
  } else if (
    name
      .split(" ")
      .filter(Boolean).length < 2
  ) {
    errors.name =
      "Please enter the employee's first name and last name.";
  }

  if (isDeployed && !company) {
    errors.company =
      "Company assignment is required for deployed employees.";
  }

  if (
    isDeployed &&
    !formData?.contractStart
  ) {
    errors.contractStart =
      "Deployment start date is required for deployed employees.";
  }

  if (
    employeeId &&
    employeeIdExists({
      employees,
      employeeId,
      excludedEmployeeId,
    })
  ) {
    errors.duplicateId =
      "This employee ID already exists.";
  }

  if (
    duplicateEmployee &&
    !duplicateConfirmed
  ) {
    errors.duplicateConfirm =
      "Verify the supporting documents and confirm that this is a different employee.";
  }

  const documents =
    Array.isArray(
      formData?.documents
    )
      ? formData.documents
      : [];

  documents.forEach((document) => {
    if (!document?.checked) {
      return;
    }

    if (!hasDocumentFile(document)) {
      errors.documents[
        `${document.name}_file`
      ] = "Proof file is required.";
    }

    if (
      document.expirable &&
      !document.expirationDate
    ) {
      errors.documents[
        document.name
      ] =
        "Expiration date is required.";
    }
  });

  const completedDocuments =
    getCompletedDocuments(documents);

  if (
    isDeployed &&
    completedDocuments.length <
      MIN_DEPLOYED_DOCUMENTS
  ) {
    errors.documents.general =
      `At least ${MIN_DEPLOYED_DOCUMENTS} complete compliance documents are required for deployed employees.`;
  }

  const hasDocumentErrors =
    Object.values(
      errors.documents
    ).some(Boolean);

  const isValid = ![
    errors.name,
    errors.company,
    errors.contractStart,
    errors.duplicateId,
    errors.duplicateConfirm,
    hasDocumentErrors,
  ].some(Boolean);

  return {
    isValid,
    errors,
  };
}

export function calculateEmployeeFormCompletion(
  formData
) {
  const documents =
    Array.isArray(
      formData?.documents
    )
      ? formData.documents
      : [];

  const completedCount =
    getCompletedDocuments(
      documents
    ).length;

  const totalDocuments =
    DOCUMENT_OPTIONS.length;

  const isDeployed =
    formData?.status === "Deployed";

  let score = 0;

  if (
    String(
      formData?.name || ""
    ).trim()
  ) {
    score += 25;
  }

  if (formData?.status) {
    score += 10;
  }

  if (
    !isDeployed ||
    String(
      formData?.company || ""
    ).trim()
  ) {
    score += 15;
  }

  if (
    !isDeployed ||
    formData?.contractStart
  ) {
    score += 10;
  }

  if (totalDocuments > 0) {
    score +=
      (
        completedCount /
        totalDocuments
      ) * 40;
  }

  return Math.min(
    Math.round(score),
    100
  );
}

export function getComplianceReviewWarning(
  formData
) {
  const documents =
    Array.isArray(
      formData?.documents
    )
      ? formData.documents
      : [];

  const completedCount =
    getCompletedDocuments(
      documents
    ).length;

  if (
    formData?.status ===
      "Deployed" &&
    completedCount <
      MIN_DEPLOYED_DOCUMENTS
  ) {
    return `Only ${completedCount}/${DOCUMENT_OPTIONS.length} documents are complete. A minimum of ${MIN_DEPLOYED_DOCUMENTS} complete documents is required for deployed employees.`;
  }

  if (
    completedCount <
    DOCUMENT_OPTIONS.length
  ) {
    return `Compliance is incomplete. ${completedCount}/${DOCUMENT_OPTIONS.length} documents are complete.`;
  }

  return "";
}

export function buildEmployeeFormData(
  formData
) {
  const requestData =
    new FormData();

  const isDeployed =
    formData?.status === "Deployed";

  requestData.append(
    "name",
    toProperName(
      formData?.name
    )
  );

  requestData.append(
    "company",
    isDeployed
      ? String(
          formData?.company || ""
        ).trim()
      : ""
  );

  requestData.append(
    "status",
    formData?.status ||
      "Floating / Standby"
  );

  requestData.append(
    "contractStart",
    isDeployed
      ? formData?.contractStart || ""
      : ""
  );

  getSelectedDocuments(
    formData?.documents
  ).forEach(
    (document, index) => {
      requestData.append(
        `documents[${index}][name]`,
        document.name
      );

      requestData.append(
        `documents[${index}][expirationDate]`,
        document.expirationDate ||
          ""
      );

      if (isFile(document.file)) {
        requestData.append(
          `documents[${index}]`,
          document.file
        );
      } else if (
        document.filePath
      ) {
        requestData.append(
          `documents[${index}][filePath]`,
          document.filePath
        );
      }
    }
  );

  return requestData;
}

export function getDocumentPreviewUrl(
  document
) {
  if (!document) {
    return "";
  }

  if (
    isFile(document.file) ||
    isBlob(document.file)
  ) {
    return URL.createObjectURL(
      document.file
    );
  }

  const filePath =
    getExistingDocumentPath(
      document
    );

  if (!filePath) {
    return "";
  }

  if (
    /^(https?:|blob:|data:)/i.test(
      filePath
    )
  ) {
    return filePath;
  }

  const separator =
    filePath.startsWith("/")
      ? ""
      : "/";

  return `http://localhost:5000${separator}${filePath}`;
}

export function getDocumentFileName(
  document
) {
  if (isFile(document?.file)) {
    return document.file.name;
  }

  const filePath =
    getExistingDocumentPath(
      document
    );

  if (!filePath) {
    return "";
  }

  return (
    filePath
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.split("?")[0] ||
    "Existing document"
  );
}

export function getDocumentPreviewType(
  document
) {
  if (isFile(document?.file)) {
    if (
      document.file.type.startsWith(
        "image/"
      )
    ) {
      return "image";
    }

    if (
      document.file.type ===
      "application/pdf"
    ) {
      return "pdf";
    }

    return "file";
  }

  const filePath =
    getExistingDocumentPath(
      document
    )
      .toLowerCase()
      .split("?")[0];

  if (
    /\.(png|jpe?g|gif|webp|bmp)$/.test(
      filePath
    )
  ) {
    return "image";
  }

  if (filePath.endsWith(".pdf")) {
    return "pdf";
  }

  return "file";
}