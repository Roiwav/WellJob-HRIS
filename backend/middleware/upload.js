const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadDirectory = path.join(
  __dirname,
  "..",
  "documents",
  "employees"
);

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const MAX_EMPLOYEE_DOCUMENTS = 20;
const MAX_INCIDENT_EVIDENCE_FILES = 10;

const FORM_FIELD_LIMIT = 100;
const FORM_FIELD_SIZE = 64 * 1024;

const EMPLOYEE_PART_LIMIT =
  FORM_FIELD_LIMIT +
  MAX_EMPLOYEE_DOCUMENTS;

const INCIDENT_PART_LIMIT =
  FORM_FIELD_LIMIT +
  MAX_INCIDENT_EVIDENCE_FILES;

const FILE_TYPE_CONFIG = {
  "image/png": {
    extension: ".png",
    allowedExtensions: [".png"],

    signatureMatches(buffer) {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    },
  },

  "image/jpeg": {
    extension: ".jpg",
    allowedExtensions: [
      ".jpg",
      ".jpeg",
    ],

    signatureMatches(buffer) {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    },
  },

  "application/pdf": {
    extension: ".pdf",
    allowedExtensions: [".pdf"],

    signatureMatches(buffer) {
      return (
        buffer.length >= 5 &&
        buffer
          .subarray(0, 5)
          .toString("ascii") ===
          "%PDF-"
      );
    },
  },
};

const SAFE_UPLOAD_ERROR_CODES =
  new Set([
    "UNSUPPORTED_FILE_TYPE",
    "FILE_TYPE_MISMATCH",
    "FILE_SIGNATURE_MISMATCH",
    "INVALID_UPLOAD",
  ]);

function ensureUploadDirectory() {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

function createUploadError(
  message,
  {
    code =
      "UPLOAD_VALIDATION_ERROR",
    statusCode = 400,
  } = {}
) {
  const error =
    new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
}

function getFileTypeConfig(mimetype) {
  const normalizedMimeType =
    String(mimetype || "")
      .trim()
      .toLowerCase();

  return (
    FILE_TYPE_CONFIG[
      normalizedMimeType
    ] || null
  );
}

function flattenUploadedFiles(files) {
  if (Array.isArray(files)) {
    return files.filter(Boolean);
  }

  if (
    files &&
    typeof files === "object"
  ) {
    return Object.values(files)
      .flat()
      .filter(Boolean);
  }

  return [];
}

async function cleanupUploadedFiles(
  files
) {
  const uploadedFiles =
    flattenUploadedFiles(files);

  for (const file of uploadedFiles) {
    const filePath = String(
      file?.path || ""
    ).trim();

    if (!filePath) {
      continue;
    }

    try {
      await fs.promises.unlink(
        filePath
      );
    } catch (error) {
      if (
        error?.code !== "ENOENT"
      ) {
        console.error(
          "UPLOAD CLEANUP ERROR:",
          {
            filePath,
            message:
              error?.message ||
              error,
          }
        );
      }
    }
  }
}

ensureUploadDirectory();

/*
 * ==================================================
 * STORAGE
 * ==================================================
 *
 * Stored extensions are controlled by the server.
 * Original client filenames never determine the
 * physical filename written to disk.
 */
const storage =
  multer.diskStorage({
    destination(
      req,
      file,
      callback
    ) {
      ensureUploadDirectory();

      callback(
        null,
        uploadDirectory
      );
    },

    filename(
      req,
      file,
      callback
    ) {
      const typeConfig =
        getFileTypeConfig(
          file.mimetype
        );

      if (!typeConfig) {
        return callback(
          createUploadError(
            "Unsupported upload file type.",
            {
              code:
                "UNSUPPORTED_FILE_TYPE",
              statusCode: 415,
            }
          )
        );
      }

      const safeName =
        `${Date.now()}-${crypto.randomUUID()}${typeConfig.extension}`;

      return callback(
        null,
        safeName
      );
    },
  });

/*
 * ==================================================
 * DECLARED FILE-TYPE VALIDATION
 * ==================================================
 *
 * This is performed before the file is accepted by
 * Multer.
 *
 * Actual file bytes are validated separately after
 * Multer writes the file.
 */
function fileFilter(
  req,
  file,
  callback
) {
  const typeConfig =
    getFileTypeConfig(
      file.mimetype
    );

  if (!typeConfig) {
    return callback(
      createUploadError(
        "Only PNG, JPEG, and PDF files are allowed.",
        {
          code:
            "UNSUPPORTED_FILE_TYPE",
          statusCode: 415,
        }
      ),
      false
    );
  }

  const originalExtension =
    path
      .extname(
        String(
          file.originalname || ""
        )
      )
      .trim()
      .toLowerCase();

  if (
    !typeConfig.allowedExtensions.includes(
      originalExtension
    )
  ) {
    return callback(
      createUploadError(
        "The file extension does not match the uploaded file type.",
        {
          code:
            "FILE_TYPE_MISMATCH",
          statusCode: 415,
        }
      ),
      false
    );
  }

  return callback(null, true);
}

/*
 * Generic Multer instance retained for compatibility.
 *
 * Employee and incident routes should use their
 * dedicated hardened middleware properties below.
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/*
 * ==================================================
 * ACTUAL FILE CONTENT VALIDATION
 * ==================================================
 */
async function validateStoredFileSignature(
  file
) {
  const filePath = String(
    file?.path || ""
  ).trim();

  const typeConfig =
    getFileTypeConfig(
      file?.mimetype
    );

  if (
    !filePath ||
    !typeConfig
  ) {
    throw createUploadError(
      "Invalid uploaded file.",
      {
        code:
          "INVALID_UPLOAD",
        statusCode: 415,
      }
    );
  }

  let handle = null;

  try {
    handle =
      await fs.promises.open(
        filePath,
        "r"
      );

    const signatureBuffer =
      Buffer.alloc(8);

    const { bytesRead } =
      await handle.read(
        signatureBuffer,
        0,
        signatureBuffer.length,
        0
      );

    const actualBytes =
      signatureBuffer.subarray(
        0,
        bytesRead
      );

    if (
      !typeConfig.signatureMatches(
        actualBytes
      )
    ) {
      throw createUploadError(
        "The uploaded file content does not match its declared file type.",
        {
          code:
            "FILE_SIGNATURE_MISMATCH",
          statusCode: 415,
        }
      );
    }
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}

function isSafeUploadValidationError(
  error
) {
  return SAFE_UPLOAD_ERROR_CODES.has(
    error?.code
  );
}

/*
 * ==================================================
 * EMPLOYEE DOCUMENT UPLOAD
 * ==================================================
 */

const employeeDocumentFields =
  Array.from(
    {
      length:
        MAX_EMPLOYEE_DOCUMENTS,
    },
    (_, index) => ({
      name:
        `documents[${index}]`,
      maxCount: 1,
    })
  );

const employeeUpload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files:
      MAX_EMPLOYEE_DOCUMENTS,
    fields: FORM_FIELD_LIMIT,
    parts:
      EMPLOYEE_PART_LIMIT,
    fieldSize:
      FORM_FIELD_SIZE,
  },
});

const parseEmployeeDocuments =
  employeeUpload.fields(
    employeeDocumentFields
  );

function sendEmployeeUploadError(
  res,
  error
) {
  if (
    error instanceof
    multer.MulterError
  ) {
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(413)
        .json({
          error:
            "Each employee document must be no larger than 5 MB.",
        });
    }

    if (
      error.code ===
      "LIMIT_FILE_COUNT"
    ) {
      return res
        .status(400)
        .json({
          error:
            "A maximum of 20 employee documents may be uploaded.",
        });
    }

    if (
      error.code ===
      "LIMIT_UNEXPECTED_FILE"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Unexpected employee document upload field.",
        });
    }

    if (
      [
        "LIMIT_FIELD_COUNT",
        "LIMIT_PART_COUNT",
        "LIMIT_FIELD_KEY",
        "LIMIT_FIELD_VALUE",
      ].includes(error.code)
    ) {
      return res
        .status(400)
        .json({
          error:
            "The employee upload form exceeds the allowed request limits.",
        });
    }

    return res
      .status(400)
      .json({
        error:
          "Invalid employee document upload request.",
      });
  }

  if (
    isSafeUploadValidationError(
      error
    )
  ) {
    return res
      .status(
        Number.isInteger(
          error.statusCode
        )
          ? error.statusCode
          : 400
      )
      .json({
        error: error.message,
      });
  }

  console.error(
    "EMPLOYEE DOCUMENT UPLOAD ERROR:",
    error
  );

  return res
    .status(400)
    .json({
      error:
        "Invalid employee document upload request.",
    });
}

upload.employeeDocuments = (
  req,
  res,
  next
) => {
  parseEmployeeDocuments(
    req,
    res,
    async (uploadError) => {
      const files =
        flattenUploadedFiles(
          req.files
        );

      /*
       * Existing employeeController expects
       * req.files to be a flat array.
       */
      req.files = files;

      if (uploadError) {
        await cleanupUploadedFiles(
          files
        );

        req.files = [];

        return sendEmployeeUploadError(
          res,
          uploadError
        );
      }

      try {
        for (const file of files) {
          await validateStoredFileSignature(
            file
          );
        }

        return next();
      } catch (error) {
        await cleanupUploadedFiles(
          files
        );

        req.files = [];

        return sendEmployeeUploadError(
          res,
          error
        );
      }
    }
  );
};

/*
 * ==================================================
 * INCIDENT EVIDENCE UPLOAD
 * ==================================================
 *
 * Security controls:
 *
 * - exact evidenceFiles field
 * - maximum 10 files
 * - maximum 5 MB per file
 * - PNG/JPEG/PDF only
 * - MIME/extension pairing
 * - server-controlled stored extension
 * - actual magic-byte verification
 * - multipart request limits
 * - cleanup after parser/signature failure
 * - request-scoped cleanup for files not committed
 *   to incident_evidence records
 */

const incidentUpload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files:
      MAX_INCIDENT_EVIDENCE_FILES,
    fields: FORM_FIELD_LIMIT,
    parts:
      INCIDENT_PART_LIMIT,
    fieldSize:
      FORM_FIELD_SIZE,
  },
});

const parseIncidentEvidence =
  incidentUpload.array(
    "evidenceFiles",
    MAX_INCIDENT_EVIDENCE_FILES
  );

function sendIncidentUploadError(
  res,
  error
) {
  if (
    error instanceof
    multer.MulterError
  ) {
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(413)
        .json({
          error:
            "Each incident evidence file must be no larger than 5 MB.",
        });
    }

    if (
      error.code ===
        "LIMIT_FILE_COUNT" ||
      error.code ===
        "LIMIT_UNEXPECTED_FILE"
    ) {
      return res
        .status(400)
        .json({
          error:
            error.code ===
            "LIMIT_FILE_COUNT"
              ? "A maximum of 10 incident evidence files may be uploaded."
              : "Unexpected upload field. Use evidenceFiles for incident evidence.",
        });
    }

    if (
      [
        "LIMIT_FIELD_COUNT",
        "LIMIT_PART_COUNT",
        "LIMIT_FIELD_KEY",
        "LIMIT_FIELD_VALUE",
      ].includes(error.code)
    ) {
      return res
        .status(400)
        .json({
          error:
            "The incident upload form exceeds the allowed request limits.",
        });
    }

    return res
      .status(400)
      .json({
        error:
          "Invalid incident evidence upload request.",
      });
  }

  if (
    isSafeUploadValidationError(
      error
    )
  ) {
    return res
      .status(
        Number.isInteger(
          error.statusCode
        )
          ? error.statusCode
          : 400
      )
      .json({
        error: error.message,
      });
  }

  console.error(
    "INCIDENT EVIDENCE UPLOAD ERROR:",
    error
  );

  return res
    .status(400)
    .json({
      error:
        "Unable to upload incident evidence.",
    });
}

/*
 * Registers a request-scoped ownership boundary.
 *
 * Multer writes files before the incident controller
 * performs business validation or database work.
 *
 * Unless the controller explicitly calls:
 *
 * req.claimIncidentEvidenceFiles()
 *
 * the newly uploaded physical files are treated as
 * uncommitted request files and are removed when the
 * response finishes or the connection closes.
 *
 * This covers controller early-return paths without
 * scattering file-deletion calls throughout every
 * validation branch.
 */
function registerIncidentCleanupBoundary(
  req,
  res,
  files
) {
  let ownershipClaimed = false;
  let cleanupStarted = false;

  req.claimIncidentEvidenceFiles =
    () => {
      ownershipClaimed = true;
    };

  const cleanupIfUnclaimed =
    () => {
      if (
        ownershipClaimed ||
        cleanupStarted
      ) {
        return;
      }

      cleanupStarted = true;

      cleanupUploadedFiles(
        files
      ).catch((error) => {
        console.error(
          "INCIDENT REQUEST CLEANUP ERROR:",
          error
        );
      });
    };

  res.once(
    "finish",
    cleanupIfUnclaimed
  );

  res.once(
    "close",
    cleanupIfUnclaimed
  );
}

upload.incidentEvidence = (
  req,
  res,
  next
) => {
  parseIncidentEvidence(
    req,
    res,
    async (uploadError) => {
      const files =
        flattenUploadedFiles(
          req.files
        );

      req.files = files;

      if (uploadError) {
        await cleanupUploadedFiles(
          files
        );

        req.files = [];

        return sendIncidentUploadError(
          res,
          uploadError
        );
      }

      try {
        for (const file of files) {
          await validateStoredFileSignature(
            file
          );
        }
      } catch (error) {
        await cleanupUploadedFiles(
          files
        );

        req.files = [];

        return sendIncidentUploadError(
          res,
          error
        );
      }

      registerIncidentCleanupBoundary(
        req,
        res,
        files
      );

      return next();
    }
  );
};

module.exports = upload;