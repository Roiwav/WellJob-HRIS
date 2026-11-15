/*
 * ================================================================
 * WELLJOB HRIS
 * Deployment Assignment End Actor Attribution
 * ================================================================
 *
 * Purpose:
 *   Persist the authenticated application user who ended a specific
 *   deployment assignment.
 *
 * Safety:
 *   - The new actor reference is nullable for historical compatibility.
 *   - Existing deployment rows are not backfilled or rewritten.
 *   - Unknown historical actors remain NULL.
 *   - User deletion clears only the reference; deployment history remains.
 *   - The migration is safe to run more than once.
 * ================================================================
 */

SET @current_database = DATABASE();

SET @end_actor_column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND COLUMN_NAME = 'ended_by_user_id'
);

SET @migration_sql = IF(
    @end_actor_column_exists = 0,
    'ALTER TABLE deployment_assignments
        ADD COLUMN ended_by_user_id INT NULL
        AFTER ended_at',
    'SELECT
        ''deployment_assignments.ended_by_user_id already exists; no column change required.''
        AS migration_status'
);

PREPARE add_deployment_assignment_end_actor_column
FROM @migration_sql;
EXECUTE add_deployment_assignment_end_actor_column;
DEALLOCATE PREPARE add_deployment_assignment_end_actor_column;

SET @end_actor_index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND INDEX_NAME = 'idx_deployment_assignments_ended_by'
);

SET @migration_sql = IF(
    @end_actor_index_exists = 0,
    'ALTER TABLE deployment_assignments
        ADD INDEX idx_deployment_assignments_ended_by (ended_by_user_id)',
    'SELECT
        ''idx_deployment_assignments_ended_by already exists; no index change required.''
        AS migration_status'
);

PREPARE add_deployment_assignment_end_actor_index
FROM @migration_sql;
EXECUTE add_deployment_assignment_end_actor_index;
DEALLOCATE PREPARE add_deployment_assignment_end_actor_index;

SET @end_actor_foreign_key_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND CONSTRAINT_NAME = 'fk_deployment_assignments_ended_by'
);

SET @migration_sql = IF(
    @end_actor_foreign_key_exists = 0,
    'ALTER TABLE deployment_assignments
        ADD CONSTRAINT fk_deployment_assignments_ended_by
        FOREIGN KEY (ended_by_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL',
    'SELECT
        ''fk_deployment_assignments_ended_by already exists; no foreign key change required.''
        AS migration_status'
);

PREPARE add_deployment_assignment_end_actor_foreign_key
FROM @migration_sql;
EXECUTE add_deployment_assignment_end_actor_foreign_key;
DEALLOCATE PREPARE add_deployment_assignment_end_actor_foreign_key;

SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_assignments'
  AND COLUMN_NAME = 'ended_by_user_id';

SELECT
    INDEX_NAME,
    NON_UNIQUE,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_assignments'
  AND INDEX_NAME = 'idx_deployment_assignments_ended_by';

SELECT
    CONSTRAINT_NAME,
    UPDATE_RULE,
    DELETE_RULE
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_assignments'
  AND CONSTRAINT_NAME = 'fk_deployment_assignments_ended_by';