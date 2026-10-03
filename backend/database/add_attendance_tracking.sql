/*
 * WELLJOB SOLUTIONS
 * Migration #14: Attendance tracking
 *
 * Persistent data source for:
 * - HR Coordinator daily attendance
 * - Attendance History
 * - Attendance Performance
 * - future KPI/dashboard attendance integration
 *
 * SECURITY:
 * - company authority is server-derived
 * - actor identity is server-derived
 * - employee/deployment scope is server-validated
 * - protected evidence stores private object references only
 *
 * Do not edit after this migration is recorded in
 * schema_migrations. Create a new migration instead.
 */


/*
 * ================================================================
 * ATTENDANCE TRACKING
 * ================================================================
 *
 * One attendance batch represents the authoritative attendance
 * submission for one client company on one calendar date.
 *
 * Entry rows retain employee/deployment snapshots so historical
 * attendance remains understandable after future transfers.
 *
 * Client-provided evidence stores only the private storage object
 * reference. Signed/public URLs must never be persisted.
 * ================================================================
 */

CREATE TABLE IF NOT EXISTS attendance_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  company VARCHAR(255) NOT NULL,

  attendance_date DATE NOT NULL,

  source ENUM(
    'coordinator',
    'client'
  ) NOT NULL,

  created_by_user_id INT NOT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_attendance_batches_company_date (
    company,
    attendance_date
  ),

  KEY idx_attendance_batches_created_by (
    created_by_user_id,
    created_at
  ),

  CONSTRAINT fk_attendance_batches_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS attendance_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  batch_id BIGINT UNSIGNED NOT NULL,

  employee_id INT NOT NULL,

  deployment_assignment_id INT NOT NULL,

  employee_name VARCHAR(255) NOT NULL,

  position VARCHAR(150) DEFAULT NULL,

  attendance_status ENUM(
    'Unmarked',
    'Present',
    'Late',
    'Absent',
    'On Leave',
    'Rest Day'
  ) NOT NULL DEFAULT 'Unmarked',

  note TEXT DEFAULT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_attendance_entries_batch_employee (
    batch_id,
    employee_id
  ),

  KEY idx_attendance_entries_employee_batch (
    employee_id,
    batch_id
  ),

  KEY idx_attendance_entries_deployment (
    deployment_assignment_id
  ),

  KEY idx_attendance_entries_status (
    attendance_status
  ),

  CONSTRAINT fk_attendance_entries_batch
    FOREIGN KEY (batch_id)
    REFERENCES attendance_batches(id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_entries_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT fk_attendance_entries_deployment
    FOREIGN KEY (deployment_assignment_id)
    REFERENCES deployment_assignments(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS attendance_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  batch_id BIGINT UNSIGNED NOT NULL,

  object_path VARCHAR(1024) NOT NULL,

  original_name VARCHAR(255) NOT NULL,

  mime_type VARCHAR(100) NOT NULL,

  file_size BIGINT UNSIGNED NOT NULL,

  uploaded_by_user_id INT NOT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_attendance_evidence_batch (
    batch_id
  ),

  KEY idx_attendance_evidence_uploader (
    uploaded_by_user_id,
    created_at
  ),

  CONSTRAINT fk_attendance_evidence_batch
    FOREIGN KEY (batch_id)
    REFERENCES attendance_batches(id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_evidence_uploader
    FOREIGN KEY (uploaded_by_user_id)
    REFERENCES users(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_general_ci;
