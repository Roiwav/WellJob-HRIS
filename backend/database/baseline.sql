/*
 * ================================================================
 * WELLJOB HRIS
 * Canonical Database Baseline
 * ================================================================
 *
 * Purpose:
 *   Defines the complete current application schema required by the
 *   WellJob HRIS backend for a fresh database.
 *
 * Safety:
 *   - Contains schema definitions only.
 *   - Does not INSERT, UPDATE, DELETE, TRUNCATE, or DROP data.
 *   - Uses CREATE TABLE IF NOT EXISTS so accidental execution against
 *     an existing database does not replace existing tables.
 *
 * Important:
 *   This baseline is intended for NEW database initialization.
 *   Existing databases must be upgraded through the migration runner.
 * ================================================================
 */

SET NAMES utf8mb4;


/*
 * ================================================================
 * 1. USERS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(20) DEFAULT NULL,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,

  role ENUM(
    'SUPER_ADMIN',
    'HR_MANAGER',
    'HR_STAFF',
    'HR_COORDINATOR',
    'IT_SUPPORT'
  ) NOT NULL,

  assigned_company VARCHAR(255) DEFAULT NULL,

  status ENUM(
    'Active',
    'Inactive'
  ) DEFAULT 'Active',

  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT UNSIGNED NOT NULL DEFAULT 1,

  PRIMARY KEY (id),

  UNIQUE KEY username (
    username
  ),

  UNIQUE KEY user_id (
    user_id
  ),

  KEY idx_users_role_assigned_company (
    role,
    assigned_company
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 2. EMPLOYEES
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS employees (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL,
  status VARCHAR(50) DEFAULT NULL,
  contractStart DATE DEFAULT NULL,
  contractEnd DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived TINYINT(1) DEFAULT 0,
  contractEndReason VARCHAR(100) DEFAULT NULL,
  contractEndRemarks TEXT DEFAULT NULL,
  contractEndedAt DATETIME DEFAULT NULL,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_employees_archived_status (
    archived,
    status
  ),

  KEY idx_employees_created_at (
    created_at
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 3. SYSTEM SETTINGS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS system_settings (
  id INT NOT NULL AUTO_INCREMENT,
  setting_name VARCHAR(50) DEFAULT NULL,
  setting_value LONGTEXT NOT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY setting_name (
    setting_name
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 4. AUDIT LOGS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(20) DEFAULT NULL,
  username VARCHAR(100) DEFAULT NULL,
  role VARCHAR(50) DEFAULT NULL,

  category ENUM(
    'TECHNICAL',
    'OPERATIONAL'
  ) NOT NULL DEFAULT 'TECHNICAL',

  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name VARCHAR(255) DEFAULT NULL,

  PRIMARY KEY (id),

  KEY idx_audit_logs_category_created_id (
    category,
    created_at,
    id
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 5. EMPLOYEE DOCUMENTS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS employee_documents (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  expiration_date DATE DEFAULT NULL,
  file_path TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file VARCHAR(255) DEFAULT NULL,

  PRIMARY KEY (id),

  KEY idx_employee_documents_employee_id (
    employee_id
  ),

  KEY idx_employee_documents_expiration_name_employee (
    expiration_date,
    name,
    employee_id
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 6. DEPLOYMENT ASSIGNMENTS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS deployment_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  company VARCHAR(255) NOT NULL,
  position VARCHAR(150) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  end_reason VARCHAR(100) DEFAULT NULL,
  end_remarks TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',

  active_employee_id_guard INT
    GENERATED ALWAYS AS (
      CASE
        WHEN LOWER(TRIM(status)) = 'active'
          THEN employee_id
        ELSE NULL
      END
    ) STORED,

  ended_at DATETIME DEFAULT NULL,
  created_by_user_id INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_deployment_assignments_one_active_employee (
    active_employee_id_guard
  ),

  KEY idx_deployment_assignments_employee_status (
    employee_id,
    status
  ),

  KEY idx_deployment_assignments_start_date (
    start_date
  ),

  KEY idx_deployment_assignments_end_date (
    end_date
  ),

  KEY idx_deployment_assignments_status (
    status
  ),

  KEY fk_deployment_assignments_created_by (
    created_by_user_id
  ),

  CONSTRAINT fk_deployment_assignments_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_deployment_assignments_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 7. EMPLOYEE STATUS HISTORY
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS employee_status_history (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  from_status VARCHAR(50) DEFAULT NULL,
  to_status VARCHAR(50) NOT NULL,
  effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(100) DEFAULT NULL,
  remarks TEXT DEFAULT NULL,
  source_event VARCHAR(50) NOT NULL,
  changed_by_user_id INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_employee_status_history_employee_effective (
    employee_id,
    effective_at
  ),

  KEY idx_employee_status_history_to_status_effective (
    to_status,
    effective_at
  ),

  KEY idx_employee_status_history_source_event (
    source_event
  ),

  KEY fk_employee_status_history_changed_by (
    changed_by_user_id
  ),

  CONSTRAINT fk_employee_status_history_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_employee_status_history_changed_by
    FOREIGN KEY (changed_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 8. INCIDENTS
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS incidents (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  employee_name VARCHAR(255) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL,
  violation_type VARCHAR(255) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'Minor',
  status VARCHAR(50) NOT NULL DEFAULT 'Open',
  incident_date DATE NOT NULL,
  location VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  reported_by VARCHAR(255) DEFAULT NULL,
  action_taken VARCHAR(255) DEFAULT NULL,
  policy_sanction VARCHAR(255) DEFAULT NULL,
  recommendation VARCHAR(255) DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NULL DEFAULT NULL
    ON UPDATE CURRENT_TIMESTAMP,

  locked_by INT DEFAULT NULL,
  locked_at DATETIME DEFAULT NULL,

  last_action_by_id VARCHAR(50) DEFAULT NULL,
  last_action_by_username VARCHAR(100) DEFAULT NULL,
  last_action_by_name VARCHAR(150) DEFAULT NULL,
  last_action_type VARCHAR(80) DEFAULT NULL,
  last_action_at DATETIME DEFAULT NULL,

  investigation_started_by_id VARCHAR(50) DEFAULT NULL,
  investigation_started_by_username VARCHAR(100) DEFAULT NULL,
  investigation_started_by_name VARCHAR(150) DEFAULT NULL,
  investigation_started_at DATETIME DEFAULT NULL,

  resolution_submitted_by_id VARCHAR(50) DEFAULT NULL,
  resolution_submitted_by_username VARCHAR(100) DEFAULT NULL,
  resolution_submitted_by_name VARCHAR(150) DEFAULT NULL,
  resolution_submitted_at DATETIME DEFAULT NULL,

  reviewed_by_id VARCHAR(50) DEFAULT NULL,
  reviewed_by_username VARCHAR(100) DEFAULT NULL,
  reviewed_by_name VARCHAR(150) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  review_decision VARCHAR(50) DEFAULT NULL,
  review_comments TEXT DEFAULT NULL,

  PRIMARY KEY (id),

  KEY idx_incidents_employee_id (
    employee_id
  ),

  KEY idx_incidents_status (
    status
  ),

  KEY idx_incidents_severity (
    severity
  ),

  KEY idx_incidents_created_at (
    created_at
  ),

  CONSTRAINT fk_incidents_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 9. INCIDENT EVIDENCE
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS incident_evidence (
  id INT NOT NULL AUTO_INCREMENT,
  incident_id INT NOT NULL,
  file_name VARCHAR(255) DEFAULT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_incident_evidence_incident_id (
    incident_id
  ),

  KEY idx_incident_evidence_created_at (
    created_at
  ),

  CONSTRAINT fk_incident_evidence
    FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 10. INCIDENT TIMELINE
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS incident_timeline (
  id INT NOT NULL AUTO_INCREMENT,
  incident_id INT NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  created_by_id VARCHAR(50) DEFAULT NULL,
  created_by_username VARCHAR(100) DEFAULT NULL,
  created_by_name VARCHAR(150) DEFAULT NULL,
  created_by_role VARCHAR(80) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_incident_timeline_incident_id (
    incident_id
  ),

  CONSTRAINT fk_incident_timeline_incident
    FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 11. KPI DECISION HISTORY
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS kpi_decision_history (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id VARCHAR(64) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  company VARCHAR(255) DEFAULT NULL,
  risk_level VARCHAR(100) DEFAULT NULL,
  kpi_level VARCHAR(100) DEFAULT NULL,
  violation_count INT DEFAULT 0,
  severity_score INT DEFAULT 0,
  critical_incident_count INT DEFAULT 0,
  decision_confidence VARCHAR(100) DEFAULT NULL,
  suggested_hr_action VARCHAR(255) DEFAULT NULL,
  system_recommendation VARCHAR(255) DEFAULT NULL,
  final_action VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  notes TEXT DEFAULT NULL,
  decided_by VARCHAR(255) DEFAULT NULL,
  decided_by_role VARCHAR(100) DEFAULT NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'Recorded',
  recommendation_reason TEXT DEFAULT NULL,
  decision_confidence_reason TEXT DEFAULT NULL,
  suggested_hr_action_reason TEXT DEFAULT NULL,
  corrective_action_basis TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NULL DEFAULT NULL
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_kpi_decision_employee_id (
    employee_id
  ),

  KEY idx_kpi_decision_type (
    decision_type
  ),

  KEY idx_kpi_decision_date (
    decided_at
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 12. SMART ALERT STATES
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS smart_alert_states (
  id INT NOT NULL AUTO_INCREMENT,
  user_key VARCHAR(120) NOT NULL,
  role VARCHAR(50) NOT NULL,
  alert_key VARCHAR(191) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  is_dismissed TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  dismissed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NULL DEFAULT NULL
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uniq_smart_alert_state (
    user_key,
    role,
    alert_key
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 13. SMART SUGGESTION STATES
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS smart_suggestion_states (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_key VARCHAR(180) NOT NULL,
  role VARCHAR(50) NOT NULL,
  suggestion_key VARCHAR(180) NOT NULL,
  action_type VARCHAR(100) DEFAULT NULL,
  action_notes TEXT DEFAULT NULL,
  action_at DATETIME DEFAULT NULL,
  is_dismissed TINYINT(1) NOT NULL DEFAULT 0,
  dismiss_reason TEXT DEFAULT NULL,
  dismissed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_smart_suggestion_state (
    user_key,
    role,
    suggestion_key
  ),

  KEY idx_smart_suggestion_user_role (
    user_key,
    role
  ),

  KEY idx_smart_suggestion_key (
    suggestion_key
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


/*
 * ================================================================
 * 14. CLIENT COMPANIES
 * ================================================================
 *
 * Central master list for WellJob client companies.
 *
 * Operational tables continue storing company names as snapshots
 * for backward compatibility and historical preservation.
 *
 * New selectable company options should come from this table.
 *
 * Companies are deactivated instead of hard-deleted.
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS client_companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_client_companies_company_name (
    company_name
  ),

  KEY idx_client_companies_active_name (
    is_active,
    company_name
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/*
 * ================================================================
 * 15. COMPANY POSITIONS
 * ================================================================
 *
 * Company-specific deployment position master list.
 *
 * deployment_assignments.position remains the actual position
 * snapshot stored for each deployment assignment.
 *
 * Position choices are deactivated instead of hard-deleted so
 * historical deployment records remain valid.
 * ================================================================
 */
CREATE TABLE IF NOT EXISTS company_positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  position_name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_company_positions_company_position (
    company_id,
    position_name
  ),

  KEY idx_company_positions_company_active_name (
    company_id,
    is_active,
    position_name
  ),

  CONSTRAINT fk_company_positions_company
    FOREIGN KEY (company_id)
    REFERENCES client_companies(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/*
 * ================================================================
 * BASELINE VERIFICATION
 * ================================================================
 */
SELECT
  TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;