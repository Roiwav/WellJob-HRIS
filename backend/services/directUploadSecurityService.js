const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");

const {
  normalizeObjectPath,
  downloadBuffer,
} = require("./storageService");

/*
 * ==================================================
 * WELLJOB DIRECT-UPLOAD SECURITY SERVICE
 * ==================================================
 *
 * Browser flow:
 *
 * 1. Authenticated user asks WELLJOB backend for
 *    direct-upload authorization.
 *
 * 2. Backend creates:
 *    - random private Supabase object path
 *    - short-lived Supabase upload authorization
 *    - WELLJOB-signed descriptor
 *
 * 3. Browser uploads the binary directly to
 *    Supabase.
 *
 * 4. Browser sends only the signed descriptor and
 *    normal form metadata back to WELLJOB.
 *
 * 5. WELLJOB verifies:
 *    - descriptor signature
 *    - expiry
 *    - actor identity
 *    - token version
 *    - upload purpose
 *    - route context
 *    - object path
 *    - actual byte size
 *    - actual magic bytes
 *
 * The descriptor is NOT an authentication token.
 * It uses a key derived from JWT_SECRET so it cannot
 * be substituted for a normal WELLJOB login JWT.
 */

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const STORAGE_PREFIX =
  "documents/employees/";

const DESCRIPTOR_VERSION =
  1;

const DESCRIPTOR_TTL_SECONDS =
  10 * 60;

const DESCRIPTOR_ISSUER =
  "welljob-hris";

const DESCRIPTOR_AUDIENCE =
  "welljob-direct-upload-finalize";

const DESCRIPTOR_KEY_CONTEXT =
  "welljob-direct-upload-descriptor-v1";

const DIRECT_UPLOAD_TYPES =
  Object.freeze({
    EMPLOYEE_DOCUMENT:
      "employee_document",

    INCIDENT_EVIDENCE:
      "incident_evidence",
  });

const DIRECT_UPLOAD_PURPOSES =
  Object.freeze({
    EMPLOYEE_CREATE:
      "employee_create",

    EMPLOYEE_UPDATE:
      "employee_update",

    INCIDENT_CREATE:
      "incident_create",

    INCIDENT_WORKFLOW:
      "incident_workflow",
  });

const VALID_UPLOAD_TYPES =
  new Set(
    Object.values(
      DIRECT_UPLOAD_TYPES
    )
  );

const VALID_UPLOAD_PURPOSES =
  new Set(
    Object.values(
      DIRECT_UPLOAD_PURPOSES
    )
  );

const VALID_WORKFLOW_ACTIONS =
  new Set([
    "SUBMIT_RESOLUTION",
    "SUBMIT_INVESTIGATION",
  ]);

const FILE_TYPE_CONFIG =
  Object.freeze({
    "image/png": {
      storedExtension:
        ".png",

      allowedExtensions:
        new Set([
          ".png",
        ]),

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
      storedExtension:
        ".jpg",

      allowedExtensions:
        new Set([
          ".jpg",
          ".jpeg",
          ".jfif",
          ".jpe",
        ]),

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
      storedExtension:
        ".pdf",

      allowedExtensions:
        new Set([
          ".pdf",
        ]),

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
  });


class DirectUploadError
  extends Error {
  constructor(
    message,
    {
      statusCode =
        400,

      code =
        "DIRECT_UPLOAD_ERROR",
    } = {}
  ) {
    super(
      message
    );

    this.name =
      "DirectUploadError";

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}


/*
 * ==================================================
 * BASIC NORMALIZATION
 * ==================================================
 */

function normalizePositiveInteger(
  value
) {
  const rawValue =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      rawValue
    )
  ) {
    return null;
  }

  const numericValue =
    Number(
      rawValue
    );

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
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


/*
 * Browser-provided names may contain either:
 *
 * filename.pdf
 * C:\fakepath\filename.pdf
 * folder/filename.pdf
 *
 * Normalize both Windows and POSIX separators so
 * behavior is identical locally and on Vercel Linux.
 */
function normalizeOriginalName(
  value
) {
  const normalizedPath =
    String(
      value || ""
    )
      .trim()
      .replace(
        /\\/g,
        "/"
      );

  const segments =
    normalizedPath.split(
      "/"
    );

  const rawName =
    String(
      segments[
        segments.length - 1
      ] ||
      ""
    )
      .replace(
        /[\u0000-\u001F\u007F]/g,
        ""
      )
      .trim();

  if (!rawName) {
    return "";
  }

  if (
    rawName.length >
    255
  ) {
    throw new DirectUploadError(
      "The uploaded file name is too long.",
      {
        code:
          "FILE_NAME_TOO_LONG",
      }
    );
  }

  return rawName;
}


function normalizeWorkflowAction(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toUpperCase();

  return (
    VALID_WORKFLOW_ACTIONS.has(
      normalized
    )
      ? normalized
      : null
  );
}


/*
 * ==================================================
 * CLIENT FILE METADATA VALIDATION
 * ==================================================
 */

function validateClientUploadMetadata(
  file,
  index = 0
) {
  if (
    !file ||
    typeof file !==
      "object" ||
    Array.isArray(
      file
    )
  ) {
    throw new DirectUploadError(
      `Upload metadata at index ${index} is invalid.`,
      {
        code:
          "INVALID_UPLOAD_METADATA",
      }
    );
  }

  const originalName =
    normalizeOriginalName(
      file.name ??
      file.fileName ??
      file.originalName ??
      file.originalname
    );

  if (!originalName) {
    throw new DirectUploadError(
      `A file name is required for upload item ${index + 1}.`,
      {
        code:
          "MISSING_FILE_NAME",
      }
    );
  }

  const mimeType =
    normalizeMimeType(
      file.type ??
      file.mimeType ??
      file.mimetype
    );

  const typeConfig =
    FILE_TYPE_CONFIG[
      mimeType
    ];

  if (!typeConfig) {
    throw new DirectUploadError(
      "Only PNG, JPEG, and PDF files are allowed.",
      {
        statusCode:
          415,

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
    !typeConfig
      .allowedExtensions
      .has(
        originalExtension
      )
  ) {
    throw new DirectUploadError(
      "The file extension does not match the declared file type.",
      {
        statusCode:
          415,

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
    throw new DirectUploadError(
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
    throw new DirectUploadError(
      "Each protected upload must be no larger than 5 MB.",
      {
        statusCode:
          413,

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
      typeConfig
        .storedExtension,
  };
}


/*
 * ==================================================
 * SERVER-GENERATED STORAGE IDENTITY
 * ==================================================
 */

function createStoredUploadIdentity(
  metadata
) {
  const storedFilename =
    `${Date.now()}-` +
    `${crypto.randomUUID()}` +
    `${metadata.storedExtension}`;

  const objectPath =
    normalizeObjectPath(
      `${STORAGE_PREFIX}${storedFilename}`
    );

  return {
    storedFilename,
    objectPath,
  };
}


/*
 * ==================================================
 * TRUSTED ACTOR
 * ==================================================
 */

function normalizeTrustedActor(
  actor
) {
  const actorUserId =
    normalizePositiveInteger(
      actor?.userId ??
      actor?.id
    );

  const tokenVersion =
    normalizePositiveInteger(
      actor?.tokenVersion
    );

  if (
    !actorUserId ||
    !tokenVersion
  ) {
    throw new DirectUploadError(
      "A verified authenticated WELLJOB user is required.",
      {
        statusCode:
          401,

        code:
          "DIRECT_UPLOAD_ACTOR_REQUIRED",
      }
    );
  }

  return {
    actorUserId,
    tokenVersion,
  };
}


/*
 * ==================================================
 * DESCRIPTOR CONTEXT
 * ==================================================
 */

function normalizeDescriptorContext(
  context = {}
) {
  if (
    !context ||
    typeof context !==
      "object" ||
    Array.isArray(
      context
    )
  ) {
    throw new DirectUploadError(
      "Invalid upload context.",
      {
        code:
          "INVALID_UPLOAD_CONTEXT",
      }
    );
  }

  const normalized = {};

  if (
    context.employeeId !==
      undefined &&
    context.employeeId !==
      null &&
    String(
      context.employeeId
    ).trim() !==
      ""
  ) {
    const employeeId =
      normalizePositiveInteger(
        context.employeeId
      );

    if (!employeeId) {
      throw new DirectUploadError(
        "Invalid employee upload context.",
        {
          code:
            "INVALID_EMPLOYEE_UPLOAD_CONTEXT",
        }
      );
    }

    normalized.employeeId =
      employeeId;
  }

  if (
    context.incidentId !==
      undefined &&
    context.incidentId !==
      null &&
    String(
      context.incidentId
    ).trim() !==
      ""
  ) {
    const incidentId =
      normalizePositiveInteger(
        context.incidentId
      );

    if (!incidentId) {
      throw new DirectUploadError(
        "Invalid incident upload context.",
        {
          code:
            "INVALID_INCIDENT_UPLOAD_CONTEXT",
        }
      );
    }

    normalized.incidentId =
      incidentId;
  }

  if (
    context.workflowAction !==
      undefined &&
    context.workflowAction !==
      null &&
    String(
      context.workflowAction
    ).trim() !==
      ""
  ) {
    const workflowAction =
      normalizeWorkflowAction(
        context.workflowAction
      );

    if (!workflowAction) {
      throw new DirectUploadError(
        "Invalid incident evidence workflow action.",
        {
          code:
            "INVALID_EVIDENCE_WORKFLOW_ACTION",
        }
      );
    }

    normalized.workflowAction =
      workflowAction;
  }

  return normalized;
}


/*
 * Enforce required context for each operation.
 */
function assertPurposeContext(
  uploadType,
  purpose,
  context
) {
  if (
    uploadType ===
      DIRECT_UPLOAD_TYPES
        .EMPLOYEE_DOCUMENT &&
    purpose ===
      DIRECT_UPLOAD_PURPOSES
        .EMPLOYEE_CREATE
  ) {
    if (
      context.employeeId ||
      context.incidentId ||
      context.workflowAction
    ) {
      throw new DirectUploadError(
        "Employee-create document authorization contains invalid context.",
        {
          code:
            "INVALID_EMPLOYEE_CREATE_CONTEXT",
        }
      );
    }

    return;
  }

  if (
    uploadType ===
      DIRECT_UPLOAD_TYPES
        .EMPLOYEE_DOCUMENT &&
    purpose ===
      DIRECT_UPLOAD_PURPOSES
        .EMPLOYEE_UPDATE
  ) {
    if (
      !context.employeeId ||
      context.incidentId ||
      context.workflowAction
    ) {
      throw new DirectUploadError(
        "Employee-update document authorization requires the target employee ID.",
        {
          code:
            "INVALID_EMPLOYEE_UPDATE_CONTEXT",
        }
      );
    }

    return;
  }

  if (
    uploadType ===
      DIRECT_UPLOAD_TYPES
        .INCIDENT_EVIDENCE &&
    purpose ===
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_CREATE
  ) {
    if (
      !context.employeeId ||
      context.incidentId ||
      context.workflowAction
    ) {
      throw new DirectUploadError(
        "Incident-create evidence authorization requires the target employee ID.",
        {
          code:
            "INVALID_INCIDENT_CREATE_CONTEXT",
        }
      );
    }

    return;
  }

  if (
    uploadType ===
      DIRECT_UPLOAD_TYPES
        .INCIDENT_EVIDENCE &&
    purpose ===
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_WORKFLOW
  ) {
    if (
      !context.incidentId ||
      !context.workflowAction ||
      context.employeeId
    ) {
      throw new DirectUploadError(
        "Incident-workflow evidence authorization requires an incident ID and proof-submission workflow action.",
        {
          code:
            "INVALID_INCIDENT_WORKFLOW_CONTEXT",
        }
      );
    }

    return;
  }

  throw new DirectUploadError(
    "The upload type and purpose combination is invalid.",
    {
      code:
        "INVALID_UPLOAD_PURPOSE_COMBINATION",
    }
  );
}


/*
 * ==================================================
 * DOMAIN-SEPARATED SIGNING KEY
 * ==================================================
 */

function getDescriptorSigningKey() {
  const jwtSecret =
    String(
      process.env.JWT_SECRET ||
      ""
    ).trim();

  if (!jwtSecret) {
    throw new DirectUploadError(
      "Direct upload security is not configured.",
      {
        statusCode:
          500,

        code:
          "DIRECT_UPLOAD_CONFIGURATION_ERROR",
      }
    );
  }

  /*
   * Derive a separate key instead of signing upload
   * descriptors with the raw login JWT key.
   */
  return crypto
    .createHmac(
      "sha256",
      jwtSecret
    )
    .update(
      DESCRIPTOR_KEY_CONTEXT
    )
    .digest();
}


/*
 * ==================================================
 * CREATE SIGNED DESCRIPTOR
 * ==================================================
 */

function createDirectUploadDescriptor({
  actor,
  uploadType,
  purpose,
  metadata,
  storedFilename,
  objectPath,
  context = {},
}) {
  const {
    actorUserId,
    tokenVersion,
  } =
    normalizeTrustedActor(
      actor
    );

  const normalizedUploadType =
    String(
      uploadType ||
      ""
    ).trim();

  const normalizedPurpose =
    String(
      purpose ||
      ""
    ).trim();

  if (
    !VALID_UPLOAD_TYPES.has(
      normalizedUploadType
    )
  ) {
    throw new DirectUploadError(
      "Invalid direct upload type.",
      {
        code:
          "INVALID_UPLOAD_TYPE",
      }
    );
  }

  if (
    !VALID_UPLOAD_PURPOSES.has(
      normalizedPurpose
    )
  ) {
    throw new DirectUploadError(
      "Invalid direct upload purpose.",
      {
        code:
          "INVALID_UPLOAD_PURPOSE",
      }
    );
  }

  const validatedMetadata =
    validateClientUploadMetadata(
      metadata,
      0
    );

  const normalizedContext =
    normalizeDescriptorContext(
      context
    );

  assertPurposeContext(
    normalizedUploadType,
    normalizedPurpose,
    normalizedContext
  );

  const normalizedObjectPath =
    normalizeObjectPath(
      objectPath
    );

  if (
    !normalizedObjectPath.startsWith(
      STORAGE_PREFIX
    )
  ) {
    throw new DirectUploadError(
      "Invalid protected Storage path.",
      {
        code:
          "INVALID_STORAGE_PATH",
      }
    );
  }

  const normalizedStoredFilename =
    String(
      storedFilename ||
      ""
    ).trim();

  if (
    !normalizedStoredFilename ||
    path.posix.basename(
      normalizedObjectPath
    ) !==
      normalizedStoredFilename
  ) {
    throw new DirectUploadError(
      "Stored filename does not match the protected Storage path.",
      {
        code:
          "STORAGE_IDENTITY_MISMATCH",
      }
    );
  }

  const storedExtension =
    path
      .extname(
        normalizedObjectPath
      )
      .toLowerCase();

  if (
    storedExtension !==
    validatedMetadata
      .storedExtension
  ) {
    throw new DirectUploadError(
      "Protected Storage extension does not match the declared file type.",
      {
        code:
          "STORAGE_EXTENSION_MISMATCH",
      }
    );
  }

  const payload = {
    v:
      DESCRIPTOR_VERSION,

    kind:
      "welljob_direct_upload",

    actorUserId,

    tokenVersion,

    uploadType:
      normalizedUploadType,

    purpose:
      normalizedPurpose,

    originalName:
      validatedMetadata
        .originalName,

    mimeType:
      validatedMetadata
        .mimeType,

    size:
      validatedMetadata
        .size,

    storedFilename:
      normalizedStoredFilename,

    objectPath:
      normalizedObjectPath,

    context:
      normalizedContext,
  };

  return jwt.sign(
    payload,
    getDescriptorSigningKey(),
    {
      algorithm:
        "HS256",

      expiresIn:
        DESCRIPTOR_TTL_SECONDS,

      issuer:
        DESCRIPTOR_ISSUER,

      audience:
        DESCRIPTOR_AUDIENCE,

      subject:
        String(
          actorUserId
        ),

      jwtid:
        crypto.randomUUID(),
    }
  );
}


/*
 * ==================================================
 * VERIFY SIGNED DESCRIPTOR
 * ==================================================
 */

function verifyDirectUploadDescriptor(
  descriptor,
  {
    actor,
    expectedUploadType,
    expectedPurpose,
    expectedContext = {},
  }
) {
  const cleanDescriptor =
    String(
      descriptor ||
      ""
    ).trim();

  if (!cleanDescriptor) {
    throw new DirectUploadError(
      "A direct upload descriptor is required.",
      {
        code:
          "DIRECT_UPLOAD_DESCRIPTOR_REQUIRED",
      }
    );
  }

  const trustedActor =
    normalizeTrustedActor(
      actor
    );

  let payload;

  try {
    payload =
      jwt.verify(
        cleanDescriptor,
        getDescriptorSigningKey(),
        {
          algorithms: [
            "HS256",
          ],

          issuer:
            DESCRIPTOR_ISSUER,

          audience:
            DESCRIPTOR_AUDIENCE,
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      throw new DirectUploadError(
        "The direct upload authorization has expired. Please upload the file again.",
        {
          statusCode:
            410,

          code:
            "DIRECT_UPLOAD_DESCRIPTOR_EXPIRED",
        }
      );
    }

    throw new DirectUploadError(
      "The direct upload authorization is invalid.",
      {
        statusCode:
          400,

        code:
          "INVALID_DIRECT_UPLOAD_DESCRIPTOR",
      }
    );
  }

  if (
    !payload ||
    typeof payload !==
      "object" ||
    Array.isArray(
      payload
    ) ||
    payload.v !==
      DESCRIPTOR_VERSION ||
    payload.kind !==
      "welljob_direct_upload"
  ) {
    throw new DirectUploadError(
      "The direct upload authorization format is invalid.",
      {
        code:
          "INVALID_DIRECT_UPLOAD_DESCRIPTOR",
      }
    );
  }

  if (
    Number(
      payload.actorUserId
    ) !==
      trustedActor
        .actorUserId ||
    Number(
      payload.tokenVersion
    ) !==
      trustedActor
        .tokenVersion ||
    String(
      payload.sub ||
      ""
    ) !==
      String(
        trustedActor
          .actorUserId
      )
  ) {
    throw new DirectUploadError(
      "This uploaded file was not authorized for the current authenticated session.",
      {
        statusCode:
          403,

        code:
          "DIRECT_UPLOAD_ACTOR_MISMATCH",
      }
    );
  }

  if (
    payload.uploadType !==
    expectedUploadType
  ) {
    throw new DirectUploadError(
      "The uploaded file authorization does not match this operation.",
      {
        statusCode:
          409,

        code:
          "DIRECT_UPLOAD_TYPE_MISMATCH",
      }
    );
  }

  if (
    payload.purpose !==
    expectedPurpose
  ) {
    throw new DirectUploadError(
      "The uploaded file authorization does not match this operation purpose.",
      {
        statusCode:
          409,

        code:
          "DIRECT_UPLOAD_PURPOSE_MISMATCH",
      }
    );
  }

  const descriptorContext =
    normalizeDescriptorContext(
      payload.context ||
      {}
    );

  assertPurposeContext(
    payload.uploadType,
    payload.purpose,
    descriptorContext
  );

  const normalizedExpectedContext =
    normalizeDescriptorContext(
      expectedContext
    );

  for (
    const [
      key,
      expectedValue,
    ] of Object.entries(
      normalizedExpectedContext
    )
  ) {
    if (
      descriptorContext[
        key
      ] !==
      expectedValue
    ) {
      throw new DirectUploadError(
        "The uploaded file authorization does not match the requested employee or incident context.",
        {
          statusCode:
            409,

          code:
            "DIRECT_UPLOAD_CONTEXT_MISMATCH",
        }
      );
    }
  }

  const metadata =
    validateClientUploadMetadata(
      {
        name:
          payload.originalName,

        type:
          payload.mimeType,

        size:
          payload.size,
      },
      0
    );

  const objectPath =
    normalizeObjectPath(
      payload.objectPath
    );

  if (
    !objectPath.startsWith(
      STORAGE_PREFIX
    )
  ) {
    throw new DirectUploadError(
      "The uploaded file references an invalid protected Storage path.",
      {
        code:
          "INVALID_STORAGE_PATH",
      }
    );
  }

  const storedFilename =
    String(
      payload.storedFilename ||
      ""
    ).trim();

  if (
    !storedFilename ||
    path.posix.basename(
      objectPath
    ) !==
      storedFilename
  ) {
    throw new DirectUploadError(
      "The direct upload Storage identity is invalid.",
      {
        code:
          "STORAGE_IDENTITY_MISMATCH",
      }
    );
  }

  if (
    path
      .extname(
        objectPath
      )
      .toLowerCase() !==
    metadata.storedExtension
  ) {
    throw new DirectUploadError(
      "The uploaded Storage object extension does not match the authorized MIME type.",
      {
        code:
          "STORAGE_EXTENSION_MISMATCH",
      }
    );
  }

  return {
    actorUserId:
      trustedActor
        .actorUserId,

    tokenVersion:
      trustedActor
        .tokenVersion,

    uploadType:
      payload.uploadType,

    purpose:
      payload.purpose,

    originalName:
      metadata.originalName,

    mimeType:
      metadata.mimeType,

    size:
      metadata.size,

    storedFilename,

    objectPath,

    context:
      descriptorContext,

    descriptorId:
      payload.jti ||
      null,

    issuedAt:
      payload.iat ||
      null,

    expiresAt:
      payload.exp ||
      null,
  };
}


/*
 * ==================================================
 * VERIFY ACTUAL SUPABASE OBJECT
 * ==================================================
 *
 * Client metadata and descriptor metadata are not
 * enough.
 *
 * After the browser completes its direct upload,
 * WELLJOB downloads the private object server-side
 * and verifies:
 *
 * - exact declared byte length
 * - 5 MB application limit
 * - actual magic bytes
 *
 * The binary is never returned through Vercel.
 */
async function verifyStoredDirectUpload(
  verifiedDescriptor
) {
  if (
    !verifiedDescriptor ||
    typeof verifiedDescriptor !==
      "object"
  ) {
    throw new DirectUploadError(
      "Verified direct upload metadata is required.",
      {
        code:
          "VERIFIED_UPLOAD_REQUIRED",
      }
    );
  }

  const objectPath =
    normalizeObjectPath(
      verifiedDescriptor
        .objectPath
    );

  const expectedMimeType =
    normalizeMimeType(
      verifiedDescriptor
        .mimeType
    );

  const typeConfig =
    FILE_TYPE_CONFIG[
      expectedMimeType
    ];

  if (!typeConfig) {
    throw new DirectUploadError(
      "Unsupported protected upload type.",
      {
        statusCode:
          415,

        code:
          "UNSUPPORTED_FILE_TYPE",
      }
    );
  }

  const expectedSize =
    Number(
      verifiedDescriptor
        .size
    );

  if (
    !Number.isSafeInteger(
      expectedSize
    ) ||
    expectedSize <= 0 ||
    expectedSize >
      MAX_FILE_SIZE
  ) {
    throw new DirectUploadError(
      "The authorized file size is invalid.",
      {
        code:
          "INVALID_AUTHORIZED_FILE_SIZE",
      }
    );
  }

  let buffer;

  try {
    buffer =
      await downloadBuffer(
        objectPath
      );
  } catch (error) {
    throw new DirectUploadError(
      "The uploaded Storage object could not be verified. Please upload the file again.",
      {
        statusCode:
          400,

        code:
          "DIRECT_UPLOAD_OBJECT_NOT_FOUND",
      }
    );
  }

  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length === 0
  ) {
    throw new DirectUploadError(
      "The uploaded file is empty or invalid.",
      {
        statusCode:
          415,

        code:
          "INVALID_UPLOADED_OBJECT",
      }
    );
  }

  if (
    buffer.length >
    MAX_FILE_SIZE
  ) {
    throw new DirectUploadError(
      "The uploaded file exceeds the 5 MB limit.",
      {
        statusCode:
          413,

        code:
          "UPLOADED_OBJECT_TOO_LARGE",
      }
    );
  }

  if (
    buffer.length !==
    expectedSize
  ) {
    throw new DirectUploadError(
      "The uploaded file size does not match the authorized file.",
      {
        statusCode:
          409,

        code:
          "DIRECT_UPLOAD_SIZE_MISMATCH",
      }
    );
  }

  if (
    !typeConfig
      .signatureMatches(
        buffer
      )
  ) {
    throw new DirectUploadError(
      "The uploaded file content does not match its authorized file type.",
      {
        statusCode:
          415,

        code:
          "DIRECT_UPLOAD_SIGNATURE_MISMATCH",
      }
    );
  }

  /*
   * Do not return the Buffer.
   *
   * Finalization only needs verified metadata.
   * This prevents the controller from retaining
   * large binary objects in memory.
   */
  return {
    objectPath,

    storedFilename:
      verifiedDescriptor
        .storedFilename,

    originalName:
      verifiedDescriptor
        .originalName,

    mimeType:
      expectedMimeType,

    size:
      buffer.length,
  };
}


/*
 * ==================================================
 * MULTER-COMPATIBLE PSEUDO FILE
 * ==================================================
 *
 * Existing controllers already depend on:
 *
 * file.fieldname
 * file.originalname
 * file.mimetype
 * file.size
 * file.filename
 * file.path
 * file.storagePath
 *
 * Hydrating this shape lets us preserve the proven
 * employee/incident transaction logic.
 */
function createPseudoFile(
  verifiedUpload,
  {
    fieldname,
  }
) {
  const cleanFieldName =
    String(
      fieldname ||
      ""
    ).trim();

  if (!cleanFieldName) {
    throw new DirectUploadError(
      "A final upload field name is required.",
      {
        code:
          "DIRECT_UPLOAD_FIELD_REQUIRED",
      }
    );
  }

  return {
    fieldname:
      cleanFieldName,

    originalname:
      verifiedUpload
        .originalName,

    encoding:
      "7bit",

    mimetype:
      verifiedUpload
        .mimeType,

    size:
      verifiedUpload
        .size,

    filename:
      verifiedUpload
        .storedFilename,

    path:
      verifiedUpload
        .objectPath,

    storagePath:
      verifiedUpload
        .objectPath,

    directUpload:
      true,
  };
}


module.exports = {
  MAX_FILE_SIZE,
  STORAGE_PREFIX,
  DESCRIPTOR_TTL_SECONDS,

  DIRECT_UPLOAD_TYPES,
  DIRECT_UPLOAD_PURPOSES,

  DirectUploadError,

  normalizeOriginalName,
  normalizeWorkflowAction,

  validateClientUploadMetadata,
  createStoredUploadIdentity,

  createDirectUploadDescriptor,
  verifyDirectUploadDescriptor,

  verifyStoredDirectUpload,
  createPseudoFile,
};
