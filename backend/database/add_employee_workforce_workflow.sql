/*
 * ============================================================
 * WELLJOB HRIS
 * Employee Workforce Workflow Foundation
 * ============================================================
 *
 * Purpose:
 * 1. Separate employment state from workforce/deployment state.
 * 2. Add the real Date Hired without reusing deployment dates.
 * 3. Add employee-level Position so Floating / Standby (Pooling)
 *    employees can retain their designated company + position
 *    before an actual deployment exists.
 * 4. Add a dedicated pre-deployment attempt layer so a scheduled
 *    deployment is not confused with an actual deployment.
 * 5. Preserve the existing deployment_assignments table as the
 *    source of truth for ACTUAL deployment history.
 * 6. Preserve employee_status_history as WORKFORCE-status history.
 * 7. Add a separate employment-status history table.
 *
 * IMPORTANT LEGACY COMPATIBILITY:
 * - employees.status remains in place during the transition.
 * - deployment_assignments is NOT rewritten by this migration.
 * - employee_status_history is NOT rewritten by this migration.
 * - existing Date Hired values are NOT fabricated.
 * - employees.company remains the employee-level designated/current
 *   client company used by the existing application.
 * - employees.position is added as the employee-level designated/current
 *   position. For existing deployed employees only, it is deterministically
 *   backfilled from their single Active deployment assignment.
 * - existing Inactive employees are NOT automatically interpreted
 *   as Resigned or Terminated because "Inactive" is ambiguous.
 *
 * Deterministic compatibility backfill:
 * - current Deployed employees -> workforce_status = Deployed
 * - current Floating / Standby employees
 *     -> workforce_status = Floating / Standby
 * - those active-workforce employees -> employment_status = Active
 * - legacy Inactive employees remain NULL in the two new canonical
 *   state columns until an explicit normalization/business rule is
 *   approved.
 *
 * New canonical values:
 *
 * employment_status:
 * - Active
 * - Resigned
 * - Terminated
 *
 * workforce_status:
 * - Floating / Standby
 * - For Deployment
 * - Deployed
 *
 * deployment_attempts.status:
 * - For Deployment
 * - Deployed
 * - No Show
 * - Withdrawn
 *
 * This migration is additive and intentionally keeps legacy fields
 * available while backend/frontend workflows are migrated.
 * ============================================================
 */


/*
 * ============================================================
 * EMPLOYEE CANONICAL STATE COLUMNS
 * ============================================================
 */

ALTER TABLE employees
  ADD COLUMN date_hired DATE NULL
    AFTER birthday,

  ADD COLUMN position VARCHAR(150) NULL
    AFTER company,

  ADD COLUMN employment_status VARCHAR(30) NULL
    AFTER status,

  ADD COLUMN workforce_status VARCHAR(30) NULL
    AFTER employment_status,

  ADD KEY idx_employees_date_hired (
    date_hired
  ),

  ADD KEY idx_employees_company_position (
    company,
    position
  ),

  ADD KEY idx_employees_employment_status (
    employment_status
  ),

  ADD KEY idx_employees_workforce_status (
    workforce_status
  );


/*
 * ============================================================
 * DETERMINISTIC LEGACY COMPATIBILITY BACKFILL
 * ============================================================
 *
 * Do not infer Date Hired from contractStart/start_date.
 * Those fields represent deployment/assignment timing.
 *
 * Do not infer a final employment state from legacy Inactive.
 * The legacy reason (for example AWOL) is not automatically
 * reclassified here as Resigned or Terminated.
 */

UPDATE employees
SET workforce_status = 'Deployed'
WHERE workforce_status IS NULL
  AND LOWER(TRIM(COALESCE(status, ''))) = 'deployed';


UPDATE employees
SET workforce_status = 'Floating / Standby'
WHERE workforce_status IS NULL
  AND LOWER(
        REPLACE(
          TRIM(COALESCE(status, '')),
          ' ',
          ''
        )
      ) IN (
        'floating/standby',
        'floating',
        'standby'
      );


UPDATE employees
SET employment_status = 'Active'
WHERE employment_status IS NULL
  AND workforce_status IN (
    'Deployed',
    'Floating / Standby'
  );


/*
 * Existing deployed employees already have one canonical Active
 * deployment assignment. Reuse only that real assignment snapshot
 * to populate the new employee-level position.
 *
 * This is deterministic because production already enforces one
 * Active deployment assignment per employee.
 *
 * Floating / Standby legacy employees are intentionally NOT assigned
 * a fabricated position here. HR Staff may encode their real
 * designated company + position later through the employee workflow.
 */
UPDATE employees AS e
INNER JOIN deployment_assignments AS da
  ON da.employee_id = e.id
  AND da.status = 'Active'
SET e.position = da.position
WHERE e.position IS NULL
  AND da.position IS NOT NULL
  AND TRIM(da.position) <> ''
  AND e.workforce_status = 'Deployed';


/*
 * ============================================================
 * EMPLOYMENT STATUS HISTORY
 * ============================================================
 *
 * employee_status_history already exists and represents workforce
 * status transitions. Keep that historical meaning stable.
 *
 * Employment transitions receive their own history table so:
 * - workforce history remains unambiguous
 * - resignation/termination history is not mixed with deployment
 *   state such as Floating / Standby or Deployed
 */

CREATE TABLE employee_employment_history (
  id INT NOT NULL AUTO_INCREMENT,

  employee_id INT NOT NULL,

  from_status VARCHAR(30) DEFAULT NULL,

  to_status VARCHAR(30) NOT NULL,

  effective_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  reason VARCHAR(100) DEFAULT NULL,

  remarks TEXT DEFAULT NULL,

  source_event VARCHAR(50) NOT NULL,

  changed_by_user_id INT DEFAULT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_employee_employment_history_employee_effective (
    employee_id,
    effective_at
  ),

  KEY idx_employee_employment_history_to_status_effective (
    to_status,
    effective_at
  ),

  KEY idx_employee_employment_history_source_event (
    source_event
  ),

  CONSTRAINT fk_employee_employment_history_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_employee_employment_history_changed_by
    FOREIGN KEY (changed_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;


/*
 * ============================================================
 * DEPLOYMENT ATTEMPTS
 * ============================================================
 *
 * A deployment attempt represents the scheduling/arrival stage.
 *
 * It does NOT represent an actual deployment assignment until the
 * employee's arrival is confirmed.
 *
 * Typical flow:
 *
 * Floating / Standby (Pooling)
 *   -> employee already has designated company + position
 *   -> HR Staff creates For Deployment attempt from that designation
 *   -> workforce_status = For Deployment
 *
 * Coordinator confirms arrival
 *   -> attempt status = Deployed
 *   -> actual_arrival_date is recorded
 *   -> deployment_assignments row is created
 *   -> workforce_status = Deployed
 *
 * Coordinator marks No Show
 *   -> attempt status = No Show
 *   -> no deployment_assignments row is created
 *   -> workforce_status = Floating / Standby
 *   -> employee company + position designation is retained
 *
 * HR Staff withdraws the scheduled deployment before arrival
 *   -> attempt status = Withdrawn
 *   -> no deployment_assignments row is created
 *   -> workforce_status = Floating / Standby
 *   -> employee company + position designation is retained
 *
 * pending_employee_id_guard enforces at most one live
 * "For Deployment" attempt per employee.
 */

CREATE TABLE deployment_attempts (
  id INT NOT NULL AUTO_INCREMENT,

  employee_id INT NOT NULL,

  company VARCHAR(255) NOT NULL,

  position VARCHAR(150) DEFAULT NULL,

  scheduled_date DATE NOT NULL,

  actual_arrival_date DATE DEFAULT NULL,

  status VARCHAR(30) NOT NULL
    DEFAULT 'For Deployment',

  outcome_reason VARCHAR(100) DEFAULT NULL,

  remarks TEXT DEFAULT NULL,

  resolved_at DATETIME DEFAULT NULL,

  created_by_user_id INT DEFAULT NULL,

  resolved_by_user_id INT DEFAULT NULL,

  deployment_assignment_id INT DEFAULT NULL,

  pending_employee_id_guard INT
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'For Deployment'
          THEN employee_id
        ELSE NULL
      END
    ) STORED,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_deployment_attempts_one_pending_employee (
    pending_employee_id_guard
  ),

  UNIQUE KEY uq_deployment_attempts_assignment (
    deployment_assignment_id
  ),

  KEY idx_deployment_attempts_employee_status (
    employee_id,
    status
  ),

  KEY idx_deployment_attempts_company_status (
    company,
    status
  ),

  KEY idx_deployment_attempts_scheduled_date (
    scheduled_date
  ),

  KEY idx_deployment_attempts_created_by (
    created_by_user_id
  ),

  KEY idx_deployment_attempts_resolved_by (
    resolved_by_user_id
  ),

  /*
   * employee_id is also the base column used by the STORED generated
   * pending_employee_id_guard column above.
   *
   * MySQL 8.4 does not allow ON UPDATE CASCADE / SET NULL / SET DEFAULT
   * on a foreign key whose child column is a base column of a stored
   * generated column. Keep the employee relationship restrictive.
   */
  CONSTRAINT fk_deployment_attempts_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT fk_deployment_attempts_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_deployment_attempts_resolved_by
    FOREIGN KEY (resolved_by_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_deployment_attempts_assignment
    FOREIGN KEY (deployment_assignment_id)
    REFERENCES deployment_assignments(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;