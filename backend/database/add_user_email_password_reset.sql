/*
 * WELLJOB SOLUTIONS
 * Migration #11: registered email and password-reset state
 *
 * Existing users keep their current passwords and sessions.
 * New columns are nullable to preserve existing account rows.
 *
 * IMPORTANT:
 * - Do not edit this SQL after it has been recorded in
 *   schema_migrations.
 * - The application must store only a SHA-256 hash of each
 *   cryptographically random password-reset token.
 * - Application recovery endpoints must be validated before
 *   this migration is applied.
 */

ALTER TABLE users
  ADD COLUMN email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL
    AFTER username,

  ADD COLUMN email_verified_at DATETIME NULL
    AFTER email,

  ADD COLUMN email_verification_token_hash CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL
    AFTER email_verified_at,

  ADD COLUMN email_verification_expires_at DATETIME NULL
    AFTER email_verification_token_hash,

  ADD COLUMN email_verification_requested_at DATETIME NULL
    AFTER email_verification_expires_at,

  ADD COLUMN password_reset_token_hash CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL
    AFTER token_version,

  ADD COLUMN password_reset_expires_at DATETIME NULL
    AFTER password_reset_token_hash,

  ADD COLUMN password_reset_requested_at DATETIME NULL
    AFTER password_reset_expires_at,

  ADD UNIQUE KEY uq_users_email (
    email
  ),

  ADD UNIQUE KEY uq_users_email_verification_token_hash (
    email_verification_token_hash
  ),

  ADD UNIQUE KEY uq_users_password_reset_token_hash (
    password_reset_token_hash
  );
