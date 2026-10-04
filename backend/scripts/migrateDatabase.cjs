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

    prepare: async (
      connection,
      databaseFamily
    ) =>
      prepareOneActiveDeploymentInvariantForMySql(
        connection,
        databaseFamily
      ),

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

  /*
   * ==================================================
   * ATTENDANCE TRACKING - MIGRATION #14
   * ==================================================
   */
  {
    name: "add_attendance_tracking.sql",

    isApplied: async (connection) => {
      const tableChecks =
        await Promise.all([
          tableExists(
            connection,
            "attendance_batches"
          ),

          tableExists(
            connection,
            "attendance_entries"
          ),

          tableExists(
            connection,
            "attendance_evidence"
          ),
        ]);

      if (
        tableChecks.some(
          (exists) => !exists
        )
      ) {
        return false;
      }

      const columnChecks =
        await Promise.all([
          columnExists(
            connection,
            "attendance_batches",
            "company"
          ),

          columnExists(
            connection,
            "attendance_batches",
            "attendance_date"
          ),

          columnExists(
            connection,
            "attendance_batches",
            "source"
          ),

          columnExists(
            connection,
            "attendance_batches",
            "created_by_user_id"
          ),

          columnExists(
            connection,
            "attendance_entries",
            "batch_id"
          ),

          columnExists(
            connection,
            "attendance_entries",
            "employee_id"
          ),

          columnExists(
            connection,
            "attendance_entries",
            "deployment_assignment_id"
          ),

          columnExists(
            connection,
            "attendance_entries",
            "attendance_status"
          ),

          columnExists(
            connection,
            "attendance_entries",
            "note"
          ),

          columnExists(
            connection,
            "attendance_evidence",
            "batch_id"
          ),

          columnExists(
            connection,
            "attendance_evidence",
            "object_path"
          ),

          columnExists(
            connection,
            "attendance_evidence",
            "uploaded_by_user_id"
          ),
        ]);

      if (
        columnChecks.some(
          (exists) => !exists
        )
      ) {
        return false;
      }

      const enumChecks =
        await Promise.all([
          enumColumnExactlyMatches(
            connection,
            "attendance_batches",
            "source",
            [
              "coordinator",
              "client",
            ]
          ),

          enumColumnExactlyMatches(
            connection,
            "attendance_entries",
            "attendance_status",
            [
              "Unmarked",
              "Present",
              "Late",
              "Absent",
              "On Leave",
              "Rest Day",
            ]
          ),
        ]);

      if (
        enumChecks.some(
          (matches) => !matches
        )
      ) {
        return false;
      }

      const indexChecks =
        await Promise.all([
          uniqueIndexExists(
            connection,
            "attendance_batches",
            "uq_attendance_batches_company_date"
          ),

          uniqueIndexExists(
            connection,
            "attendance_entries",
            "uq_attendance_entries_batch_employee"
          ),

          uniqueIndexExists(
            connection,
            "attendance_evidence",
            "uq_attendance_evidence_batch"
          ),

          indexExists(
            connection,
            "attendance_entries",
            "idx_attendance_entries_employee_batch"
          ),

          indexExists(
            connection,
            "attendance_entries",
            "idx_attendance_entries_deployment"
          ),

          indexExists(
            connection,
            "attendance_entries",
            "idx_attendance_entries_status"
          ),

          indexExists(
            connection,
            "attendance_batches",
            "idx_attendance_batches_created_by"
          ),

          indexExists(
            connection,
            "attendance_evidence",
            "idx_attendance_evidence_uploader"
          ),
        ]);

      if (
        indexChecks.some(
          (exists) => !exists
        )
      ) {
        return false;
      }

      const foreignKeyChecks =
        await Promise.all([
          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_batches",

              constraintName:
                "fk_attendance_batches_created_by",

              columnName:
                "created_by_user_id",

              referencedTableName:
                "users",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "RESTRICT",
            }
          ),

          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_entries",

              constraintName:
                "fk_attendance_entries_batch",

              columnName:
                "batch_id",

              referencedTableName:
                "attendance_batches",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "CASCADE",
            }
          ),

          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_entries",

              constraintName:
                "fk_attendance_entries_employee",

              columnName:
                "employee_id",

              referencedTableName:
                "employees",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "RESTRICT",
            }
          ),

          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_entries",

              constraintName:
                "fk_attendance_entries_deployment",

              columnName:
                "deployment_assignment_id",

              referencedTableName:
                "deployment_assignments",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "RESTRICT",
            }
          ),

          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_evidence",

              constraintName:
                "fk_attendance_evidence_batch",

              columnName:
                "batch_id",

              referencedTableName:
                "attendance_batches",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "CASCADE",
            }
          ),

          foreignKeyExists(
            connection,
            {
              tableName:
                "attendance_evidence",

              constraintName:
                "fk_attendance_evidence_uploader",

              columnName:
                "uploaded_by_user_id",

              referencedTableName:
                "users",

              referencedColumnName:
                "id",

              updateRule:
                "RESTRICT",

              deleteRule:
                "RESTRICT",
            }
          ),
        ]);

      return foreignKeyChecks.every(
        Boolean
      );
    },
  },

  /*
   * ==================================================
   * MESSENGER SCHEMA - MIGRATION #15
   * ==================================================
   *
   * Existing installations may adopt this migration
   * only if their complete Messenger schema matches
   * the required production contract.
   */
  {
    name:
      "add_chat_messenger_schema.sql",

    isApplied:
      chatMessengerSchemaIsApplied,

    canAdopt:
      chatMessengerSchemaIsApplied,

    verifyApplied:
      chatMessengerSchemaIsApplied,
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

function getDatabaseSslOptions(
  host
) {
  const encodedCertificate =
    String(
      process.env
        .DB_SSL_CA_BASE64 ??
      ""
    ).trim();

  if (
    !encodedCertificate
  ) {
    return undefined;
  }

  const caCertificate =
    Buffer.from(
      encodedCertificate,
      "base64"
    ).toString(
      "utf8"
    );

  if (
    !caCertificate.includes(
      "-----BEGIN CERTIFICATE-----"
    ) ||
    !caCertificate.includes(
      "-----END CERTIFICATE-----"
    )
  ) {
    throw new Error(
      "DB_SSL_CA_BASE64 must contain a valid Base64-encoded PEM certificate."
    );
  }

  return {
    ca:
      caCertificate,

    rejectUnauthorized:
      true,

    minVersion:
      "TLSv1.2",

    servername:
      host,
  };
}

function getConnectionOptions() {
  const host =
    requiredEnv(
      "DB_HOST"
    );

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
    host,

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

    ssl:
      getDatabaseSslOptions(
        host
      ),

    connectTimeout:
      15000,

    /*
     * Migration files are trusted,
     * repository-owned SQL and may contain
     * multiple statements.
     */
    multipleStatements: true,
  };
}

async function getDatabaseFamily(
  connection
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        VERSION() AS version,
        @@version_comment AS version_comment
      `
    );

  const identity =
    `${String(
      rows[0]?.version ||
      ""
    )} ${String(
      rows[0]?.version_comment ||
      ""
    )}`.toLowerCase();

  return identity.includes(
    "mariadb"
  )
    ? "mariadb"
    : "mysql";
}

function normalizeMigrationSqlForTarget(
  migrationName,
  sql,
  databaseFamily
) {
  if (
    databaseFamily !==
      "mysql" ||
    migrationName !==
      "add_one_active_deployment_invariant.sql"
  ) {
    return sql;
  }

  /*
   * MariaDB calls a stored generated column
   * PERSISTENT. MySQL uses STORED.
   *
   * The repository checksum is always calculated
   * from the original migration file. Only the SQL
   * sent to MySQL is normalized in memory.
   */
  return sql.replace(
    /\bPERSISTENT\b/gi,
    "STORED"
  );
}

async function prepareOneActiveDeploymentInvariantForMySql(
  connection,
  databaseFamily
) {
  if (
    databaseFamily !==
    "mysql"
  ) {
    return;
  }

  const [rows] =
    await connection.query(
      `
      SELECT
        rc.UPDATE_RULE AS update_rule,
        rc.DELETE_RULE AS delete_rule
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
      WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
        AND rc.TABLE_NAME = 'deployment_assignments'
        AND rc.CONSTRAINT_NAME =
          'fk_deployment_assignments_employee'
      LIMIT 1
      `
    );

  if (
    rows.length === 0
  ) {
    return;
  }

  const updateRule =
    String(
      rows[0]?.update_rule ||
      ""
    ).toUpperCase();

  if (
    updateRule !==
    "CASCADE"
  ) {
    return;
  }

  /*
   * MySQL 8.x does not allow ON UPDATE CASCADE
   * when employee_id is referenced by the stored
   * generated column active_employee_id_guard.
   *
   * Employee primary-key IDs are immutable in the
   * application, so RESTRICT preserves the intended
   * relationship while remaining MySQL-compatible.
   */
  await connection.query(
    `
    ALTER TABLE deployment_assignments
      DROP FOREIGN KEY
        fk_deployment_assignments_employee,
      ADD CONSTRAINT
        fk_deployment_assignments_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
    `
  );
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

/*
 * ================================================================
 * MESSENGER SCHEMA END-STATE VERIFICATION
 * ================================================================
 */
async function chatMessengerSchemaIsApplied(
  connection
) {
  const requiredTables = [
    "chat_conversations",
    "chat_messages",
    "chat_groups",
    "chat_group_members",
    "chat_group_messages",
    "chat_group_audit",
    "chat_attachments",
  ];


  const [
    tableRows,
  ] =
    await connection.query(
      `
      SELECT
        TABLE_NAME AS table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME IN (
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
      requiredTables
    );


  const existingTables =
    new Set(
      tableRows.map(
        (row) =>
          String(
            row.table_name ||
            row.TABLE_NAME ||
            ""
          )
      )
    );


  if (
    requiredTables.some(
      (tableName) =>
        !existingTables.has(
          tableName
        )
    )
  ) {
    return false;
  }


  const requiredColumns = [
    ["chat_conversations", "user1_id"],
    ["chat_conversations", "user2_id"],

    ["chat_messages", "conversation_id"],
    ["chat_messages", "sender_id"],
    ["chat_messages", "body"],
    ["chat_messages", "read_at"],

    ["chat_groups", "name"],
    ["chat_groups", "created_by"],

    ["chat_group_members", "group_id"],
    ["chat_group_members", "user_id"],
    ["chat_group_members", "is_admin"],
    ["chat_group_members", "joined_after_message_id"],
    ["chat_group_members", "last_read_message_id"],

    ["chat_group_messages", "group_id"],
    ["chat_group_messages", "sender_id"],
    ["chat_group_messages", "body"],
    ["chat_group_messages", "system_action"],

    ["chat_group_audit", "group_id"],
    ["chat_group_audit", "actor_id"],
    ["chat_group_audit", "target_user_id"],
    ["chat_group_audit", "action"],

    ["chat_attachments", "conversation_type"],
    ["chat_attachments", "message_id"],
    ["chat_attachments", "storage_name"],
    ["chat_attachments", "original_name"],
    ["chat_attachments", "byte_size"],
  ];


  const [
    columnRows,
  ] =
    await connection.query(
      `
      SELECT
        TABLE_NAME AS table_name,
        COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
      requiredTables
    );


  const columnSet =
    new Set(
      columnRows.map(
        (row) =>
          `${String(
            row.table_name ||
            row.TABLE_NAME ||
            ""
          )}.${String(
            row.column_name ||
            row.COLUMN_NAME ||
            ""
          )}`
      )
    );


  if (
    requiredColumns.some(
      ([
        tableName,
        columnName,
      ]) =>
        !columnSet.has(
          `${tableName}.${columnName}`
        )
    )
  ) {
    return false;
  }


  const [
    indexRows,
  ] =
    await connection.query(
      `
      SELECT
        TABLE_NAME AS table_name,
        INDEX_NAME AS index_name,
        NON_UNIQUE AS non_unique,
        COLUMN_NAME AS column_name,
        SEQ_IN_INDEX AS seq_in_index
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          ?, ?, ?, ?, ?, ?, ?
        )
      ORDER BY
        TABLE_NAME,
        INDEX_NAME,
        SEQ_IN_INDEX
      `,
      requiredTables
    );


  function getIndex(
    tableName,
    indexName
  ) {
    return indexRows
      .filter(
        (row) =>
          String(
            row.table_name ||
            row.TABLE_NAME ||
            ""
          ) ===
            tableName &&
          String(
            row.index_name ||
            row.INDEX_NAME ||
            ""
          ) ===
            indexName
      )
      .sort(
        (
          left,
          right
        ) =>
          Number(
            left.seq_in_index ||
            left.SEQ_IN_INDEX ||
            0
          ) -
          Number(
            right.seq_in_index ||
            right.SEQ_IN_INDEX ||
            0
          )
      );
  }


  function indexMatches({
    tableName,
    indexName,
    columns,
    unique = false,
  }) {
    const rows =
      getIndex(
        tableName,
        indexName
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
          row.COLUMN_NAME ||
          ""
        ) ===
          columns[index] &&
        Number(
          row.non_unique ??
          row.NON_UNIQUE
        ) ===
          expectedNonUnique
    );
  }


  const indexesValid =
    [
      indexMatches({
        tableName:
          "chat_conversations",

        indexName:
          "uq_chat_pair",

        columns: [
          "user1_id",
          "user2_id",
        ],

        unique:
          true,
      }),

      indexMatches({
        tableName:
          "chat_messages",

        indexName:
          "idx_chat_messages_history",

        columns: [
          "conversation_id",
          "id",
        ],
      }),

      indexMatches({
        tableName:
          "chat_messages",

        indexName:
          "idx_chat_messages_unread",

        columns: [
          "conversation_id",
          "read_at",
          "sender_id",
        ],
      }),

      indexMatches({
        tableName:
          "chat_groups",

        indexName:
          "idx_chat_group_updated",

        columns: [
          "updated_at",
        ],
      }),

      indexMatches({
        tableName:
          "chat_group_members",

        indexName:
          "PRIMARY",

        columns: [
          "group_id",
          "user_id",
        ],

        unique:
          true,
      }),

      indexMatches({
        tableName:
          "chat_group_members",

        indexName:
          "idx_chat_group_member_user",

        columns: [
          "user_id",
        ],
      }),

      indexMatches({
        tableName:
          "chat_group_messages",

        indexName:
          "idx_chat_group_messages_history",

        columns: [
          "group_id",
          "id",
        ],
      }),

      indexMatches({
        tableName:
          "chat_group_audit",

        indexName:
          "idx_chat_group_audit_group",

        columns: [
          "group_id",
          "created_at",
        ],
      }),

      indexMatches({
        tableName:
          "chat_attachments",

        indexName:
          "uq_chat_attachment_storage",

        columns: [
          "storage_name",
        ],

        unique:
          true,
      }),

      indexMatches({
        tableName:
          "chat_attachments",

        indexName:
          "idx_chat_attachment_message",

        columns: [
          "conversation_type",
          "message_id",
        ],
      }),
    ]
      .every(
        Boolean
      );


  if (
    !indexesValid
  ) {
    return false;
  }


  const [
    foreignKeyRows,
  ] =
    await connection.query(
      `
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.CONSTRAINT_NAME AS constraint_name,
        kcu.COLUMN_NAME AS column_name,
        kcu.REFERENCED_TABLE_NAME AS referenced_table,
        kcu.REFERENCED_COLUMN_NAME AS referenced_column,
        rc.UPDATE_RULE AS update_rule,
        rc.DELETE_RULE AS delete_rule

      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu

      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
        ON rc.CONSTRAINT_SCHEMA =
           kcu.CONSTRAINT_SCHEMA

        AND rc.TABLE_NAME =
            kcu.TABLE_NAME

        AND rc.CONSTRAINT_NAME =
            kcu.CONSTRAINT_NAME

      WHERE
        kcu.TABLE_SCHEMA =
          DATABASE()

        AND kcu.CONSTRAINT_NAME IN (
          'fk_chat_messages_conversation',
          'fk_chat_group_members_group',
          'fk_chat_group_messages_group',
          'fk_chat_group_audit_group'
        )
      `
    );


  const foreignKeyMap =
    new Map(
      foreignKeyRows.map(
        (row) => [
          String(
            row.constraint_name ||
            row.CONSTRAINT_NAME ||
            ""
          ),
          row,
        ]
      )
    );


  const expectedForeignKeys = [
    {
      name:
        "fk_chat_messages_conversation",

      table:
        "chat_messages",

      column:
        "conversation_id",

      referencedTable:
        "chat_conversations",

      referencedColumn:
        "id",
    },

    {
      name:
        "fk_chat_group_members_group",

      table:
        "chat_group_members",

      column:
        "group_id",

      referencedTable:
        "chat_groups",

      referencedColumn:
        "id",
    },

    {
      name:
        "fk_chat_group_messages_group",

      table:
        "chat_group_messages",

      column:
        "group_id",

      referencedTable:
        "chat_groups",

      referencedColumn:
        "id",
    },

    {
      name:
        "fk_chat_group_audit_group",

      table:
        "chat_group_audit",

      column:
        "group_id",

      referencedTable:
        "chat_groups",

      referencedColumn:
        "id",
    },
  ];


  for (
    const expected of
    expectedForeignKeys
  ) {
    const actual =
      foreignKeyMap.get(
        expected.name
      );


    if (
      !actual
    ) {
      return false;
    }


    if (
      String(
        actual.table_name ||
        actual.TABLE_NAME ||
        ""
      ) !==
        expected.table ||

      String(
        actual.column_name ||
        actual.COLUMN_NAME ||
        ""
      ) !==
        expected.column ||

      String(
        actual.referenced_table ||
        actual.REFERENCED_TABLE_NAME ||
        ""
      ) !==
        expected.referencedTable ||

      String(
        actual.referenced_column ||
        actual.REFERENCED_COLUMN_NAME ||
        ""
      ) !==
        expected.referencedColumn ||

      String(
        actual.update_rule ||
        actual.UPDATE_RULE ||
        ""
      ).toUpperCase() !==
        "RESTRICT" ||

      String(
        actual.delete_rule ||
        actual.DELETE_RULE ||
        ""
      ).toUpperCase() !==
        "CASCADE"
    ) {
      return false;
    }
  }


  return true;
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

async function enumColumnExactlyMatches(
  connection,
  tableName,
  columnName,
  expectedValues
) {
  if (
    !Array.isArray(
      expectedValues
    ) ||
    expectedValues.length === 0
  ) {
    return false;
  }

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
    rows.length === 0
  ) {
    return false;
  }

  const actual =
    String(
      rows[0]?.column_type ||
        ""
    ).trim();

  const expected =
    `enum(${expectedValues
      .map(
        (value) =>
          `'${String(value)}'`
      )
      .join(",")})`;

  return actual === expected;
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
    const databaseFamily =
      await getDatabaseFamily(
        connection
      );

    console.log(
      "WELLJOB HRIS database migrations"
    );

    console.log(
      `Database engine: ${databaseFamily}`
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
        sql:
          repositorySql,

        checksum,
      } =
        readMigration(
          migration.name
        );

      const executableSql =
        normalizeMigrationSqlForTarget(
          migration.name,
          repositorySql,
          databaseFamily
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

      if (
        typeof migration.prepare ===
        "function"
      ) {
        await migration.prepare(
          connection,
          databaseFamily
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
        executableSql
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