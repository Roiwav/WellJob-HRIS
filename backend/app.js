const path = require("path");

/*
 * ==================================================
 * ENVIRONMENT LOADING
 * ==================================================
 *
 * Local / Render:
 * backend/.env may provide values.
 *
 * Vercel:
 * deployment environment variables already exist in
 * process.env. dotenv does not overwrite them unless
 * explicitly configured to do so.
 */

require("dotenv").config({
  path: path.join(
    __dirname,
    ".env"
  ),

  quiet: true,
});


/*
 * ==================================================
 * APPLICATION ENVIRONMENT
 * ==================================================
 *
 * PORT intentionally does NOT belong here.
 *
 * The Express application itself does not own a TCP
 * port when executed by Vercel.
 *
 * PORT is validated only by server.js, which remains
 * the local / temporary Render persistent launcher.
 */

const REQUIRED_ENVIRONMENT = [
  {
    name:
      "DB_HOST",
  },

  {
    name:
      "DB_PORT",
  },

  {
    name:
      "DB_USER",
  },

  {
    name:
      "DB_PASSWORD",

    allowEmpty:
      true,
  },

  {
    name:
      "DB_NAME",
  },

  {
    name:
      "JWT_SECRET",
  },

  {
    name:
      "FRONTEND_ORIGIN",
  },
];


const JSON_BODY_LIMIT =
  "1mb";


function validateApplicationEnvironment() {
  const missingVariables =
    [];

  for (
    const requirement of
    REQUIRED_ENVIRONMENT
  ) {
    const exists =
      Object.prototype
        .hasOwnProperty
        .call(
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
        ] ??
        ""
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
    missingVariables.length >
    0
  ) {
    throw new Error(
      `Missing required environment configuration: ${missingVariables.join(
        ", "
      )}`
    );
  }


  const dbPort =
    Number.parseInt(
      process.env.DB_PORT,
      10
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
}


validateApplicationEnvironment();


/*
 * ==================================================
 * CORE DEPENDENCIES
 * ==================================================
 */

const express =
  require("express");

const cors =
  require("cors");

const compression =
  require("compression");


/*
 * Initialize the existing MySQL pool.
 *
 * The module itself remains responsible for Aiven /
 * local MySQL configuration.
 */
require("./config/db");


const checkMaintenanceMode =
  require(
    "./middleware/maintenanceMiddleware"
  );


/*
 * ==================================================
 * WELLJOB ROUTES
 * ==================================================
 */

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

const chatRoutes =
  require(
    "./routes/chatRoutes"
  );


/*
 * ==================================================
 * EXPRESS APPLICATION
 * ==================================================
 */

const app =
  express();


/*
 * ==================================================
 * CORS
 * ==================================================
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
     * Server-to-server requests and health checks
     * commonly have no Origin header.
     */
    if (
      !requestOrigin
    ) {
      return callback(
        null,
        true
      );
    }


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
     * Do not grant browser CORS permission to an
     * unapproved origin.
     */
    return callback(
      null,
      false
    );
  },
};


app.use(
  cors(
    corsOptions
  )
);


app.use(
  compression()
);


/*
 * ==================================================
 * REQUEST BODY
 * ==================================================
 */

app.use(
  express.json({
    limit:
      JSON_BODY_LIMIT,
  })
);


/*
 * ==================================================
 * MAINTENANCE GATE
 * ==================================================
 */

app.use(
  "/api",
  checkMaintenanceMode
);


/*
 * ==================================================
 * API ROUTES
 * ==================================================
 */

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
app.use("/api", require("./routes/attendanceRoutes"));


/*
 * Messenger REST endpoints remain registered.
 *
 * Realtime Socket.IO startup is NOT performed in
 * this application module.
 *
 * server.js owns the current persistent Socket.IO
 * runtime while the final Vercel realtime migration
 * is handled separately.
 */
app.use(
  "/api/chat",
  chatRoutes
);


/*
 * ==================================================
 * HEALTH / ROOT
 * ==================================================
 */

app.get(
  "/",
  (
    req,
    res
  ) => {
    return res.send(
      "API is running..."
    );
  }
);


/*
 * ==================================================
 * CENTRAL 404
 * ==================================================
 */

app.use(
  (
    req,
    res
  ) => {
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


    if (
      res.headersSent
    ) {
      return next(
        err
      );
    }


    if (
      err?.type ===
        "entity.too.large" ||
      err?.status ===
        413 ||
      err?.statusCode ===
        413
    ) {
      return res
        .status(413)
        .json({
          success:
            false,

          error:
            "Request payload is too large.",

          message:
            `JSON request bodies must not exceed ${JSON_BODY_LIMIT}.`,
        });
    }


    if (
      err instanceof
        SyntaxError &&
      err?.status ===
        400 &&
      Object.prototype
        .hasOwnProperty
        .call(
          err,
          "body"
        )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Invalid JSON request body.",

          message:
            "Check the request body syntax and try again.",
        });
    }


    return res
      .status(500)
      .json({
        success:
          false,

        error:
          "Internal server error.",
      });
  }
);


/*
 * ==================================================
 * EXPORT
 * ==================================================
 *
 * Vercel's Express integration can execute this
 * exported CommonJS Express application directly.
 *
 * No app.listen() belongs in this module.
 */

module.exports =
  app;
