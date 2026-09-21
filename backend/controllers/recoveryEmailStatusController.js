"use strict";

const db = require("../config/db");

/**
 * GET /api/auth/recovery-email-status
 *
 * Returns the recovery-email status of the currently
 * authenticated user only.
 *
 * This endpoint does not expose the email address,
 * verification tokens, or other users' information.
 */
async function getRecoveryEmailStatus(req, res) {
  res.set("Cache-Control", "no-store");

  const userId = Number(
    req.user?.id ?? req.user?.userId
  );

  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    return res.status(401).json({
      message: "Please sign in again.",
    });
  }

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        email,
        email_verified_at,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Please sign in again.",
      });
    }

    const account = rows[0];

    if (
      String(account.status || "")
        .trim()
        .toUpperCase() !== "ACTIVE"
    ) {
      return res.status(403).json({
        message: "An active account is required.",
      });
    }

    const registered = Boolean(
      String(account.email || "").trim()
    );

    const verified = Boolean(
      registered && account.email_verified_at
    );

    return res.status(200).json({
      registered,
      verified,
    });
  } catch (error) {
    console.error(
      "GET RECOVERY EMAIL STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load recovery email status.",
    });
  }
}

module.exports = {
  getRecoveryEmailStatus,
};