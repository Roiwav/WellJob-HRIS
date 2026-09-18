const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.join(
    __dirname,
    "..",
    ".env"
  ),
});

const mysql = require("mysql2/promise");

const DATABASE_DIRECTORY =
  path.resolve(
    __dirname,
    "..",
    "database"
  );

const BASELINE_PATH =
  path.join(
    DATABASE_DIRECTORY,
    "baseline.sql"
  );

const MIGRATION_RUNNER_PATH =
  path.join(
    __dirname,
    "migrateDatabase.cjs"
  );

function requiredEnv(
  name,
  {
    allowEmpty = false,
  } = {}
) {
  const exists =
    Object.prototype.hasOwnProperty.call(
      process.env,
      name
    );

  if (!exists) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  const value =
    String(
      process.env[name] ?? ""
    ).trim();

  if (
    !allowEmpty &&
    !value
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function getDatabaseName() {
  const databaseName =
    requiredEnv(
      "DB_NAME"
    );

  /*
   * The database name is interpolated only after a
   * strict identifier validation because MySQL does
   * not support parameter placeholders for database
   * identifiers.
   */
  if (
    !/^[A-Za-z0-9_]+$/.test(
      databaseName
    )
  ) {
    throw new Error(
      "DB_NAME may contain only letters, numbers, and underscores."
    );
  }

  if (
    databaseName.length >
    64
  ) {
    throw new Error(
      "DB_NAME exceeds the MySQL identifier length limit."
    );
  }

  return databaseName;
}

function getConnectionOptions() {
  const port =
    Number.parseInt(
      requiredEnv(
        "DB_PORT"
      ),
      10
    );

  if (
    !Number.isInteger(
      port
    ) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      "DB_PORT must be a valid TCP port number."
    );
  }

  return {
    host:
      requiredEnv(
        "DB_HOST"
      ),

    port,

    user:
      requiredEnv(
        "DB_USER"
      ),

    password:
      requiredEnv(
        "DB_PASSWORD",
        {
          allowEmpty:
            true,
        }
      ),
  };
}

function readBaselineSql() {
  if (
    !fs.existsSync(
      BASELINE_PATH
    )
  ) {
    throw new Error(
      `Database baseline not found: ${BASELINE_PATH}`
    );
  }

  const baselineSql =
    fs.readFileSync(
      BASELINE_PATH,
      "utf8"
    );

  if (
    !baselineSql.trim()
  ) {
    throw new Error(
      "Database baseline is empty."
    );
  }

  return baselineSql;
}

function runMigrationRunner(
  databaseName
) {
  if (
    !fs.existsSync(
      MIGRATION_RUNNER_PATH
    )
  ) {
    throw new Error(
      `Migration runner not found: ${MIGRATION_RUNNER_PATH}`
    );
  }

  const result =
    spawnSync(
      process.execPath,
      [
        MIGRATION_RUNNER_PATH,
      ],
      {
        cwd:
          path.resolve(
            __dirname,
            "..",
            ".."
          ),

        env: {
          ...process.env,
          DB_NAME:
            databaseName,
        },

        encoding:
          "utf8",
      }
    );

  if (
    result.stdout
  ) {
    process.stdout.write(
      result.stdout
    );
  }

  if (
    result.stderr
  ) {
    process.stderr.write(
      result.stderr
    );
  }

  if (
    result.error
  ) {
    throw result.error;
  }

  if (
    result.status !== 0
  ) {
    throw new Error(
      `Migration runner failed with exit code ${result.status}.`
    );
  }
}

async function verifyCoreSchema(
  connection
) {
  const requiredTables = [
    "users",
    "employees",
    "employee_documents",
    "deployment_assignments",
    "employee_status_history",
    "incidents",
    "incident_evidence",
    "incident_timeline",
    "kpi_decision_history",
    "smart_alert_states",
    "smart_suggestion_states",
    "system_settings",
    "audit_logs",
    "schema_migrations",
  ];

  const [
    rows,
  ] =
    await connection.query(
      `
      SELECT
        TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      `
    );

  const existing =
    new Set(
      rows.map(
        (row) =>
          row.TABLE_NAME
      )
    );

  const missing =
    requiredTables.filter(
      (tableName) =>
        !existing.has(
          tableName
        )
    );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Database setup verification failed. Missing table(s): ${missing.join(", ")}`
    );
  }
}

async function main() {
  const databaseName =
    getDatabaseName();

  const connectionOptions =
    getConnectionOptions();

  const baselineSql =
    readBaselineSql();

  let adminConnection =
    null;

  let databaseConnection =
    null;

  try {
    console.log(
      "WELLJOB HRIS database setup"
    );

    console.log(
      `Target database: ${databaseName}`
    );

    /*
     * Connect without selecting DB_NAME first so a
     * fresh installation can create the database.
     */
    adminConnection =
      await mysql.createConnection(
        connectionOptions
      );

    await adminConnection.query(
      `
      CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_general_ci
      `
    );

    await adminConnection.end();

    adminConnection =
      null;

    databaseConnection =
      await mysql.createConnection({
        ...connectionOptions,

        database:
          databaseName,

        /*
         * baseline.sql is trusted repository-owned
         * SQL and intentionally contains multiple
         * CREATE TABLE statements.
         */
        multipleStatements:
          true,
      });

    /*
     * baseline.sql contains CREATE TABLE IF NOT
     * EXISTS definitions and no destructive data
     * statements. On a fresh database this creates
     * the canonical application schema.
     */
    await databaseConnection.query(
      baselineSql
    );

    await databaseConnection.end();

    databaseConnection =
      null;

    /*
     * Run the normal migration engine afterward.
     * Fresh baseline state is adopted into the
     * schema_migrations ledger, while an existing
     * installation is upgraded/skipped according to
     * the same migration rules.
     */
    runMigrationRunner(
      databaseName
    );

    databaseConnection =
      await mysql.createConnection({
        ...connectionOptions,
        database:
          databaseName,
      });

    await verifyCoreSchema(
      databaseConnection
    );

    console.log(
      "\nDATABASE SETUP PASSED."
    );
  } finally {
    if (
      databaseConnection
    ) {
      try {
        await databaseConnection.end();
      } catch {
        // Ignore cleanup-only errors.
      }
    }

    if (
      adminConnection
    ) {
      try {
        await adminConnection.end();
      } catch {
        // Ignore cleanup-only errors.
      }
    }
  }
}

main().catch(
  (error) => {
    console.error(
      "\nDATABASE SETUP FAILED:",
      error?.message ||
        error
    );

    process.exitCode = 1;
  }
);
