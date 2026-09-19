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

const REQUIRED_APPLICATION_TABLES = [
  "users",
  "employees",
  "system_settings",
  "audit_logs",
  "employee_documents",
  "deployment_assignments",
  "employee_status_history",
  "incidents",
  "incident_evidence",
  "incident_timeline",
  "kpi_decision_history",
  "smart_alert_states",
  "smart_suggestion_states",
  "client_companies",
  "company_positions",
];

const REQUIRED_SYSTEM_TABLES = [
  "schema_migrations",
];

const EXPECTED_MIGRATIONS = [
  "add_employee_lifecycle_history.sql",
  "add_incident_timeline.sql",
  "smart_suggestion_states.sql",
  "add_incident_policy_sanction.sql",
  "add_one_active_deployment_invariant.sql",
  "add_employee_documents_employee_id_index.sql",
  "add_employee_documents_expiration_index.sql",
  "add_audit_logs_category_created_index.sql",
  "add_hr_coordinator_scope.sql",
  "add_company_position_master_data.sql",
  "add_user_email_password_reset.sql",
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

async function tableExists(
  connection,
  tableName
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        COUNT(*) AS count
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
      SELECT
        COUNT(*) AS count
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

async function enumColumnContains(
  connection,
  tableName,
  columnName,
  enumValue
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        COLUMN_TYPE AS column_type
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [
        tableName,
        columnName,
      ]
    );

  if (
    rows.length ===
    0
  ) {
    return false;
  }

  return String(
    rows[0]?.column_type ||
      ""
  ).includes(
    `'${String(enumValue)}'`
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
      SELECT
        COUNT(*) AS count
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

async function columnDefinitionMatches(
  connection,
  {
    tableName,
    columnName,
    dataType,
    maxLength = null,
    nullable = null,
    unsigned = false,
    collationName = null,
    extraIncludes = null,
  }
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        DATA_TYPE AS data_type,
        CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
        IS_NULLABLE AS is_nullable,
        COLUMN_TYPE AS column_type,
        COLLATION_NAME AS collation_name,
        EXTRA AS extra
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [
        tableName,
        columnName,
      ]
    );

  if (
    rows.length ===
    0
  ) {
    return false;
  }

  const row =
    rows[0];

  if (
    String(
      row.data_type ||
        ""
    ).toLowerCase() !==
    String(
      dataType ||
        ""
    ).toLowerCase()
  ) {
    return false;
  }

  if (
    maxLength !==
      null &&
    Number(
      row.character_maximum_length
    ) !==
      Number(
        maxLength
      )
  ) {
    return false;
  }

  if (
    typeof nullable ===
    "boolean"
  ) {
    const actuallyNullable =
      String(
        row.is_nullable ||
          ""
      ).toUpperCase() ===
      "YES";

    if (
      actuallyNullable !==
      nullable
    ) {
      return false;
    }
  }

  if (
    unsigned &&
    !String(
      row.column_type ||
        ""
    )
      .toLowerCase()
      .includes(
        "unsigned"
      )
  ) {
    return false;
  }

  if (
    collationName &&
    String(
      row.collation_name ||
        ""
    ).toLowerCase() !==
      String(
        collationName
      ).toLowerCase()
  ) {
    return false;
  }

  if (
    extraIncludes &&
    !String(
      row.extra ||
        ""
    )
      .toLowerCase()
      .includes(
        String(
          extraIncludes
        ).toLowerCase()
      )
  ) {
    return false;
  }

  return true;
}

async function indexDefinitionMatches(
  connection,
  {
    tableName,
    indexName,
    columns,
    unique = false,
  }
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        COLUMN_NAME AS column_name,
        SEQ_IN_INDEX AS seq_in_index,
        NON_UNIQUE AS non_unique
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      ORDER BY SEQ_IN_INDEX ASC
      `,
      [
        tableName,
        indexName,
      ]
    );

  if (
    rows.length !==
    columns.length
  ) {
    return false;
  }

  const expectedNonUnique =
    unique
      ? 0
      : 1;

  return rows.every(
    (
      row,
      index
    ) =>
      String(
        row.column_name ||
          ""
      ) ===
        String(
          columns[
            index
          ] ||
            ""
        ) &&
      Number(
        row.seq_in_index
      ) ===
        index +
          1 &&
      Number(
        row.non_unique
      ) ===
        expectedNonUnique
  );
}

async function foreignKeyDefinitionMatches(
  connection,
  {
    tableName,
    constraintName,
    columnName,
    referencedTableName,
    referencedColumnName,
    updateRule,
    deleteRule,
  }
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        kcu.COLUMN_NAME AS column_name,
        kcu.REFERENCED_TABLE_NAME AS referenced_table_name,
        kcu.REFERENCED_COLUMN_NAME AS referenced_column_name,
        rc.UPDATE_RULE AS update_rule,
        rc.DELETE_RULE AS delete_rule
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
        ON rc.CONSTRAINT_SCHEMA =
          kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME =
          kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME =
          kcu.TABLE_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.CONSTRAINT_NAME = ?
      LIMIT 1
      `,
      [
        tableName,
        constraintName,
      ]
    );

  if (
    rows.length ===
    0
  ) {
    return false;
  }

  const row =
    rows[0];

  return (
    String(
      row.column_name ||
        ""
    ) ===
      String(
        columnName ||
          ""
      ) &&
    String(
      row.referenced_table_name ||
        ""
    ) ===
      String(
        referencedTableName ||
          ""
      ) &&
    String(
      row.referenced_column_name ||
        ""
    ) ===
      String(
        referencedColumnName ||
          ""
      ) &&
    String(
      row.update_rule ||
        ""
    ).toUpperCase() ===
      String(
        updateRule ||
          ""
      ).toUpperCase() &&
    String(
      row.delete_rule ||
        ""
    ).toUpperCase() ===
      String(
        deleteRule ||
          ""
      ).toUpperCase()
  );
}

async function verifyCoreSchema(
  connection
) {
  const requiredTables = [
    ...REQUIRED_APPLICATION_TABLES,
    ...REQUIRED_SYSTEM_TABLES,
  ];

  const [rows] =
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
    missing.length >
    0
  ) {
    throw new Error(
      `Database setup verification failed. Missing table(s): ${missing.join(", ")}`
    );
  }

  const usersSupportHrCoordinator =
    await enumColumnContains(
      connection,
      "users",
      "role",
      "HR_COORDINATOR"
    );

  if (
    !usersSupportHrCoordinator
  ) {
    throw new Error(
      "Database setup verification failed. users.role does not include HR_COORDINATOR."
    );
  }

  const assignedCompanyExists =
    await columnExists(
      connection,
      "users",
      "assigned_company"
    );

  if (
    !assignedCompanyExists
  ) {
    throw new Error(
      "Database setup verification failed. users.assigned_company is missing."
    );
  }

  const hrCoordinatorScopeIndexExists =
    await indexExists(
      connection,
      "users",
      "idx_users_role_assigned_company"
    );

  if (
    !hrCoordinatorScopeIndexExists
  ) {
    throw new Error(
      "Database setup verification failed. idx_users_role_assigned_company is missing."
    );
  }


  /*
   * Registered email and password-reset schema.
   *
   * These fields are nullable so existing user
   * accounts remain valid before email registration.
   */
  const passwordResetColumnChecks = await Promise.all([
    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "email",
      dataType: "varchar",
      maxLength: 254,
      nullable: true,
      collationName: "utf8mb4_general_ci",
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "email_verified_at",
      dataType: "datetime",
      nullable: true,
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "email_verification_token_hash",
      dataType: "char",
      maxLength: 64,
      nullable: true,
      collationName: "utf8mb4_general_ci",
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "email_verification_expires_at",
      dataType: "datetime",
      nullable: true,
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "email_verification_requested_at",
      dataType: "datetime",
      nullable: true,
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "password_reset_token_hash",
      dataType: "char",
      maxLength: 64,
      nullable: true,
      collationName: "utf8mb4_general_ci",
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "password_reset_expires_at",
      dataType: "datetime",
      nullable: true,
    }),

    columnDefinitionMatches(connection, {
      tableName: "users",
      columnName: "password_reset_requested_at",
      dataType: "datetime",
      nullable: true,
    }),
  ]);

  if (passwordResetColumnChecks.some((matches) => !matches)) {
    throw new Error(
      "Database setup verification failed. User email/password-reset columns do not match the canonical schema."
    );
  }

  const passwordResetIndexChecks = await Promise.all([
    indexDefinitionMatches(connection, {
      tableName: "users",
      indexName: "uq_users_email",
      columns: ["email"],
      unique: true,
    }),

    indexDefinitionMatches(connection, {
      tableName: "users",
      indexName: "uq_users_email_verification_token_hash",
      columns: ["email_verification_token_hash"],
      unique: true,
    }),

    indexDefinitionMatches(connection, {
      tableName: "users",
      indexName: "uq_users_password_reset_token_hash",
      columns: ["password_reset_token_hash"],
      unique: true,
    }),
  ]);

  if (passwordResetIndexChecks.some((matches) => !matches)) {
    throw new Error(
      "Database setup verification failed. User email/password-reset indexes do not match the canonical schema."
    );
  }

  const clientCompanyColumnChecks =
    await Promise.all([
      columnDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          columnName:
            "id",

          dataType:
            "bigint",

          nullable:
            false,

          unsigned:
            true,

          extraIncludes:
            "auto_increment",
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          columnName:
            "company_name",

          dataType:
            "varchar",

          maxLength:
            255,

          nullable:
            false,

          collationName:
            "utf8mb4_unicode_ci",
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          columnName:
            "is_active",

          dataType:
            "tinyint",

          nullable:
            false,
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          columnName:
            "created_at",

          dataType:
            "timestamp",

          nullable:
            false,
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          columnName:
            "updated_at",

          dataType:
            "timestamp",

          nullable:
            false,

          extraIncludes:
            "on update",
        }
      ),
    ]);

  if (
    clientCompanyColumnChecks.some(
      (matches) =>
        !matches
    )
  ) {
    throw new Error(
      "Database setup verification failed. client_companies column definitions do not match the canonical schema."
    );
  }

  const clientCompanyIndexChecks =
    await Promise.all([
      indexDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          indexName:
            "PRIMARY",

          columns: [
            "id",
          ],

          unique:
            true,
        }
      ),

      indexDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          indexName:
            "uq_client_companies_company_name",

          columns: [
            "company_name",
          ],

          unique:
            true,
        }
      ),

      indexDefinitionMatches(
        connection,
        {
          tableName:
            "client_companies",

          indexName:
            "idx_client_companies_active_name",

          columns: [
            "is_active",
            "company_name",
          ],
        }
      ),
    ]);

  if (
    clientCompanyIndexChecks.some(
      (matches) =>
        !matches
    )
  ) {
    throw new Error(
      "Database setup verification failed. client_companies indexes do not match the canonical schema."
    );
  }

  const companyPositionColumnChecks =
    await Promise.all([
      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "id",

          dataType:
            "bigint",

          nullable:
            false,

          unsigned:
            true,

          extraIncludes:
            "auto_increment",
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "company_id",

          dataType:
            "bigint",

          nullable:
            false,

          unsigned:
            true,
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "position_name",

          dataType:
            "varchar",

          maxLength:
            150,

          nullable:
            false,

          collationName:
            "utf8mb4_unicode_ci",
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "is_active",

          dataType:
            "tinyint",

          nullable:
            false,
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "created_at",

          dataType:
            "timestamp",

          nullable:
            false,
        }
      ),

      columnDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          columnName:
            "updated_at",

          dataType:
            "timestamp",

          nullable:
            false,

          extraIncludes:
            "on update",
        }
      ),
    ]);

  if (
    companyPositionColumnChecks.some(
      (matches) =>
        !matches
    )
  ) {
    throw new Error(
      "Database setup verification failed. company_positions column definitions do not match the canonical schema."
    );
  }

  const companyPositionIndexChecks =
    await Promise.all([
      indexDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          indexName:
            "PRIMARY",

          columns: [
            "id",
          ],

          unique:
            true,
        }
      ),

      indexDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          indexName:
            "uq_company_positions_company_position",

          columns: [
            "company_id",
            "position_name",
          ],

          unique:
            true,
        }
      ),

      indexDefinitionMatches(
        connection,
        {
          tableName:
            "company_positions",

          indexName:
            "idx_company_positions_company_active_name",

          columns: [
            "company_id",
            "is_active",
            "position_name",
          ],
        }
      ),
    ]);

  if (
    companyPositionIndexChecks.some(
      (matches) =>
        !matches
    )
  ) {
    throw new Error(
      "Database setup verification failed. company_positions indexes do not match the canonical schema."
    );
  }

  const companyPositionForeignKey =
    await foreignKeyDefinitionMatches(
      connection,
      {
        tableName:
          "company_positions",

        constraintName:
          "fk_company_positions_company",

        columnName:
          "company_id",

        referencedTableName:
          "client_companies",

        referencedColumnName:
          "id",

        updateRule:
          "CASCADE",

        deleteRule:
          "RESTRICT",
      }
    );

  if (
    !companyPositionForeignKey
  ) {
    throw new Error(
      "Database setup verification failed. fk_company_positions_company does not match the canonical foreign-key definition."
    );
  }

  const [migrationRows] =
    await connection.query(
      `
      SELECT
        migration_name,
        checksum_sha256,
        execution_mode
      FROM schema_migrations
      ORDER BY id ASC
      `
    );

  if (
    migrationRows.length !==
    EXPECTED_MIGRATIONS.length
  ) {
    throw new Error(
      `Database setup verification failed. Expected ${EXPECTED_MIGRATIONS.length} recorded migrations but found ${migrationRows.length}.`
    );
  }

  const expectedMigrationSet =
    new Set(
      EXPECTED_MIGRATIONS
    );

  const recordedMigrationNames =
    migrationRows.map(
      (row) =>
        String(
          row.migration_name ||
            ""
        )
    );

  const recordedMigrationSet =
    new Set(
      recordedMigrationNames
    );

  if (
    recordedMigrationSet.size !==
    recordedMigrationNames.length
  ) {
    throw new Error(
      "Database setup verification failed. Duplicate migration names were found in schema_migrations."
    );
  }

  const missingMigrations =
    EXPECTED_MIGRATIONS.filter(
      (migrationName) =>
        !recordedMigrationSet.has(
          migrationName
        )
    );

  const unexpectedMigrations =
    [
      ...recordedMigrationSet,
    ].filter(
      (migrationName) =>
        !expectedMigrationSet.has(
          migrationName
        )
    );

  if (
    missingMigrations.length >
      0 ||
    unexpectedMigrations.length >
      0
  ) {
    const details = [];

    if (
      missingMigrations.length >
      0
    ) {
      details.push(
        `missing: ${missingMigrations.join(", ")}`
      );
    }

    if (
      unexpectedMigrations.length >
      0
    ) {
      details.push(
        `unexpected: ${unexpectedMigrations.join(", ")}`
      );
    }

    throw new Error(
      `Database setup verification failed. Migration ledger mismatch (${details.join("; ")}).`
    );
  }

  for (
    const row of
      migrationRows
  ) {
    const migrationName =
      String(
        row.migration_name ||
          ""
      );

    const checksum =
      String(
        row.checksum_sha256 ||
          ""
      );

    const executionMode =
      String(
        row.execution_mode ||
          ""
      );

    if (
      !/^[a-f0-9]{64}$/i.test(
        checksum
      )
    ) {
      throw new Error(
        `Database setup verification failed. Invalid migration checksum format for ${migrationName}.`
      );
    }

    if (
      ![
        "executed",
        "adopted",
      ].includes(
        executionMode
      )
    ) {
      throw new Error(
        `Database setup verification failed. Invalid execution mode "${executionMode}" for ${migrationName}.`
      );
    }
  }

  console.log(
    `Verified ${REQUIRED_APPLICATION_TABLES.length} application tables and ${REQUIRED_SYSTEM_TABLES.length} migration ledger table.`
  );

  console.log(
    "Verified HR Coordinator scope."
  );

  console.log(
    "Verified exact client-company and company-position master-data schema."
  );

  console.log(
    `Verified all ${EXPECTED_MIGRATIONS.length} expected migration ledger records.`
  );
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