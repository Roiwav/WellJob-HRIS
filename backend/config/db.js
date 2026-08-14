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

const dbPassword = getRequiredEnv(
  "DB_PASSWORD",
  {
    allowEmpty: true,
  }
);

const dbName = getRequiredEnv("DB_NAME");

const dbPort = Number.parseInt(
  dbPortRaw,
  10
);

if (
  !Number.isInteger(dbPort) ||
  dbPort <= 0 ||
  dbPort > 65535
) {
  throw new Error(
    "DB_PORT must be a valid TCP port number."
  );
}

const db = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    /*
     * Keep the full database error on the server side
     * only. This information must never be returned
     * directly through an API response.
     */
    console.error(
      "Database connection failed:",
      err
    );

    return;
  }

  console.log(
    "MySQL Connected"
  );

  connection.release();
});

module.exports = db;