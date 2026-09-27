const crypto = require("crypto");
const multer = require("multer");
const path = require("path");

const {
  uploadBuffer,
  removeObject,
} = require("../services/storageService");

const STORAGE_PREFIX =
  "documents/employees";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const MAX_EMPLOYEE_DOCUMENTS =
  20;

const MAX_INCIDENT_EVIDENCE_FILES =
  10;

const FORM_FIELD_LIMIT =
  100;

const FORM_FIELD_SIZE =
  64 * 1024;

const EMPLOYEE_PART_LIMIT =
  FORM_FIELD_LIMIT +
  MAX_EMPLOYEE_DOCUMENTS;

const INCIDENT_PART_LIMIT =
  FORM_FIELD_LIMIT +
  MAX_INCIDENT_EVIDENCE_FILES;

const FILE_TYPE_CONFIG = {
  "image/png": {
    extension:
      ".png",

    allowedExtensions: [
      ".png",
    ],

    signatureMatches(
      buffer
    ) {
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
    extension:
      ".jpg",

    allowedExtensions: [
      ".jpg",
      ".jpeg",
    ],

    signatureMatches(
      buffer
    ) {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    },
  },

  "application/pdf": {
    extension:
      ".pdf",

    allowedExtensions: [
      ".pdf",
    ],

    signatureMatches(
      buffer
    ) {
      return (
        buffer.length >= 5 &&
        buffer
          .subarray(
            0,
            5
          )
          .toString(
            "ascii"
          ) ===
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
    "STORAGE_UPLOAD_ERROR",
  ]);

function createUploadError(
  message,
  {
    code =
      "UPLOAD_VALIDATION_ERROR",

    statusCode =
      400,
  } = {}
) {
  const error =
    new Error(
      message
    );

  error.code =
    code;

  error.statusCode =
    statusCode;

  return error;
}

function getFileTypeConfig(
  mimetype
) {
  const normalizedMimeType =
    String(
      mimetype || ""
    )
      .trim()
      .toLowerCase();

  return (
    FILE_TYPE_CONFIG[
      normalizedMimeType
    ] ||
    null
  );
}

function flattenUploadedFiles(
  files
) {
  if (
    Array.isArray(
      files
    )
  ) {
    return files.filter(
      Boolean
    );
  }

  if (
    files &&
    typeof files ===
      "object"
  ) {
    return Object
      .values(
        files
      )
      .flat()
      .filter(
        Boolean
      );
  }

  return [];
}

function getUploadedObjectPath(
  file
) {
  return String(
    file?.storagePath ||
    file?.path ||
    ""
  ).trim();
}

/*
 * ==================================================
 * CLOUD COMPENSATION
 * ==================================================
 *
 * Used only for newly uploaded request objects.
 *
 * Historical/pre-existing files use the separate
 * reference-aware lifecycle service.
 */
async function cleanupUploadedFiles(
  files
) {
  const uploadedFiles =
    flattenUploadedFiles(
      files
    );

  for (
    const file of
    uploadedFiles
  ) {
    const objectPath =
      getUploadedObjectPath(
        file
      );

    if (!objectPath) {
      continue;
    }

    try {
      await removeObject(
        objectPath
      );
    } catch (error) {
      console.error(
        "UPLOAD CLOUD CLEANUP ERROR:",
        {
          objectPath,

          message:
            error?.message ||
            error,
        }
      );
    }
  }
}

/*
 * ==================================================
 * MEMORY-ONLY MULTIPART PARSING
 * ==================================================
 *
 * The backend no longer writes employee documents
 * or incident evidence to local disk.
 *
 * Bytes are:
 *
 * multipart request
 * -> memory
 * -> signature validation
 * -> private Supabase Storage
 */
const storage =
  multer.memoryStorage();

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

          statusCode:
            415,
        }
      ),
      false
    );
  }

  const originalExtension =
    path
      .extname(
        String(
          file.originalname ||
          ""
        )
      )
      .trim()
      .toLowerCase();

  if (
    !typeConfig
      .allowedExtensions
      .includes(
        originalExtension
      )
  ) {
    return callback(
      createUploadError(
        "The file extension does not match the uploaded file type.",
        {
          code:
            "FILE_TYPE_MISMATCH",

          statusCode:
            415,
        }
      ),
      false
    );
  }

  return callback(
    null,
    true
  );
}

const upload =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,
    },
  });

function validateBufferedFileSignature(
  file
) {
  const typeConfig =
    getFileTypeConfig(
      file?.mimetype
    );

  const buffer =
    file?.buffer;

  if (
    !typeConfig ||
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length === 0
  ) {
    throw createUploadError(
      "Invalid uploaded file.",
      {
        code:
          "INVALID_UPLOAD",

        statusCode:
          415,
      }
    );
  }

  if (
    !typeConfig
      .signatureMatches(
        buffer
      )
  ) {
    throw createUploadError(
      "The uploaded file content does not match its declared file type.",
      {
        code:
          "FILE_SIGNATURE_MISMATCH",

        statusCode:
          415,
      }
    );
  }
}

function createStoredFilename(
  mimetype
) {
  const typeConfig =
    getFileTypeConfig(
      mimetype
    );

  if (!typeConfig) {
    throw createUploadError(
      "Unsupported upload file type.",
      {
        code:
          "UNSUPPORTED_FILE_TYPE",

        statusCode:
          415,
      }
    );
  }

  return (
    `${Date.now()}-` +
    `${crypto.randomUUID()}` +
    `${typeConfig.extension}`
  );
}

async function persistFilesToStorage(
  files
) {
  const uploadedFiles =
    [];

  try {
    for (
      const file of
      files
    ) {
      const storedFilename =
        createStoredFilename(
          file.mimetype
        );

      const objectPath =
        `${STORAGE_PREFIX}/${storedFilename}`;

      await uploadBuffer(
        objectPath,
        file.buffer,
        {
          contentType:
            file.mimetype,

          upsert:
            false,
        }
      );

      /*
       * Preserve the familiar Multer-shaped contract
       * expected by the existing controllers.
       */
      file.filename =
        storedFilename;

      file.path =
        objectPath;

      file.storagePath =
        objectPath;

      /*
       * The bytes now exist in Supabase.
       * Release the in-memory copy before controller
       * business/database work begins.
       */
      delete file.buffer;

      uploadedFiles.push(
        file
      );
    }

    return files;
  } catch (error) {
    await cleanupUploadedFiles(
      uploadedFiles
    );

    throw error;
  }
}

function isSafeUploadValidationError(
  error
) {
  return (
    SAFE_UPLOAD_ERROR_CODES.has(
      error?.code
    ) ||
    Number(
      error?.statusCode ||
      error?.status
    ) === 415
  );
}

/*
 * ==================================================
 * EMPLOYEE DOCUMENTS
 * ==================================================
 */

const employeeDocumentFields =
  Array.from(
    {
      length:
        MAX_EMPLOYEE_DOCUMENTS,
    },
    (
      _,
      index
    ) => ({
      name:
        `documents[${index}]`,

      maxCount:
        1,
    })
  );

const employeeUpload =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,

      files:
        MAX_EMPLOYEE_DOCUMENTS,

      fields:
        FORM_FIELD_LIMIT,

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
      ].includes(
        error.code
      )
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
          error?.statusCode
        )
          ? error.statusCode
          : 415
      )
      .json({
        error:
          error.message,
      });
  }

  console.error(
    "EMPLOYEE DOCUMENT UPLOAD ERROR:",
    error
  );

  return res
    .status(500)
    .json({
      error:
        "Unable to store employee document.",
    });
}

upload.employeeDocuments =
  (
    req,
    res,
    next
  ) => {
    parseEmployeeDocuments(
      req,
      res,
      async (
        uploadError
      ) => {
        const files =
          flattenUploadedFiles(
            req.files
          );

        req.files =
          files;

        if (
          uploadError
        ) {
          req.files =
            [];

          return sendEmployeeUploadError(
            res,
            uploadError
          );
        }

        try {
          for (
            const file of
            files
          ) {
            validateBufferedFileSignature(
              file
            );
          }

          await persistFilesToStorage(
            files
          );

          return next();
        } catch (error) {
          await cleanupUploadedFiles(
            files
          );

          req.files =
            [];

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
 * INCIDENT EVIDENCE
 * ==================================================
 */

const incidentUpload =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,

      files:
        MAX_INCIDENT_EVIDENCE_FILES,

      fields:
        FORM_FIELD_LIMIT,

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
      ].includes(
        error.code
      )
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
          error?.statusCode
        )
          ? error.statusCode
          : 415
      )
      .json({
        error:
          error.message,
      });
  }

  console.error(
    "INCIDENT EVIDENCE UPLOAD ERROR:",
    error
  );

  return res
    .status(500)
    .json({
      error:
        "Unable to store incident evidence.",
    });
}

function registerIncidentCleanupBoundary(
  req,
  res,
  files
) {
  let ownershipClaimed =
    false;

  let cleanupStarted =
    false;

  req.claimIncidentEvidenceFiles =
    () => {
      ownershipClaimed =
        true;
    };

  const cleanupIfUnclaimed =
    () => {
      if (
        ownershipClaimed ||
        cleanupStarted
      ) {
        return;
      }

      cleanupStarted =
        true;

      cleanupUploadedFiles(
        files
      ).catch(
        (
          error
        ) => {
          console.error(
            "INCIDENT REQUEST CLOUD CLEANUP ERROR:",
            error
          );
        }
      );
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

upload.incidentEvidence =
  (
    req,
    res,
    next
  ) => {
    parseIncidentEvidence(
      req,
      res,
      async (
        uploadError
      ) => {
        const files =
          flattenUploadedFiles(
            req.files
          );

        req.files =
          files;

        if (
          uploadError
        ) {
          req.files =
            [];

          return sendIncidentUploadError(
            res,
            uploadError
          );
        }

        try {
          for (
            const file of
            files
          ) {
            validateBufferedFileSignature(
              file
            );
          }

          await persistFilesToStorage(
            files
          );
        } catch (error) {
          await cleanupUploadedFiles(
            files
          );

          req.files =
            [];

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

module.exports =
  upload;
