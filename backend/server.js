const path = require("path");

// LOAD ENVIRONMENT VARIABLES FIRST
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

/*
 * ==================================================
 * REQUIRED ENVIRONMENT CONFIGURATION
 * ==================================================
 *
 * Fail early during startup when deployment-specific
 * configuration is missing instead of allowing the
 * application to start in a partially configured
 * state.
 *
 * DB_PASSWORD is required to exist as a variable,
 * but an empty value remains technically valid for
 * environments whose database account has no
 * password configured.
 */
const REQUIRED_ENVIRONMENT = [
  {
    name: "DB_HOST",
  },
  {
    name: "DB_PORT",
  },
  {
    name: "DB_USER",
  },
  {
    name: "DB_PASSWORD",
    allowEmpty: true,
  },
  {
    name: "DB_NAME",
  },
  {
    name: "PORT",
  },
  {
    name: "JWT_SECRET",
  },
  {
    name: "FRONTEND_ORIGIN",
  },
];

const JSON_BODY_LIMIT = "1mb";

function validateEnvironment() {
  const missingVariables = [];

  for (const requirement of REQUIRED_ENVIRONMENT) {
    const exists =
      Object.prototype.hasOwnProperty.call(
        process.env,
        requirement.name
      );

    if (!exists) {
      missingVariables.push(
        requirement.name
      );

      continue;
    }

    const value = String(
      process.env[
        requirement.name
      ] ?? ""
    ).trim();

    if (
      !requirement.allowEmpty &&
      !value
    ) {
      missingVariables.push(
        requirement.name
      );
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment configuration: ${missingVariables.join(
        ", "
      )}`
    );
  }

  const port = Number.parseInt(
    process.env.PORT,
    10
  );

  if (
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      "PORT must be a valid TCP port number."
    );
  }

  const dbPort = Number.parseInt(
    process.env.DB_PORT,
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
}

validateEnvironment();

const express = require("express");
const cors = require("cors");
const compression = require("compression");

// DATABASE
const db =
  require("./config/db");

// MAINTENANCE MIDDLEWARE
const checkMaintenanceMode =
  require(
    "./middleware/maintenanceMiddleware"
  );

// ROUTES
const authRoutes =
  require("./routes/authRoutes");

const userRoutes =
  require("./routes/userRoutes");

const employeeRoutes =
  require(
    "./routes/employeeRoutes"
  );

const incidentRoutes =
  require(
    "./routes/incidentRoutes"
  );

const deploymentRoutes =
  require(
    "./routes/deploymentRoutes"
  );

const auditLogRoutes =
  require(
    "./routes/auditLogRoutes"
  );

const kpiDecisionRoutes =
  require(
    "./routes/kpiDecisionRoutes"
  );

const kpiDataRoutes =
  require(
    "./routes/kpiDataRoutes"
  );

const smartAlertRoutes =
  require(
    "./routes/smartAlertRoutes"
  );

const smartSuggestionRoutes =
  require(
    "./routes/smartSuggestionRoutes"
  );

const settingsRoutes =
  require(
    "./routes/settingsRoutes"
  );

const dashboardRoutes =
  require(
    "./routes/dashboardRoutes"
  );

// INIT APP
const app = express();

/*
 * ==================================================
 * CORS CONFIGURATION
 * ==================================================
 *
 * Browser requests are allowed only from the
 * configured frontend origin.
 *
 * Requests without an Origin header remain allowed
 * so backend-to-backend tools, PowerShell tests,
 * Postman-style clients, and health checks continue
 * to work normally.
 */
const FRONTEND_ORIGIN = String(
  process.env.FRONTEND_ORIGIN
).trim();

const corsOptions = {
  origin(
    requestOrigin,
    callback
  ) {
    /*
     * Non-browser/server-side requests commonly
     * have no Origin header.
     */
    if (!requestOrigin) {
      return callback(
        null,
        true
      );
    }

    /*
     * Allow only the configured browser frontend.
     */
    if (
      requestOrigin ===
      FRONTEND_ORIGIN
    ) {
      return callback(
        null,
        true
      );
    }

    /*
     * Do not grant CORS permission to any other
     * browser origin.
     */
    return callback(
      null,
      false
    );
  },
};

// CORE MIDDLEWARE
app.use(
  cors(corsOptions)
);

app.use(
  compression()
);

/*
 * ==================================================
 * JSON REQUEST BODY LIMIT
 * ==================================================
 *
 * Express defaults JSON bodies to approximately
 * 100 KB. The system-wide violation policy can
 * legitimately exceed that size.
 *
 * Keep this limit aligned with the application-level
 * configuration limit enforced by settingsRoutes.js.
 *
 * This remains intentionally bounded at 1 MB instead
 * of accepting unlimited JSON payloads.
 */
app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
  })
);

/*
 * ==================================================
 * DOCUMENT SECURITY
 * ==================================================
 *
 * Employee documents and incident evidence are not
 * exposed through a public static /documents route.
 *
 * Files stored under backend/documents must only be
 * accessed through their dedicated authenticated
 * API endpoints, where JWT authentication, RBAC,
 * record ownership/association validation, path
 * containment, and response security controls are
 * enforced.
 */

// SYSTEM MAINTENANCE GATE
app.use(
  "/api",
  checkMaintenanceMode
);

// API ROUTES
app.use(
  "/api",
  authRoutes
);

app.use(
  "/api",
  userRoutes
);

app.use(
  "/api",
  employeeRoutes
);

app.use(
  "/api",
  incidentRoutes
);

app.use(
  "/api",
  deploymentRoutes
);

app.use(
  "/api",
  kpiDecisionRoutes
);

app.use(
  "/api",
  kpiDataRoutes
);

app.use(
  "/api",
  smartAlertRoutes
);

app.use(
  "/api",
  smartSuggestionRoutes
);

app.use(
  "/api",
  auditLogRoutes
);

app.use(
  "/api",
  settingsRoutes
);

app.use(
  "/api",
  dashboardRoutes
);

// DEFAULT TEST ROUTE
app.get(
  "/",
  (req, res) => {
    return res.send(
      "API is running..."
    );
  }
);

/*
 * ==================================================
 * CENTRAL 404 RESPONSE
 * ==================================================
 *
 * Any request that reaches this point did not
 * match an existing application route.
 *
 * Always return JSON instead of exposing Express
 * implementation details or a default HTML page.
 */
app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        error:
          "Route not found.",
      });
  }
);

/*
 * ==================================================
 * CENTRAL ERROR BOUNDARY
 * ==================================================
 *
 * Final safety boundary for errors forwarded through
 * Express middleware or application routes.
 *
 * Known request parsing failures receive an
 * appropriate client-facing HTTP status.
 *
 * Unexpected technical details remain only in the
 * backend logs.
 */
app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "UNHANDLED SERVER ERROR:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    /*
     * Express/body-parser payload size rejection.
     *
     * A request exceeding the configured JSON limit
     * is a client request-size problem, not an
     * internal server failure.
     */
    if (
      err?.type ===
        "entity.too.large" ||
      err?.status === 413 ||
      err?.statusCode === 413
    ) {
      return res
        .status(413)
        .json({
          success: false,

          error:
            "Request payload is too large.",

          message:
            `JSON request bodies must not exceed ${JSON_BODY_LIMIT}.`,
        });
    }

    /*
     * Malformed JSON should return HTTP 400 rather
     * than being exposed as a generic server error.
     */
    if (
      err instanceof
        SyntaxError &&
      err?.status === 400 &&
      Object.prototype.hasOwnProperty.call(
        err,
        "body"
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            "Invalid JSON request body.",

          message:
            "Check the request body syntax and try again.",
        });
    }

    return res
      .status(500)
      .json({
        success: false,

        error:
          "Internal server error.",
      });
  }
);

// PORT
const PORT =
  Number.parseInt(
    process.env.PORT,
    10
  );

/*
 * ==================================================
 * DATABASE STARTUP HEALTH CHECK
 * ==================================================
 *
 * The HTTP server must not begin listening until
 * the configured MySQL database is reachable.
 *
 * This prevents the process from advertising
 * "Server running" while every database-backed
 * request is guaranteed to fail.
 */
async function verifyDatabaseConnection() {
  await db
    .promise()
    .query(
      "SELECT 1 AS database_health_check"
    );
}

/*
 * ==================================================
 * START SERVER
 * ==================================================
 *
 * Startup order:
 * 1. Environment validation
 * 2. Database connectivity verification
 * 3. HTTP listener activation
 *
 * If the initial database check fails, terminate
 * with a non-zero exit code so the deployment
 * environment can report the backend as unhealthy.
 */
async function startServer() {
  try {
    await verifyDatabaseConnection();

    console.log(
      "Database connection verified."
    );

    app.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "FATAL STARTUP ERROR: Database connection could not be established.",
      error
    );

    /*
     * mysql2 pools may keep handles alive after a
     * failed connection attempt. Close the pool
     * before exiting whenever possible.
     */
    try {
      await db
        .promise()
        .end();
    } catch (closeError) {
      console.error(
        "Database pool cleanup failed during startup shutdown:",
        closeError
      );
    }

    process.exit(1);
  }
}

startServer();