const multer =
  require("multer");

const path =
  require("path");

const fs =
  require("fs");

const uploadDirectory =
  path.join(
    __dirname,
    "..",
    "documents",
    "employees"
  );

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const MAX_EMPLOYEE_DOCUMENTS =
  20;

const EMPLOYEE_FIELD_LIMIT =
  100;

const EMPLOYEE_PART_LIMIT =
  120;

const EMPLOYEE_FIELD_SIZE =
  64 * 1024;

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
          ) === "%PDF-"
      );
    },
  },
};

function ensureUploadDirectory() {
  if (
    !fs.existsSync(
      uploadDirectory
    )
  ) {
    fs.mkdirSync(
      uploadDirectory,
      {
        recursive: true,
      }
    );
  }
}

ensureUploadDirectory();

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
  return (
    FILE_TYPE_CONFIG[
      String(
        mimetype || ""
      )
        .trim()
        .toLowerCase()
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
    return files;
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
    const filePath =
      String(
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
        error?.code !==
        "ENOENT"
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

const storage =
  multer.diskStorage({
    destination(
      req,
      file,
      cb
    ) {
      ensureUploadDirectory();

      cb(
        null,
        uploadDirectory
      );
    },

    filename(
      req,
      file,
      cb
    ) {
      const typeConfig =
        getFileTypeConfig(
          file.mimetype
        );

      if (!typeConfig) {
        return cb(
          createUploadError(
            "Unsupported upload file type.",
            {
              code:
                "UNSUPPORTED_FILE_TYPE",

              statusCode:
                415,
            }
          )
        );
      }

      const randomPart =
        Math.round(
          Math.random() *
            1e9
        );

      const safeName =
        `${Date.now()}-${randomPart}${typeConfig.extension}`;

      return cb(
        null,
        safeName
      );
    },
  });

function fileFilter(
  req,
  file,
  cb
) {
  const typeConfig =
    getFileTypeConfig(
      file.mimetype
    );

  if (!typeConfig) {
    return cb(
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
    path.extname(
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
    return cb(
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

  return cb(
    null,
    true
  );
}

/*
 * Existing shared Multer instance.
 *
 * Incident evidence currently uses methods such as:
 *
 * upload.array("evidenceFiles", 10)
 *
 * Keep this export behavior intact so the existing
 * incident workflow is not changed by the employee
 * upload hardening work.
 */
const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,
    },
  });

/*
 * Employee uploads use exact multipart file fields.
 *
 * Existing employeeController expects:
 *
 * documents[0]
 * documents[1]
 * ...
 * documents[19]
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
        EMPLOYEE_FIELD_LIMIT,

      parts:
        EMPLOYEE_PART_LIMIT,

      fieldSize:
        EMPLOYEE_FIELD_SIZE,
    },
  });

const parseEmployeeDocuments =
  employeeUpload.fields(
    employeeDocumentFields
  );

async function validateStoredFileSignature(
  file
) {
  const filePath =
    String(
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
      "Invalid uploaded employee document.",
      {
        code:
          "INVALID_UPLOAD",

        statusCode:
          415,
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
      Buffer.alloc(
        8
      );

    const {
      bytesRead,
    } =
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
      !typeConfig
        .signatureMatches(
          actualBytes
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
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}

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

  const statusCode =
    Number.isInteger(
      error?.statusCode
    )
      ? error.statusCode
      : 400;

  return res
    .status(
      statusCode
    )
    .json({
      error:
        error?.message ||
        "Invalid employee document upload request.",
    });
}

/*
 * EMPLOYEE-SPECIFIC UPLOAD MIDDLEWARE
 *
 * Security controls:
 *
 * - only documents[0] through documents[19]
 * - max 1 file per document slot
 * - max 20 files total
 * - max 5 MB per file
 * - PNG/JPEG/PDF only
 * - extension must match declared MIME type
 * - stored extension is server-controlled
 * - actual file magic bytes are verified
 * - partial uploads are removed when validation fails
 *
 * req.files is flattened back into an array after
 * multer.fields() so the existing employeeController
 * behavior remains compatible.
 */
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

        /*
         * Preserve employeeController's existing
         * req.files array contract.
         */
        req.files =
          files;

        if (
          uploadError
        ) {
          await cleanupUploadedFiles(
            files
          );

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
            await validateStoredFileSignature(
              file
            );
          }

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

module.exports =
  upload;