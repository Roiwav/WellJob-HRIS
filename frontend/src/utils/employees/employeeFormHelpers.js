import {
  DOCUMENT_NUMBER_MAX_LENGTH,
  DOCUMENT_OPTIONS,
  documentRequiresNumber,
  getDocumentNumberLabel,
  normalizeName,
  toProperName,
} from "../../components/employees/employeeConstants";
import { API_BASE } from "../../config/api";

export const EMPLOYEE_API_URL = `${API_BASE}/employees`;

export const ALLOWED_DOCUMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
];

export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

const CAMERA_PHOTO_MAX_DIMENSION = 2200;
const CAMERA_PHOTO_START_QUALITY = 0.88;
const CAMERA_PHOTO_MIN_QUALITY = 0.68;
const CAMERA_PHOTO_MIN_DIMENSION = 1200;

function getCameraPhotoFileName(file) {
  const originalName =
    String(
      file?.name ||
        "document-photo"
    ).trim();

  const baseName =
    originalName
      .replace(/\.[^.]+$/, "")
      .trim() ||
    "document-photo";

  return `${baseName.slice(0, 200)}.jpg`;
}

function canvasToJpegBlob(
  canvas,
  quality
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Unable to prepare this photo. Please try again."
              )
            );
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    }
  );
}

async function loadCameraPhotoSource(file) {
  if (
    typeof createImageBitmap ===
    "function"
  ) {
    try {
      const bitmap =
        await createImageBitmap(
          file
        );

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup() {
          bitmap.close?.();
        },
      };
    } catch {
      // Fall back to a normal browser Image below.
    }
  }

  if (
    typeof document ===
      "undefined" ||
    typeof Image ===
      "undefined" ||
    typeof URL ===
      "undefined"
  ) {
    throw new Error(
      "Camera photo preparation is not available on this device."
    );
  }

  const objectUrl =
    URL.createObjectURL(
      file
    );

  try {
    const image =
      new Image();

    image.decoding =
      "async";

    image.src =
      objectUrl;

    if (
      typeof image.decode ===
      "function"
    ) {
      await image.decode();
    } else {
      await new Promise(
        (
          resolve,
          reject
        ) => {
          image.onload =
            resolve;

          image.onerror =
            () =>
              reject(
                new Error(
                  "Unable to open this camera photo."
                )
              );
        }
      );
    }

    return {
      source: image,
      width:
        image.naturalWidth ||
        image.width,
      height:
        image.naturalHeight ||
        image.height,
      cleanup() {
        URL.revokeObjectURL(
          objectUrl
        );
      },
    };
  } catch (error) {
    URL.revokeObjectURL(
      objectUrl
    );

    throw error;
  }
}

/*
 * Camera-photo preparation
 *
 * Phone camera files are converted to a normal JPEG
 * before upload. This keeps iPhone/Android camera
 * photos compatible with the existing backend and
 * also removes photo metadata such as location data.
 *
 * Large photos are resized/compressed until they fit
 * the existing 5 MB employee-document limit.
 */
export async function prepareEmployeeDocumentCameraFile(
  file
) {
  if (!isFile(file)) {
    throw new Error(
      "Please take a photo again."
    );
  }

  const mimeType =
    String(
      file.type || ""
    )
      .trim()
      .toLowerCase();

  const extension =
    String(
      file.name || ""
    )
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0] ||
    "";

  const looksLikeImage =
    mimeType.startsWith(
      "image/"
    ) ||
    [
      ".heic",
      ".heif",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ].includes(
      extension
    );

  if (!looksLikeImage) {
    throw new Error(
      "Please use the camera for a photo document."
    );
  }

  const loaded =
    await loadCameraPhotoSource(
      file
    );

  try {
    const sourceWidth =
      Number(
        loaded.width
      );

    const sourceHeight =
      Number(
        loaded.height
      );

    if (
      !Number.isFinite(
        sourceWidth
      ) ||
      !Number.isFinite(
        sourceHeight
      ) ||
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      throw new Error(
        "Unable to read this camera photo."
      );
    }

    if (
      typeof document ===
      "undefined"
    ) {
      throw new Error(
        "Camera photo preparation is not available on this device."
      );
    }

    let longestSide =
      Math.min(
        Math.max(
          sourceWidth,
          sourceHeight
        ),
        CAMERA_PHOTO_MAX_DIMENSION
      );

    let quality =
      CAMERA_PHOTO_START_QUALITY;

    for (
      let attempt = 0;
      attempt < 7;
      attempt += 1
    ) {
      const scale =
        Math.min(
          1,
          longestSide /
            Math.max(
              sourceWidth,
              sourceHeight
            )
        );

      const targetWidth =
        Math.max(
          1,
          Math.round(
            sourceWidth *
              scale
          )
        );

      const targetHeight =
        Math.max(
          1,
          Math.round(
            sourceHeight *
              scale
          )
        );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        targetWidth;

      canvas.height =
        targetHeight;

      const context =
        canvas.getContext(
          "2d",
          {
            alpha:
              false,
          }
        );

      if (!context) {
        throw new Error(
          "Unable to prepare this camera photo."
        );
      }

      context.drawImage(
        loaded.source,
        0,
        0,
        targetWidth,
        targetHeight
      );

      const jpegBlob =
        await canvasToJpegBlob(
          canvas,
          quality
        );

      if (
        jpegBlob.size <=
        MAX_DOCUMENT_SIZE
      ) {
        return new File(
          [
            jpegBlob,
          ],
          getCameraPhotoFileName(
            file
          ),
          {
            type:
              "image/jpeg",

            lastModified:
              Date.now(),
          }
        );
      }

      longestSide =
        Math.max(
          CAMERA_PHOTO_MIN_DIMENSION,
          Math.round(
            longestSide *
              0.84
          )
        );

      quality =
        Math.max(
          CAMERA_PHOTO_MIN_QUALITY,
          quality -
            0.05
        );
    }

    throw new Error(
      "This photo is still too large. Please take the photo again a little farther away."
    );
  } catch (error) {
    const message =
      String(
        error?.message ||
          ""
      ).trim();

    if (message) {
      throw error;
    }

    throw new Error(
      "Unable to prepare this photo. Please try again."
    );
  } finally {
    loaded.cleanup?.();
  }
}

export const INITIAL_EMPLOYEE_FORM_ERRORS = {
  name: "",
  birthday: "",
  dateHired: "",
  status: "",
  company: "",
  position: "",
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

export function parseEmployeeDocuments(documents) {
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

export function getExistingDocumentPath(document) {
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

export function getDocumentExpirationValue(document) {
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

export function getExistingDocumentNumber(document) {
  if (
    !document ||
    typeof document !== "object"
  ) {
    return "";
  }

  return String(
    document.documentNumber ||
      document.document_number ||
      document.referenceNumber ||
      document.reference_number ||
      ""
  );
}

export function normalizeEmployeeDocumentNumber(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateEmployeeDocumentNumber(document) {
  if (
    !document ||
    !document.checked
  ) {
    return "";
  }

  const requiresNumber =
    Boolean(document.requiresDocumentNumber) ||
    documentRequiresNumber(document.name);

  if (!requiresNumber) {
    return "";
  }

  const label =
    document.documentNumberLabel ||
    getDocumentNumberLabel(document.name);

  const value =
    normalizeEmployeeDocumentNumber(
      document.documentNumber
    );

  const originalNumber =
    normalizeEmployeeDocumentNumber(
      document.originalDocumentNumber
    );

  const hasExistingRecord =
    Boolean(document.isExistingRecord);

  const hasReplacementFile =
    isFile(document.file);

  /*
   * Legacy-safe rule:
   *
   * Existing historical government documents may
   * have no structured number because they pre-date
   * this feature. Allow unrelated edits while the
   * original scan remains unchanged.
   *
   * Require the number when:
   * - the government document is newly added,
   * - the existing document gets a replacement file,
   * - or a previously recorded number is cleared.
   */
  if (
    !value &&
    (
      originalNumber ||
      !hasExistingRecord ||
      hasReplacementFile
    )
  ) {
    return `${label} is required.`;
  }

  if (!value) {
    return "";
  }

  if (
    value.length >
    DOCUMENT_NUMBER_MAX_LENGTH
  ) {
    return `${label} must not exceed ${DOCUMENT_NUMBER_MAX_LENGTH} characters.`;
  }

  if (
    !/^[0-9 -]+$/.test(value) ||
    !/\d/.test(value)
  ) {
    return `${label} may only contain numbers, spaces, and hyphens.`;
  }

  return "";
}

export function normalizeDateInput(value) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return String(value).slice(0, 10);
  }

  const year =
    parsedDate.getFullYear();

  const month =
    String(
      parsedDate.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      parsedDate.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function validateEmployeeBirthday(value) {
  const birthday =
    String(value || "").trim();

  if (!birthday) {
    return "";
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      birthday
    );

  if (!match) {
    return "Enter a valid birthday.";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return "Enter a valid birthday.";
  }

  const today = new Date();

  const todayValue =
    `${today.getFullYear()}-` +
    `${String(today.getMonth() + 1).padStart(2, "0")}-` +
    `${String(today.getDate()).padStart(2, "0")}`;

  if (birthday > todayValue) {
    return "Birthday cannot be in the future.";
  }

  return "";
}

export function validateEmployeeBusinessDate(
  value,
  {
    label = "Date",
    required = false,
  } = {}
) {
  const normalized =
    String(
      value || ""
    ).trim();

  if (!normalized) {
    return required
      ? `${label} is required.`
      : "";
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );

  if (!match) {
    return `Enter a valid ${label.toLowerCase()}.`;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return `Enter a valid ${label.toLowerCase()}.`;
  }

  const philippinesToday =
    new Date(
      Date.now() +
        8 *
          60 *
          60 *
          1000
    )
      .toISOString()
      .slice(0, 10);

  if (
    normalized >
    philippinesToday
  ) {
    return `${label} cannot be in the future.`;
  }

  return "";
}

const EMPLOYEE_WORKFORCE_STATUSES =
  new Set([
    "Floating / Standby",
    "For Deployment",
    "Deployed",
  ]);

function resolveEmployeeWorkforceStatus(
  employee
) {
  const value =
    String(
      employee?.workforceStatus ||
      employee?.workforce_status ||
      employee?.status ||
      ""
    ).trim();

  return EMPLOYEE_WORKFORCE_STATUSES.has(
    value
  )
    ? value
    : "Floating / Standby";
}

export function createEmployeeDocuments(
  existingDocuments = []
) {
  const currentDocuments =
    parseEmployeeDocuments(existingDocuments);

  return DOCUMENT_OPTIONS.map((option) => {
    const matchedDocument =
      currentDocuments.find(
        (document) =>
          normalizeName(document?.name) ===
          normalizeName(option.name)
      );

    const originalDocumentNumber =
      normalizeEmployeeDocumentNumber(
        getExistingDocumentNumber(
          matchedDocument
        )
      );

    return {
      id: matchedDocument?.id,
      name: option.name,
      expirable: option.expirable,
      requiresDocumentNumber:
        Boolean(option.requiresDocumentNumber),
      documentNumberLabel:
        option.documentNumberLabel ||
        "Document Number",
      documentNumberPlaceholder:
        option.documentNumberPlaceholder ||
        "Enter document number",
      documentNumber:
        originalDocumentNumber,
      originalDocumentNumber,
      isExistingRecord:
        Boolean(matchedDocument),
      checked:
        Boolean(matchedDocument),
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
  });
}

export function createInitialEmployeeFormData(
  employee = null
) {
  if (!employee) {
    return {
      name: "",
      birthday: "",
      dateHired: "",
      status:
        "Floating / Standby",
      company: "",
      position: "",
      contractStart: "",
      documents:
        createEmployeeDocuments(),
    };
  }

  const status =
    resolveEmployeeWorkforceStatus(
      employee
    );

  return {
    name:
      employee?.name ||
      employee?.fullName ||
      employee?.fullname ||
      "",

    birthday:
      normalizeDateInput(
        employee?.birthday ||
          employee?.birthDate ||
          employee?.birth_date ||
          employee?.dateOfBirth ||
          employee?.date_of_birth
      ),

    dateHired:
      normalizeDateInput(
        employee?.dateHired ||
          employee?.date_hired ||
          employee?.hireDate ||
          employee?.hire_date
      ),

    status,

    company:
      String(
        employee?.company || ""
      ).trim(),

    position:
      String(
        employee?.position ||
          employee?.deploymentPosition ||
          employee?.deployment_position ||
          ""
      ).trim(),

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

export function validateEmployeeDocumentFile(file) {
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

  if (
    file.size >
    MAX_DOCUMENT_SIZE
  ) {
    return "File must be less than 5MB.";
  }

  return "";
}

export function hasDocumentFile(document) {
  return Boolean(
    isFile(document?.file) ||
      document?.filePath ||
      document?.file_path ||
      document?.url
  );
}

export function isDocumentComplete(document) {
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
    (document) =>
      document?.checked
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
        ) ===
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
  const targetId =
    normalizeEmployeeId(
      employeeId
    );

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

  const name =
    String(
      formData?.name || ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  const status =
    String(
      formData?.status ||
      "Floating / Standby"
    ).trim();

  const company =
    String(
      formData?.company || ""
    ).trim();

  const position =
    String(
      formData?.position || ""
    ).trim();

  const dateHired =
    String(
      formData?.dateHired ||
      formData?.date_hired ||
      ""
    ).trim();

  const contractStart =
    String(
      formData?.contractStart ||
      ""
    ).trim();

  const isDeployed =
    status ===
    "Deployed";

  if (!name) {
    errors.name =
      "Full name is required.";
  } else if (
    !/^[A-Za-zÑñ\s.'-]+$/.test(
      name
    )
  ) {
    errors.name =
      "Full name may only contain letters, spaces, apostrophes, periods, and hyphens.";
  } else if (
    name
      .split(" ")
      .filter(Boolean)
      .length < 2
  ) {
    errors.name =
      "Please enter the employee's first name and last name.";
  }

  const birthdayError =
    validateEmployeeBirthday(
      formData?.birthday
    );

  if (birthdayError) {
    errors.birthday =
      birthdayError;
  }

  const dateHiredError =
    validateEmployeeBusinessDate(
      dateHired,
      {
        label:
          "Date Hired",
        required:
          true,
      }
    );

  if (dateHiredError) {
    errors.dateHired =
      dateHiredError;
  }

  if (
    !EMPLOYEE_WORKFORCE_STATUSES.has(
      status
    )
  ) {
    errors.status =
      "Select a valid workforce status.";
  }

  if (!company) {
    errors.company =
      isDeployed
        ? "Current company is required."
        : "Designated company is required.";
  }

  if (!position) {
    errors.position =
      isDeployed
        ? "Current position is required."
        : "Designated position is required.";
  }

  if (isDeployed) {
    const deploymentStartError =
      validateEmployeeBusinessDate(
        contractStart,
        {
          label:
            "Deployment start date",
          required:
            true,
        }
      );

    if (deploymentStartError) {
      errors.contractStart =
        deploymentStartError;
    } else if (
      dateHired &&
      contractStart &&
      contractStart <
        dateHired
    ) {
      errors.contractStart =
        "Deployment start date cannot be earlier than Date Hired.";
    }
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

    if (
      !hasDocumentFile(
        document
      )
    ) {
      errors.documents[
        `${document.name}_file`
      ] =
        "Proof file is required.";
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

    const documentNumberError =
      validateEmployeeDocumentNumber(
        document
      );

    if (documentNumberError) {
      errors.documents[
        `${document.name}_number`
      ] =
        documentNumberError;
    }
  });

  const hasDocumentErrors =
    Object.values(
      errors.documents
    ).some(Boolean);

  const isValid =
    ![
      errors.name,
      errors.birthday,
      errors.dateHired,
      errors.status,
      errors.company,
      errors.position,
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

  const status =
    String(
      formData?.status ||
      ""
    ).trim();

  const isDeployed =
    status ===
    "Deployed";

  let score = 0;

  if (
    String(
      formData?.name || ""
    ).trim()
  ) {
    score += 20;
  }

  if (
    String(
      formData?.dateHired ||
      formData?.date_hired ||
      ""
    ).trim()
  ) {
    score += 10;
  }

  if (
    EMPLOYEE_WORKFORCE_STATUSES.has(
      status
    )
  ) {
    score += 10;
  }

  if (
    String(
      formData?.company || ""
    ).trim()
  ) {
    score += 10;
  }

  if (
    String(
      formData?.position || ""
    ).trim()
  ) {
    score += 10;
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
      ) * 30;
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
    completedCount <
    DOCUMENT_OPTIONS.length
  ) {
    const pendingCount =
      DOCUMENT_OPTIONS.length -
      completedCount;

    return `${completedCount} of ${DOCUMENT_OPTIONS.length} compliance requirements submitted. ${pendingCount} requirement${pendingCount === 1 ? "" : "s"} pending. Remaining documents may be submitted later.`;
  }

  return "";
}

export function buildEmployeeFormData(
  formData
) {
  const requestData =
    new FormData();

  const status =
    String(
      formData?.status ||
      "Floating / Standby"
    ).trim();

  const isDeployed =
    status ===
    "Deployed";

  requestData.append(
    "name",
    toProperName(
      formData?.name
    )
  );

  requestData.append(
    "birthday",
    String(
      formData?.birthday || ""
    ).trim()
  );

  requestData.append(
    "dateHired",
    String(
      formData?.dateHired ||
      formData?.date_hired ||
      ""
    ).trim()
  );

  requestData.append(
    "company",
    String(
      formData?.company || ""
    ).trim()
  );

  requestData.append(
    "position",
    String(
      formData?.position || ""
    ).trim()
  );

  requestData.append(
    "status",
    status
  );

  requestData.append(
    "contractStart",
    isDeployed
      ? String(
          formData?.contractStart ||
          ""
        ).trim()
      : ""
  );

  getSelectedDocuments(
    formData?.documents
  ).forEach(
    (
      document,
      index
    ) => {
      requestData.append(
        `documents[${index}][name]`,
        document.name
      );

      requestData.append(
        `documents[${index}][expirationDate]`,
        document.expirationDate ||
          ""
      );

      requestData.append(
        `documents[${index}][documentNumber]`,
        normalizeEmployeeDocumentNumber(
          document.documentNumber
        )
      );

      if (
        isFile(
          document.file
        )
      ) {
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

  return "";
}

export function getDocumentFileName(
  document
) {
  if (
    isFile(
      document?.file
    )
  ) {
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
  if (
    isFile(document?.file) ||
    isBlob(document?.file)
  ) {
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

  if (
    filePath.endsWith(
      ".pdf"
    )
  ) {
    return "pdf";
  }

  return "file";
}