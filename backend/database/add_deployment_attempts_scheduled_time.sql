/*
==================================================
WELLJOB SOLUTIONS
DEPLOYMENT EXPECTED ARRIVAL TIME MIGRATION
==================================================

Purpose:
- Add a structured expected arrival time to
  deployment_attempts.
- Existing historical rows remain valid with NULL.
- New application code can require scheduled_time
  for newly created deployment schedules.

IMPORTANT:
- This file only changes the table schema.
- It does NOT populate or modify historical times.
- Review the connected database before execution.
- MySQL DDL may auto-commit.

Target table:
  deployment_attempts

New column:
  scheduled_time TIME NULL
*/

-- ==================================================
-- 1. VERIFY CURRENT DATABASE
-- ==================================================

SELECT
  DATABASE() AS connected_database;


-- ==================================================
-- 2. VERIFY TARGET TABLE EXISTS
-- ==================================================

SELECT
  COUNT(*) AS deployment_attempts_table_exists
FROM information_schema.TABLES
WHERE
  TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_attempts';


-- ==================================================
-- 3. CHECK WHETHER COLUMN ALREADY EXISTS
-- ==================================================

SELECT
  COUNT(*) AS scheduled_time_column_exists
FROM information_schema.COLUMNS
WHERE
  TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_attempts'
  AND COLUMN_NAME = 'scheduled_time';


-- ==================================================
-- 4. ADD COLUMN ONLY WHEN MISSING
-- ==================================================
--
-- The prepared statement makes this migration
-- safely rerunnable on MySQL installations where
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS support
-- should not be assumed.
--

SET @scheduled_time_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deployment_attempts'
    AND COLUMN_NAME = 'scheduled_time'
);

SET @scheduled_time_migration_sql =
  IF(
    @scheduled_time_exists = 0,
    'ALTER TABLE `deployment_attempts`
       ADD COLUMN `scheduled_time` TIME NULL
       AFTER `scheduled_date`',
    'SELECT ''scheduled_time already exists; no schema change was required.'' AS migration_status'
  );

PREPARE scheduled_time_migration_statement
FROM @scheduled_time_migration_sql;

EXECUTE scheduled_time_migration_statement;

DEALLOCATE PREPARE scheduled_time_migration_statement;


-- ==================================================
-- 5. VERIFY FINAL COLUMN DEFINITION
-- ==================================================

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  ORDINAL_POSITION
FROM information_schema.COLUMNS
WHERE
  TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deployment_attempts'
  AND COLUMN_NAME = 'scheduled_time';


-- ==================================================
-- 6. READ-ONLY LEGACY DATA CHECK
-- ==================================================
--
-- Historical attempts are intentionally allowed
-- to keep scheduled_time = NULL.
--

SELECT
  COUNT(*) AS total_deployment_attempts,
  SUM(
    CASE
      WHEN scheduled_time IS NULL
        THEN 1
      ELSE 0
    END
  ) AS historical_rows_without_time,
  SUM(
    CASE
      WHEN scheduled_time IS NOT NULL
        THEN 1
      ELSE 0
    END
  ) AS rows_with_expected_time
FROM deployment_attempts;


/*
==================================================
EXPECTED FINAL SCHEMA
==================================================

deployment_attempts.scheduled_time
  Type: TIME
  Nullable: YES
  Default: NULL

Application behavior after migration:
- Historical attempts:
    scheduled_time may remain NULL.
- New schedules:
    backend requires scheduledTime.
- HR Coordinator:
    sees Expected Arrival Date + Time.
- Smart notification:
    includes employee + company + date + time.

ROLLBACK NOTE:
Do not run a rollback casually because any future
scheduled_time values would be lost.

If an approved rollback is ever required, the DDL is:

  ALTER TABLE `deployment_attempts`
    DROP COLUMN `scheduled_time`;

The rollback statement is intentionally NOT executed
by this migration file.
==================================================
*/
