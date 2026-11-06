"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

const backendRoot = path.join(__dirname, "..");
const sourceEnvPath = path.join(backendRoot, ".env.phase3.local");
const runtimeEnvPath = path.join(backendRoot, ".env.phase3.runtime.local");
const expectedDatabase = "welljob_phase3_test";
const runtimeUser = "welljob_phase3_runtime";
const runtimeHost = "%";

if (!process.argv.includes("--confirm-create")) {
  throw new Error(
    "Refusing to provision a database user without --confirm-create."
  );
}

dotenv.config({
  path: sourceEnvPath,
  override: true,
  quiet: true,
});

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function connectionOptions(overrides = {}) {
  const host = requiredEnv("DB_HOST");
  const ca = Buffer.from(
    requiredEnv("DB_SSL_CA_BASE64"),
    "base64"
  ).toString("utf8");

  return {
    host,
    port: Number(requiredEnv("DB_PORT")),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    ssl: {
      ca,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      servername: host,
    },
    connectTimeout: 15000,
    ...overrides,
  };
}

function replaceEnvValue(contents, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");

  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.replace(/\s*$/, "")}\n${line}\n`;
}

async function main() {
  const database = requiredEnv("DB_NAME");
  const confirmedDatabase = requiredEnv("DB_EXPECTED_NAME");

  if (database !== expectedDatabase || confirmedDatabase !== expectedDatabase) {
    throw new Error(
      `Database guard failed: both DB_NAME and DB_EXPECTED_NAME must equal ${expectedDatabase}.`
    );
  }

  const admin = await mysql.createConnection(connectionOptions());
  const account = `${admin.escape(runtimeUser)}@${admin.escape(runtimeHost)}`;
  const escapedDatabase = `\`${expectedDatabase.replace(/`/g, "``")}\``;
  const targetPattern = /ON\s+[`"]?welljob_phase3_test[`"]?\.\*/i;
  const password = crypto.randomBytes(32).toString("base64url");

  try {
    const [identityRows] = await admin.query(
      "SELECT DATABASE() AS database_name"
    );

    if (identityRows[0]?.database_name !== expectedDatabase) {
      throw new Error("Connected database does not match the guarded target.");
    }

    await admin.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ?`, [
      password,
    ]);
    await admin.query(`ALTER USER ${account} IDENTIFIED BY ?`, [password]);

    const [existingGrantRows] = await admin.query(
      `SHOW GRANTS FOR ${account}`
    );
    const existingUnexpectedGrant = existingGrantRows
      .map((row) => String(Object.values(row)[0] || ""))
      .find(
        (grant) =>
          !/^GRANT\s+USAGE\s+ON\s+\*\.\*/i.test(grant) &&
          !targetPattern.test(grant)
      );

    if (existingUnexpectedGrant) {
      throw new Error(
        "Runtime account already has privileges outside the guarded Phase 3 database."
      );
    }

    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${escapedDatabase}.* TO ${account}`
    );

    const [grantRows] = await admin.query(`SHOW GRANTS FOR ${account}`);
    const grants = grantRows.map((row) => String(Object.values(row)[0] || ""));
    const unexpectedGrant = grants.find(
      (grant) =>
        !/^GRANT\s+USAGE\s+ON\s+\*\.\*/i.test(grant) &&
        !targetPattern.test(grant)
    );

    if (unexpectedGrant || !grants.some((grant) => targetPattern.test(grant))) {
      throw new Error(
        "Runtime account grant verification failed."
      );
    }

    let runtimeEnv = fs.readFileSync(sourceEnvPath, "utf8");
    runtimeEnv = replaceEnvValue(runtimeEnv, "DB_USER", runtimeUser);
    runtimeEnv = replaceEnvValue(runtimeEnv, "DB_PASSWORD", password);
    runtimeEnv = replaceEnvValue(
      runtimeEnv,
      "DB_EXPECTED_NAME",
      expectedDatabase
    );
    fs.writeFileSync(runtimeEnvPath, runtimeEnv, { mode: 0o600 });

    const runtime = await mysql.createConnection(
      connectionOptions({
        user: runtimeUser,
        password,
      })
    );

    try {
      const [runtimeIdentityRows] = await runtime.query(
        "SELECT DATABASE() AS database_name"
      );
      const [cipherRows] = await runtime.query(
        "SHOW SESSION STATUS LIKE 'Ssl_cipher'"
      );
      const selectedDatabase = String(
        runtimeIdentityRows[0]?.database_name || ""
      );
      const tlsCipher = String(
        cipherRows[0]?.Value || cipherRows[0]?.VALUE || ""
      );

      if (selectedDatabase !== expectedDatabase || !tlsCipher) {
        throw new Error("Restricted runtime account connection verification failed.");
      }
    } finally {
      await runtime.end();
    }

    console.log(
      JSON.stringify(
        {
          database: expectedDatabase,
          runtimeUser,
          privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
          tlsVerified: true,
          runtimeEnvFile: path.basename(runtimeEnvPath),
        },
        null,
        2
      )
    );
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error("Phase 3 runtime-user provisioning failed:", error.message);
  process.exitCode = 1;
});
