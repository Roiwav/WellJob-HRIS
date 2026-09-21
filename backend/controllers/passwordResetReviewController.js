"use strict";

const db = require("../config/db");

const {
  newToken,
  hashToken,
} = require("../utils/recoveryHelpers");

const {
  sendRecoveryLink,
} = require("../utils/recoveryMailer");

const {
  logAudit,
} = require("../utils/auditLogger");

const {
  isAuthorizedPasswordResetReviewer,
} = require("../utils/passwordResetReviewPolicy");

/*
 * WELLJOB HRIS
 * Password Reset Request Review
 *
 * Authorized reviewers:
 *
 * IT Support:
 * - HR Staff
 * - HR Manager
 * - HR Coordinator
 * - Super Admin
 * - other IT Support accounts
 *
 * Super Admin:
 * - IT Support accounts
 *
 * No self-approval.
 *
 * Approval authorizes sending a reset link only
 * to the account's existing verified recovery email.
 *
 * Reviewers cannot choose the recipient, see the
 * reset token, or set the account owner's password.
 */

const REVIEWER_ROLES = new Set([
  "IT_SUPPORT",
  "SUPER_ADMIN",
]);

function parsePositiveId(value) {
  const text = String(value ?? "").trim();

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const id = Number(text);

  return Number.isSafeInteger(id)
    ? id
    : null;
}

function getReviewer(req) {
  const id = parsePositiveId(req.user?.id);

  const role = String(
    req.user?.role ?? ""
  ).trim();

  const tokenVersion = Number(
    req.user?.tokenVersion
  );

  if (
    !id ||
    !REVIEWER_ROLES.has(role) ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 1
  ) {
    return null;
  }

  return {
    id,
    role,
    tokenVersion,
  };
}

function errorResponse(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function auditDetails({
  reviewer,
  action,
  requestId,
  description,
}) {
  return {
    userId: reviewer.id,
    username: reviewer.username,
    fullName: reviewer.fullName,
    role: reviewer.role,
    category: "TECHNICAL",
    action,
    description:
      `Password-reset request #${requestId}. ${description}`,
  };
}

/*
 * GET /api/auth/password-reset-requests
 *
 * Returns pending requests that the authenticated
 * reviewer is authorized to process.
 *
 * Never return recovery emails, password hashes,
 * or reset tokens to the reviewer.
 */

async function listPendingPasswordResetRequests(
  req,
  res
) {
  const reviewer = getReviewer(req);

  if (!reviewer) {
    return errorResponse(
      res,
      403,
      "You are not authorized to review password-reset requests."
    );
  }

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        r.id,
        r.user_id AS requesterId,
        requester.username,
        requester.full_name AS fullName,
        requester.role AS requesterRole,
        r.requested_at AS requestedAt,
        r.expires_at AS expiresAt

      FROM password_reset_requests AS r

      INNER JOIN users AS requester
        ON requester.id = r.user_id

      WHERE r.status = 'PENDING'
        AND r.expires_at > NOW()
        AND r.user_id <> ?
        AND r.requested_token_version =
            requester.token_version
        AND requester.status = 'Active'
        AND requester.email IS NOT NULL
        AND requester.email_verified_at IS NOT NULL

        AND (
          (
            ? = 'IT_SUPPORT'
            AND requester.role IN (
              'SUPER_ADMIN',
              'HR_MANAGER',
              'HR_STAFF',
              'HR_COORDINATOR',
              'IT_SUPPORT'
            )
          )

          OR (
            ? = 'SUPER_ADMIN'
            AND requester.role = 'IT_SUPPORT'
          )
        )

      ORDER BY
        r.requested_at ASC,
        r.id ASC

      LIMIT 100
      `,
      [
        reviewer.id,
        reviewer.role,
        reviewer.role,
      ]
    );

    const requests = rows.filter((row) =>
      isAuthorizedPasswordResetReviewer({
        reviewerId: reviewer.id,
        reviewerRole: reviewer.role,
        requesterId: row.requesterId,
        requesterRole: row.requesterRole,
      })
    );

    return res.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error(
      "PASSWORD RESET REQUEST LIST ERROR:",
      error?.code || "query failed"
    );

    return errorResponse(
      res,
      503,
      "Password-reset requests are temporarily unavailable."
    );
  }
}

/*
 * Lock the current reviewer and requester accounts,
 * then lock the pending request.
 *
 * Both Approve and Reject use the same checks.
 *
 * Current database role, account status, and token
 * version remain authoritative.
 */

async function lockReviewableRequest(
  connection,
  reviewer,
  requestId
) {
  const [references] = await connection.query(
    `
    SELECT user_id

    FROM password_reset_requests

    WHERE id = ?

    LIMIT 1
    `,
    [requestId]
  );

  if (references.length !== 1) {
    return null;
  }

  const requesterId = Number(
    references[0].user_id
  );

  const [accounts] = await connection.query(
    `
    SELECT
      id,
      username,
      full_name,
      role,
      status,
      token_version,
      email,
      email_verified_at

    FROM users

    WHERE id IN (?, ?)

    ORDER BY id

    FOR UPDATE
    `,
    [
      reviewer.id,
      requesterId,
    ]
  );

  const currentReviewer = accounts.find(
    (account) =>
      Number(account.id) === reviewer.id
  );

  const requester = accounts.find(
    (account) =>
      Number(account.id) === requesterId
  );

  if (
    !currentReviewer ||
    !requester
  ) {
    return null;
  }

  if (
    currentReviewer.status !== "Active" ||
    currentReviewer.role !== reviewer.role ||
    Number(currentReviewer.token_version) !==
      reviewer.tokenVersion
  ) {
    return null;
  }

  if (
    requester.status !== "Active" ||
    !requester.email ||
    !requester.email_verified_at
  ) {
    return null;
  }

  const [requestRows] = await connection.query(
    `
    SELECT
      id,
      user_id,
      requested_token_version,
      status,
      expires_at,

      CASE
        WHEN expires_at > NOW() THEN 1
        ELSE 0
      END AS isLive

    FROM password_reset_requests

    WHERE id = ?

    LIMIT 1

    FOR UPDATE
    `,
    [requestId]
  );

  const request = requestRows[0];

  if (
    !request ||
    Number(request.user_id) !== requesterId ||
    request.status !== "PENDING" ||
    Number(request.isLive) !== 1 ||
    Number(request.requested_token_version) !==
      Number(requester.token_version)
  ) {
    return null;
  }

  const authorized =
    isAuthorizedPasswordResetReviewer({
      reviewerId: currentReviewer.id,
      reviewerRole: currentReviewer.role,
      requesterId: requester.id,
      requesterRole: requester.role,
    });

  if (!authorized) {
    return null;
  }

  return {
    request,
    requester,

    reviewer: {
      id: Number(currentReviewer.id),
      username: currentReviewer.username,
      fullName: currentReviewer.full_name,
      role: currentReviewer.role,
    },
  };
}

/*
 * Claim a request inside a database transaction.
 *
 * An approved request moves from PENDING to SENDING.
 * A rejected request moves from PENDING to REJECTED.
 *
 * After a successful claim, another reviewer can no
 * longer approve or reject the same request.
 */

async function reviewRequestInTransaction({
  reviewer,
  requestId,
  decision,
}) {
  const connection =
    await db.promise().getConnection();

  let transactionOpen = false;

  try {
    await connection.beginTransaction();

    transactionOpen = true;

    const locked = await lockReviewableRequest(
      connection,
      reviewer,
      requestId
    );

    if (!locked) {
      return {
        outcome: "UNAVAILABLE",
      };
    }

    const {
      request,
      requester,
      reviewer: currentReviewer,
    } = locked;

    if (decision === "REJECT") {
      const [result] = await connection.query(
        `
        UPDATE password_reset_requests

        SET
          status = 'REJECTED',
          reviewed_by_user_id = ?,
          reviewed_at = NOW()

        WHERE id = ?
          AND status = 'PENDING'
          AND expires_at > NOW()
        `,
        [
          currentReviewer.id,
          request.id,
        ]
      );

      if (result.affectedRows !== 1) {
        return {
          outcome: "UNAVAILABLE",
        };
      }

      await logAudit(
        auditDetails({
          reviewer: currentReviewer,
          action:
            "PASSWORD_RESET_REQUEST_REJECTED",
          requestId,
          description:
            "Request rejected by an authorized reviewer.",
        }),
        {
          connection,
          throwOnError: true,
        }
      );

      await connection.commit();

      transactionOpen = false;

      return {
        outcome: "REJECTED",
      };
    }

    if (decision !== "APPROVE") {
      return {
        outcome: "UNAVAILABLE",
      };
    }

    /*
     * Generate the token on the backend only.
     * Store its hash in users.
     *
     * Never return the token to the reviewer.
     */

    const token = newToken();
    const tokenHash = hashToken(token);

    const [accountUpdate] = await connection.query(
      `
      UPDATE users

      SET
        password_reset_token_hash = ?,
        password_reset_expires_at =
          DATE_ADD(NOW(), INTERVAL 30 MINUTE),
        password_reset_requested_at = NOW()

      WHERE id = ?
        AND token_version = ?
        AND status = 'Active'
        AND email = ?
        AND email_verified_at IS NOT NULL
      `,
      [
        tokenHash,
        requester.id,
        requester.token_version,
        requester.email,
      ]
    );

    if (accountUpdate.affectedRows !== 1) {
      return {
        outcome: "UNAVAILABLE",
      };
    }

    /*
     * The migration #12 verification columns remain
     * NULL because the simplified UI does not record
     * an independently verified identity method.
     *
     * Do not write an unverified claim to the audit log.
     */

    const [requestUpdate] =
      await connection.query(
        `
        UPDATE password_reset_requests

        SET
          status = 'SENDING',
          reviewed_by_user_id = ?,
          reviewed_at = NOW(),
          identity_verification_method = NULL,
          identity_verified_at = NULL

        WHERE id = ?
          AND status = 'PENDING'
          AND expires_at > NOW()
        `,
        [
          currentReviewer.id,
          request.id,
        ]
      );

    if (requestUpdate.affectedRows !== 1) {
      return {
        outcome: "UNAVAILABLE",
      };
    }

    await logAudit(
      auditDetails({
        reviewer: currentReviewer,
        action:
          "PASSWORD_RESET_REQUEST_APPROVED",
        requestId,
        description:
          "Request approved by an authorized reviewer; reset-email delivery pending.",
      }),
      {
        connection,
        throwOnError: true,
      }
    );

    await connection.commit();

    transactionOpen = false;

    return {
      outcome: "CLAIMED",
      requesterId: Number(requester.id),
      requesterEmail: requester.email,
      requesterTokenVersion:
        Number(requester.token_version),
      token,
      tokenHash,
    };
  } finally {
    try {
      if (transactionOpen) {
        await connection.rollback();
      }
    } finally {
      connection.release();
    }
  }
}

/*
 * If delivery fails or the account changes before
 * delivery, invalidate this request's reset token.
 *
 * SMTP failures can have an ambiguous outcome.
 * Failed requests must not be automatically retried.
 */

async function markDeliveryFailed({
  requestId,
  reviewerId,
  requesterId,
  tokenHash,
}) {
  const connection =
    await db.promise().getConnection();

  let transactionOpen = false;

  try {
    await connection.beginTransaction();

    transactionOpen = true;

    await connection.query(
      `
      UPDATE users

      SET
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL,
        password_reset_requested_at = NULL

      WHERE id = ?
        AND password_reset_token_hash = ?
      `,
      [
        requesterId,
        tokenHash,
      ]
    );

    await connection.query(
      `
      UPDATE password_reset_requests

      SET
        status = 'SEND_FAILED',
        delivery_failed_at = NOW()

      WHERE id = ?
        AND status = 'SENDING'
        AND reviewed_by_user_id = ?
      `,
      [
        requestId,
        reviewerId,
      ]
    );

    await connection.commit();

    transactionOpen = false;
  } finally {
    try {
      if (transactionOpen) {
        await connection.rollback();
      }
    } finally {
      connection.release();
    }
  }
}

/*
 * POST /api/auth/password-reset-requests/:id/approve
 *
 * Approval does not require verificationMethod or
 * identityVerified request-body fields.
 *
 * The backend sends the reset email only to the
 * account's currently registered verified email.
 */

async function approvePasswordResetRequest(
  req,
  res
) {
  const reviewer = getReviewer(req);

  const requestId = parsePositiveId(
    req.params?.id
  );

  if (!reviewer) {
    return errorResponse(
      res,
      403,
      "You are not authorized to review password-reset requests."
    );
  }

  if (!requestId) {
    return errorResponse(
      res,
      400,
      "Invalid request ID."
    );
  }

  let claim;

  try {
    claim = await reviewRequestInTransaction({
      reviewer,
      requestId,
      decision: "APPROVE",
    });
  } catch (error) {
    console.error(
      "PASSWORD RESET APPROVAL ERROR:",
      error?.code || "approval failed"
    );

    return errorResponse(
      res,
      503,
      "Unable to approve this request. Please try again later."
    );
  }

  if (claim.outcome !== "CLAIMED") {
    return errorResponse(
      res,
      409,
      "This request is unavailable, expired, or already processed."
    );
  }

  /*
   * Recheck the recipient before sending.
   * The reviewer cannot supply an alternative address.
   */

  try {
    const [accounts] = await db.promise().query(
      `
      SELECT
        email,
        email_verified_at,
        status,
        token_version,
        password_reset_token_hash

      FROM users

      WHERE id = ?

      LIMIT 1
      `,
      [claim.requesterId]
    );

    const current = accounts[0];

    const recipientStillValid =
      current &&
      current.status === "Active" &&
      current.email_verified_at &&
      current.email === claim.requesterEmail &&
      Number(current.token_version) ===
        claim.requesterTokenVersion &&
      current.password_reset_token_hash ===
        claim.tokenHash;

    if (!recipientStillValid) {
      await markDeliveryFailed({
        requestId,
        reviewerId: reviewer.id,
        requesterId: claim.requesterId,
        tokenHash: claim.tokenHash,
      });

      return errorResponse(
        res,
        409,
        "The account changed before delivery. A new request is required."
      );
    }
  } catch (error) {
    console.error(
      "PASSWORD RESET RECIPIENT CHECK ERROR:",
      error?.code || "recipient check failed"
    );

    /*
     * Never send when the verified recipient
     * cannot be confirmed.
     *
     * SENDING remains unavailable for automatic
     * retry if the result cannot be reconciled.
     */

    return errorResponse(
      res,
      503,
      "Unable to confirm the recovery-email recipient. Delivery was not attempted."
    );
  }

  try {
    await sendRecoveryLink({
      to: claim.requesterEmail,
      token: claim.token,
      type: "reset",
    });
  } catch (error) {
    console.error(
      "APPROVED PASSWORD RESET EMAIL ERROR:",
      error?.code || "delivery failed"
    );

    try {
      await markDeliveryFailed({
        requestId,
        reviewerId: reviewer.id,
        requesterId: claim.requesterId,
        tokenHash: claim.tokenHash,
      });
    } catch (recordError) {
      console.error(
        "PASSWORD RESET DELIVERY STATUS ERROR:",
        recordError?.code || "status update failed"
      );
    }

    return errorResponse(
      res,
      503,
      "Reset-email delivery could not be confirmed. The request will not be automatically retried."
    );
  }

  /*
   * The email provider accepted the message.
   *
   * Do not resend automatically if the subsequent
   * database status update fails.
   */

  try {
    const [result] = await db.promise().query(
      `
      UPDATE password_reset_requests

      SET
        status = 'SENT',
        sent_at = NOW()

      WHERE id = ?
        AND status = 'SENDING'
        AND reviewed_by_user_id = ?
      `,
      [
        requestId,
        reviewer.id,
      ]
    );

    if (result.affectedRows !== 1) {
      throw new Error(
        "Unexpected password-reset delivery state."
      );
    }

    return res.json({
      success: true,
      message:
        "Request approved. A password-reset link was sent to the account's verified recovery email.",
    });
  } catch (error) {
    console.error(
      "PASSWORD RESET SENT STATUS ERROR:",
      error?.code || "status update failed"
    );

    return errorResponse(
      res,
      503,
      "The email provider accepted the reset email, but request-status confirmation failed. Do not resend automatically."
    );
  }
}

/*
 * POST /api/auth/password-reset-requests/:id/reject
 */

async function rejectPasswordResetRequest(
  req,
  res
) {
  const reviewer = getReviewer(req);

  const requestId = parsePositiveId(
    req.params?.id
  );

  if (!reviewer) {
    return errorResponse(
      res,
      403,
      "You are not authorized to review password-reset requests."
    );
  }

  if (!requestId) {
    return errorResponse(
      res,
      400,
      "Invalid request ID."
    );
  }

  try {
    const result = await reviewRequestInTransaction({
      reviewer,
      requestId,
      decision: "REJECT",
    });

    if (result.outcome !== "REJECTED") {
      return errorResponse(
        res,
        409,
        "This request is unavailable, expired, or already processed."
      );
    }

    return res.json({
      success: true,
      message:
        "Password-reset request rejected.",
    });
  } catch (error) {
    console.error(
      "PASSWORD RESET REJECTION ERROR:",
      error?.code || "rejection failed"
    );

    return errorResponse(
      res,
      503,
      "Unable to reject this request. Please try again later."
    );
  }
}

module.exports = {
  listPendingPasswordResetRequests,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
};