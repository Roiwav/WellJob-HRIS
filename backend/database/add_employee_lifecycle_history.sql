-- ============================================================
-- WELLJOB HRIS
-- Employee Lifecycle History Foundation
-- ============================================================
--
-- Purpose:
-- 1. Preserve every client deployment / assignment as history.
-- 2. Preserve employee workforce-status transitions over time.
-- 3. Keep employees as the current master/current-state record.
--
-- Current employee.status remains the current workforce state:
-- - Deployed
-- - Floating / Standby
-- - Inactive
--
-- deployment_assignments stores assignment history:
-- - Active
-- - Completed
-- - Cancelled
--
-- employee_status_history stores effective-dated transitions.
--
-- NOTE:
-- The current employees table is intentionally NOT altered here.
-- Existing company/contract* columns remain temporarily for
-- compatibility while backend/frontend workflows are migrated.
-- ============================================================

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

  ended_at DATETIME DEFAULT NULL,

  created_by_user_id INT DEFAULT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

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