const crypto = require("crypto");

const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

/*
 * ==================================================
 * EMPLOYEE MOBILE HANDOFF CONTROLLER
 * ==================================================
 *
 * Purpose:
 * Securely bridge the desktop Employee module to a
 * phone for employee compliance-document capture.
 *
 * Security properties:
 * - HR Staff route authorization remains mandatory.
 * - A cryptographically random raw token is returned
 *   only to the authenticated creator.
 * - Only SHA-256(token) is stored in MySQL.
 * - The handoff is bound to the same authenticated
 *   WELLJOB user who created it.
 * - A handoff expires after 15 minutes.
 * - Resolving a handoff consumes it exactly once.
 * - Creating a replacement handoff revokes any other
 *   still-active handoff for the same user/employee.
 * - Raw tokens are never written to audit logs.
 */

const HANDOFF_PURPOSE =
  "EMPLOYEE_DOCUMENT_CAPTURE";

const HANDOFF_TTL_MINUTES =
  15;

const HANDOFF_TTL_SECONDS =
  HANDOFF_TTL_MINUTES * 60;

const HANDOFF_TOKEN_BYTES =
  32;

const HANDOFF_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

function normalizePositiveInteger(
  value
) {
  const normalized =
    typeof value === "number"
      ? value
      : Number(
          String(
            value ?? ""
          ).trim()
        );

  if (
    !Number.isSafeInteger(
      normalized
    ) ||
    normalized <= 0
  ) {
    return null;
  }

  return normalized;
}

function normalizeText(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim();
}

function getActorDisplayName(
  user
) {
  return (
    normalizeText(
      user?.fullName
    ) ||
    normalizeText(
      user?.full_name
    ) ||
    normalizeText(
      user?.name
    ) ||
    normalizeText(
      user?.username
    ) ||
    "Authorized HR Staff"
  );
}

/*
 * authMiddleware is expected to expose the canonical
 * database users.id on req.user.id.
 *
 * A positive numeric req.user.userId is accepted only
 * as a compatibility fallback. String public IDs such
 * as "USR-001" are never coerced into a database PK.
 */
function getAuthenticatedDatabaseUserId(
  req
) {
  const directId =
    normalizePositiveInteger(
      req?.user?.id
    );

  if (directId) {
    return directId;
  }

  return normalizePositiveInteger(
    req?.user?.userId
  );
}

function createRawHandoffToken() {
  return crypto
    .randomBytes(
      HANDOFF_TOKEN_BYTES
    )
    .toString(
      "base64url"
    );
}

function hashHandoffToken(
  rawToken
) {
  return crypto
    .createHash("sha256")
    .update(
      rawToken,
      "utf8"
    )
    .digest("hex");
}

function normalizeHandoffToken(
  value
) {
  const token =
    normalizeText(value);

  if (
    !HANDOFF_TOKEN_PATTERN.test(
      token
    )
  ) {
    return "";
  }

  return token;
}

function sendUnavailableHandoff(
  res
) {
  return res
    .status(410)
    .json({
      error:
        "This mobile handoff is invalid, expired, already used, revoked, or unavailable for this account. Generate a new QR code from the employee record.",
    });
}

async function writeHandoffAuditSafely({
  req,
  action,
  employeeId,
}) {
  try {
    const user =
      req?.user || {};

    await logAudit({
      userId:
        user.userId ??
        user.id,

      username:
        normalizeText(
          user.username
        ) ||
        "Unknown User",

      fullName:
        getActorDisplayName(
          user
        ),

      role:
        normalizeText(
          user.role
        ) ||
        "HR_STAFF",

      category:
        AUDIT_CATEGORY.OPERATIONAL,

      action,

      /*
       * Deliberately excludes:
       * - raw token
       * - token hash
       * - employee name
       * - birthday
       * - government numbers
       * - document metadata
       */
      description:
        `${getActorDisplayName(user)} ${action === "CREATE_EMPLOYEE_MOBILE_HANDOFF" ? "created" : "used"} a secure mobile document handoff for employee record #${employeeId}.`,
    });
  } catch (error) {
    /*
     * Handoff resolution is one-time. An audit write
     * failure must never turn a successfully consumed
     * handoff into an apparent client failure that
     * cannot be retried.
     */
    console.error(
      `Employee mobile handoff audit failed (${action}).`,
      error?.message ||
        error
    );
  }
}

async function createEmployeeMobileHandoff(
  req,
  res
) {
  const employeeId =
    normalizePositiveInteger(
      req.params?.id
    );

  if (!employeeId) {
    return res
      .status(400)
      .json({
        error:
          "A valid employee ID is required.",
      });
  }

  const creatorUserId =
    getAuthenticatedDatabaseUserId(
      req
    );

  if (!creatorUserId) {
    return res
      .status(401)
      .json({
        error:
          "Your authenticated user identity could not be verified.",
      });
  }

  let connection = null;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    /*
     * Lock the target employee so a lifecycle change
     * cannot race the handoff creation check.
     *
     * Do not impose deployment/floating rules here.
     * Mobile capture is an employee-document workflow,
     * not a deployment workflow.
     */
    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          employeeId,
        ]
      );

    if (
      employeeRows.length ===
      0
    ) {
      await connection.rollback();

      return res
        .status(404)
        .json({
          error:
            "Employee record not found.",
        });
    }

    if (
      Number(
        employeeRows[0]
          ?.archived ||
          0
      ) === 1
    ) {
      await connection.rollback();

      return res
        .status(409)
        .json({
          error:
            "Archived employee records cannot start a mobile document handoff.",
        });
    }

    /*
     * Only one live QR is kept for this employee and
     * creator. Regenerating a QR invalidates the old
     * unconsumed link immediately.
     */
    await connection.query(
      `
      UPDATE employee_mobile_handoffs
      SET revoked_at = UTC_TIMESTAMP()
      WHERE created_by_user_id = ?
        AND employee_id = ?
        AND purpose = ?
        AND consumed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
      `,
      [
        creatorUserId,
        employeeId,
        HANDOFF_PURPOSE,
      ]
    );

    const rawToken =
      createRawHandoffToken();

    const tokenHash =
      hashHandoffToken(
        rawToken
      );

    const [
      insertResult,
    ] =
      await connection.query(
        `
        INSERT INTO employee_mobile_handoffs
        (
          token_hash,
          employee_id,
          created_by_user_id,
          purpose,
          expires_at
        )
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          DATE_ADD(
            UTC_TIMESTAMP(),
            INTERVAL ${HANDOFF_TTL_MINUTES} MINUTE
          )
        )
        `,
        [
          tokenHash,
          employeeId,
          creatorUserId,
          HANDOFF_PURPOSE,
        ]
      );

    const [
      createdRows,
    ] =
      await connection.query(
        `
        SELECT
          DATE_FORMAT(
            expires_at,
            '%Y-%m-%dT%H:%i:%sZ'
          ) AS expires_at
        FROM employee_mobile_handoffs
        WHERE id = ?
        LIMIT 1
        `,
        [
          insertResult.insertId,
        ]
      );

    await connection.commit();

    await writeHandoffAuditSafely({
      req,
      action:
        "CREATE_EMPLOYEE_MOBILE_HANDOFF",
      employeeId,
    });

    return res
      .status(201)
      .json({
        token:
          rawToken,

        expiresAt:
          createdRows[0]
            ?.expires_at ||
          null,

        expiresInSeconds:
          HANDOFF_TTL_SECONDS,

        purpose:
          HANDOFF_PURPOSE,
      });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original error.
      }
    }

    console.error(
      "Create employee mobile handoff failed:",
      error?.message ||
        error
    );

    return res
      .status(500)
      .json({
        error:
          "Unable to create the mobile document handoff.",
      });
  } finally {
    connection?.release();
  }
}

async function resolveEmployeeMobileHandoff(
  req,
  res
) {
  const rawToken =
    normalizeHandoffToken(
      req.body?.token
    );

  if (!rawToken) {
    return res
      .status(400)
      .json({
        error:
          "A valid mobile handoff token is required.",
      });
  }

  const currentUserId =
    getAuthenticatedDatabaseUserId(
      req
    );

  if (!currentUserId) {
    return res
      .status(401)
      .json({
        error:
          "Your authenticated user identity could not be verified.",
      });
  }

  const tokenHash =
    hashHandoffToken(
      rawToken
    );

  let connection = null;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    /*
     * Row locking makes redemption atomic. Two tabs or
     * two phones cannot successfully consume the same
     * handoff at the same time.
     */
    const [
      rows,
    ] =
      await connection.query(
        `
        SELECT
          h.id,
          h.employee_id,
          h.created_by_user_id,
          h.purpose,
          h.expires_at,
          h.consumed_at,
          h.revoked_at,
          CASE
            WHEN h.expires_at <= UTC_TIMESTAMP()
              THEN 1
            ELSE 0
          END AS is_expired,
          e.name AS employee_name,
          e.archived AS employee_archived
        FROM employee_mobile_handoffs AS h
        INNER JOIN employees AS e
          ON e.id =
            h.employee_id
        WHERE h.token_hash = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          tokenHash,
        ]
      );

    if (
      rows.length ===
      0
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    const handoff =
      rows[0];

    if (
      Number(
        handoff.created_by_user_id
      ) !==
      currentUserId
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    if (
      normalizeText(
        handoff.purpose
      ) !==
      HANDOFF_PURPOSE
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    if (
      handoff.revoked_at
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    if (
      handoff.consumed_at
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    /*
     * Expiry is computed inside the locked MySQL row
     * read using UTC_TIMESTAMP(). This avoids sending
     * a DATETIME through the Node.js Date/timezone
     * conversion path before comparing it.
     */
    if (
      Number(
        handoff.is_expired ||
          0
      ) === 1
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    if (
      Number(
        handoff.employee_archived ||
          0
      ) === 1
    ) {
      await connection.rollback();

      return res
        .status(409)
        .json({
          error:
            "This employee record is archived and can no longer use mobile document capture.",
        });
    }

    const [
      consumeResult,
    ] =
      await connection.query(
        `
        UPDATE employee_mobile_handoffs
        SET consumed_at =
          UTC_TIMESTAMP()
        WHERE id = ?
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at >
            UTC_TIMESTAMP()
      `,
        [
          handoff.id,
        ]
      );

    if (
      Number(
        consumeResult.affectedRows ||
          0
      ) !== 1
    ) {
      await connection.rollback();

      return sendUnavailableHandoff(
        res
      );
    }

    await connection.commit();

    await writeHandoffAuditSafely({
      req,
      action:
        "USE_EMPLOYEE_MOBILE_HANDOFF",
      employeeId:
        Number(
          handoff.employee_id
        ),
    });

    return res.json({
      employee: {
        id:
          Number(
            handoff.employee_id
          ),

        name:
          normalizeText(
            handoff.employee_name
          ),
      },

      purpose:
        HANDOFF_PURPOSE,

      consumed:
        true,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original error.
      }
    }

    console.error(
      "Resolve employee mobile handoff failed:",
      error?.message ||
        error
    );

    return res
      .status(500)
      .json({
        error:
          "Unable to activate the mobile document handoff.",
      });
  } finally {
    connection?.release();
  }
}

module.exports = {
  createEmployeeMobileHandoff,
  resolveEmployeeMobileHandoff,
};