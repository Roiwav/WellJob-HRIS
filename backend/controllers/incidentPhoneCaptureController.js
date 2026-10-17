const crypto = require("crypto");

const db = require("../config/db");

const {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  removeObject,
  isStorageNotFoundError,
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
  verifyStoredDirectUpload,
} = require("../services/directUploadSecurityService");

const {
  evaluateProofSubmission,
} = require("../utils/incidentInvestigationPolicy");


/*
 * ==================================================
 * WELLJOB INCIDENT PHONE CAMERA CAPTURE
 * ==================================================
 *
 * One reusable capture bridge for BOTH:
 *
 * 1. INCIDENT CREATE
 *    - Add Incident
 *    - Initial NTE / supporting evidence
 *    - employeeId context
 *
 * 2. INCIDENT WORKFLOW
 *    - Resolution / Investigation Proof
 *    - incidentId + workflowAction context
 *
 * IMPORTANT LIMIT MODEL
 * ---------------------
 *
 * The overall Incident evidence limit is handled by
 * the normal Incident create/workflow finalization
 * pipeline. The target limit is 10 evidence items.
 *
 * This controller intentionally authorizes ONE phone
 * image per capture session. That is not the Incident
 * evidence limit. It keeps one QR handoff atomic:
 *
 *   scan -> capture/retake -> use photo -> desktop
 *
 * The desktop may create additional capture sessions
 * for additional phone photos until the shared
 * 10-evidence limit is reached.
 *
 * Desktop/laptop file uploads remain available and may
 * be combined with phone-captured images in the final
 * directUploads array.
 *
 * Security model:
 *
 * - Desktop session create/status/cancel/consume:
 *   normal WELLJOB JWT + HR_MANAGER / HR_COORDINATOR.
 *
 * - Phone:
 *   NO WELLJOB JWT.
 *
 * - QR:
 *   high-entropy opaque token only.
 *
 * - Database:
 *   stores SHA-256(token), never the raw QR token.
 *
 * - Public phone responses:
 *   no employee name, company, incident description,
 *   violation, investigator, or user profile data.
 *
 * - Storage:
 *   private Supabase bucket + server-generated path.
 *
 * - Final save:
 *   still goes through existing WELLJOB signed
 *   descriptor verification, context verification,
 *   byte-size verification, and magic-byte checking.
 */

const CAPTURE_SESSION_TTL_SECONDS =
  10 * 60;

const CAPTURE_PREVIEW_TTL_SECONDS =
  5 * 60;

/*
 * One image per QR capture session.
 *
 * This is intentionally NOT the overall Incident
 * evidence maximum. Add Incident and workflow proof
 * are being aligned to a shared 10-evidence limit.
 */
const MAX_PHONE_CAPTURE_FILES_PER_SESSION =
  1;

const PHONE_CAPTURE_ALLOWED_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
  ]);

const PHONE_CAPTURE_STATUSES =
  Object.freeze({
    WAITING:
      "WAITING",

    UPLOAD_AUTHORIZED:
      "UPLOAD_AUTHORIZED",

    UPLOADED:
      "UPLOADED",

    CONSUMED:
      "CONSUMED",

    CANCELLED:
      "CANCELLED",
  });

const DESKTOP_CAPTURE_ROLES =
  new Set([
    "HR_MANAGER",
    "HR_COORDINATOR",
  ]);


class IncidentPhoneCaptureError
  extends Error {
  constructor(
    message,
    {
      statusCode =
        400,

      code =
        "INCIDENT_PHONE_CAPTURE_ERROR",
    } = {}
  ) {
    super(
      message
    );

    this.name =
      "IncidentPhoneCaptureError";

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
  const raw =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      raw
    )
  ) {
    return null;
  }

  const numericValue =
    Number(
      raw
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


function normalizeRole(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}


function normalizeCompany(
  value
) {
  return String(
    value || ""
  )
    .trim();
}


function normalizeSessionId(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        normalized
      )
      ? normalized
      : null
  );
}


function normalizeCaptureToken(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  /*
   * Current tokens:
   * 32 random bytes encoded as base64url
   * (normally 43 characters).
   */
  if (
    !/^[A-Za-z0-9_-]{40,128}$/
      .test(
        normalized
      )
  ) {
    return null;
  }

  return normalized;
}


function getPublicCaptureToken(
  req
) {
  return normalizeCaptureToken(
    req.body?.captureToken ??
    req.body?.capture_token
  );
}


function hashCaptureToken(
  token
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      token,
      "utf8"
    )
    .digest(
      "hex"
    );
}


function getTrustedUserId(
  user
) {
  return normalizePositiveInteger(
    user?.userId ??
    user?.id
  );
}


function getTrustedTokenVersion(
  user
) {
  return normalizePositiveInteger(
    user?.tokenVersion
  );
}


function getUtcDateTimeString(
  date
) {
  return date
    .toISOString()
    .slice(
      0,
      19
    )
    .replace(
      "T",
      " "
    );
}


function normalizeCapturePurpose(
  value,
  body = {}
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
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_CREATE ||
    normalized ===
      "create" ||
    normalized ===
      "add_incident" ||
    normalized ===
      "incident"
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .INCIDENT_CREATE;
  }

  if (
    normalized ===
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_WORKFLOW ||
    normalized ===
      "workflow" ||
    normalized ===
      "proof" ||
    normalized ===
      "resolution_proof" ||
    normalized ===
      "investigation_proof"
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .INCIDENT_WORKFLOW;
  }

  /*
   * Backward-compatible inference for the first
   * Add-Incident-only implementation.
   */
  const hasEmployeeId =
    normalizePositiveInteger(
      body?.employeeId ??
      body?.employee_id
    );

  const hasIncidentId =
    normalizePositiveInteger(
      body?.incidentId ??
      body?.incident_id
    );

  if (
    hasEmployeeId &&
    !hasIncidentId
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .INCIDENT_CREATE;
  }

  if (
    hasIncidentId &&
    !hasEmployeeId
  ) {
    return DIRECT_UPLOAD_PURPOSES
      .INCIDENT_WORKFLOW;
  }

  return null;
}


function getPublicStatus(
  status
) {
  switch (
    String(
      status || ""
    ).trim()
  ) {
    case PHONE_CAPTURE_STATUSES
      .WAITING:
      return "WAITING";

    case PHONE_CAPTURE_STATUSES
      .UPLOAD_AUTHORIZED:
      return "READY_FOR_UPLOAD";

    case PHONE_CAPTURE_STATUSES
      .UPLOADED:
      return "PHOTO_ADDED";

    case PHONE_CAPTURE_STATUSES
      .CONSUMED:
      return "DONE";

    case PHONE_CAPTURE_STATUSES
      .CANCELLED:
      return "CANCELLED";

    default:
      return "UNAVAILABLE";
  }
}


function assertDesktopActor(
  user
) {
  const role =
    normalizeRole(
      user?.role
    );

  const userId =
    getTrustedUserId(
      user
    );

  const tokenVersion =
    getTrustedTokenVersion(
      user
    );

  if (
    !DESKTOP_CAPTURE_ROLES.has(
      role
    ) ||
    !userId ||
    !tokenVersion
  ) {
    throw new IncidentPhoneCaptureError(
      "You are not authorized to use Incident phone capture.",
      {
        statusCode:
          403,

        code:
          "INCIDENT_PHONE_CAPTURE_FORBIDDEN",
      }
    );
  }

  return {
    role,
    userId,
    tokenVersion,

    assignedCompany:
      user?.assignedCompany ??
      user?.assigned_company ??
      "",
  };
}


/*
 * ==================================================
 * DATABASE ROW HELPERS
 * ==================================================
 */

const CAPTURE_SESSION_SELECT = `
  SELECT
    id,

    session_id AS sessionId,
    creator_user_id AS creatorUserId,

    capture_purpose AS capturePurpose,

    employee_id AS employeeId,
    incident_id AS incidentId,
    workflow_action AS workflowAction,

    status,

    original_name AS originalName,
    mime_type AS mimeType,
    file_size AS fileSize,

    stored_filename AS storedFilename,
    object_path AS objectPath,

    DATE_FORMAT(
      expires_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS expiresAt,

    DATE_FORMAT(
      upload_authorized_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS uploadAuthorizedAt,

    DATE_FORMAT(
      uploaded_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS uploadedAt,

    DATE_FORMAT(
      consumed_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS consumedAt,

    DATE_FORMAT(
      cancelled_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS cancelledAt,

    DATE_FORMAT(
      created_at,
      '%Y-%m-%dT%H:%i:%sZ'
    ) AS createdAt,

    (
      expires_at <=
      UTC_TIMESTAMP()
    ) AS isExpired
  FROM incident_phone_capture_sessions
`;


async function getSessionByTokenHash(
  tokenHash
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        ${CAPTURE_SESSION_SELECT}
        WHERE token_hash = ?
        LIMIT 1
        `,
        [
          tokenHash,
        ]
      );

  return (
    rows[0] ||
    null
  );
}


async function getSessionForDesktop(
  sessionId,
  userId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        ${CAPTURE_SESSION_SELECT}
        WHERE
          session_id = ?
          AND creator_user_id = ?
        LIMIT 1
        `,
        [
          sessionId,
          userId,
        ]
      );

  return (
    rows[0] ||
    null
  );
}


/*
 * ==================================================
 * STORAGE CLEANUP
 * ==================================================
 */

async function removeCaptureObjectSafely(
  objectPath,
  context =
    "INCIDENT PHONE CAPTURE"
) {
  const normalizedPath =
    String(
      objectPath ||
      ""
    ).trim();

  if (!normalizedPath) {
    return;
  }

  try {
    await removeObject(
      normalizedPath
    );
  } catch (error) {
    if (
      isStorageNotFoundError(
        error
      )
    ) {
      return;
    }

    console.error(
      `${context} STORAGE CLEANUP ERROR:`,
      {
        objectPath:
          normalizedPath,

        message:
          error?.message ||
          error,
      }
    );
  }
}


async function cleanupExpiredUnfinishedSessions(
  userId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          object_path AS objectPath
        FROM incident_phone_capture_sessions
        WHERE
          creator_user_id = ?
          AND status IN (?, ?)
          AND expires_at <= UTC_TIMESTAMP()
        `,
        [
          userId,

          PHONE_CAPTURE_STATUSES
            .WAITING,

          PHONE_CAPTURE_STATUSES
            .UPLOAD_AUTHORIZED,
        ]
      );

  if (
    rows.length ===
    0
  ) {
    return;
  }

  await db
    .promise()
    .query(
      `
      UPDATE incident_phone_capture_sessions
      SET
        status = ?,
        cancelled_at = UTC_TIMESTAMP()
      WHERE
        creator_user_id = ?
        AND status IN (?, ?)
        AND expires_at <= UTC_TIMESTAMP()
      `,
      [
        PHONE_CAPTURE_STATUSES
          .CANCELLED,

        userId,

        PHONE_CAPTURE_STATUSES
          .WAITING,

        PHONE_CAPTURE_STATUSES
          .UPLOAD_AUTHORIZED,
      ]
    );

  for (
    const row of
    rows
  ) {
    await removeCaptureObjectSafely(
      row.objectPath,
      "EXPIRED INCIDENT PHONE CAPTURE"
    );
  }
}


async function markExpiredPublicSessionCancelled(
  session
) {
  if (
    !session?.isExpired ||
    ![
      PHONE_CAPTURE_STATUSES
        .WAITING,

      PHONE_CAPTURE_STATUSES
        .UPLOAD_AUTHORIZED,
    ].includes(
      session.status
    )
  ) {
    return session;
  }

  await db
    .promise()
    .query(
      `
      UPDATE incident_phone_capture_sessions
      SET
        status = ?,
        cancelled_at = UTC_TIMESTAMP()
      WHERE
        id = ?
        AND status IN (?, ?)
      `,
      [
        PHONE_CAPTURE_STATUSES
          .CANCELLED,

        session.id,

        PHONE_CAPTURE_STATUSES
          .WAITING,

        PHONE_CAPTURE_STATUSES
          .UPLOAD_AUTHORIZED,
      ]
    );

  await removeCaptureObjectSafely(
    session.objectPath,
    "EXPIRED PUBLIC INCIDENT PHONE CAPTURE"
  );

  return {
    ...session,

    status:
      PHONE_CAPTURE_STATUSES
        .CANCELLED,

    cancelledAt:
      new Date()
        .toISOString(),

    isExpired:
      1,
  };
}


/*
 * ==================================================
 * CREATE-INCIDENT SCOPE
 * ==================================================
 */

async function verifyEmployeeCaptureScope(
  {
    employeeId,
    actor,
  }
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          employee_id AS employeeId,
          company
        FROM deployment_assignments
        WHERE
          employee_id = ?
          AND LOWER(
            TRIM(
              status
            )
          ) = 'active'
        ORDER BY
          id DESC
        LIMIT 1
        `,
        [
          employeeId,
        ]
      );

  const deployment =
    rows[0] ||
    null;

  if (!deployment) {
    throw new IncidentPhoneCaptureError(
      "The selected employee does not have an active deployment.",
      {
        statusCode:
          409,

        code:
          "INCIDENT_CAPTURE_ACTIVE_DEPLOYMENT_REQUIRED",
      }
    );
  }

  if (
    actor.role ===
      "HR_COORDINATOR"
  ) {
    const assignedCompany =
      normalizeCompany(
        actor.assignedCompany
      );

    const employeeCompany =
      normalizeCompany(
        deployment.company
      );

    if (
      !assignedCompany ||
      !employeeCompany ||
      assignedCompany
        .toLowerCase() !==
        employeeCompany
          .toLowerCase()
    ) {
      throw new IncidentPhoneCaptureError(
        "You may capture Incident evidence only for employees assigned to your company.",
        {
          statusCode:
            403,

          code:
            "INCIDENT_CAPTURE_COMPANY_SCOPE_MISMATCH",
        }
      );
    }
  }

  return {
    employeeId:
      normalizePositiveInteger(
        deployment.employeeId
      ),

    company:
      normalizeCompany(
        deployment.company
      ),
  };
}


/*
 * ==================================================
 * WORKFLOW-PROOF SCOPE
 * ==================================================
 */

async function verifyWorkflowCaptureScope(
  {
    incidentId,
    workflowAction,
    user,
  }
) {
  const normalizedIncidentId =
    normalizePositiveInteger(
      incidentId
    );

  if (
    !normalizedIncidentId
  ) {
    throw new IncidentPhoneCaptureError(
      "A valid incident ID is required for workflow proof phone capture.",
      {
        code:
          "INCIDENT_ID_REQUIRED",
      }
    );
  }

  const normalizedWorkflowAction =
    normalizeWorkflowAction(
      workflowAction
    );

  if (
    !normalizedWorkflowAction
  ) {
    throw new IncidentPhoneCaptureError(
      "Phone capture may only be used while submitting investigation proof for review.",
      {
        code:
          "INVALID_EVIDENCE_WORKFLOW_ACTION",
      }
    );
  }

  const [incidentRows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          company,
          status,
          investigation_started_by_id,
          investigation_started_at
        FROM incidents
        WHERE id = ?
        LIMIT 1
        `,
        [
          normalizedIncidentId,
        ]
      );

  if (
    incidentRows.length ===
    0
  ) {
    throw new IncidentPhoneCaptureError(
      "Incident not found.",
      {
        statusCode:
          404,

        code:
          "INCIDENT_NOT_FOUND",
      }
    );
  }

  const proofPolicy =
    evaluateProofSubmission({
      actor:
        user,

      incident:
        incidentRows[0],
    });

  if (
    !proofPolicy.allowed
  ) {
    throw new IncidentPhoneCaptureError(
      proofPolicy.message,
      {
        statusCode:
          proofPolicy.statusCode,

        code:
          proofPolicy.code,
      }
    );
  }

  return {
    incidentId:
      normalizedIncidentId,

    workflowAction:
      normalizedWorkflowAction,
  };
}


/*
 * ==================================================
 * PURPOSE / CONTEXT
 * ==================================================
 */

function getSessionDescriptorContext(
  session
) {
  if (
    session.capturePurpose ===
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_CREATE
  ) {
    const employeeId =
      normalizePositiveInteger(
        session.employeeId
      );

    if (!employeeId) {
      throw new IncidentPhoneCaptureError(
        "The phone capture employee context is invalid.",
        {
          statusCode:
            500,

          code:
            "CAPTURE_CONTEXT_INVALID",
        }
      );
    }

    return {
      employeeId,
    };
  }

  if (
    session.capturePurpose ===
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_WORKFLOW
  ) {
    const incidentId =
      normalizePositiveInteger(
        session.incidentId
      );

    const workflowAction =
      normalizeWorkflowAction(
        session.workflowAction
      );

    if (
      !incidentId ||
      !workflowAction
    ) {
      throw new IncidentPhoneCaptureError(
        "The phone capture workflow context is invalid.",
        {
          statusCode:
            500,

          code:
            "CAPTURE_CONTEXT_INVALID",
        }
      );
    }

    return {
      incidentId,
      workflowAction,
    };
  }

  throw new IncidentPhoneCaptureError(
    "The phone capture purpose is invalid.",
    {
      statusCode:
        500,

      code:
        "CAPTURE_PURPOSE_INVALID",
    }
  );
}


function assertSupportedSessionPurpose(
  session
) {
  if (
    session?.capturePurpose !==
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_CREATE &&
    session?.capturePurpose !==
      DIRECT_UPLOAD_PURPOSES
        .INCIDENT_WORKFLOW
  ) {
    throw new IncidentPhoneCaptureError(
      "The phone capture purpose is invalid.",
      {
        statusCode:
          500,

        code:
          "CAPTURE_PURPOSE_INVALID",
      }
    );
  }

  return session.capturePurpose;
}


/*
 * ==================================================
 * PHONE FILE VALIDATION
 * ==================================================
 */

function validatePhoneCaptureMetadata(
  file,
  {
    purpose,
  }
) {
  const validated =
    validateClientUploadMetadata(
      file,
      0,
      {
        uploadType:
          DIRECT_UPLOAD_TYPES
            .INCIDENT_EVIDENCE,

        purpose,
      }
    );

  if (
    !PHONE_CAPTURE_ALLOWED_MIME_TYPES.has(
      validated.mimeType
    )
  ) {
    throw new IncidentPhoneCaptureError(
      "Phone capture must be a JPG, JPEG, or PNG image.",
      {
        statusCode:
          415,

        code:
          "UNSUPPORTED_PHONE_CAPTURE_TYPE",
      }
    );
  }

  return validated;
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
      IncidentPhoneCaptureError ||
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
          "INCIDENT_PHONE_CAPTURE_ERROR",
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
        "Unable to process the Incident phone capture request.",
    });
}


/*
 * ==================================================
 * AUTHENTICATED DESKTOP:
 * CREATE CAPTURE SESSION
 * ==================================================
 *
 * POST
 * /api/incident-evidence/phone-capture-sessions
 *
 * CREATE body:
 *
 * {
 *   "capturePurpose": "incident_create",
 *   "employeeId": 1500
 * }
 *
 * WORKFLOW body:
 *
 * {
 *   "capturePurpose": "incident_workflow",
 *   "incidentId": 123,
 *   "workflowAction": "SUBMIT_INVESTIGATION"
 * }
 *
 * Route roles:
 *
 * HR_MANAGER
 * HR_COORDINATOR
 */
exports.createIncidentPhoneCaptureSession =
  async (
    req,
    res
  ) => {
    try {
      const trustedActor =
        assertDesktopActor(
          req.user
        );

      const capturePurpose =
        normalizeCapturePurpose(
          req.body?.capturePurpose ??
          req.body?.capture_purpose ??
          req.body?.purpose,
          req.body
        );

      if (
        !capturePurpose
      ) {
        throw new IncidentPhoneCaptureError(
          "A valid Incident phone capture purpose is required.",
          {
            code:
              "INVALID_CAPTURE_PURPOSE",
          }
        );
      }

      let employeeId =
        null;

      let incidentId =
        null;

      let workflowAction =
        null;

      if (
        capturePurpose ===
          DIRECT_UPLOAD_PURPOSES
            .INCIDENT_CREATE
      ) {
        employeeId =
          normalizePositiveInteger(
            req.body?.employeeId ??
            req.body?.employee_id
          );

        if (!employeeId) {
          throw new IncidentPhoneCaptureError(
            "A valid employee ID is required before opening phone capture.",
            {
              code:
                "EMPLOYEE_ID_REQUIRED",
            }
          );
        }

        await verifyEmployeeCaptureScope({
          employeeId,

          actor:
            trustedActor,
        });
      } else {
        const workflowContext =
          await verifyWorkflowCaptureScope({
            incidentId:
              req.body?.incidentId ??
              req.body?.incident_id,

            workflowAction:
              req.body?.workflowAction ??
              req.body?.workflow_action,

            user:
              req.user,
          });

        incidentId =
          workflowContext
            .incidentId;

        workflowAction =
          workflowContext
            .workflowAction;
      }

      /*
       * Clean only abandoned sessions that never reached
       * a completed UPLOADED state.
       *
       * Completed captures are not auto-deleted because
       * the Incident may already own the Storage object
       * if its save succeeded but the follow-up consume
       * request failed.
       */
      await cleanupExpiredUnfinishedSessions(
        trustedActor.userId
      );

      const sessionId =
        crypto.randomUUID();

      const captureToken =
        crypto
          .randomBytes(
            32
          )
          .toString(
            "base64url"
          );

      const tokenHash =
        hashCaptureToken(
          captureToken
        );

      const expiresAtDate =
        new Date(
          Date.now() +
          CAPTURE_SESSION_TTL_SECONDS *
            1000
        );

      const expiresAt =
        getUtcDateTimeString(
          expiresAtDate
        );

      await db
        .promise()
        .query(
          `
          INSERT INTO incident_phone_capture_sessions (
            session_id,
            token_hash,
            creator_user_id,

            capture_purpose,

            employee_id,
            incident_id,
            workflow_action,

            status,
            expires_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            sessionId,
            tokenHash,
            trustedActor.userId,

            capturePurpose,

            employeeId,
            incidentId,
            workflowAction,

            PHONE_CAPTURE_STATUSES
              .WAITING,

            expiresAt,
          ]
        );

      return res
        .status(201)
        .json({
          success:
            true,

          sessionId,

          /*
           * Returned only to the authenticated desktop
           * so it can construct the QR/mobile URL.
           */
          captureToken,

          capturePurpose,

          expiresAt:
            expiresAtDate
              .toISOString(),

          expiresIn:
            CAPTURE_SESSION_TTL_SECONDS,

          status:
            "WAITING",
        });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "CREATE INCIDENT PHONE CAPTURE SESSION"
      );
    }
  };


/*
 * ==================================================
 * PUBLIC PHONE:
 * GET CAPTURE SESSION STATUS
 * ==================================================
 *
 * POST
 * /api/incident-evidence/phone-capture/status
 *
 * Required JSON body:
 *
 * {
 *   "captureToken": "<opaque-token>"
 * }
 *
 * The raw capture token is intentionally kept out of
 * the backend URL path/query.
 *
 * Deliberately returns no employee, company, incident,
 * workflow, or user information.
 */
exports.getIncidentPhoneCapturePublicStatus =
  async (
    req,
    res
  ) => {
    try {
      const captureToken =
        getPublicCaptureToken(
          req
        );

      if (!captureToken) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_LINK",
          }
        );
      }

      const tokenHash =
        hashCaptureToken(
          captureToken
        );

      let session =
        await getSessionByTokenHash(
          tokenHash
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid or no longer available.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      assertSupportedSessionPurpose(
        session
      );

      session =
        await markExpiredPublicSessionCancelled(
          session
        );

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CANCELLED &&
        session.isExpired
      ) {
        return res
          .status(410)
          .json({
            success:
              false,

            status:
              "EXPIRED",

            error:
              "This phone capture link has expired.",

            code:
              "CAPTURE_SESSION_EXPIRED",
          });
      }

      return res.json({
        success:
          true,

        status:
          getPublicStatus(
            session.status
          ),

        expiresAt:
          session.expiresAt,
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "GET INCIDENT PHONE CAPTURE PUBLIC STATUS"
      );
    }
  };


/*
 * ==================================================
 * PUBLIC PHONE:
 * CREATE ONE SIGNED IMAGE UPLOAD AUTHORIZATION
 * ==================================================
 *
 * POST
 * /api/incident-evidence/phone-capture/upload-authorization
 *
 * Body:
 *
 * {
 *   "captureToken": "<opaque-token>",
 *   "file": {
 *     "name": "incident-photo.jpg",
 *     "type": "image/jpeg",
 *     "size": 123456
 *   }
 * }
 *
 * The raw capture token is intentionally kept out of
 * the backend URL path/query.
 *
 * One image per QR capture session.
 *
 * This is separate from the overall 10-evidence limit.
 */
exports.createIncidentPhoneCaptureUploadAuthorization =
  async (
    req,
    res
  ) => {
    let newObjectPath =
      null;

    try {
      const captureToken =
        getPublicCaptureToken(
          req
        );

      if (!captureToken) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_LINK",
          }
        );
      }

      const tokenHash =
        hashCaptureToken(
          captureToken
        );

      let session =
        await getSessionByTokenHash(
          tokenHash
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid or no longer available.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      const capturePurpose =
        assertSupportedSessionPurpose(
          session
        );

      session =
        await markExpiredPublicSessionCancelled(
          session
        );

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CANCELLED &&
        session.isExpired
      ) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link has expired.",
          {
            statusCode:
              410,

            code:
              "CAPTURE_SESSION_EXPIRED",
          }
        );
      }

      if (
        ![
          PHONE_CAPTURE_STATUSES
            .WAITING,

          PHONE_CAPTURE_STATUSES
            .UPLOAD_AUTHORIZED,
        ].includes(
          session.status
        )
      ) {
        throw new IncidentPhoneCaptureError(
          session.status ===
            PHONE_CAPTURE_STATUSES
              .UPLOADED ||
          session.status ===
            PHONE_CAPTURE_STATUSES
              .CONSUMED
            ? "A photo has already been added for this capture session."
            : "This phone capture session is no longer available.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_SESSION_NOT_WAITING",
          }
        );
      }

      const file =
        req.body?.file ??
        (
          Array.isArray(
            req.body?.files
          )
            ? req.body.files[0]
            : null
        );

      if (
        Array.isArray(
          req.body?.files
        ) &&
        req.body.files.length >
          MAX_PHONE_CAPTURE_FILES_PER_SESSION
      ) {
        throw new IncidentPhoneCaptureError(
          "Use one photo at a time for phone capture.",
          {
            code:
              "TOO_MANY_CAPTURE_FILES",
          }
        );
      }

      const metadata =
        validatePhoneCaptureMetadata(
          file,
          {
            purpose:
              capturePurpose,
          }
        );

      const {
        storedFilename,
        objectPath,
      } =
        createStoredUploadIdentity(
          metadata,
          {
            uploadType:
              DIRECT_UPLOAD_TYPES
                .INCIDENT_EVIDENCE,
          }
        );

      newObjectPath =
        objectPath;

      const authorization =
        await createSignedUploadUrl(
          objectPath,
          {
            upsert:
              false,
          }
        );

      const [updateResult] =
        await db
          .promise()
          .query(
            `
            UPDATE incident_phone_capture_sessions
            SET
              status = ?,

              original_name = ?,
              mime_type = ?,
              file_size = ?,

              stored_filename = ?,
              object_path = ?,

              upload_authorized_at = UTC_TIMESTAMP(),
              uploaded_at = NULL
            WHERE
              id = ?
              AND status IN (?, ?)
              AND expires_at > UTC_TIMESTAMP()
            `,
            [
              PHONE_CAPTURE_STATUSES
                .UPLOAD_AUTHORIZED,

              metadata.originalName,
              metadata.mimeType,
              metadata.size,

              storedFilename,
              authorization.path,

              session.id,

              PHONE_CAPTURE_STATUSES
                .WAITING,

              PHONE_CAPTURE_STATUSES
                .UPLOAD_AUTHORIZED,
            ]
          );

      if (
        Number(
          updateResult.affectedRows
        ) !== 1
      ) {
        throw new IncidentPhoneCaptureError(
          "This phone capture session changed or expired. Please scan a new QR code.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_SESSION_CHANGED",
          }
        );
      }

      /*
       * Retake/re-authorization:
       * once the new path is persisted, remove an older
       * staged object if it used another path.
       */
      if (
        session.objectPath &&
        session.objectPath !==
          authorization.path
      ) {
        await removeCaptureObjectSafely(
          session.objectPath,
          "INCIDENT PHONE CAPTURE RETAKE"
        );
      }

      return res.json({
        success:
          true,

        status:
          "READY_FOR_UPLOAD",

        signedUrl:
          authorization
            .signedUrl,

        expiresAt:
          session.expiresAt,
      });
    } catch (error) {
      if (newObjectPath) {
        await removeCaptureObjectSafely(
          newObjectPath,
          "FAILED INCIDENT PHONE CAPTURE AUTHORIZATION"
        );
      }

      return sendControllerError(
        res,
        error,
        "CREATE INCIDENT PHONE CAPTURE UPLOAD AUTHORIZATION"
      );
    }
  };


/*
 * ==================================================
 * PUBLIC PHONE:
 * COMPLETE + VERIFY UPLOADED PHOTO
 * ==================================================
 *
 * POST
 * /api/incident-evidence/phone-capture/complete
 *
 * Required JSON body:
 *
 * {
 *   "captureToken": "<opaque-token>"
 * }
 *
 * No object path, employee context, incident context,
 * or workflow context is accepted from the phone.
 * All trusted values come from the server session row.
 *
 * The raw capture token is intentionally kept out of
 * the backend URL path/query.
 */
exports.completeIncidentPhoneCaptureUpload =
  async (
    req,
    res
  ) => {
    try {
      const captureToken =
        getPublicCaptureToken(
          req
        );

      if (!captureToken) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_LINK",
          }
        );
      }

      const tokenHash =
        hashCaptureToken(
          captureToken
        );

      let session =
        await getSessionByTokenHash(
          tokenHash
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "This phone capture link is invalid or no longer available.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      const capturePurpose =
        assertSupportedSessionPurpose(
          session
        );

      session =
        await markExpiredPublicSessionCancelled(
          session
        );

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .UPLOADED ||
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CONSUMED
      ) {
        return res.json({
          success:
            true,

          status:
            getPublicStatus(
              session.status
            ),
        });
      }

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CANCELLED
      ) {
        throw new IncidentPhoneCaptureError(
          session.isExpired
            ? "This phone capture link has expired."
            : "This phone capture session was cancelled.",
          {
            statusCode:
              session.isExpired
                ? 410
                : 409,

            code:
              session.isExpired
                ? "CAPTURE_SESSION_EXPIRED"
                : "CAPTURE_SESSION_CANCELLED",
          }
        );
      }

      if (
        session.status !==
          PHONE_CAPTURE_STATUSES
            .UPLOAD_AUTHORIZED ||
        !session.objectPath ||
        !session.storedFilename ||
        !session.originalName ||
        !session.mimeType ||
        !normalizePositiveInteger(
          session.fileSize
        )
      ) {
        throw new IncidentPhoneCaptureError(
          "Upload the selected phone photo before completing capture.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_UPLOAD_NOT_READY",
          }
        );
      }

      const context =
        getSessionDescriptorContext(
          session
        );

      /*
       * Reuse existing private-object verification.
       *
       * Checks:
       * - object exists
       * - exact authorized byte length
       * - application size limit
       * - JPEG/PNG magic bytes
       */
      await verifyStoredDirectUpload({
        uploadType:
          DIRECT_UPLOAD_TYPES
            .INCIDENT_EVIDENCE,

        purpose:
          capturePurpose,

        originalName:
          session.originalName,

        mimeType:
          session.mimeType,

        size:
          Number(
            session.fileSize
          ),

        storedFilename:
          session.storedFilename,

        objectPath:
          session.objectPath,

        context,
      });

      const [updateResult] =
        await db
          .promise()
          .query(
            `
            UPDATE incident_phone_capture_sessions
            SET
              status = ?,
              uploaded_at = UTC_TIMESTAMP()
            WHERE
              id = ?
              AND status = ?
              AND expires_at > UTC_TIMESTAMP()
            `,
            [
              PHONE_CAPTURE_STATUSES
                .UPLOADED,

              session.id,

              PHONE_CAPTURE_STATUSES
                .UPLOAD_AUTHORIZED,
            ]
          );

      if (
        Number(
          updateResult.affectedRows
        ) !== 1
      ) {
        throw new IncidentPhoneCaptureError(
          "This phone capture session expired while the photo was being verified. Please scan a new QR code.",
          {
            statusCode:
              410,

            code:
              "CAPTURE_SESSION_EXPIRED",
          }
        );
      }

      return res.json({
        success:
          true,

        status:
          "PHOTO_ADDED",
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "COMPLETE INCIDENT PHONE CAPTURE UPLOAD"
      );
    }
  };


/*
 * ==================================================
 * AUTHENTICATED DESKTOP:
 * POLL / REFRESH CAPTURE SESSION
 * ==================================================
 *
 * GET
 * /api/incident-evidence/phone-capture-sessions/:sessionId
 *
 * When UPLOADED/CONSUMED:
 *
 * - temporary signed preview URL
 * - FRESH WELLJOB direct-upload descriptor
 *
 * The caller should request this endpoint again just
 * before the final Incident/workflow submit so the
 * descriptor cannot become stale while the user keeps
 * editing the desktop form.
 */
exports.getIncidentPhoneCaptureSession =
  async (
    req,
    res
  ) => {
    try {
      const trustedActor =
        assertDesktopActor(
          req.user
        );

      const sessionId =
        normalizeSessionId(
          req.params?.sessionId
        );

      if (!sessionId) {
        throw new IncidentPhoneCaptureError(
          "Invalid phone capture session ID.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_SESSION_ID",
          }
        );
      }

      let session =
        await getSessionForDesktop(
          sessionId,
          trustedActor.userId
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "Phone capture session not found.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      const capturePurpose =
        assertSupportedSessionPurpose(
          session
        );

      session =
        await markExpiredPublicSessionCancelled(
          session
        );

      const responseBody = {
        success:
          true,

        sessionId:
          session.sessionId,

        capturePurpose,

        status:
          getPublicStatus(
            session.status
          ),

        expiresAt:
          session.expiresAt,

        uploadedAt:
          session.uploadedAt ||
          null,
      };

      /*
       * Context is safe on the authenticated desktop
       * response and helps frontend consistency checks.
       */
      if (
        capturePurpose ===
          DIRECT_UPLOAD_PURPOSES
            .INCIDENT_CREATE
      ) {
        responseBody.employeeId =
          Number(
            session.employeeId
          );
      } else {
        responseBody.incidentId =
          Number(
            session.incidentId
          );

        responseBody.workflowAction =
          session.workflowAction;
      }

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .UPLOADED ||
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CONSUMED
      ) {
        if (
          !session.objectPath ||
          !session.storedFilename ||
          !session.originalName ||
          !session.mimeType ||
          !normalizePositiveInteger(
            session.fileSize
          )
        ) {
          throw new IncidentPhoneCaptureError(
            "The completed phone capture metadata is incomplete.",
            {
              statusCode:
                500,

              code:
                "CAPTURE_METADATA_INCOMPLETE",
            }
          );
        }

        /*
         * Re-check current workflow authorization before
         * issuing a fresh workflow descriptor.
         *
         * If ownership/status changed after the QR was
         * created, the desktop does not receive a usable
         * workflow descriptor.
         */
        if (
          capturePurpose ===
            DIRECT_UPLOAD_PURPOSES
              .INCIDENT_WORKFLOW
        ) {
          await verifyWorkflowCaptureScope({
            incidentId:
              session.incidentId,

            workflowAction:
              session.workflowAction,

            user:
              req.user,
          });
        }

        const context =
          getSessionDescriptorContext(
            session
          );

        const previewAuthorization =
          await createSignedDownloadUrl(
            session.objectPath,
            {
              expiresIn:
                CAPTURE_PREVIEW_TTL_SECONDS,
            }
          );

        const descriptor =
          createDirectUploadDescriptor({
            actor:
              req.user,

            uploadType:
              DIRECT_UPLOAD_TYPES
                .INCIDENT_EVIDENCE,

            purpose:
              capturePurpose,

            metadata: {
              name:
                session.originalName,

              type:
                session.mimeType,

              size:
                Number(
                  session.fileSize
                ),
            },

            storedFilename:
              session.storedFilename,

            objectPath:
              session.objectPath,

            context,
          });

        responseBody.photo = {
          name:
            session.originalName,

          type:
            session.mimeType,

          size:
            Number(
              session.fileSize
            ),

          previewUrl:
            previewAuthorization
              .signedUrl,

          previewExpiresIn:
            previewAuthorization
              .expiresIn,

          directUpload: {
            descriptor,
          },

          descriptorExpiresIn:
            DESCRIPTOR_TTL_SECONDS,
        };
      }

      return res.json(
        responseBody
      );
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "GET INCIDENT PHONE CAPTURE SESSION"
      );
    }
  };


/*
 * ==================================================
 * AUTHENTICATED DESKTOP:
 * MARK CAPTURE CONSUMED
 * ==================================================
 *
 * POST
 * /api/incident-evidence/phone-capture-sessions/:sessionId/consume
 *
 * Call only AFTER the Incident create or workflow
 * submission succeeds.
 *
 * This never deletes the object because the successful
 * Incident/workflow transaction now owns it.
 */
exports.consumeIncidentPhoneCaptureSession =
  async (
    req,
    res
  ) => {
    try {
      const trustedActor =
        assertDesktopActor(
          req.user
        );

      const sessionId =
        normalizeSessionId(
          req.params?.sessionId
        );

      if (!sessionId) {
        throw new IncidentPhoneCaptureError(
          "Invalid phone capture session ID.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_SESSION_ID",
          }
        );
      }

      const session =
        await getSessionForDesktop(
          sessionId,
          trustedActor.userId
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "Phone capture session not found.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      assertSupportedSessionPurpose(
        session
      );

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CONSUMED
      ) {
        return res.json({
          success:
            true,

          status:
            "DONE",
        });
      }

      if (
        session.status !==
          PHONE_CAPTURE_STATUSES
            .UPLOADED
      ) {
        throw new IncidentPhoneCaptureError(
          "Only a completed phone photo can be marked as used.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_NOT_UPLOADED",
          }
        );
      }

      const [updateResult] =
        await db
          .promise()
          .query(
            `
            UPDATE incident_phone_capture_sessions
            SET
              status = ?,
              consumed_at = UTC_TIMESTAMP()
            WHERE
              id = ?
              AND creator_user_id = ?
              AND status = ?
            `,
            [
              PHONE_CAPTURE_STATUSES
                .CONSUMED,

              session.id,
              trustedActor.userId,

              PHONE_CAPTURE_STATUSES
                .UPLOADED,
            ]
          );

      if (
        Number(
          updateResult.affectedRows
        ) !== 1
      ) {
        throw new IncidentPhoneCaptureError(
          "The phone capture session changed before it could be marked as used.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_SESSION_CHANGED",
          }
        );
      }

      return res.json({
        success:
          true,

        status:
          "DONE",
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "CONSUME INCIDENT PHONE CAPTURE SESSION"
      );
    }
  };


/*
 * ==================================================
 * AUTHENTICATED DESKTOP:
 * CANCEL + CLEAN STAGED CAPTURE
 * ==================================================
 *
 * DELETE
 * /api/incident-evidence/phone-capture-sessions/:sessionId
 *
 * Intended when:
 *
 * - desktop form/modal is cancelled
 * - staged phone photo is removed
 * - user starts that photo over
 *
 * A CONSUMED capture is never deleted because the
 * successful Incident/workflow transaction owns it.
 */
exports.cancelIncidentPhoneCaptureSession =
  async (
    req,
    res
  ) => {
    try {
      const trustedActor =
        assertDesktopActor(
          req.user
        );

      const sessionId =
        normalizeSessionId(
          req.params?.sessionId
        );

      if (!sessionId) {
        throw new IncidentPhoneCaptureError(
          "Invalid phone capture session ID.",
          {
            statusCode:
              404,

            code:
              "INVALID_CAPTURE_SESSION_ID",
          }
        );
      }

      const session =
        await getSessionForDesktop(
          sessionId,
          trustedActor.userId
        );

      if (!session) {
        throw new IncidentPhoneCaptureError(
          "Phone capture session not found.",
          {
            statusCode:
              404,

            code:
              "CAPTURE_SESSION_NOT_FOUND",
          }
        );
      }

      assertSupportedSessionPurpose(
        session
      );

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CONSUMED
      ) {
        throw new IncidentPhoneCaptureError(
          "This phone-captured photo is already owned by a saved Incident and cannot be cancelled.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_ALREADY_CONSUMED",
          }
        );
      }

      if (
        session.status ===
          PHONE_CAPTURE_STATUSES
            .CANCELLED
      ) {
        return res.json({
          success:
            true,

          status:
            "CANCELLED",
        });
      }

      const [updateResult] =
        await db
          .promise()
          .query(
            `
            UPDATE incident_phone_capture_sessions
            SET
              status = ?,
              cancelled_at = UTC_TIMESTAMP()
            WHERE
              id = ?
              AND creator_user_id = ?
              AND status <> ?
            `,
            [
              PHONE_CAPTURE_STATUSES
                .CANCELLED,

              session.id,
              trustedActor.userId,

              PHONE_CAPTURE_STATUSES
                .CONSUMED,
            ]
          );

      if (
        Number(
          updateResult.affectedRows
        ) !== 1
      ) {
        throw new IncidentPhoneCaptureError(
          "The phone capture session changed before it could be cancelled.",
          {
            statusCode:
              409,

            code:
              "CAPTURE_SESSION_CHANGED",
          }
        );
      }

      await removeCaptureObjectSafely(
        session.objectPath,
        "CANCEL INCIDENT PHONE CAPTURE"
      );

      return res.json({
        success:
          true,

        status:
          "CANCELLED",
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "CANCEL INCIDENT PHONE CAPTURE SESSION"
      );
    }
  };


module.exports.PHONE_CAPTURE_STATUSES =
  PHONE_CAPTURE_STATUSES;

module.exports.CAPTURE_SESSION_TTL_SECONDS =
  CAPTURE_SESSION_TTL_SECONDS;