const mysql = require("mysql2");

function getRequiredEnv(name, { allowEmpty = false } = {}) {
  const exists = Object.prototype.hasOwnProperty.call(
    process.env,
    name
  );

  if (!exists) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  const value = String(process.env[name] ?? "").trim();

  if (!allowEmpty && !value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

const dbHost = getRequiredEnv("DB_HOST");
const dbPortRaw = getRequiredEnv("DB_PORT");
const dbUser = getRequiredEnv("DB_USER");

const dbPassword = getRequiredEnv("DB_PASSWORD", {
  allowEmpty: true,
});

const dbName = getRequiredEnv("DB_NAME");

const dbPort = Number(dbPortRaw);

if (
  !Number.isInteger(dbPort) ||
  dbPort <= 0 ||
  dbPort > 65535
) {
  throw new Error(
    "DB_PORT must be a valid TCP port number."
  );
}

/*
 * ==================================================
 * OPTIONAL DATABASE SSL CONFIGURATION
 * ==================================================
 *
 * Local XAMPP:
 *   Leave DB_SSL_CA_BASE64 unset.
 *
 * Aiven MySQL:
 *   Set DB_SSL_CA_BASE64 to the Base64-encoded
 *   CA certificate in the hosting environment.
 *
 * Never disable SSL certificate verification.
 */

function getDatabaseSslOptions() {
  const encodedCertificate = String(
    process.env.DB_SSL_CA_BASE64 ?? ""
  ).trim();

  if (!encodedCertificate) {
    return undefined;
  }

  const caCertificate = Buffer.from(
    encodedCertificate,
    "base64"
  ).toString("utf8");

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
    ca: caCertificate,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    servername: dbHost,
  };
}

/*
 * ==================================================
 * MYSQL CONNECTION POOL
 * ==================================================
 */

const db = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,

  ssl: getDatabaseSslOptions(),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/*
 * ==================================================
 * INITIAL CONNECTION CHECK
 * ==================================================
 */

db.getConnection((err, connection) => {
  if (err) {
    /*
     * Log technical database errors on the
     * backend only. Never return database
     * credentials or connection details
     * through an API response.
     */

    console.error(
      "Database connection failed:",
      err
    );

    return;
  }

  console.log("MySQL Connected");

  connection.release();
});

module.exports = db;