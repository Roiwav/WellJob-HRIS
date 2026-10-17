-- ============================================================
-- WELLJOB HRIS
-- INCIDENT PHONE CAMERA CAPTURE SESSION TABLE
-- PREFLIGHT-VERIFIED MIGRATION
-- ============================================================
--
-- VERIFIED AGAINST CURRENT AIVEN / MySQL SCHEMA:
--
-- Database:
--   defaultdb
--
-- MySQL:
--   8.4.8
--
-- Existing application tables:
--   deployment_assignments -> InnoDB / utf8mb4_general_ci
--   incidents              -> InnoDB / utf8mb4_general_ci
--   users                  -> InnoDB / utf8mb4_general_ci
--
-- Existing key types:
--   deployment_assignments.employee_id -> INT
--   incidents.id                       -> INT
--   users.id                           -> INT
--
-- Existing target table:
--   incident_phone_capture_sessions -> DOES NOT EXIST
--
-- Name collision:
--   NONE
--
-- Time behavior:
--   Current database NOW() and UTC_TIMESTAMP() are aligned.
--   Controller-side expiry checks use UTC_TIMESTAMP().
--
-- IMPORTANT:
--   This file performs a database schema mutation.
--   DO NOT execute it until explicit approval is given.
--
-- SAFETY CHANGE:
--   CREATE TABLE intentionally does NOT use IF NOT EXISTS.
--   Because preflight confirmed the table does not exist,
--   a future accidental re-run should fail visibly instead
--   of silently masking an unexpected schema state.
-- ============================================================


CREATE TABLE incident_phone_capture_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    session_id CHAR(36)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    token_hash CHAR(64)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    creator_user_id INT NOT NULL,

    capture_purpose VARCHAR(32) NOT NULL,

    employee_id INT NULL,
    incident_id INT NULL,
    workflow_action VARCHAR(40) NULL,

    status VARCHAR(24) NOT NULL DEFAULT 'WAITING',

    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size INT UNSIGNED NULL,

    stored_filename VARCHAR(255) NULL,
    object_path VARCHAR(1024) NULL,

    expires_at DATETIME NOT NULL,

    upload_authorized_at DATETIME NULL,
    uploaded_at DATETIME NULL,
    consumed_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_incident_phone_capture_session_id (
        session_id
    ),

    UNIQUE KEY uq_incident_phone_capture_token_hash (
        token_hash
    ),

    KEY idx_incident_phone_capture_creator_status (
        creator_user_id,
        status
    ),

    KEY idx_incident_phone_capture_purpose (
        capture_purpose
    ),

    KEY idx_incident_phone_capture_employee (
        employee_id
    ),

    KEY idx_incident_phone_capture_incident (
        incident_id
    ),

    KEY idx_incident_phone_capture_expires (
        expires_at
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


-- ============================================================
-- POST-MIGRATION READ-ONLY VERIFICATION
-- ============================================================

SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    ENGINE,
    TABLE_COLLATION
FROM information_schema.TABLES
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_phone_capture_sessions';


SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    CHARACTER_SET_NAME,
    COLLATION_NAME,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    EXTRA,
    ORDINAL_POSITION
FROM information_schema.COLUMNS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_phone_capture_sessions'
ORDER BY
    ORDINAL_POSITION;


SELECT
    INDEX_NAME,
    NON_UNIQUE,
    SEQ_IN_INDEX,
    COLUMN_NAME
FROM information_schema.STATISTICS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_phone_capture_sessions'
ORDER BY
    INDEX_NAME,
    SEQ_IN_INDEX;


SELECT
    COUNT(*) AS row_count_after_migration
FROM incident_phone_capture_sessions;
