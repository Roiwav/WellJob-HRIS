const fs = require("fs");
const os = require("os");
const path = require("path");

require("dotenv").config();

const db = require("../config/db");

const EXPECTED_DATABASE = "welljob_db";
const CONFIRMATION =
  "--confirm=RESET_DEFENSE_OPERATIONAL_DATA";

const OPERATIONAL_TABLES = [
  "audit_logs",
  "employee_documents",
  "employees",
  "incident_evidence",
  "incident_timeline",
  "incidents",
  "kpi_decision_history",
  "smart_alert_states",
  "smart_suggestion_states",
];

const DELETE_ORDER = [
  "incident_evidence",
  "incident_timeline",
  "incidents",
  "employee_documents",
  "kpi_decision_history",
  "smart_alert_states",
  "smart_suggestion_states",
  "audit_logs",
  "employees",
];

function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

async function getCurrentDatabase() {
  const [[row]] = await db
    .promise()
    .query(
      "SELECT DATABASE() AS dbName"
    );

  return row?.dbName || "";
}

async function getTableCounts(
  connection
) {
  const counts = {};

  for (const table of OPERATIONAL_TABLES) {
    const [[row]] =
      await connection.query(
        `SELECT COUNT(*) AS total FROM \`${table}\``
      );

    counts[table] =
      Number(row?.total || 0);
  }

  return counts;
}

async function backupOperationalData(
  connection
) {
  const backupRoot =
    path.join(
      os.homedir(),
      "WellJob-HRIS-Backups",
      `defense-reset-${getTimestamp()}`
    );

  await fs.promises.mkdir(
    backupRoot,
    {
      recursive: true,
    }
  );

  const manifest = {
    createdAt:
      new Date().toISOString(),

    database:
      EXPECTED_DATABASE,

    scope:
      "Operational/demo data only. Users and system_settings are not included or modified.",

    tables: {},
  };

  for (const table of OPERATIONAL_TABLES) {
    const [rows] =
      await connection.query(
        `SELECT * FROM \`${table}\``
      );

    manifest.tables[table] = {
      rows:
        rows.length,
    };

    await fs.promises.writeFile(
      path.join(
        backupRoot,
        `${table}.json`
      ),
      JSON.stringify(
        rows,
        null,
        2
      ),
      "utf8"
    );
  }

  await fs.promises.writeFile(
    path.join(
      backupRoot,
      "manifest.json"
    ),
    JSON.stringify(
      manifest,
      null,
      2
    ),
    "utf8"
  );

  return backupRoot;
}

async function resetAutoIncrement(
  databaseName
) {
  const placeholders =
    OPERATIONAL_TABLES.map(
      () => "?"
    ).join(", ");

  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT DISTINCT TABLE_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (${placeholders})
          AND EXTRA LIKE '%auto_increment%'
        ORDER BY TABLE_NAME
        `,
        [
          databaseName,
          ...OPERATIONAL_TABLES,
        ]
      );

  for (const row of rows) {
    const tableName =
      row.TABLE_NAME ||
      row.table_name;

    if (!tableName) {
      continue;
    }

    await db
      .promise()
      .query(
        `ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`
      );
  }

  return rows
    .map(
      (row) =>
        row.TABLE_NAME ||
        row.table_name
    )
    .filter(Boolean);
}

async function main() {
  if (
    !process.argv.includes(
      CONFIRMATION
    )
  ) {
    console.error(
      "\nReset cancelled."
    );

    console.error(
      `Run again with ${CONFIRMATION} only when you are ready to erase the current operational/demo data.`
    );

    process.exitCode = 1;

    return;
  }

  const databaseName =
    await getCurrentDatabase();

  if (
    databaseName !==
    EXPECTED_DATABASE
  ) {
    throw new Error(
      `Safety check failed. Expected database "${EXPECTED_DATABASE}" but connected to "${databaseName || "unknown"}".`
    );
  }

  const connection =
    await db
      .promise()
      .getConnection();

  let transactionStarted =
    false;

  try {
    console.log(
      `\nConnected database: ${databaseName}`
    );

    console.log(
      "\nUsers and system_settings will be preserved."
    );

    const beforeCounts =
      await getTableCounts(
        connection
      );

    console.log(
      "\nOperational rows before reset:"
    );

    console.table(
      beforeCounts
    );

    console.log(
      "\nCreating local safety backup..."
    );

    const backupPath =
      await backupOperationalData(
        connection
      );

    console.log(
      `Backup created at:\n${backupPath}`
    );

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    for (
      const table of
      DELETE_ORDER
    ) {
      await connection.query(
        `DELETE FROM \`${table}\``
      );
    }

    await connection.commit();

    transactionStarted =
      false;

    connection.release();

    const resetTables =
      await resetAutoIncrement(
        databaseName
      );

    const verificationConnection =
      await db
        .promise()
        .getConnection();

    try {
      const afterCounts =
        await getTableCounts(
          verificationConnection
        );

      const [[userCountRow]] =
        await verificationConnection.query(
          "SELECT COUNT(*) AS total FROM users"
        );

      const [[settingsCountRow]] =
        await verificationConnection.query(
          "SELECT COUNT(*) AS total FROM system_settings"
        );

      console.log(
        "\nOperational rows after reset:"
      );

      console.table(
        afterCounts
      );

      console.log(
        "\nPreserved:"
      );

      console.table({
        users:
          Number(
            userCountRow?.total ||
              0
          ),

        system_settings:
          Number(
            settingsCountRow?.total ||
              0
          ),
      });

      console.log(
        "\nAUTO_INCREMENT reset where applicable:"
      );

      console.log(
        resetTables.length > 0
          ? resetTables.join(", ")
          : "No AUTO_INCREMENT tables detected."
      );

      console.log(
        "\nDefense operational-data reset completed successfully."
      );
    } finally {
      verificationConnection.release();
    }
  } catch (error) {
    if (
      transactionStarted
    ) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "Rollback error:",
          rollbackError?.message ||
            rollbackError
        );
      }
    }

    try {
      connection.release();
    } catch {
      // Ignore duplicate-release failures.
    }

    throw error;
  }
}

main()
  .catch((error) => {
    console.error(
      "\nRESET ERROR:",
      error?.message ||
        error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db
        .promise()
        .end();
    } catch {
      // Process exit will clean up the pool if needed.
    }
  });