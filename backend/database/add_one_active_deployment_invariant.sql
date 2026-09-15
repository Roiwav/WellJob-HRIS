/*
 * ================================================================
 * WELLJOB HRIS
 * One Active Deployment Per Employee Invariant
 * ================================================================
 *
 * Purpose:
 *   Enforces at the database level that one employee can have
 *   at most one Active deployment assignment at any given time.
 *
 * Design:
 *   - Active assignments expose employee_id through a generated
 *     guard column.
 *   - Non-Active assignments expose NULL.
 *   - A UNIQUE index is applied to the generated guard column.
 *
 * Result:
 *   employee_id 123 + Active  -> allowed once
 *   employee_id 123 + Active  -> rejected if already active
 *   employee_id 123 + Completed/Cancelled -> unlimited history
 *
 * Important:
 *   - Existing deployment history is preserved.
 *   - No records are deleted or rewritten.
 *   - The migration is safe to run more than once.
 *   - The UNIQUE index is not created if duplicate Active
 *     assignments already exist.
 *
 * Compatible target:
 *   MariaDB 10.4+
 * ================================================================
 */

SET @current_database = DATABASE();

/*
 * ================================================================
 * PRE-MIGRATION DUPLICATE CHECK
 * ================================================================
 *
 * The unique invariant can only be added safely when no employee
 * currently has more than one Active deployment.
 */
SET @duplicate_active_employee_count = (
    SELECT COUNT(*)
    FROM (
        SELECT
            employee_id
        FROM deployment_assignments
        WHERE LOWER(TRIM(status)) = 'active'
        GROUP BY employee_id
        HAVING COUNT(*) > 1
    ) AS duplicate_active_employees
);

/*
 * ================================================================
 * GENERATED GUARD COLUMN
 * ================================================================
 *
 * Active row:
 *   active_employee_id_guard = employee_id
 *
 * Non-Active row:
 *   active_employee_id_guard = NULL
 *
 * UNIQUE indexes allow multiple NULL values, so historical
 * Completed/Cancelled assignments remain unrestricted.
 */
SET @active_guard_column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND COLUMN_NAME = 'active_employee_id_guard'
);

SET @migration_sql = IF(
    @active_guard_column_exists = 0,

    'ALTER TABLE deployment_assignments
        ADD COLUMN active_employee_id_guard INT
        GENERATED ALWAYS AS (
            CASE
                WHEN LOWER(TRIM(status)) = ''active''
                THEN employee_id
                ELSE NULL
            END
        ) PERSISTENT
        AFTER status',

    'SELECT
        ''active_employee_id_guard already exists; no column change required.''
        AS migration_status'
);

PREPARE add_active_guard_column
FROM @migration_sql;

EXECUTE add_active_guard_column;

DEALLOCATE PREPARE add_active_guard_column;


/*
 * ================================================================
 * UNIQUE ACTIVE-EMPLOYEE INDEX
 * ================================================================
 */
SET @active_guard_unique_index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND INDEX_NAME = 'uq_deployment_assignments_one_active_employee'
      AND NON_UNIQUE = 0
);

SET @active_guard_index_name_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'deployment_assignments'
      AND INDEX_NAME = 'uq_deployment_assignments_one_active_employee'
);

SET @migration_sql = IF(
    @active_guard_unique_index_exists > 0,

    'SELECT
        ''One-active-deployment unique index already exists; no index change required.''
        AS migration_status',

    IF(
        @active_guard_index_name_exists > 0,

        'SELECT
            ''Index name uq_deployment_assignments_one_active_employee already exists but is not UNIQUE. Manual review is required.''
            AS migration_status',

        IF(
            @duplicate_active_employee_count > 0,

            'SELECT
                ''Cannot create one-active-deployment unique index because duplicate Active assignments currently exist.''
                AS migration_status',

            'ALTER TABLE deployment_assignments
                ADD UNIQUE INDEX uq_deployment_assignments_one_active_employee (
                    active_employee_id_guard
                )'
        )
    )
);

PREPARE add_active_guard_unique_index
FROM @migration_sql;

EXECUTE add_active_guard_unique_index;

DEALLOCATE PREPARE add_active_guard_unique_index;


/*
 * ================================================================
 * FINAL VERIFICATION
 * ================================================================
 */

SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    EXTRA,
    GENERATION_EXPRESSION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_assignments'
  AND COLUMN_NAME = 'active_employee_id_guard';


SELECT
    INDEX_NAME,
    NON_UNIQUE,
    SEQ_IN_INDEX,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_assignments'
  AND INDEX_NAME = 'uq_deployment_assignments_one_active_employee'
ORDER BY SEQ_IN_INDEX;


/*
 * This result set must remain empty.
 */
SELECT
    employee_id,
    COUNT(*) AS active_count,
    GROUP_CONCAT(
        id
        ORDER BY id
    ) AS deployment_ids
FROM deployment_assignments
WHERE LOWER(TRIM(status)) = 'active'
GROUP BY employee_id
HAVING COUNT(*) > 1
ORDER BY employee_id;
