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

  const requestPath = String(
    req.path ||
      req.originalUrl ||
      ""
  )
    .split("?")[0]
    .trim();

  return BYPASS_PATHS.has(
    requestPath
  );
}

function getBearerToken(req) {
  const authorizationHeader =
    String(
      req.headers
        ?.authorization ||
        ""
    ).trim();

  if (!authorizationHeader) {
    return null;
  }

  const parts =
    authorizationHeader.split(
      /\s+/
    );

  if (parts.length !== 2) {
    return null;
  }

  const [
    scheme,
    token,
  ] = parts;

  if (
    String(scheme)
      .toLowerCase() !==
      "bearer" ||
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
    String(settingValue) ===
      "1"
  );
}

function normalizeTokenVersion(
  value
) {
  const numericValue =
    Number(value);

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue < 1
  ) {
    return null;
  }

  return numericValue;
}

function parsePositiveUserId(
  value
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      normalized
    )
  ) {
    return null;
  }

  const numericValue =
    Number(normalized);

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}

/*
 * ==================================================
 * VERIFY CURRENT IT SUPPORT MAINTENANCE ACCESS
 * ==================================================
 *
 * A JWT role alone is not trusted.
 *
 * The token establishes the original authenticated
 * session identity, while the current database
 * record remains authoritative for:
 *
 * - account existence
 * - account status
 * - current role
 * - token/session version
 *
 * This mirrors the security model used by the main
 * authentication middleware.
 */
async function hasCurrentItSupportAccess(
  token,
  jwtSecret
) {
  let payload;

  try {
    payload = jwt.verify(
      token,
      jwtSecret,
      {
        algorithms: [
          "HS256",
        ],
      }
    );
  } catch {
    return false;
  }

  if (
    !payload ||
    typeof payload !==
      "object" ||
    Array.isArray(payload)
  ) {
    return false;
  }

  const databaseUserId =
    parsePositiveUserId(
      payload.id ??
        payload.userId ??
        payload.user_id
    );

  const tokenVersion =
    normalizeTokenVersion(
      payload.tokenVersion
    );

  if (
    !databaseUserId ||
    !tokenVersion
  ) {
    return false;
  }

  try {
    const [users] =
      await db
        .promise()
        .query(
          `
          SELECT
            id,
            role,
            status,
            token_version
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [
            databaseUserId,
          ]
        );

    if (
      users.length === 0
    ) {
      return false;
    }

    const user =
      users[0];

    const currentRole =
      normalizeRole(
        user.role
      );

    const currentStatus =
      String(
        user.status || ""
      )
        .trim()
        .toUpperCase();

    const currentTokenVersion =
      normalizeTokenVersion(
        user.token_version
      );

    if (
      currentStatus !==
      "ACTIVE"
    ) {
      return false;
    }

    if (
      currentRole !==
      "IT_SUPPORT"
    ) {
      return false;
    }

    if (
      !currentTokenVersion ||
      tokenVersion !==
        currentTokenVersion
    ) {
      return false;
    }

    return true;
  } catch (error) {
    /*
     * A failure while verifying the bypass principal
     * must fail closed.
     *
     * Maintenance remains active and this session is
     * not granted an exception.
     */
    console.error(
      "Maintenance IT Support verification error:",
      error
    );

    return false;
  }
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
      await db
        .promise()
        .query(
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
     * ==================================================
     * MAINTENANCE BYPASS
     * ==================================================
     *
     * During maintenance, only an ACTIVE IT_SUPPORT
     * account with:
     *
     * - valid HS256 JWT
     * - existing database account
     * - current IT_SUPPORT database role
     * - matching token_version
     *
     * may proceed.
     *
     * The role embedded inside the JWT is never used
     * as the authoritative maintenance-bypass role.
     */
    const token =
      getBearerToken(req);

    const jwtSecret =
      String(
        process.env.JWT_SECRET ||
          ""
      ).trim();

    if (
      token &&
      jwtSecret
    ) {
      const allowed =
        await hasCurrentItSupportAccess(
          token,
          jwtSecret
        );

      if (allowed) {
        return next();
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
     * Preserve the existing fail-open behavior for
     * the maintenance-setting lookup itself.
     *
     * This avoids locking the entire application
     * solely because the maintenance configuration
     * cannot temporarily be queried.
     *
     * NOTE:
     * IT Support bypass verification above still
     * fails closed once maintenance mode has been
     * successfully confirmed as active.
     */
    return next();
  }
}

module.exports =
  checkMaintenanceMode;