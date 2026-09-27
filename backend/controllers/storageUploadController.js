const {
  createSignedUploadUrl,
} = require("../services/storageService");

const {
  DESCRIPTOR_TTL_SECONDS,

  DIRECT_UPLOAD_TYPES,
  DIRECT_UPLOAD_PURPOSES,

  DirectUploadError,

  normalizeWorkflowAction,

  validateClientUploadMetadata,
  createStoredUploadIdentity,

  createDirectUploadDescriptor,
} = require("../services/directUploadSecurityService");


/*
 * ==================================================
 * WELLJOB PROTECTED DIRECT-UPLOAD AUTHORIZATION
 * ==================================================
 *
 * Browser:
 *
 *   authenticated WELLJOB request
 *              ↓
 *   server validates metadata/context
 *              ↓
 *   server creates random Storage object path
 *              ↓
 *   Supabase signed upload URL
 *              +
 *   WELLJOB signed upload descriptor
 *
 * The descriptor cryptographically binds:
 *
 * - current authenticated user
 * - current token_version
 * - upload type
 * - operation/purpose
 * - file metadata
 * - server-generated object path
 * - employee / incident context
 *
 * SUPABASE_SECRET_KEY and JWT_SECRET never leave
 * the backend.
 */

const MAX_EMPLOYEE_DOCUMENTS =
  20;

const MAX_INCIDENT_EVIDENCE_FILES =
  10;


class UploadAuthorizationError
  extends Error {
  constructor(
    message,
    {
      statusCode =
        400,

      code =
        "UPLOAD_AUTHORIZATION_ERROR",
    } = {}
  ) {
    super(
      message
    );

    this.name =
      "UploadAuthorizationError";

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}


/*
 * ==================================================
 * BASIC VALIDATION
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


function normalizeEmployeePurpose(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    normalized ===
      "create" ||
    normalized ===
      "employee_create"
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .EMPLOYEE_CREATE;
  }

  if (
    normalized ===
      "update" ||
    normalized ===
      "employee_update"
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .EMPLOYEE_UPDATE;
  }

  return null;
}


/*
 * ==================================================
 * AUTHORIZATION BATCH
 * ==================================================
 */

async function createAuthorizationBatch(
  files,
  {
    maxFiles,

    actor,

    uploadType,

    purpose,

    context = {},
  }
) {
  if (
    !Array.isArray(
      files
    )
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
    files.length ===
    0
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

  /*
   * Validate every item before issuing even the first
   * signed Storage URL.
   */
  const validatedFiles =
    files.map(
      (
        file,
        index
      ) =>
        validateClientUploadMetadata(
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

    /*
     * Storage identity always comes from the backend.
     * Browser never chooses the final object path.
     */
    const {
      storedFilename,
      objectPath,
    } =
      createStoredUploadIdentity(
        file
      );

    const authorization =
      await createSignedUploadUrl(
        objectPath,
        {
          upsert:
            false,
        }
      );

    /*
     * Bind the signed Storage authorization to the
     * authenticated WELLJOB operation.
     */
    const descriptor =
      createDirectUploadDescriptor({
        actor,

        uploadType,

        purpose,

        metadata: {
          name:
            file.originalName,

          type:
            file.mimeType,

          size:
            file.size,
        },

        storedFilename,

        objectPath:
          authorization.path,

        context,
      });

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

      /*
       * Browser uses this only to send the binary
       * directly to private Supabase Storage.
       */
      signedUrl:
        authorization.signedUrl,

      token:
        authorization.token,

      /*
       * Browser must return this descriptor to
       * WELLJOB during final employee/incident save.
       */
      descriptor,
    });
  }

  return uploads;
}


/*
 * ==================================================
 * PUBLIC ERROR RESPONSE
 * ==================================================
 */

function sendControllerError(
  res,
  error,
  context
) {
  if (
    error instanceof
      UploadAuthorizationError ||
    error instanceof
      DirectUploadError
  ) {
    return res
      .status(
        Number(
          error.statusCode
        ) ||
        400
      )
      .json({
        error:
          error.message,

        code:
          error.code ||
          "UPLOAD_AUTHORIZATION_ERROR",
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
 * Existing route:
 *
 * POST
 * /api/employee-documents/upload-authorizations
 *
 * Body for CREATE:
 *
 * {
 *   "purpose": "create",
 *   "files": [...]
 * }
 *
 * Body for UPDATE:
 *
 * {
 *   "purpose": "update",
 *   "employeeId": 1500,
 *   "files": [...]
 * }
 *
 * Route roles remain:
 *
 * HR_MANAGER
 * HR_STAFF
 */
exports.createEmployeeDocumentUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const purpose =
        normalizeEmployeePurpose(
          req.body?.purpose ??
          req.body?.operation
        );

      if (!purpose) {
        throw new UploadAuthorizationError(
          "Employee document upload purpose must be create or update.",
          {
            code:
              "INVALID_EMPLOYEE_UPLOAD_PURPOSE",
          }
        );
      }

      let context = {};

      if (
        purpose ===
        DIRECT_UPLOAD_PURPOSES
          .EMPLOYEE_UPDATE
      ) {
        const employeeId =
          normalizePositiveInteger(
            req.body?.employeeId ??
            req.body?.employee_id
          );

        if (!employeeId) {
          throw new UploadAuthorizationError(
            "A valid employee ID is required when authorizing document uploads for an employee update.",
            {
              code:
                "EMPLOYEE_ID_REQUIRED",
            }
          );
        }

        context = {
          employeeId,
        };
      }

      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_EMPLOYEE_DOCUMENTS,

            actor:
              req.user,

            uploadType:
              DIRECT_UPLOAD_TYPES
                .EMPLOYEE_DOCUMENT,

            purpose,

            context,
          }
        );

      return res.json({
        success:
          true,

        uploadType:
          DIRECT_UPLOAD_TYPES
            .EMPLOYEE_DOCUMENT,

        purpose,

        context,

        descriptorExpiresIn:
          DESCRIPTOR_TTL_SECONDS,

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
 * Existing route:
 *
 * POST
 * /api/incident-evidence/upload-authorizations/create
 *
 * Required body:
 *
 * {
 *   "employeeId": 1500,
 *   "files": [...]
 * }
 *
 * The target employee ID becomes part of every
 * signed descriptor.
 *
 * Route roles remain:
 *
 * HR_MANAGER
 * HR_STAFF
 * HR_COORDINATOR
 */
exports.createIncidentEvidenceUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const employeeId =
        normalizePositiveInteger(
          req.body?.employeeId ??
          req.body?.employee_id
        );

      if (!employeeId) {
        throw new UploadAuthorizationError(
          "A valid employee ID is required for incident evidence upload authorization.",
          {
            code:
              "EMPLOYEE_ID_REQUIRED",
          }
        );
      }

      const purpose =
        DIRECT_UPLOAD_PURPOSES
          .INCIDENT_CREATE;

      const context = {
        employeeId,
      };

      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_INCIDENT_EVIDENCE_FILES,

            actor:
              req.user,

            uploadType:
              DIRECT_UPLOAD_TYPES
                .INCIDENT_EVIDENCE,

            purpose,

            context,
          }
        );

      return res.json({
        success:
          true,

        uploadType:
          DIRECT_UPLOAD_TYPES
            .INCIDENT_EVIDENCE,

        purpose,

        context,

        descriptorExpiresIn:
          DESCRIPTOR_TTL_SECONDS,

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
 * Existing route:
 *
 * POST
 * /api/incident-evidence/upload-authorizations/workflow
 *
 * Required body:
 *
 * {
 *   "incidentId": 123,
 *   "workflowAction": "SUBMIT_RESOLUTION",
 *   "files": [...]
 * }
 *
 * Allowed workflow actions:
 *
 * SUBMIT_RESOLUTION
 * SUBMIT_INVESTIGATION
 *
 * Route roles remain:
 *
 * HR_MANAGER
 * HR_STAFF
 */
exports.createIncidentWorkflowEvidenceUploadAuthorizations =
  async (
    req,
    res
  ) => {
    try {
      const incidentId =
        normalizePositiveInteger(
          req.body?.incidentId ??
          req.body?.incident_id
        );

      if (!incidentId) {
        throw new UploadAuthorizationError(
          "A valid incident ID is required for workflow evidence upload authorization.",
          {
            code:
              "INCIDENT_ID_REQUIRED",
          }
        );
      }

      const workflowAction =
        normalizeWorkflowAction(
          req.body
            ?.workflowAction
        );

      if (!workflowAction) {
        throw new UploadAuthorizationError(
          "Evidence files may only be authorized when submitting investigation proof for review.",
          {
            code:
              "INVALID_EVIDENCE_WORKFLOW_ACTION",
          }
        );
      }

      const purpose =
        DIRECT_UPLOAD_PURPOSES
          .INCIDENT_WORKFLOW;

      const context = {
        incidentId,
        workflowAction,
      };

      const uploads =
        await createAuthorizationBatch(
          req.body?.files,
          {
            maxFiles:
              MAX_INCIDENT_EVIDENCE_FILES,

            actor:
              req.user,

            uploadType:
              DIRECT_UPLOAD_TYPES
                .INCIDENT_EVIDENCE,

            purpose,

            context,
          }
        );

      return res.json({
        success:
          true,

        uploadType:
          DIRECT_UPLOAD_TYPES
            .INCIDENT_EVIDENCE,

        purpose,

        workflowAction,

        context,

        descriptorExpiresIn:
          DESCRIPTOR_TTL_SECONDS,

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
