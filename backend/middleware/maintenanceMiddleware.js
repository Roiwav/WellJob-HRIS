const jwt = require("jsonwebtoken");

const db = require("../config/db");

const {
  normalizeRole,
} = require("./authMiddleware");

const BYPASS_PATHS = new Set([
  "/login",
  "/api/login",

  "/settings/toggle-maintenance",
  "/api/settings/toggle-maintenance",

  "/settings/maintenance-status",
  "/api/settings/maintenance-status",
]);

function isBypassRequest(req) {
  /*
   * Allow CORS preflight requests.
   */
  if (req.method === "OPTIONS") {
    return true;
  }

  const path = String(
    req.path || req.originalUrl || ""
  )
    .split("?")[0]
    .trim();

  return BYPASS_PATHS.has(path);
}

function getBearerToken(req) {
  const authorizationHeader =
    String(
      req.headers?.authorization || ""
    ).trim();

  if (!authorizationHeader) {
    return null;
  }

  const parts =
    authorizationHeader.split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] =
    parts;

  if (
    scheme.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function isMaintenanceEnabled(
  settingValue
) {
  return (
    settingValue === 1 ||
    settingValue === true ||
    String(settingValue) === "1"
  );
}

async function checkMaintenanceMode(
  req,
  res,
  next
) {
  /*
   * Login must remain reachable so IT Support
   * can authenticate during maintenance.
   *
   * Maintenance status/toggle endpoints also
   * remain reachable here, but those routes
   * still enforce their own verifyToken +
   * IT_SUPPORT RBAC.
   */
  if (isBypassRequest(req)) {
    return next();
  }

  try {
    const [rows] =
      await db.promise().query(
        `
        SELECT setting_value
        FROM system_settings
        WHERE setting_name = 'maintenance_mode'
        LIMIT 1
        `
      );

    const maintenanceEnabled =
      rows.length > 0 &&
      isMaintenanceEnabled(
        rows[0].setting_value
      );

    /*
     * Normal operation:
     * do not alter the request flow.
     */
    if (!maintenanceEnabled) {
      return next();
    }

    /*
     * During maintenance, only a VALID,
     * SIGNATURE-VERIFIED IT_SUPPORT JWT
     * may bypass the maintenance block.
     */
    const token =
      getBearerToken(req);

    const jwtSecret =
      String(
        process.env.JWT_SECRET || ""
      ).trim();

    if (
      token &&
      jwtSecret
    ) {
      try {
        const payload =
          jwt.verify(
            token,
            jwtSecret
          );

        const role =
          normalizeRole(
            payload?.role
          );

        if (
          role === "IT_SUPPORT"
        ) {
          return next();
        }
      } catch (error) {
        /*
         * Invalid, expired, malformed, or
         * otherwise unverifiable JWTs must
         * never bypass maintenance mode.
         */
      }
    }

    return res
      .status(503)
      .json({
        success: false,

        error:
          "System under maintenance",

        message:
          "System is currently under maintenance. Please try again later.",
      });
  } catch (error) {
    console.error(
      "Maintenance middleware error:",
      error
    );

    /*
     * Preserve the existing fail-open behavior
     * for database-check failures so a temporary
     * settings-query problem does not lock the
     * entire application.
     */
    return next();
  }
}

module.exports =
  checkMaintenanceMode;