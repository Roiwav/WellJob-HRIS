const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * WELLJOB HRIS
 * INCIDENT PHONE CAMERA MIGRATION — CONTROLLED EXECUTOR
 * ============================================================
 *
 * USER APPROVAL:
 *   This runner is intended to be used only after explicit
 *   approval to create incident_phone_capture_sessions.
 *
 * EXPECTED FILE:
 *   backend/database/add_incident_phone_capture_sessions.sql
 *
 * SAFETY:
 *   - Verifies the connected database.
 *   - Refuses to run if the target table already exists.
 *   - Refuses to run if required source tables are missing.
 *   - Executes the reviewed migration file only once.
 *   - Performs read-only post-migration verification.
 *   - Does NOT drop, truncate, delete, or modify existing rows.
 *
 * RUN FROM PROJECT ROOT:
 *
 *   node backend/database/run_incident_phone_capture_migration.js
 */

require("dotenv").config({
  path: path.resolve(
    __dirname,
    "../.env"
  ),
});

const db =
  require("../config/db");

const MIGRATION_FILE =
  path.resolve(
    __dirname,
    "add_incident_phone_capture_sessions.sql"
  );

const TARGET_TABLE =
  "incident_phone_capture_sessions";


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


function stripSqlComments(
  sql
) {
  return sql
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    )
    .replace(
      /^\s*--.*$/gm,
      ""
    );
}


function splitSqlStatements(
  sql
) {
  return stripSqlComments(
    sql
  )
    .split(
      /;\s*(?:\r?\n|$)/
    )
    .map(
      (
        statement
      ) =>
        statement.trim()
    )
    .filter(
      Boolean
    );
}


function assertMigrationContents(
  sql
) {
  const normalized =
    sql
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .toLowerCase();

  if (
    !normalized.includes(
      `create table ${TARGET_TABLE}`
    )
  ) {
    throw new Error(
      `Migration file does not contain CREATE TABLE ${TARGET_TABLE}.`
    );
  }

  const forbiddenPatterns = [
    /\bdrop\s+table\b/i,
    /\btruncate\b/i,
    /\bdelete\s+from\b/i,
    /\bupdate\s+[a-z0-9_`]+\s+set\b/i,
    /\binsert\s+into\b/i,
    /\balter\s+table\b/i,
  ];

  for (
    const pattern of
    forbiddenPatterns
  ) {
    if (
      pattern.test(
        sql
      )
    ) {
      throw new Error(
        `Migration safety check failed: forbidden SQL matched ${pattern}.`
      );
    }
  }
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
      let settled =
        false;

      const finish =
        (
          error
        ) => {
          if (settled) {
            return;
          }

          settled =
            true;

          if (error) {
            reject(
              error
            );

            return;
          }

          resolve();
        };

      try {
        const maybePromise =
          db.end(
            finish
          );

        if (
          maybePromise &&
          typeof maybePromise.then ===
            "function"
        ) {
          maybePromise
            .then(
              () =>
                finish()
            )
            .catch(
              finish
            );
        }
      } catch (error) {
        finish(
          error
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
    "1. LOAD REVIEWED MIGRATION FILE"
  );

  if (
    !fs.existsSync(
      MIGRATION_FILE
    )
  ) {
    throw new Error(
      [
        "Migration file not found:",
        MIGRATION_FILE,
        "",
        "Save the approved migration as:",
        "backend/database/add_incident_phone_capture_sessions.sql",
      ].join(
        "\n"
      )
    );
  }

  const migrationSql =
    fs.readFileSync(
      MIGRATION_FILE,
      "utf8"
    );

  assertMigrationContents(
    migrationSql
  );

  console.log(
    "PASS: reviewed migration file found and safety-checked."
  );


  printSection(
    "2. VERIFY DATABASE CONNECTION"
  );

  const connectionRows =
    await query(`
      SELECT
        DATABASE() AS connected_database,
        VERSION() AS mysql_version,
        UTC_TIMESTAMP() AS database_utc_now
    `);

  printRows(
    connectionRows
  );

  const connectedDatabase =
    String(
      connectionRows?.[0]
        ?.connected_database ||
      ""
    ).trim();

  if (
    !connectedDatabase
  ) {
    throw new Error(
      "No active database is selected."
    );
  }


  printSection(
    "3. VERIFY TARGET TABLE IS STILL ABSENT"
  );

  const targetRows =
    await query(
      `
      SELECT
        COUNT(*) AS target_table_exists
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [
        TARGET_TABLE,
      ]
    );

  printRows(
    targetRows
  );

  const targetExists =
    Number(
      targetRows?.[0]
        ?.target_table_exists
    ) >
    0;

  if (
    targetExists
  ) {
    throw new Error(
      [
        `STOP: ${TARGET_TABLE} already exists.`,
        "The migration was NOT executed.",
        "Inspect the existing table before taking any further action.",
      ].join(
        "\n"
      )
    );
  }


  printSection(
    "4. VERIFY REQUIRED APPLICATION TABLES"
  );

  const requiredTables =
    await query(`
      SELECT
        expected.table_name,
        CASE
          WHEN actual.TABLE_NAME IS NULL
          THEN 'MISSING'
          ELSE 'FOUND'
        END AS table_status
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
    `);

  printRows(
    requiredTables
  );

  const missingTables =
    requiredTables.filter(
      (
        row
      ) =>
        row.table_status !==
        "FOUND"
    );

  if (
    missingTables.length >
    0
  ) {
    throw new Error(
      `STOP: required table(s) are missing: ${missingTables
        .map(
          (
            row
          ) =>
            row.table_name
        )
        .join(
          ", "
        )}`
    );
  }


  printSection(
    "5. EXECUTE APPROVED MIGRATION"
  );

  const statements =
    splitSqlStatements(
      migrationSql
    );

  const createStatements =
    statements.filter(
      (
        statement
      ) =>
        /^create\s+table\s+/i.test(
          statement
        )
    );

  if (
    createStatements.length !==
    1
  ) {
    throw new Error(
      `Expected exactly 1 CREATE TABLE statement, found ${createStatements.length}.`
    );
  }

  /*
   * Execute only the single approved CREATE TABLE mutation.
   * Verification SELECTs in the SQL file are intentionally
   * re-run below through fixed read-only queries.
   */
  await query(
    createStatements[0]
  );

  console.log(
    `PASS: ${TARGET_TABLE} created successfully.`
  );


  printSection(
    "6. POST-MIGRATION TABLE VERIFICATION"
  );

  const tableRows =
    await query(
      `
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        ENGINE,
        TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [
        TARGET_TABLE,
      ]
    );

  printRows(
    tableRows
  );

  if (
    tableRows.length !==
    1
  ) {
    throw new Error(
      "Migration executed, but the target table could not be verified."
    );
  }


  printSection(
    "7. POST-MIGRATION COLUMN VERIFICATION"
  );

  const columnRows =
    await query(
      `
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
        AND TABLE_NAME = ?
      ORDER BY
        ORDINAL_POSITION
      `,
      [
        TARGET_TABLE,
      ]
    );

  printRows(
    columnRows
  );


  printSection(
    "8. POST-MIGRATION INDEX VERIFICATION"
  );

  const indexRows =
    await query(
      `
      SELECT
        INDEX_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX,
        COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY
        INDEX_NAME,
        SEQ_IN_INDEX
      `,
      [
        TARGET_TABLE,
      ]
    );

  printRows(
    indexRows
  );


  printSection(
    "9. POST-MIGRATION ROW COUNT"
  );

  const rowCount =
    await query(`
      SELECT
        COUNT(*) AS row_count_after_migration
      FROM incident_phone_capture_sessions
    `);

  printRows(
    rowCount
  );


  printSection(
    "MIGRATION COMPLETE"
  );

  console.log(
    [
      `Database: ${connectedDatabase}`,
      `Table: ${TARGET_TABLE}`,
      "Status: CREATED AND VERIFIED",
      "",
      "No existing Incident, Employee, Deployment, or User rows were modified.",
      "Do NOT run this migration again.",
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
        "\nMIGRATION STOPPED / FAILED:"
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