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

  {
    name: "add_hr_coordinator_scope.sql",
    isApplied: async (connection) => {
      const roleSupportsHrCoordinator =
        await enumColumnContains(
          connection,
          "users",
          "role",
          "HR_COORDINATOR"
        );

      const assignedCompanyColumn =
        await columnExists(
          connection,
          "users",
          "assigned_company"
        );

      const roleCompanyIndex =
        await indexExists(
          connection,
          "users",
          "idx_users_role_assigned_company"
        );

      return (
        roleSupportsHrCoordinator &&
        assignedCompanyColumn &&
        roleCompanyIndex
      );
    },
  },

  /*
   * ==================================================
   * CLIENT COMPANY + POSITION MASTER DATA
   * ==================================================
   *
   * This migration creates the authoritative option
   * lists used by System Configuration.
   *
   * Existing string-based operational fields remain
   * intact so historical deployment/company/position
   * snapshots are preserved.
   *
   * The state check also validates the legacy-data
   * backfill. This prevents a partially executed
   * migration from being incorrectly adopted merely
   * because its tables happen to exist.
   */
  {
    name: "add_company_position_master_data.sql",

    /*
     * Once recorded, only the persistent schema contract is
     * checked on future migration runs.
     *
     * Historical backfill completeness is verified only while
     * adopting an existing unrecorded state or immediately
     * after migration #10 executes.
     */
    isApplied: async (connection) =>
      companyPositionMasterDataSchemaIsApplied(
        connection
      ),

    canAdopt: async (connection) =>
      companyPositionMasterDataIsApplied(
        connection
      ),

    verifyApplied: async (connection) =>
      companyPositionMasterDataIsApplied(
        connection
      ),

    preflight: async (connection) =>
      validateCompanyPositionMasterDataSource(
        connection
      ),
  },

  {
    name: "add_user_email_password_reset.sql",
    isApplied: async (connection) =>
      passwordResetSchemaIsApplied(connection),
  },

  {
    name: "add_password_reset_approval_requests.sql",
    isApplied: async (connection) =>
      passwordResetApprovalSchemaIsApplied(connection),
  },

  {
    name: "add_account_credentials_delivery_status.sql",
    isApplied: async (connection) =>
      accountCredentialsDeliverySchemaIsApplied(connection),
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
     * Migration files are trusted,
     * repository-owned SQL and may contain
     * multiple statements.
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

  const columnType =
    String(
      rows[0]?.column_type ||
        ""
    );

  return columnType.includes(
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

async function uniqueIndexExists(
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

async function foreignKeyExists(
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

async function validateCompanyPositionMasterDataSource(
  connection
) {
  const [
    companyLengthRows,
  ] =
    await connection.query(
      `
      SELECT
        MAX(
          CHAR_LENGTH(
            source.company_name
          )
        ) AS max_company_length
      FROM (
        SELECT
          CONVERT(
            TRIM(company)
            USING utf8mb4
          ) AS company_name
        FROM deployment_assignments
        WHERE company IS NOT NULL
          AND TRIM(company) <> ''

        UNION ALL

        SELECT
          CONVERT(
            TRIM(company)
            USING utf8mb4
          ) AS company_name
        FROM employees
        WHERE company IS NOT NULL
          AND TRIM(company) <> ''

        UNION ALL

        SELECT
          CONVERT(
            TRIM(company)
            USING utf8mb4
          ) AS company_name
        FROM incidents
        WHERE company IS NOT NULL
          AND TRIM(company) <> ''

        UNION ALL

        SELECT
          CONVERT(
            TRIM(assigned_company)
            USING utf8mb4
          ) AS company_name
        FROM users
        WHERE assigned_company IS NOT NULL
          AND TRIM(assigned_company) <> ''
      ) AS source
      `
    );

  const maxCompanyLength =
    Number(
      companyLengthRows[
        0
      ]?.max_company_length ||
        0
    );

  if (
    maxCompanyLength >
    255
  ) {
    throw new Error(
      "Migration #10 preflight failed: an existing company value exceeds 255 characters."
    );
  }

  const [
    positionLengthRows,
  ] =
    await connection.query(
      `
      SELECT
        MAX(
          CHAR_LENGTH(
            CONVERT(
              TRIM(position)
              USING utf8mb4
            )
          )
        ) AS max_position_length
      FROM deployment_assignments
      WHERE position IS NOT NULL
        AND TRIM(position) <> ''
      `
    );

  const maxPositionLength =
    Number(
      positionLengthRows[
        0
      ]?.max_position_length ||
        0
    );

  if (
    maxPositionLength >
    150
  ) {
    throw new Error(
      "Migration #10 preflight failed: an existing deployment position exceeds 150 characters."
    );
  }
}

/*
 * ==================================================
 * COMPANY / POSITION MASTER-DATA STATE CHECK
 * ==================================================
 *
 * Verification includes:
 *
 * - required master tables
 * - required columns
 * - unique and lookup indexes
 * - company-position foreign key
 * - backfilled existing company names
 * - backfilled existing deployment positions
 *
 * The backfill verification is important because
 * MySQL/MariaDB DDL may auto-commit. If the migration
 * previously stopped after creating the tables but
 * before completing its INSERT statements, this
 * function returns false rather than adopting an
 * incomplete state.
 */
async function companyPositionMasterDataSchemaIsApplied(
  connection
) {
  const clientCompaniesTable =
    await tableExists(
      connection,
      "client_companies"
    );

  const companyPositionsTable =
    await tableExists(
      connection,
      "company_positions"
    );

  if (
    !clientCompaniesTable ||
    !companyPositionsTable
  ) {
    return false;
  }

  const requiredColumnChecks =
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
    requiredColumnChecks.some(
      (matches) =>
        !matches
    )
  ) {
    return false;
  }

  const requiredIndexChecks =
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
    requiredIndexChecks.some(
      (matches) =>
        !matches
    )
  ) {
    return false;
  }

  const companyPositionForeignKey =
    await foreignKeyExists(
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

  return Boolean(
    companyPositionForeignKey
  );
}

async function companyPositionMasterDataIsApplied(
  connection
) {
  const schemaApplied =
    await companyPositionMasterDataSchemaIsApplied(
      connection
    );

  if (
    !schemaApplied
  ) {
    return false;
  }

  const [
    missingCompanyRows,
  ] =
    await connection.query(
      `
      SELECT
        COUNT(*) AS missing_count
      FROM (
        SELECT DISTINCT
          source.company_name
        FROM (
          SELECT
            CONVERT(
              TRIM(company)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
              AS company_name
          FROM deployment_assignments
          WHERE company IS NOT NULL
            AND TRIM(company) <> ''

          UNION

          SELECT
            CONVERT(
              TRIM(company)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
              AS company_name
          FROM employees
          WHERE company IS NOT NULL
            AND TRIM(company) <> ''

          UNION

          SELECT
            CONVERT(
              TRIM(company)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
              AS company_name
          FROM incidents
          WHERE company IS NOT NULL
            AND TRIM(company) <> ''

          UNION

          SELECT
            CONVERT(
              TRIM(assigned_company)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
              AS company_name
          FROM users
          WHERE assigned_company IS NOT NULL
            AND TRIM(assigned_company) <> ''
        ) AS source

        WHERE source.company_name IS NOT NULL
          AND source.company_name <> ''
      ) AS existing_companies

      LEFT JOIN client_companies AS master_company
        ON (
          CONVERT(
            TRIM(
              master_company.company_name
            )
            USING utf8mb4
          ) COLLATE utf8mb4_unicode_ci
        ) =
        existing_companies.company_name

      WHERE master_company.id IS NULL
      `
    );

  const missingCompanyCount =
    Number(
      missingCompanyRows[
        0
      ]?.missing_count ||
        0
    );

  if (
    missingCompanyCount >
    0
  ) {
    return false;
  }

  const [
    missingPositionRows,
  ] =
    await connection.query(
      `
      SELECT
        COUNT(*) AS missing_count
      FROM (
        SELECT DISTINCT
          CONVERT(
            TRIM(company)
            USING utf8mb4
          ) COLLATE utf8mb4_unicode_ci
            AS company_name,

          CONVERT(
            TRIM(position)
            USING utf8mb4
          ) COLLATE utf8mb4_unicode_ci
            AS position_name

        FROM deployment_assignments

        WHERE company IS NOT NULL
          AND TRIM(company) <> ''

          AND position IS NOT NULL
          AND TRIM(position) <> ''
      ) AS existing_positions

      INNER JOIN client_companies AS master_company
        ON (
          CONVERT(
            TRIM(
              master_company.company_name
            )
            USING utf8mb4
          ) COLLATE utf8mb4_unicode_ci
        ) =
        existing_positions.company_name

      LEFT JOIN company_positions AS master_position
        ON master_position.company_id =
          master_company.id

        AND (
          CONVERT(
            TRIM(
              master_position.position_name
            )
            USING utf8mb4
          ) COLLATE utf8mb4_unicode_ci
        ) =
        existing_positions.position_name

      WHERE master_position.id IS NULL
      `
    );

  const missingPositionCount =
    Number(
      missingPositionRows[
        0
      ]?.missing_count ||
        0
    );

  return (
    missingPositionCount ===
    0
  );
}


/*
 * ==================================================
 * REGISTERED EMAIL + PASSWORD RESET SCHEMA
 * ==================================================
 */
async function passwordResetSchemaIsApplied(connection) {
  const columnChecks = await Promise.all([
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

  if (columnChecks.some((matches) => !matches)) {
    return false;
  }

  const indexChecks = await Promise.all([
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

  return indexChecks.every(Boolean);
}


/*
 * ==================================================
 * FORGOT PASSWORD APPROVAL REQUESTS - MIGRATION #12
 * ==================================================
 *
 * Verify the required table structure before adopting
 * or recording this migration as successfully applied.
 */
async function passwordResetApprovalSchemaIsApplied(connection) {
  const tableName = "password_reset_requests";

  if (!(await tableExists(connection, tableName))) {
    return false;
  }

  const columns = [
    {
      columnName: "id",
      dataType: "bigint",
      nullable: false,
      unsigned: true,
      extraIncludes: "auto_increment",
    },
    {
      columnName: "user_id",
      dataType: "int",
      nullable: false,
    },
    {
      columnName: "requested_token_version",
      dataType: "int",
      nullable: false,
      unsigned: true,
    },
    {
      columnName: "status",
      dataType: "enum",
      nullable: false,
    },
    {
      columnName: "requested_at",
      dataType: "datetime",
      nullable: false,
    },
    {
      columnName: "expires_at",
      dataType: "datetime",
      nullable: false,
    },
    {
      columnName: "reviewed_by_user_id",
      dataType: "int",
      nullable: true,
    },
    {
      columnName: "reviewed_at",
      dataType: "datetime",
      nullable: true,
    },
    {
      columnName: "identity_verification_method",
      dataType: "varchar",
      maxLength: 32,
      nullable: true,
      collationName: "utf8mb4_general_ci",
    },
    {
      columnName: "identity_verified_at",
      dataType: "datetime",
      nullable: true,
    },
    {
      columnName: "sent_at",
      dataType: "datetime",
      nullable: true,
    },
    {
      columnName: "delivery_failed_at",
      dataType: "datetime",
      nullable: true,
    },
    {
      columnName: "updated_at",
      dataType: "timestamp",
      nullable: false,
      extraIncludes: "on update",
    },
  ];

  const columnChecks = await Promise.all(
    columns.map((definition) =>
      columnDefinitionMatches(connection, {
        tableName,
        ...definition,
      })
    )
  );

  if (columnChecks.some((matches) => !matches)) {
    return false;
  }

  const requiredStatuses = [
    "PENDING",
    "SENDING",
    "SENT",
    "REJECTED",
    "EXPIRED",
    "SEND_FAILED",
    "CANCELLED",
  ];

  const statusChecks = await Promise.all(
    requiredStatuses.map((status) =>
      enumColumnContains(
        connection,
        tableName,
        "status",
        status
      )
    )
  );

  if (statusChecks.some((matches) => !matches)) {
    return false;
  }

  const indexes = [
    {
      indexName: "PRIMARY",
      columns: ["id"],
      unique: true,
    },
    {
      indexName: "idx_password_reset_requests_user_status",
      columns: ["user_id", "status", "requested_at"],
    },
    {
      indexName: "idx_password_reset_requests_status_expiry",
      columns: ["status", "expires_at", "requested_at"],
    },
    {
      indexName: "idx_password_reset_requests_reviewer",
      columns: ["reviewed_by_user_id", "reviewed_at"],
    },
  ];

  const indexChecks = await Promise.all(
    indexes.map((definition) =>
      indexDefinitionMatches(connection, {
        tableName,
        ...definition,
      })
    )
  );

  if (indexChecks.some((matches) => !matches)) {
    return false;
  }

  const foreignKeys = [
    {
      constraintName: "fk_password_reset_requests_user",
      columnName: "user_id",
      referencedTableName: "users",
      referencedColumnName: "id",
      updateRule: "RESTRICT",
      deleteRule: "RESTRICT",
    },
    {
      constraintName: "fk_password_reset_requests_reviewer",
      columnName: "reviewed_by_user_id",
      referencedTableName: "users",
      referencedColumnName: "id",
      updateRule: "RESTRICT",
      deleteRule: "RESTRICT",
    },
  ];

  const foreignKeyChecks = await Promise.all(
    foreignKeys.map((definition) =>
      foreignKeyExists(connection, {
        tableName,
        ...definition,
      })
    )
  );

  return foreignKeyChecks.every(Boolean);
}

/*
 * ==================================================
 * ACCOUNT CREDENTIALS DELIVERY - MIGRATION #13
 * ==================================================
 *
 * A separate delivery state distinguishes accounts
 * with failed credentials delivery from accounts
 * intentionally deactivated by an administrator.
 *
 * Existing accounts retain NULL delivery status.
 */
async function accountCredentialsDeliverySchemaIsApplied(
  connection
) {
  const deliveryColumnMatches =
    await columnDefinitionMatches(
      connection,
      {
        tableName: "users",
        columnName: "account_credentials_delivery_status",
        dataType: "enum",
        nullable: true,
      }
    );

  if (!deliveryColumnMatches) {
    return false;
  }

  const requiredDeliveryStatuses = [
    "PENDING",
    "SENDING",
    "FAILED",
    "SMTP_ACCEPTED",
  ];

  const statusChecks = await Promise.all(
    requiredDeliveryStatuses.map(
      (status) =>
        enumColumnContains(
          connection,
          "users",
          "account_credentials_delivery_status",
          status
        )
    )
  );

  if (statusChecks.some((matches) => !matches)) {
    return false;
  }

  return indexDefinitionMatches(
    connection,
    {
      tableName: "users",
      indexName:
        "idx_users_account_credentials_delivery_status",
      columns: [
        "account_credentials_delivery_status",
        "status",
      ],
    }
  );
}
async function acquireMigrationLock(
  connection
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        GET_LOCK(?, 15) AS acquired
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
      SELECT
        RELEASE_LOCK(?) AS released
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

  let lockAcquired =
    false;

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

    lockAcquired =
      true;

    await ensureMigrationTable(
      connection
    );

    const recorded =
      await getRecordedMigrations(
        connection
      );

    let executedCount =
      0;

    let adoptedCount =
      0;

    let skippedCount =
      0;

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

        skippedCount +=
          1;

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
      const adoptionChecker =
        migration.canAdopt ||
        migration.isApplied;

      const alreadyPresent =
        await adoptionChecker(
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

        adoptedCount +=
          1;

        console.log(
          `ADOPT   ${migration.name}`
        );

        continue;
      }

      if (
        typeof migration.preflight ===
        "function"
      ) {
        console.log(
          `CHECK   ${migration.name}`
        );

        await migration.preflight(
          connection
        );
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

      const verificationChecker =
        migration.verifyApplied ||
        migration.isApplied;

      const appliedSuccessfully =
        await verificationChecker(
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

      executedCount +=
        1;

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

    process.exitCode =
      1;
  }
);