"use strict";

const path = require("path");

require("dotenv").config({
  path: path.join(
    __dirname,
    "..",
    ".env"
  ),
});

const mysql =
  require("mysql2/promise");

function requiredEnv(name) {
  const value = String(
    process.env[name] ?? ""
  ).trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function getConnectionOptions() {
  const host =
    requiredEnv("DB_HOST");

  const port = Number(
    requiredEnv("DB_PORT")
  );

  const database =
    requiredEnv("DB_NAME");

  const expectedDatabase =
    requiredEnv(
      "DB_EXPECTED_NAME"
    );

  if (
    database !==
      expectedDatabase
  ) {
    throw new Error(
      `Database target confirmation failed: expected ${expectedDatabase} but DB_NAME is ${database}.`
    );
  }

  if (
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      "DB_PORT must be a valid TCP port number."
    );
  }

  const ca = Buffer.from(
    requiredEnv(
      "DB_SSL_CA_BASE64"
    ),
    "base64"
  ).toString("utf8");

  if (
    !ca.includes(
      "-----BEGIN CERTIFICATE-----"
    ) ||
    !ca.includes(
      "-----END CERTIFICATE-----"
    )
  ) {
    throw new Error(
      "DB_SSL_CA_BASE64 must contain a Base64-encoded PEM certificate."
    );
  }

  return {
    host,
    port,
    user:
      requiredEnv("DB_USER"),
    password:
      requiredEnv(
        "DB_PASSWORD"
      ),
    database,
    ssl: {
      ca,
      rejectUnauthorized:
        true,
      minVersion:
        "TLSv1.2",
      servername:
        host,
    },
    connectTimeout:
      15000,
  };
}

async function main() {
  const options =
    getConnectionOptions();

  const connection =
    await mysql.createConnection(
      options
    );

  try {
    const [identityRows] =
      await connection.query(
        `
        SELECT
          DATABASE() AS database_name,
          VERSION() AS mysql_version
        `
      );

    const selectedDatabase =
      String(
        identityRows[0]
          ?.database_name ??
          ""
      );

    if (
      selectedDatabase !==
        options.database
    ) {
      throw new Error(
        `Database target verification failed: expected ${options.database} but selected ${selectedDatabase || "no database"}.`
      );
    }

    const [cipherRows] =
      await connection.query(
        "SHOW SESSION STATUS LIKE 'Ssl_cipher'"
      );

    const tlsActive = Boolean(
      String(
        cipherRows[0]?.Value ??
          cipherRows[0]
            ?.VALUE ??
          ""
      ).trim()
    );

    if (!tlsActive) {
      throw new Error(
        "Database readiness verification failed: TLS is not active."
      );
    }

    const [tableRows] =
      await connection.query(
        `
        SELECT
          COUNT(*) AS table_count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        `
      );

    const [ledgerRows] =
      await connection.query(
        `
        SELECT
          COUNT(*) AS ledger_count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'schema_migrations'
        `
      );

    const [applicationTableRows] =
      await connection.query(
        `
        SELECT
          TABLE_NAME AS table_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
        `
      );

    const [grantRows] =
      await connection.query(
        "SHOW GRANTS FOR CURRENT_USER"
      );

    const grants =
      grantRows.map(
        (row) =>
          String(
            Object.values(
              row
            )[0] || ""
          )
      );

    const globalGrantLines =
      grants.filter(
        (value) =>
          /\sON\s+\*\.\*/i.test(
            value
          ) &&
          !/^GRANT\s+USAGE\s+ON/i.test(
            value
          )
      );

    const targetPattern =
      new RegExp(
        `\\sON\\s+\`?${escapeRegExp(
          options.database
        )}\`?\\.\\*`,
        "i"
      );

    const databaseGrantLines =
      grants.filter(
        (value) =>
          /\sON\s+`?[^`\s]+`?\.\*/i.test(
            value
          )
      );

    const targetGrantLines =
      databaseGrantLines.filter(
        (value) =>
          targetPattern.test(
            value
          )
      );

    const otherDatabaseGrantLines =
      databaseGrantLines.filter(
        (value) =>
          !targetPattern.test(
            value
          )
      );

    const globalGrantText =
      globalGrantLines
        .join(" ")
        .toUpperCase();

    let latestForeignKeyError =
      "";

    let parentKeyDefinitions =
      [];

    let recentForeignKeyLog =
      [];

    if (
      process.argv.includes(
        "--latest-foreign-key-error"
      )
    ) {
      const [engineRows] =
        await connection.query(
          "SHOW ENGINE INNODB STATUS"
        );

      const engineStatus =
        String(
          engineRows[0]?.Status ??
            ""
        );

      const marker =
        "LATEST FOREIGN KEY ERROR";

      const markerIndex =
        engineStatus.indexOf(
          marker
        );

      if (markerIndex >= 0) {
        latestForeignKeyError =
          engineStatus
            .slice(
              markerIndex,
              markerIndex + 2500
            )
            .split(/\r?\n/)
            .slice(0, 24)
            .join("\n")
            .trim();
      }
    }

    if (
      process.argv.includes(
        "--parent-key-definitions"
      )
    ) {
      const [definitionRows] =
        await connection.query(
          `
          SELECT
            TABLE_NAME AS table_name,
            COLUMN_NAME AS column_name,
            COLUMN_TYPE AS column_type,
            IS_NULLABLE AS is_nullable,
            COLUMN_KEY AS column_key
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND (
              (TABLE_NAME = 'users' AND COLUMN_NAME = 'id')
              OR (TABLE_NAME = 'employees' AND COLUMN_NAME = 'id')
              OR (TABLE_NAME = 'deployment_assignments' AND COLUMN_NAME = 'id')
            )
          ORDER BY TABLE_NAME, COLUMN_NAME
          `
        );

      parentKeyDefinitions =
        definitionRows.map(
          (row) => ({
            table:
              String(
                row.table_name ||
                  ""
              ),
            column:
              String(
                row.column_name ||
                  ""
              ),
            type:
              String(
                row.column_type ||
                  ""
              ),
            nullable:
              String(
                row.is_nullable ||
                  ""
              ),
            key:
              String(
                row.column_key ||
                  ""
              ),
          })
        );
    }

    if (
      process.argv.includes(
        "--server-foreign-key-log"
      )
    ) {
      try {
        const [logRows] =
          await connection.query(
            `
            SELECT
              DATA AS message
            FROM performance_schema.error_log
            WHERE LOWER(DATA) LIKE '%foreign key%'
               OR LOWER(DATA) LIKE '%referenced table%'
            ORDER BY LOGGED DESC
            LIMIT 10
            `
          );

        recentForeignKeyLog =
          logRows.map(
            (row) =>
              String(
                row.message ||
                  ""
              ).slice(0, 1200)
          );
      } catch (error) {
        recentForeignKeyLog = [
          `Unavailable: ${error?.message || "query failed"}`,
        ];
      }
    }

    console.log(
      JSON.stringify(
        {
          database:
            selectedDatabase,
          mysqlVersion:
            String(
              identityRows[0]
                ?.mysql_version ??
                ""
            ),
          tlsActive,
          tableCount:
            Number(
              tableRows[0]
                ?.table_count ||
                0
            ),
          tables:
            applicationTableRows.map(
              (row) =>
                String(
                  row.table_name ||
                    ""
                )
            ),
          migrationLedgerExists:
            Number(
              ledgerRows[0]
                ?.ledger_count ||
                0
            ) === 1,
          grantSummary: {
            hasGlobalPrivileges:
              globalGrantLines.length >
              0,
            hasGlobalAllPrivileges:
              /GRANT\s+ALL\s+PRIVILEGES\s+ON\s+\*\.\*/i.test(
                globalGrantLines.join(
                  " "
                )
              ),
            hasGlobalCreatePrivilege:
              /\bCREATE\b/.test(
                globalGrantText
              ),
            hasTargetDatabaseGrant:
              targetGrantLines.length >
              0,
            otherDatabaseGrantCount:
              otherDatabaseGrantLines.length,
          },
          ...(latestForeignKeyError
            ? {
                latestForeignKeyError,
              }
            : {}),
          ...(parentKeyDefinitions.length >
          0
            ? {
                parentKeyDefinitions,
              }
            : {}),
          ...(recentForeignKeyLog.length >
          0
            ? {
                recentForeignKeyLog,
              }
            : {}),
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    "Database readiness verification failed:",
    error?.message || error
  );

  process.exitCode = 1;
});
