/*
 * WELLJOB HRIS
 * Account Credentials Delivery Status
 *
 * NULL:
 *   Existing account or account created before
 *   credentials-delivery tracking was introduced.
 *
 * PENDING:
 *   Account saved; delivery has not started.
 *
 * SENDING:
 *   Credentials email delivery is in progress.
 *
 * FAILED:
 *   Delivery attempt failed. Account remains Inactive
 *   and may be eligible for a controlled resend.
 *
 * SMTP_ACCEPTED:
 *   The SMTP server accepted the credentials email.
 *   This does not guarantee inbox delivery.
 *
 * A separate delivery status prevents the system
 * from treating every Inactive account as a failed
 * credentials-delivery account.
 */

ALTER TABLE users
  ADD COLUMN account_credentials_delivery_status
    ENUM(
      'PENDING',
      'SENDING',
      'FAILED',
      'SMTP_ACCEPTED'
    )
    NULL
    DEFAULT NULL
    AFTER must_change_password,

  ADD INDEX idx_users_account_credentials_delivery_status (
    account_credentials_delivery_status,
    status
  );