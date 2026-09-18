const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const mysql = require("mysql2/promise");

const DATABASE_DIRECTORY = path.resolve(
  __dirname,
  "..",
  "database"
);

const MIGRATION_LOCK_NAME =
  "welljob_hris_schema_migrations";

const MIGRATIONS = [
  {
    name: "add_employee_lifecycle_history.sql",
    isApplied: async (connection) => {
      const deploymentAssignments =
        await tableExists(
          connection,
          "deployment_assignments"
        );

      const employeeStatusHistory =
        await tableExists(
          connection,
          "employee_status_history"
        );

      return (
        deploymentAssignments &&
        employeeStatusHistory
      );
    },
  },
  {
    name: "add_incident_timeline.sql",
    isApplied: async (connection) =>
      tableExists(
        connection,
        "incident_timeline"
      ),
  },
  {
    name: "smart_suggestion_states.sql",
    isApplied: async (connection) =>
      tableExists(
        connection,
        "smart_suggestion_states"
      ),
  },
  {
    name: "add_incident_policy_sanction.sql",
    isApplied: async (connection) =>
      columnExists(
        connection,
        "incidents",
        "policy_sanction"
      ),
  },
  {
    name: "add_one_active_deployment_invariant.sql",
    isApplied: async (connection) => {
      const guardColumn =
        await columnExists(
          connection,
          "deployment_assignments",
          "active_employee_id_guard"
        );

      const uniqueIndex =
        await uniqueIndexExists(
          connection,
          "deployment_assignments",
          "uq_deployment_assignments_one_active_employee"
        );

      return (
        guardColumn &&
        uniqueIndex
      );
    },
  },
  {
    name: "add_employee_documents_employee_id_index.sql",
    isApplied: async (connection) =>
      indexExists(
        connection,
        "employee_documents",
        "idx_employee_documents_employee_id"
      ),
  },
  {
    name: "add_employee_documents_expiration_index.sql",
    isApplied: async (connection) =>
      indexExists(
        connection,
        "employee_documents",
        "idx_employee_documents_expiration_name_employee"
      ),
  },
  {
    name: "add_audit_logs_category_created_index.sql",
    isApplied: async (connection) =>
      indexExists(
        connection,
        "audit_logs",
        "idx_audit_logs_category_created_id"
      ),
  },
];

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

function getConnectionOptions() {
  const port = Number.parseInt(
    requiredEnv("DB_PORT"),
    10
  );

  if (
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      "DB_PORT must be a valid TCP port number."
    );
  }

  return {
    host: requiredEnv(
      "DB_HOST"
    ),
    port,
    user: requiredEnv(
      "DB_USER"
    ),
    password: requiredEnv(
      "DB_PASSWORD",
      {
        allowEmpty: true,
      }
    ),
    database: requiredEnv(
      "DB_NAME"
    ),

    /*
     * Migration files are trusted, repository-owned
     * SQL and may contain multiple statements.
     */
    multipleStatements: true,
  };
}

function getMigrationPath(
  migrationName
) {
  const migrationPath =
    path.resolve(
      DATABASE_DIRECTORY,
      migrationName
    );

  const relativePath =
    path.relative(
      DATABASE_DIRECTORY,
      migrationPath
    );

  if (
    !relativePath ||
    relativePath.startsWith(
      ".."
    ) ||
    path.isAbsolute(
      relativePath
    )
  ) {
    throw new Error(
      `Unsafe migration path: ${migrationName}`
    );
  }

  return migrationPath;
}

function readMigration(
  migrationName
) {
  const migrationPath =
    getMigrationPath(
      migrationName
    );

  if (
    !fs.existsSync(
      migrationPath
    )
  ) {
    throw new Error(
      `Migration file not found: ${migrationName}`
    );
  }

  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  if (!sql.trim()) {
    throw new Error(
      `Migration file is empty: ${migrationName}`
    );
  }

  const checksum =
    crypto
      .createHash("sha256")
      .update(
        sql,
        "utf8"
      )
      .digest("hex");

  return {
    sql,
    checksum,
  };
}

async function ensureMigrationTable(
  connection
) {
  await connection.query(
    `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration_name VARCHAR(255) NOT NULL,
      checksum_sha256 CHAR(64) NOT NULL,
      execution_mode VARCHAR(20) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_name (
        migration_name
      )
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_general_ci
    `
  );
}

async function getRecordedMigrations(
  connection
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        migration_name,
        checksum_sha256,
        execution_mode,
        applied_at
      FROM schema_migrations
      ORDER BY id ASC
      `
    );

  return new Map(
    rows.map(
      (row) => [
        row.migration_name,
        row,
      ]
    )
  );
}

async function recordMigration(
  connection,
  {
    migrationName,
    checksum,
    executionMode,
  }
) {
  await connection.query(
    `
    INSERT INTO schema_migrations (
      migration_name,
      checksum_sha256,
      execution_mode
    )
    VALUES (?, ?, ?)
    `,
    [
      migrationName,
      checksum,
      executionMode,
    ]
  );
}

async function tableExists(
  connection,
  tableName
) {
  const [rows] =
    await connection.query(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND TABLE_TYPE = 'BASE TABLE'
      `,
      [
        tableName,
      ]
    );

  return (
    Number(
      rows[0]?.count ||
      0
    ) > 0
  );
}

async function columnExists(
  connection,
  tableName,
  columnName
) {
  const [rows] =
    await connection.query(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      `,
      [
        tableName,
        columnName,
      ]
    );

  return (
    Number(
      rows[0]?.count ||
      0
    ) > 0
  );
}

async function indexExists(
  connection,
  tableName,
  indexName
) {
  const [rows] =
    await connection.query(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      `,
      [
        tableName,
        indexName,
      ]
    );

  return (
    Number(
      rows[0]?.count ||
      0
    ) > 0
  );
}

async function uniqueIndexExists(
  connection,
  tableName,
  indexName
) {
  const [rows] =
    await connection.query(
      `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
        AND NON_UNIQUE = 0
      `,
      [
        tableName,
        indexName,
      ]
    );

  return (
    Number(
      rows[0]?.count ||
      0
    ) > 0
  );
}

async function acquireMigrationLock(
  connection
) {
  const [rows] =
    await connection.query(
      `
      SELECT GET_LOCK(?, 15) AS acquired
      `,
      [
        MIGRATION_LOCK_NAME,
      ]
    );

  if (
    Number(
      rows[0]?.acquired
    ) !== 1
  ) {
    throw new Error(
      "Could not acquire the database migration lock."
    );
  }
}

async function releaseMigrationLock(
  connection
) {
  try {
    await connection.query(
      `
      SELECT RELEASE_LOCK(?) AS released
      `,
      [
        MIGRATION_LOCK_NAME,
      ]
    );
  } catch (error) {
    console.error(
      "WARNING: Unable to release migration lock:",
      error?.message ||
        error
    );
  }
}

async function runMigrations() {
  const connection =
    await mysql.createConnection(
      getConnectionOptions()
    );

  let lockAcquired = false;

  try {
    console.log(
      "WELLJOB HRIS database migrations"
    );

    console.log(
      `Database: ${requiredEnv("DB_NAME")}`
    );

    await acquireMigrationLock(
      connection
    );

    lockAcquired = true;

    await ensureMigrationTable(
      connection
    );

    const recorded =
      await getRecordedMigrations(
        connection
      );

    let executedCount = 0;
    let adoptedCount = 0;
    let skippedCount = 0;

    for (
      const migration of
        MIGRATIONS
    ) {
      const {
        sql,
        checksum,
      } =
        readMigration(
          migration.name
        );

      const recordedMigration =
        recorded.get(
          migration.name
        );

      /*
       * Once a migration has been recorded, its
       * repository SQL must not silently change.
       */
      if (
        recordedMigration
      ) {
        if (
          recordedMigration
            .checksum_sha256 !==
          checksum
        ) {
          throw new Error(
            `Migration checksum mismatch: ${migration.name}. ` +
              "Create a new migration instead of editing an already-recorded migration."
          );
        }

        const stateStillPresent =
          await migration.isApplied(
            connection
          );

        if (
          !stateStillPresent
        ) {
          throw new Error(
            `Recorded migration state is missing from the database: ${migration.name}`
          );
        }

        skippedCount += 1;

        console.log(
          `SKIP    ${migration.name}`
        );

        continue;
      }

      /*
       * Existing installations pre-date
       * schema_migrations. If the migration's full
       * end-state already exists, adopt it into the
       * ledger without re-running DDL.
       */
      const alreadyPresent =
        await migration.isApplied(
          connection
        );

      if (
        alreadyPresent
      ) {
        await recordMigration(
          connection,
          {
            migrationName:
              migration.name,
            checksum,
            executionMode:
              "adopted",
          }
        );

        adoptedCount += 1;

        console.log(
          `ADOPT   ${migration.name}`
        );

        continue;
      }

      console.log(
        `APPLY   ${migration.name}`
      );

      /*
       * MySQL/MariaDB DDL may auto-commit, so the
       * runner does not pretend that a transaction
       * can roll back every schema statement.
       *
       * Instead, migration completion is recorded
       * only after the expected end-state is
       * verified successfully.
       */
      await connection.query(
        sql
      );

      const appliedSuccessfully =
        await migration.isApplied(
          connection
        );

      if (
        !appliedSuccessfully
      ) {
        throw new Error(
          `Migration completed without producing its required schema state: ${migration.name}`
        );
      }

      await recordMigration(
        connection,
        {
          migrationName:
            migration.name,
          checksum,
          executionMode:
            "executed",
        }
      );

      executedCount += 1;

      console.log(
        `PASS    ${migration.name}`
      );
    }

    console.log(
      "\nMigration summary:"
    );

    console.table({
      "Executed now":
        executedCount,
      "Adopted existing":
        adoptedCount,
      "Already recorded":
        skippedCount,
      "Total migrations":
        MIGRATIONS.length,
    });

    console.log(
      "\nDATABASE MIGRATIONS PASSED."
    );
  } finally {
    if (
      lockAcquired
    ) {
      await releaseMigrationLock(
        connection
      );
    }

    await connection.end();
  }
}

runMigrations().catch(
  (error) => {
    console.error(
      "\nDATABASE MIGRATION FAILED:",
      error?.message ||
        error
    );

    process.exitCode = 1;
  }
);
