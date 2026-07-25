import {
  DOCUMENT_OPTIONS,
  MIN_DEPLOYED_DOCUMENTS,
  normalizeName,
  toProperName,
} from "../../components/employees/employeeConstants";

export const EMPLOYEE_API_URL =
  "http://localhost:5000/api/employees";

export const INITIAL_EMPLOYEE_FORM_ERRORS = {
  name: "",
  company: "",
  contractStart: "",
  duplicateId: "",
  duplicateConfirm: "",
  documents: {},
};

export const ALLOWED_DOCUMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
];

export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

export function getEmployeeApiError(
  error,
  fallback = "Something went wrong."
) {
  if (error?.response?.status === 503) {
    return "System is currently under maintenance. Please try again later.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export function parseEmployeeDocuments(documents) {
  if (Array.isArray(documents)) {
    return documents;
  }

  if (typeof documents !== "string") {
    return [];
  }

  try {
    const parsedDocuments = JSON.parse(documents);

    return Array.isArray(parsedDocuments)
      ? parsedDocuments
      : [];
  } catch {
    return [];
  }
}

export function getExistingDocumentPath(document) {
  if (!document || typeof document !== "object") {
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

export function getDocumentExpirationValue(document) {
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

export function normalizeDateInput(value) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).slice(0, 10);
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createEmployeeDocuments(existingDocuments = []) {
  const safeDocuments = parseEmployeeDocuments(existingDocuments);

  return DOCUMENT_OPTIONS.map((documentOption) => {
    const matchedDocument = safeDocuments.find(
      (document) =>
        String(document?.name || "")
          .trim()
          .toLowerCase() ===
        documentOption.name.toLowerCase()
    );

    const existingFilePath =
      getExistingDocumentPath(matchedDocument);

    return {
      name: documentOption.name,
      expirable: documentOption.expirable,
      checked: Boolean(matchedDocument),
      expirationDate: normalizeDateInput(
        getDocumentExpirationValue(matchedDocument)
      ),
      filePath: existingFilePath,
      file: null,
    };
  });
}

export function createInitialEmployeeFormData(employee = null) {
  if (!employee) {
    return {
      name: "",
      status: "Deployed",
      company: "",
      contractStart: "",
      documents: createEmployeeDocuments([]),
    };
  }

  const status =
    employee?.status === "Floating / Standby"
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
        ? String(employee?.company || "")
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
    documents: createEmployeeDocuments(employee?.documents),
  };
}

export function validateEmployeeDocumentFile(file) {
  if (!file) {
    return "";
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return "Only PNG, JPEG, and PDF files are allowed.";
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return "File must be less than 5MB.";
  }

  return "";
}

export function hasDocumentFile(document) {
  return Boolean(
    document?.file instanceof File ||
      document?.filePath ||
      document?.file_path ||
      document?.url
  );
}

export function isDocumentComplete(document) {
  if (!document?.checked) {
    return false;
  }

  if (!hasDocumentFile(document)) {
    return false;
  }

  if (
    document.expirable &&
    !document.expirationDate
  ) {
    return false;
  }

  return true;
}

export function getSelectedDocuments(documents = []) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.filter(
    (document) => document?.checked
  );
}

export function getCompletedDocuments(documents = []) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.filter(isDocumentComplete);
}

export function findDuplicateEmployee({
  employees = [],
  employeeName = "",
  excludedEmployeeId = "",
}) {
  const normalizedInput = normalizeName(employeeName);

  if (!normalizedInput) {
    return null;
  }

  return (
    employees.find((employee) => {
      const employeeId = String(
        employee?.id ||
          employee?.employeeId ||
          employee?.employee_id ||
          ""
      );

      if (
        excludedEmployeeId &&
        employeeId === String(excludedEmployeeId)
      ) {
        return false;
      }

      return (
        normalizeName(employee?.name) ===
        normalizedInput
      );
    }) || null
  );
}

export function employeeIdExists({
  employees = [],
  employeeId = "",
  excludedEmployeeId = "",
}) {
  const normalizedEmployeeId = String(employeeId)
    .trim()
    .toLowerCase();

  if (!normalizedEmployeeId) {
    return false;
  }

  return employees.some((employee) => {
    const currentEmployeeId = String(
      employee?.id ||
        employee?.employeeId ||
        employee?.employee_id ||
        ""
    )
      .trim()
      .toLowerCase();

    if (
      excludedEmployeeId &&
      currentEmployeeId ===
        String(excludedEmployeeId)
          .trim()
          .toLowerCase()
    ) {
      return false;
    }

    return currentEmployeeId === normalizedEmployeeId;
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
  const nextErrors = {
    ...INITIAL_EMPLOYEE_FORM_ERRORS,
    documents: {},
  };

  const trimmedName = String(formData?.name || "")
    .trim()
    .replace(/\s+/g, " ");

  const trimmedCompany = String(
    formData?.company || ""
  ).trim();

  const isDeployed =
    formData?.status === "Deployed";

  if (!trimmedName) {
    nextErrors.name = "Full name is required.";
  } else if (
    !/^[A-Za-zÑñ\s.'-]+$/.test(trimmedName)
  ) {
    nextErrors.name =
      "Full name may only contain letters, spaces, apostrophes, periods, and hyphens.";
  } else if (
    trimmedName.split(" ").filter(Boolean).length < 2
  ) {
    nextErrors.name =
      "Please enter the employee's first name and last name.";
  }

  if (isDeployed && !trimmedCompany) {
    nextErrors.company =
      "Company assignment is required for deployed employees.";
  }

  if (isDeployed && !formData?.contractStart) {
    nextErrors.contractStart =
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
    nextErrors.duplicateId =
      "This employee ID already exists.";
  }

  if (
    duplicateEmployee &&
    !duplicateConfirmed
  ) {
    nextErrors.duplicateConfirm =
      "Verify the supporting documents and confirm that this is a different employee.";
  }

  const documents = Array.isArray(formData?.documents)
    ? formData.documents
    : [];

  documents.forEach((document) => {
    if (!document?.checked) {
      return;
    }

    if (!hasDocumentFile(document)) {
      nextErrors.documents[
        `${document.name}_file`
      ] = "Proof file is required.";
    }

    if (
      document.expirable &&
      !document.expirationDate
    ) {
      nextErrors.documents[document.name] =
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
    nextErrors.documents.general =
      `At least ${MIN_DEPLOYED_DOCUMENTS} complete compliance documents are required for deployed employees.`;
  }

  const hasDocumentErrors = Object.values(
    nextErrors.documents
  ).some(Boolean);

  const isValid = !(
    nextErrors.name ||
    nextErrors.company ||
    nextErrors.contractStart ||
    nextErrors.duplicateId ||
    nextErrors.duplicateConfirm ||
    hasDocumentErrors
  );

  return {
    isValid,
    errors: nextErrors,
  };
}

export function calculateEmployeeFormCompletion(formData) {
  const documents = Array.isArray(formData?.documents)
    ? formData.documents
    : [];

  const completedDocuments =
    getCompletedDocuments(documents);

  const totalDocuments = DOCUMENT_OPTIONS.length;

  let score = 0;

  if (String(formData?.name || "").trim()) {
    score += 25;
  }

  if (formData?.status) {
    score += 10;
  }

  const isDeployed =
    formData?.status === "Deployed";

  if (
    !isDeployed ||
    String(formData?.company || "").trim()
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
      (completedDocuments.length /
        totalDocuments) *
      40;
  }

  return Math.min(Math.round(score), 100);
}

export function getComplianceReviewWarning(formData) {
  const documents = Array.isArray(formData?.documents)
    ? formData.documents
    : [];

  const completedDocuments =
    getCompletedDocuments(documents);

  if (
    formData?.status === "Deployed" &&
    completedDocuments.length <
      MIN_DEPLOYED_DOCUMENTS
  ) {
    return `Only ${completedDocuments.length}/${DOCUMENT_OPTIONS.length} documents are complete. A minimum of ${MIN_DEPLOYED_DOCUMENTS} complete documents is required for deployed employees.`;
  }

  if (
    completedDocuments.length <
    DOCUMENT_OPTIONS.length
  ) {
    return `Compliance is incomplete. ${completedDocuments.length}/${DOCUMENT_OPTIONS.length} documents are complete.`;
  }

  return "";
}

export function buildEmployeeFormData(formData) {
  const requestData = new FormData();

  const isDeployed =
    formData?.status === "Deployed";

  requestData.append(
    "name",
    toProperName(formData?.name)
  );

  requestData.append(
    "company",
    isDeployed
      ? String(formData?.company || "").trim()
      : ""
  );

  requestData.append(
    "status",
    formData?.status || "Floating / Standby"
  );

  requestData.append(
    "contractStart",
    isDeployed
      ? formData?.contractStart || ""
      : ""
  );

  const selectedDocuments = getSelectedDocuments(
    formData?.documents
  );

  selectedDocuments.forEach((document, index) => {
    requestData.append(
      `documents[${index}][name]`,
      document.name
    );

    requestData.append(
      `documents[${index}][expirationDate]`,
      document.expirationDate || ""
    );

    if (document.file instanceof File) {
      requestData.append(
        `documents[${index}]`,
        document.file
      );
    } else if (document.filePath) {
      requestData.append(
        `documents[${index}][filePath]`,
        document.filePath
      );
    }
  });

  return requestData;
}

export function getDocumentPreviewUrl(document) {
  if (!document) {
    return "";
  }

  if (
    document.file instanceof File ||
    document.file instanceof Blob
  ) {
    return URL.createObjectURL(document.file);
  }

  const filePath =
    document.filePath ||
    document.file_path ||
    document.url ||
    "";

  if (!filePath) {
    return "";
  }

  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://") ||
    filePath.startsWith("blob:") ||
    filePath.startsWith("data:")
  ) {
    return filePath;
  }

  const separator = filePath.startsWith("/")
    ? ""
    : "/";

  return `http://localhost:5000${separator}${filePath}`;
}

export function getDocumentFileName(document) {
  if (document?.file instanceof File) {
    return document.file.name;
  }

  const filePath =
    document?.filePath ||
    document?.file_path ||
    document?.url ||
    "";

  if (!filePath) {
    return "";
  }

  return (
    filePath.split("/").pop()?.split("?")[0] ||
    "Existing document"
  );
}

export function getDocumentPreviewType(document) {
  if (document?.file instanceof File) {
    if (document.file.type.startsWith("image/")) {
      return "image";
    }

    if (document.file.type === "application/pdf") {
      return "pdf";
    }

    return "file";
  }

  const filePath = String(
    document?.filePath ||
      document?.file_path ||
      document?.url ||
      ""
  )
    .toLowerCase()
    .split("?")[0];

  if (
    /\.(png|jpe?g|gif|webp|bmp)$/.test(filePath)
  ) {
    return "image";
  }

  if (filePath.endsWith(".pdf")) {
    return "pdf";
  }

  return "file";
}