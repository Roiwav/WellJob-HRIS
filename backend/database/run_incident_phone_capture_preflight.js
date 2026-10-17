const path = require("path");

/*
 * ============================================================
 * WELLJOB HRIS
 * INCIDENT PHONE CAMERA MIGRATION — READ-ONLY NODE PREFLIGHT
 * ============================================================
 *
 * PURPOSE:
 *   Run the phone-capture database preflight without requiring
 *   the MySQL command-line client.
 *
 * SAFETY:
 *   READ-ONLY ONLY.
 *
 *   This script executes SELECT statements only.
 *
 * RUN FROM:
 *   C:\Users\Nene\Desktop\WellJob-HRIS
 *
 * COMMAND:
 *   node backend/database/run_incident_phone_capture_preflight.js
 *
 * IMPORTANT:
 *   Do NOT run add_incident_phone_capture_sessions.sql yet.
 */

require("dotenv").config({
  path: path.resolve(
    __dirname,
    "../.env"
  ),
});

const db =
  require("../config/db");


async function query(
  sql,
  params = []
) {
  const [rows] =
    await db
      .promise()
      .query(
        sql,
        params
      );

  return rows;
}


function printSection(
  title
) {
  console.log(
    "\n============================================================"
  );

  console.log(
    title
  );

  console.log(
    "============================================================"
  );
}


function printRows(
  rows
) {
  if (
    !Array.isArray(
      rows
    ) ||
    rows.length ===
      0
  ) {
    console.log(
      "(no rows)"
    );

    return;
  }

  console.table(
    rows
  );
}


async function closeDatabase() {
  if (
    !db ||
    typeof db.end !==
      "function"
  ) {
    return;
  }

  await new Promise(
    (
      resolve,
      reject
    ) => {
      const maybePromise =
        db.end(
          (
            error
          ) => {
            if (error) {
              reject(
                error
              );

              return;
            }

            resolve();
          }
        );

      if (
        maybePromise &&
        typeof maybePromise.then ===
          "function"
      ) {
        maybePromise
          .then(
            resolve
          )
          .catch(
            reject
          );
      }
    }
  ).catch(
    (
      error
    ) => {
      console.warn(
        "Database close warning:",
        error?.message ||
        error
      );
    }
  );
}


async function main() {
  printSection(
    "1. CONNECTION / DATABASE / SERVER CHECK"
  );

  printRows(
    await query(`
      SELECT
        DATABASE() AS connected_database,
        VERSION() AS mysql_version,
        @@session.time_zone AS session_time_zone,
        @@global.time_zone AS global_time_zone,
        UTC_TIMESTAMP() AS database_utc_now,
        NOW() AS database_session_now
    `)
  );


  printSection(
    "2. TARGET TABLE EXISTENCE CHECK"
  );

  printRows(
    await query(`
      SELECT
        COUNT(*) AS target_table_exists
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'incident_phone_capture_sessions'
    `)
  );


  printSection(
    "3A. TARGET TABLE METADATA IF IT ALREADY EXISTS"
  );

  printRows(
    await query(`
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        ENGINE,
        TABLE_COLLATION,
        CREATE_TIME,
        UPDATE_TIME
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'incident_phone_capture_sessions'
    `)
  );


  printSection(
    "3B. TARGET TABLE COLUMNS IF IT ALREADY EXISTS"
  );

  printRows(
    await query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        DATA_TYPE,
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
        ORDINAL_POSITION
    `)
  );


  printSection(
    "3C. TARGET TABLE INDEXES IF IT ALREADY EXISTS"
  );

  printRows(
    await query(`
      SELECT
        INDEX_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX,
        COLUMN_NAME,
        COLLATION,
        CARDINALITY
      FROM information_schema.STATISTICS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'incident_phone_capture_sessions'
      ORDER BY
        INDEX_NAME,
        SEQ_IN_INDEX
    `)
  );


  printSection(
    "4. REQUIRED EXISTING TABLES CHECK"
  );

  printRows(
    await query(`
      SELECT
        expected.table_name,
        CASE
          WHEN actual.TABLE_NAME IS NULL
          THEN 'MISSING'
          ELSE 'FOUND'
        END AS table_status,
        actual.ENGINE,
        actual.TABLE_COLLATION
      FROM (
        SELECT 'incidents' AS table_name
        UNION ALL
        SELECT 'deployment_assignments'
        UNION ALL
        SELECT 'users'
      ) AS expected
      LEFT JOIN information_schema.TABLES AS actual
        ON actual.TABLE_SCHEMA = DATABASE()
        AND actual.TABLE_NAME = expected.table_name
      ORDER BY
        expected.table_name
    `)
  );


  printSection(
    "5. REQUIRED CONTROLLER COLUMN CHECK"
  );

  printRows(
    await query(`
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_KEY,
        EXTRA
      FROM information_schema.COLUMNS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND (
          (
            TABLE_NAME = 'incidents'
            AND COLUMN_NAME IN (
              'id',
              'company',
              'status',
              'investigation_started_by_id',
              'investigation_started_at'
            )
          )
          OR
          (
            TABLE_NAME = 'deployment_assignments'
            AND COLUMN_NAME IN (
              'employee_id',
              'company',
              'status'
            )
          )
          OR
          (
            TABLE_NAME = 'users'
            AND COLUMN_NAME = 'id'
          )
        )
      ORDER BY
        TABLE_NAME,
        ORDINAL_POSITION
    `)
  );


  printSection(
    "6. KEY TYPE COMPATIBILITY CHECK"
  );

  printRows(
    await query(`
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        COLUMN_TYPE,
        DATA_TYPE,
        NUMERIC_PRECISION,
        IS_NULLABLE,
        COLUMN_KEY,
        EXTRA
      FROM information_schema.COLUMNS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND (
          (
            TABLE_NAME = 'users'
            AND COLUMN_NAME = 'id'
          )
          OR
          (
            TABLE_NAME = 'deployment_assignments'
            AND COLUMN_NAME = 'employee_id'
          )
          OR
          (
            TABLE_NAME = 'incidents'
            AND COLUMN_NAME = 'id'
          )
        )
      ORDER BY
        TABLE_NAME,
        COLUMN_NAME
    `)
  );


  printSection(
    "7A. DATABASE DEFAULT CHARACTER SET / COLLATION"
  );

  printRows(
    await query(`
      SELECT
        SCHEMA_NAME,
        DEFAULT_CHARACTER_SET_NAME,
        DEFAULT_COLLATION_NAME
      FROM information_schema.SCHEMATA
      WHERE
        SCHEMA_NAME = DATABASE()
    `)
  );


  printSection(
    "7B. EXISTING TABLE ENGINE / COLLATION"
  );

  printRows(
    await query(`
      SELECT
        TABLE_NAME,
        ENGINE,
        TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'users',
          'incidents',
          'deployment_assignments'
        )
      ORDER BY
        TABLE_NAME
    `)
  );


  printSection(
    "8. TARGET NAME COLLISION CHECK"
  );

  printRows(
    await query(`
      SELECT
        TABLE_NAME,
        TABLE_TYPE,
        ENGINE,
        TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND (
          TABLE_NAME = 'incident_phone_capture_sessions'
          OR TABLE_NAME LIKE 'incident%phone%capture%'
          OR TABLE_NAME LIKE '%capture%session%'
        )
      ORDER BY
        TABLE_NAME
    `)
  );


  printSection(
    "9A. INCIDENT ROW COUNT"
  );

  printRows(
    await query(`
      SELECT
        COUNT(*) AS incident_row_count
      FROM incidents
    `)
  );


  printSection(
    "9B. DEPLOYMENT ASSIGNMENT SANITY CHECK"
  );

  printRows(
    await query(`
      SELECT
        COUNT(*) AS deployment_assignment_row_count,
        SUM(
          CASE
            WHEN LOWER(TRIM(status)) = 'active'
            THEN 1
            ELSE 0
          END
        ) AS active_deployment_row_count
      FROM deployment_assignments
    `)
  );


  printSection(
    "10. PREFLIGHT FINISHED"
  );

  console.log(
    [
      "Review conditions before migration:",
      "",
      "A. connected_database is the intended WELLJOB database.",
      "B. target_table_exists must be 0 for the first migration.",
      "C. incidents, deployment_assignments, and users must be FOUND.",
      "D. Required controller columns must all be present.",
      "E. Key column types must be reviewed.",
      "F. No unexpected old capture-session table should exist.",
      "",
      "NO DATABASE CHANGES WERE MADE BY THIS SCRIPT.",
      "DO NOT run add_incident_phone_capture_sessions.sql yet.",
    ].join(
      "\n"
    )
  );
}


main()
  .catch(
    (
      error
    ) => {
      console.error(
        "\nPREFLIGHT FAILED:"
      );

      console.error(
        error?.stack ||
        error?.message ||
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await closeDatabase();
    }
  );