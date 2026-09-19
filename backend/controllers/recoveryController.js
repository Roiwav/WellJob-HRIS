"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { sendRecoveryLink } = require("../utils/recoveryMailer");
const { logAudit } = require("../utils/auditLogger");

const GENERIC_RESPONSE = "If this email is eligible for recovery, you will receive a password-reset link shortly.";
const INVALID_LINK = "This link is invalid or has expired. Request a new link.";
const TOKEN_RE = /^[0-9a-f]{64}$/i;

const { normalizeRecoveryEmail, isStrongPassword, newToken, hashToken } = require("../utils/recoveryHelpers");

/* Authenticated user only. The user must prove control of their inbox. */
async function requestEmailVerification(req, res) {
  const authenticatedId = Number(req.user?.id ?? req.user?.userId);
  if (!Number.isSafeInteger(authenticatedId) || authenticatedId < 1) {
    return res.status(401).json({ message: "Authentication required." });
  }
  try {
    const [rows] = await db.promise().query(
      `SELECT id, email, email_verified_at, status FROM users WHERE id = ? LIMIT 1`,
      [authenticatedId]
    );
    const account = rows[0];
    if (!account || String(account.status).toLowerCase() !== "active") {
      return res.status(403).json({ message: "Active account required." });
    }
    if (!account.email) {
      return res.status(400).json({ message: "Ask Super Admin to register your recovery email first." });
    }
    if (account.email_verified_at) {
      return res.json({ message: "Your recovery email is already verified." });
    }
    const token = newToken();
    const tokenHash = hashToken(token);
    const [result] = await db.promise().query(
      `UPDATE users SET email_verification_token_hash = ?,
          email_verification_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
          email_verification_requested_at = NOW()
       WHERE id = ? AND email = ? AND email_verified_at IS NULL
         AND status = 'Active' AND
         (email_verification_requested_at IS NULL OR
          email_verification_requested_at < DATE_SUB(NOW(), INTERVAL 60 SECOND))`,
      [tokenHash, account.id, account.email]
    );
    if (result.affectedRows !== 1) {
      return res.status(429).json({ message: "Please wait at least one minute before requesting another verification email." });
    }
    try {
      await sendRecoveryLink({ to: account.email, token, type: "verify" });
    } catch (error) {
      /* Never log raw email addresses, SMTP credentials, or reset tokens. */
      console.error("RECOVERY EMAIL DELIVERY ERROR:", error?.code || "delivery failed");
      await db.promise().query(
        `UPDATE users SET email_verification_token_hash = NULL,
          email_verification_expires_at = NULL,
          email_verification_requested_at = NULL
         WHERE id = ? AND email_verification_token_hash = ?`,
        [account.id, tokenHash]
      );
      return res.status(503).json({ message: "Verification email is unavailable. Please try again later." });
    }
    return res.json({ message: "If your recovery email is reachable, a verification link has been sent." });
  } catch (error) {
    console.error("REQUEST EMAIL VERIFICATION ERROR:", error?.code || "request failed");
    return res.status(500).json({ message: "Unable to request email verification." });
  }
}

/* Link possession proves mailbox control; token is checked and consumed atomically. */
async function verifyEmail(req, res) {
  const token = req.body?.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return res.status(400).json({ message: INVALID_LINK });
  }
  try {
    const hash = hashToken(token);
    const [result] = await db.promise().query(
      `UPDATE users SET email_verified_at = NOW(),
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL,
          email_verification_requested_at = NULL
       WHERE email_verification_token_hash = ?
         AND email_verification_expires_at > NOW()
         AND email_verified_at IS NULL AND email IS NOT NULL AND status = 'Active'`,
      [hash]
    );
    if (result.affectedRows !== 1) return res.status(400).json({ message: INVALID_LINK });
    return res.json({ message: "Recovery email verified successfully." });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error?.code || "verification failed");
    return res.status(500).json({ message: "Unable to verify recovery email." });
  }
}

async function requestPasswordReset(req, res) {
  const email = normalizeRecoveryEmail(req.body?.email);
  const generic = () => res.json({ message: GENERIC_RESPONSE });
  if (!email) return generic();
  try {
    const [rows] = await db.promise().query(
      `SELECT id, email FROM users WHERE email = ? AND email_verified_at IS NOT NULL
         AND status = 'Active' LIMIT 1`,
      [email]
    );
    const account = rows[0];
    if (!account) return generic();
    const token = newToken();
    const hash = hashToken(token);
    const [result] = await db.promise().query(
      `UPDATE users SET password_reset_token_hash = ?,
          password_reset_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE),
          password_reset_requested_at = NOW()
       WHERE id = ? AND email = ? AND email_verified_at IS NOT NULL
         AND status = 'Active' AND
         (password_reset_requested_at IS NULL OR
          password_reset_requested_at < DATE_SUB(NOW(), INTERVAL 60 SECOND))`,
      [hash, account.id, account.email]
    );
    if (result.affectedRows !== 1) return generic();
    try {
      await sendRecoveryLink({ to: account.email, token, type: "reset" });
    } catch (error) {
      console.error("PASSWORD RESET EMAIL ERROR:", error?.code || "delivery failed");
      await db.promise().query(
        `UPDATE users SET password_reset_token_hash = NULL,
          password_reset_expires_at = NULL, password_reset_requested_at = NULL
         WHERE id = ? AND password_reset_token_hash = ?`,
        [account.id, hash]
      );
    }
    return generic();
  } catch (error) {
    console.error("REQUEST PASSWORD RESET ERROR:", error?.code || "request failed");
    /* Identical external response for eligible/ineligible addresses. */
    return generic();
  }
}

async function resetPasswordWithToken(req, res) {
  const token = req.body?.token;
  const newPassword = req.body?.newPassword;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return res.status(400).json({ message: INVALID_LINK });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: "Use 8–128 characters with uppercase, lowercase, number and a special character (!@#$%^&*()_+)." });
  }
  const hash = hashToken(token);
  try {
    const [rows] = await db.promise().query(
      `SELECT id, password FROM users WHERE password_reset_token_hash = ?
        AND password_reset_expires_at > NOW() AND email_verified_at IS NOT NULL
        AND email IS NOT NULL AND status = 'Active' LIMIT 1`,
      [hash]
    );
    if (rows.length !== 1) return res.status(400).json({ message: INVALID_LINK });
    if (await bcrypt.compare(newPassword, rows[0].password)) {
      return res.status(400).json({ message: "Use a password different from the current password." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const [result] = await db.promise().query(
      `UPDATE users SET password = ?, must_change_password = 0,
          token_version = token_version + 1,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL,
          password_reset_requested_at = NULL
       WHERE id = ? AND password_reset_token_hash = ?
         AND password_reset_expires_at > NOW()
         AND email_verified_at IS NOT NULL AND email IS NOT NULL AND status = 'Active'`,
      [passwordHash, rows[0].id, hash]
    );
    if (result.affectedRows !== 1) return res.status(400).json({ message: INVALID_LINK });
    /* Never log or return the password or the raw token. */
    try {
      await logAudit({ userId: rows[0].id, username: "-", fullName: "Account holder",
        role: "-", action: "SELF_SERVICE_PASSWORD_RESET",
        description: "Password reset completed through a verified recovery email." });
    } catch (error) { console.error("PASSWORD RESET AUDIT ERROR:", error?.code || "audit failed"); }
    return res.json({ message: "Password updated. Please sign in using the new password." });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error?.code || "reset failed");
    return res.status(500).json({ message: "Unable to reset password." });
  }
}

module.exports = {
  normalizeRecoveryEmail, isStrongPassword, newToken, hashToken,
  requestEmailVerification, verifyEmail, requestPasswordReset, resetPasswordWithToken,
};
