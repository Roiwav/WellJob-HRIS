const path = require("path");

// LOAD ENVIRONMENT VARIABLES FIRST
require("dotenv").config({
  path: path.join(
    __dirname,
    ".env"
  ),
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

function validateEnvironment() {
  const missingVariables = [];

  for (
    const requirement of
    REQUIRED_ENVIRONMENT
  ) {
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

    const value =
      String(
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

  if (
    missingVariables.length > 0
  ) {
    throw new Error(
      `Missing required environment configuration: ${missingVariables.join(
        ", "
      )}`
    );
  }

  const port =
    Number.parseInt(
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

  const dbPort =
    Number.parseInt(
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

const express =
  require("express");

const cors =
  require("cors");

// MAINTENANCE MIDDLEWARE
const checkMaintenanceMode =
  require(
    "./middleware/maintenanceMiddleware"
  );

// ROUTES
const authRoutes =
  require(
    "./routes/authRoutes"
  );

const userRoutes =
  require(
    "./routes/userRoutes"
  );

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

// INIT APP
const app =
  express();

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
const FRONTEND_ORIGIN =
  String(
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
     *
     * The request does not receive the required
     * Access-Control-Allow-Origin permission.
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
  express.json()
);

// STATIC FILES
app.use(
  "/documents",
  express.static(
    path.join(
      __dirname,
      "documents"
    )
  )
);

/*
 * ==================================================
 * SYSTEM MAINTENANCE GATE
 * ==================================================
 *
 * Applied only to /api requests.
 *
 * When maintenance mode is OFF:
 * - requests continue normally.
 *
 * When maintenance mode is ON:
 * - login remains reachable,
 * - maintenance status/toggle remain reachable,
 * - valid IT_SUPPORT JWT requests may continue,
 * - all other API users receive HTTP 503.
 *
 * Individual routes still enforce their own
 * authentication and RBAC after this middleware.
 */
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
 * This is the final safety boundary for errors
 * forwarded through Express middleware/routes.
 *
 * Full technical details remain in backend logs.
 * Clients receive only a stable generic response.
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

    return res
      .status(500)
      .json({
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

// START SERVER
app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);