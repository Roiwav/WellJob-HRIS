const crypto = require("crypto");
const path = require("path");

const {
  createSignedUploadUrl,
} = require("../services/storageService");

/*
 * ==================================================
 * WELLJOB PROTECTED DIRECT-UPLOAD AUTHORIZATION
 * ==================================================
 *
 * Purpose:
 * Generate temporary, server-authorized upload URLs
 * for protected employee documents and incident
 * evidence.
 *
 * Security model:
 *
 * Browser
 *   -> authenticated WELLJOB API
 *   -> temporary signed upload authorization
 *   -> direct upload to private Supabase Storage
 *
 * SUPABASE_SECRET_KEY never reaches the browser.
 */

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const MAX_EMPLOYEE_DOCUMENTS =
  20;

const MAX_INCIDENT_EVIDENCE_FILES =
  10;

/*
 * Keep the existing WELLJOB storage identity.
 *
 * Existing database references and lifecycle logic
 * already use:
 *
 * documents/employees/<generated-file>
 *
 * Employee documents and incident evidence currently
 * share this protected storage family.
 */
const STORAGE_PREFIX =
  "documents/employees";

const FILE_TYPE_CONFIG = {
  "image/png": {
    extension: ".png",
    allowedExtensions: [
      ".png",
    ],
  },

  "image/jpeg": {
    extension: ".jpg",
    allowedExtensions: [
      ".jpg",
      ".jpeg",
    ],
  },

  "application/pdf": {
    extension: ".pdf",
    allowedExtensions: [
      ".pdf",
    ],
  },
};

const EVIDENCE_WORKFLOW_ACTIONS =
  new Set([
    "SUBMIT_RESOLUTION",
    "SUBMIT_INVESTIGATION",
  ]);

class UploadAuthorizationError extends Error {
  constructor(
    message,
    {
      statusCode = 400,
      code =
        "UPLOAD_AUTHORIZATION_ERROR",
    } = {}
  ) {
    super(message);

    this.name =
      "UploadAuthorizationError";

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}

function normalizeMimeType(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normalizeOriginalName(
  value
) {
  return path
    .basename(
      String(
        value || ""
      ).trim()
    )
    .trim();
}

function getUploadMetadata(
  file,
  index
) {
  if (
    !file ||
    typeof file !== "object" ||
    Array.isArray(file)
  ) {
    throw new UploadAuthorizationError(
      `Upload metadata at index ${index} is invalid.`,
      {
        code:
          "INVALID_UPLOAD_METADATA",
      }
    );
  }

  const originalName =
    normalizeOriginalName(
      file.name ||
        file.fileName ||
        file.originalName
    );

  if (!originalName) {
    throw new UploadAuthorizationError(
      `A file name is required for upload item ${index + 1}.`,
      {
        code:
          "MISSING_FILE_NAME",
      }
    );
  }

  const mimeType =
    normalizeMimeType(
      file.type ||
        file.mimeType ||
        file.mimetype
    );

  const typeConfig =
    FILE_TYPE_CONFIG[
      mimeType
    ];

  if (!typeConfig) {
    throw new UploadAuthorizationError(
      "Only PNG, JPEG, and PDF files are allowed.",
      {
        statusCode: 415,

        code:
          "UNSUPPORTED_FILE_TYPE",
      }
    );
  }

  const originalExtension =
    path
      .extname(
        originalName
      )
      .trim()
      .toLowerCase();

  if (
    !typeConfig.allowedExtensions.includes(
      originalExtension
    )
  ) {
    throw new UploadAuthorizationError(
      "The file extension does not match the declared file type.",
      {
        statusCode: 415,

        code:
          "FILE_TYPE_MISMATCH",
      }
    );
  }

  const size =
    Number(
      file.size
    );

  if (
    !Number.isSafeInteger(
      size
    ) ||
    size <= 0
  ) {
    throw new UploadAuthorizationError(
      `A valid file size is required for ${originalName}.`,
      {
        code:
          "INVALID_FILE_SIZE",
      }
    );
  }

  if (
    size >
    MAX_FILE_SIZE
  ) {
    throw new UploadAuthorizationError(
      `Each protected upload must be no larger than 5 MB.`,
      {
        statusCode: 413,

        code:
          "FILE_TOO_LARGE",
      }
    );
  }

  return {
    originalName,
    mimeType,
    size,

    storedExtension:
      typeConfig.extension,
  };
}

function createStoredFilename(
  extension
) {
  return (
    `${Date.now()}-` +
    `${crypto.randomUUID()}` +
    `${extension}`
  );
}

async function createAuthorizationBatch(
  files,
  {
    maxFiles,
  }
) {
  if (
    !Array.isArray(files)
  ) {
    throw new UploadAuthorizationError(
      "The files field must be an array.",
      {
        code:
          "INVALID_FILES_ARRAY",
      }
    );
  }

  if (
    files.length === 0
  ) {
    throw new UploadAuthorizationError(
      "At least one file is required.",
      {
        code:
          "NO_FILES",
      }
    );
  }

  if (
    files.length >
    maxFiles
  ) {
    throw new UploadAuthorizationError(
      `A maximum of ${maxFiles} files may be authorized at once.`,
      {
        code:
          "TOO_MANY_FILES",
      }
    );
  }

  const validatedFiles =
    files.map(
      (
        file,
        index
      ) =>
        getUploadMetadata(
          file,
          index
        )
    );

  const uploads = [];

  for (
    let index = 0;
    index <
    validatedFiles.length;
    index += 1
  ) {
    const file =
      validatedFiles[
        index
      ];

    const storedFilename =
      createStoredFilename(
        file.storedExtension
      );

    const objectPath =
      `${STORAGE_PREFIX}/${storedFilename}`;

    const authorization =
      await createSignedUploadUrl(
        objectPath,
        {
          upsert: false,
        }
      );

    uploads.push({
      clientIndex:
        index,

      originalName:
        file.originalName,

      mimeType:
        file.mimeType,

      size:
        file.size,

      storedFilename,

      objectPath:
        authorization.path,

      signedUrl:
        authorization.signedUrl,

      token:
        authorization.token,
    });
  }

  return uploads;
}

function sendControllerError(
  res,
  error,
  context
) {
  if (
    error instanceof
    UploadAuthorizationError
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        error:
          error.message,

        code:
          error.code,
      });
  }

  console.error(
    `${context} ERROR:`,
    {
      message:
        error?.message ||
        error,

      code:
        error?.code ||
        null,

      status:
        error?.status ||
        null,
    }
  );

  return res
    .status(500)
    .json({
      error:
        "Unable to authorize protected file upload.",
    });
}

/*
 * ==================================================
 * EMPLOYEE DOCUMENT AUTHORIZATION
 * ==================================================
 *
 * Route authorization:
 * HR_MANAGER / HR_STAFF
 */
exports.createEmployeeDocumentUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_EMPLOYEE_DOCUMENTS,
          }
        );

      return res.json({
        success: true,

        uploadType:
          "employee_document",

        uploads,
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "EMPLOYEE DOCUMENT UPLOAD AUTHORIZATION"
      );
    }
  };

/*
 * ==================================================
 * INCIDENT CREATE-EVIDENCE AUTHORIZATION
 * ==================================================
 *
 * Route authorization:
 * HR_MANAGER / HR_STAFF / HR_COORDINATOR
 */
exports.createIncidentEvidenceUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_INCIDENT_EVIDENCE_FILES,
          }
        );

      return res.json({
        success: true,

        uploadType:
          "incident_evidence",

        purpose:
          "create",

        uploads,
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "INCIDENT CREATE EVIDENCE UPLOAD AUTHORIZATION"
      );
    }
  };

/*
 * ==================================================
 * INCIDENT WORKFLOW-EVIDENCE AUTHORIZATION
 * ==================================================
 *
 * Route authorization:
 * HR_MANAGER / HR_STAFF
 *
 * Only investigation/resolution proof submissions
 * may obtain workflow evidence upload authorization.
 */
exports.createIncidentWorkflowEvidenceUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const workflowAction =
        String(
          req.body
            ?.workflowAction ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        !EVIDENCE_WORKFLOW_ACTIONS.has(
          workflowAction
        )
      ) {
        throw new UploadAuthorizationError(
          "Evidence files may only be uploaded when submitting investigation proof for review.",
          {
            code:
              "INVALID_EVIDENCE_WORKFLOW_ACTION",
          }
        );
      }

      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_INCIDENT_EVIDENCE_FILES,
          }
        );

      return res.json({
        success: true,

        uploadType:
          "incident_evidence",

        purpose:
          "workflow",

        workflowAction,

        uploads,
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "INCIDENT WORKFLOW EVIDENCE UPLOAD AUTHORIZATION"
      );
    }
  };
