/*
 * ================================================================
 * WELLJOB HRIS
 * Incident Policy Sanction Schema Migration
 * ================================================================
 *
 * Purpose:
 *   Adds incidents.policy_sanction so the system can store the
 *   server-authoritative prescribed sanction separately from the
 *   investigator's actual action_taken.
 *
 * Important:
 *   - This migration is safe to run more than once.
 *   - Existing incident records are NOT bulk backfilled.
 *   - Historical action_taken values may represent different
 *     workflow meanings, so automatic historical migration would
 *     risk corrupting historical data.
 * ================================================================
 */

SET @current_database = DATABASE();

SET @policy_sanction_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @current_database
      AND TABLE_NAME = 'incidents'
      AND COLUMN_NAME = 'policy_sanction'
);

SET @migration_sql = IF(
    @policy_sanction_exists = 0,
    'ALTER TABLE incidents
        ADD COLUMN policy_sanction VARCHAR(255) NULL AFTER action_taken',
    'SELECT ''policy_sanction already exists; no schema change required.'' AS migration_status'
);

PREPARE policy_sanction_migration
FROM @migration_sql;

EXECUTE policy_sanction_migration;

DEALLOCATE PREPARE policy_sanction_migration;

/*
 * Final verification
 */
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'incidents'
  AND COLUMN_NAME = 'policy_sanction';