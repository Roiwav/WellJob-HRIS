/*
 * ==================================================
 * EMPLOYEE MOBILE DOCUMENT HANDOFFS
 * ==================================================
 *
 * Supports the secure "Continue on Phone" workflow for
 * employee compliance-document capture.
 *
 * SECURITY DESIGN:
 * - Only a SHA-256 hash of the temporary handoff token
 *   is stored in the database.
 * - The raw token must never be persisted here.
 * - Handoffs are short-lived and can be consumed once.
 * - Handoffs may be revoked before use.
 * - The creating HR Staff user is recorded so the
 *   backend can require the same authenticated account
 *   when the QR link is opened on a phone.
 *
 * This migration does not modify employee records,
 * compliance KPI logic, or deployment workflow.
 */

CREATE TABLE employee_mobile_handoffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  token_hash CHAR(64)
    CHARACTER SET ascii
    COLLATE ascii_bin
    NOT NULL,

  employee_id INT NOT NULL,
  created_by_user_id INT NOT NULL,

  purpose VARCHAR(64)
    NOT NULL
    DEFAULT 'EMPLOYEE_DOCUMENT_CAPTURE',

  expires_at DATETIME NOT NULL,
  consumed_at DATETIME DEFAULT NULL,
  revoked_at DATETIME DEFAULT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_employee_mobile_handoffs_token_hash (
    token_hash
  ),

  KEY idx_employee_mobile_handoffs_employee_expiry (
    employee_id,
    expires_at
  ),

  KEY idx_employee_mobile_handoffs_creator_employee_expiry (
    created_by_user_id,
    employee_id,
    expires_at
  ),

  CONSTRAINT fk_employee_mobile_handoffs_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_employee_mobile_handoffs_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;
