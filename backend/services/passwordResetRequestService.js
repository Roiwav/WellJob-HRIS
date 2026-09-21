"use strict";

const db = require("../config/db");

const {
  normalizeRecoveryEmail,
} = require("../utils/recoveryHelpers");

/*
 * WELLJOB HRIS
 * Forgot Password - Pending Request Service
 *
 * This service ONLY creates a pending approval request.
 *
 * It does NOT:
 * - send a password-reset email;
 * - generate or return a reset token;
 * - change an account password;
 * - approve a request.
 *
 * The existing Forgot Password endpoint will be connected
 * to this service after the reviewer workflow is ready.
 */

/*
 * A pending request remains eligible for review
 * for one hour.
 *
 * This is separate from the password-reset LINK
 * expiration, which remains 30 minutes after
 * the system sends the approved reset email.
 */
const REQUEST_EXPIRATION_MINUTES = 60;

function normalizeIdentity(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasValidIdentityInput({
  email,
  username,
  fullName,
}) {
  return Boolean(
    email &&
    username &&
    fullName &&
    username.length <= 150 &&
    fullName.length <= 150
  );
}

/**
 * Creates a pending password-reset request when:
 *
 * 1. The supplied email, username, and full name
 *    match the same database account.
 *
 * 2. The account is active.
 *
 * 3. Its recovery email has already been verified.
 *
 * 4. It has no existing active pending request
 *    or currently processing reset request.
 *
 * The returned result is INTERNAL ONLY.
 *
 * The public Forgot Password endpoint must ALWAYS
 * use a generic confirmation response, regardless
 * of whether this function creates a request.
 */
async function createPendingPasswordResetRequest({
  email,
  username,
  fullName,
} = {}) {
  const normalizedEmail =
    normalizeRecoveryEmail(email);

  const normalizedUsername =
    normalizeIdentity(username);

  const normalizedFullName =
    normalizeIdentity(fullName);

  if (
    !hasValidIdentityInput({
      email: normalizedEmail,
      username: normalizedUsername,
      fullName: normalizedFullName,
    })
  ) {
    return {
      queued: false,
    };
  }

  /*
   * Acquire one dedicated connection from the
   * existing MySQL pool.
   *
   * All transaction queries must use this SAME
   * connection until commit or rollback.
   */
  const connection =
    await db.promise().getConnection();

  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    await connection.beginTransaction();

    transactionStarted = true;

    /*
     * Lock the matching user record.
     *
     * Concurrent requests for the same account
     * will be serialized through this lock.
     *
     * The registered email must already be
     * verified and the account must be active.
     */
    const [accounts] =
      await connection.query(
        `
        SELECT
          id,
          username,
          full_name,
          token_version

        FROM users

        WHERE email = ?
          AND email_verified_at IS NOT NULL
          AND status = 'Active'

        LIMIT 1

        FOR UPDATE
        `,
        [normalizedEmail]
      );

    if (accounts.length !== 1) {
      return {
        queued: false,
      };
    }

    const account = accounts[0];

    /*
     * Compare both additional identity fields
     * with the actual stored account data.
     *
     * These fields help match the request to
     * an account. They are NOT sufficient proof
     * that the requester owns that account.
     */
    const usernameMatches =
      normalizeIdentity(account.username) ===
      normalizedUsername;

    const fullNameMatches =
      normalizeIdentity(account.full_name) ===
      normalizedFullName;

    if (
      !usernameMatches ||
      !fullNameMatches
    ) {
      return {
        queued: false,
      };
    }

    /*
     * Prevent duplicate active requests.
     *
     * A pending request that has expired does
     * not block a new request.
     *
     * A SENDING request remains protected
     * against duplicate processing.
     */
    const [existingRequests] =
      await connection.query(
        `
        SELECT
          id

        FROM password_reset_requests

        WHERE user_id = ?
          AND (
            (
              status = 'PENDING'
              AND expires_at > NOW()
            )

            OR status = 'SENDING'
          )

        LIMIT 1
        `,
        [account.id]
      );

    if (existingRequests.length > 0) {
      return {
        queued: false,
      };
    }

    /*
     * Capture the current account token version.
     *
     * During approval, the backend must compare
     * this stored version against the current
     * users.token_version.
     *
     * An account change between request creation
     * and approval must invalidate the request.
     */
    const [result] =
      await connection.query(
        `
        INSERT INTO password_reset_requests
        (
          user_id,
          requested_token_version,
          status,
          requested_at,
          expires_at
        )

        VALUES
        (
          ?,
          ?,
          'PENDING',
          NOW(),
          DATE_ADD(
            NOW(),
            INTERVAL ${REQUEST_EXPIRATION_MINUTES} MINUTE
          )
        )
        `,
        [
          account.id,
          account.token_version,
        ]
      );

    await connection.commit();

    transactionCommitted = true;

    return {
      queued: true,
      requestId: result.insertId,
    };
  } finally {
    /*
     * Roll back any transaction that did not
     * successfully commit.
     *
     * This also releases the user-row lock
     * when the request is ineligible or when
     * an existing pending request is found.
     */
    try {
      if (
        transactionStarted &&
        !transactionCommitted
      ) {
        await connection.rollback();
      }
    } finally {
      connection.release();
    }
  }
}

module.exports = {
  createPendingPasswordResetRequest,
};