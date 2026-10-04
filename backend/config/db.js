const mysql =
  require("mysql2");


/*
 * ==================================================
 * REQUIRED ENVIRONMENT HELPER
 * ==================================================
 */

function getRequiredEnv(
  name,
  {
    allowEmpty = false,
  } = {}
) {
  const exists =
    Object.prototype
      .hasOwnProperty
      .call(
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
      process.env[
        name
      ] ??
      ""
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


/*
 * ==================================================
 * DATABASE ENVIRONMENT
 * ==================================================
 */

const dbHost =
  getRequiredEnv(
    "DB_HOST"
  );

const dbPortRaw =
  getRequiredEnv(
    "DB_PORT"
  );

const dbUser =
  getRequiredEnv(
    "DB_USER"
  );

const dbPassword =
  getRequiredEnv(
    "DB_PASSWORD",
    {
      allowEmpty:
        true,
    }
  );

const dbName =
  getRequiredEnv(
    "DB_NAME"
  );


const dbPort =
  Number(
    dbPortRaw
  );


if (
  !Number.isInteger(
    dbPort
  ) ||
  dbPort <= 0 ||
  dbPort > 65535
) {
  throw new Error(
    "DB_PORT must be a valid TCP port number."
  );
}


/*
 * ==================================================
 * CONNECTION POOL LIMIT
 * ==================================================
 *
 * Persistent/local runtimes retain the historical
 * default of 10 connections.
 *
 * Vercel receives a conservative default of 4 because
 * every warm serverless instance owns its own mysql2
 * pool. This prevents several concurrent instances
 * from unnecessarily competing for Aiven's finite
 * MySQL connection capacity.
 *
 * DB_CONNECTION_LIMIT remains the authoritative
 * override for every environment.
 */

function getConnectionLimit() {
  const rawValue =
    String(
      process.env
        .DB_CONNECTION_LIMIT ??
      ""
    ).trim();


  if (!rawValue) {
    const isVercel =
      String(
        process.env.VERCEL ??
        ""
      ).trim() ===
      "1";

    return isVercel
      ? 4
      : 10;
  }


  const value =
    Number.parseInt(
      rawValue,
      10
    );


  if (
    !Number.isInteger(
      value
    ) ||
    value <= 0 ||
    value > 100
  ) {
    throw new Error(
      "DB_CONNECTION_LIMIT must be an integer between 1 and 100."
    );
  }


  return value;
}


const connectionLimit =
  getConnectionLimit();


/*
 * ==================================================
 * OPTIONAL DATABASE SSL CONFIGURATION
 * ==================================================
 *
 * Local XAMPP:
 * DB_SSL_CA_BASE64 may remain unset.
 *
 * Aiven:
 * Store the Base64-encoded CA certificate in the
 * deployment environment.
 *
 * Certificate verification remains enabled.
 */

function getDatabaseSslOptions() {
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
      dbHost,
  };
}


/*
 * ==================================================
 * MYSQL CONNECTION POOL
 * ==================================================
 *
 * mysql2 creates the pool synchronously but opens
 * actual MySQL connections only when a query or
 * getConnection operation requires one.
 *
 * This is suitable for a reusable Express module:
 *
 * - cold import does not perform a DB probe
 * - warm instances may reuse the same pool
 * - individual routes continue using the exact same
 *   db.query(), db.promise(), transaction APIs
 */

const db =
  mysql.createPool({
    host:
      dbHost,

    port:
      dbPort,

    user:
      dbUser,

    password:
      dbPassword,

    database:
      dbName,

    ssl:
      getDatabaseSslOptions(),

    waitForConnections:
      true,

    connectionLimit,

    queueLimit:
      0,

    enableKeepAlive:
      true,

    keepAliveInitialDelay:
      0,
  });


/*
 * ==================================================
 * EXPLICIT CONNECTION VERIFICATION
 * ==================================================
 *
 * Do not call this automatically during module load.
 *
 * Traditional persistent server startup may call it
 * deliberately before accepting HTTP requests.
 *
 * Vercel Functions will instead connect lazily when
 * a route actually executes a database operation.
 */

async function verifyDatabaseConnection() {
  const connection =
    await db
      .promise()
      .getConnection();


  try {
    await connection.query(
      "SELECT 1"
    );

    return true;
  } finally {
    connection.release();
  }
}


/*
 * Preserve the existing mysql2 Pool export so every
 * current controller/service continues working.
 *
 * Attach one additive helper for server startup.
 */

db.verifyConnection =
  verifyDatabaseConnection;


module.exports =
  db;
