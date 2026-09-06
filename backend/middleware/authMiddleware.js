const jwt = require("jsonwebtoken");
const db = require("../config/db");

const CANONICAL_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "IT_SUPPORT",
]);

/*
 * ==================================================
 * NORMALIZATION HELPERS
 * ==================================================
 */

function normalizeRole(value) {
  const normalized = String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",

    HRMANAGER: "HR_MANAGER",
    HR_MANAGER: "HR_MANAGER",

    HRSTAFF: "HR_STAFF",
    HR_STAFF: "HR_STAFF",

    ITSUPPORT: "IT_SUPPORT",
    IT_SUPPORT: "IT_SUPPORT",
  };

  return (
    aliases[normalized] ||
    normalized
  );
}

function normalizeStatus(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

function normalizeTokenVersion(value) {
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

function parsePositiveUserId(value) {
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
 * JWT CONFIGURATION
 * ==================================================
 */

function getJwtSecret() {
  const secret = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!secret) {
    return null;
  }

  return secret;
}

/*
 * ==================================================
 * BEARER TOKEN EXTRACTION
 * ==================================================
 */

function getBearerToken(req) {
  const authorizationHeader =
    String(
      req.headers?.authorization ||
        ""
    ).trim();

  if (!authorizationHeader) {
    return null;
  }

  const parts =
    authorizationHeader.split(
      /\s+/
    );

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const [scheme, token] =
    parts;

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

/*
 * ==================================================
 * VERIFIED JWT SESSION IDENTITY
 * ==================================================
 *
 * SECURITY:
 *
 * The JWT establishes:
 * - which database user originally logged in
 * - which token/session generation was issued
 *
 * The JWT role is NOT treated as the current
 * authorization source anymore.
 *
 * Current role/status/token_version will be loaded
 * from the database for every protected request.
 */
function getVerifiedTokenIdentity(
  payload
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const databaseUserId =
    parsePositiveUserId(
      payload.id ??
        payload.userId ??
        payload.user_id
    );

  const username =
    String(
      payload.username || ""
    ).trim();

  const tokenVersion =
    normalizeTokenVersion(
      payload.tokenVersion
    );

  if (
    !databaseUserId ||
    !username ||
    !tokenVersion
  ) {
    return null;
  }

  return {
    id:
      databaseUserId,

    username,

    tokenVersion,
  };
}

/*
 * ==================================================
 * VERIFY TOKEN
 * ==================================================
 *
 * SECURITY FLOW:
 *
 * 1. Require Authorization: Bearer <token>
 * 2. Verify JWT signature / expiry using HS256 only
 * 3. Validate session identity
 * 4. Reload CURRENT user from MySQL
 * 5. Confirm account still exists
 * 6. Confirm account is still Active
 * 7. Confirm token_version still matches
 * 8. Use CURRENT database role
 * 9. Populate req.user
 *
 * Benefits:
 *
 * - deactivated accounts immediately lose API access
 * - deleted accounts immediately lose API access
 * - revoked sessions immediately stop working
 * - stale JWT roles are no longer authoritative
 */
async function verifyToken(
  req,
  res,
  next
) {
  const token =
    getBearerToken(req);

  if (!token) {
    return res
      .status(401)
      .json({
        success: false,

        error:
          "Authentication required",

        message:
          "A valid Authorization Bearer token is required.",
      });
  }

  const jwtSecret =
    getJwtSecret();

  if (!jwtSecret) {
    console.error(
      "JWT authentication configuration error: JWT_SECRET is not configured."
    );

    return res
      .status(500)
      .json({
        success: false,

        error:
          "Server configuration error",

        message:
          "Authentication service is not configured correctly.",
      });
  }

  let payload;

  try {
    /*
     * jwt.verify() validates:
     * - cryptographic signature
     * - expiration claim
     * - not-before claim, when present
     *
     * SECURITY:
     *
     * Authentication tokens issued by authController
     * use HS256. Accept that algorithm only instead
     * of allowing other HMAC JWT algorithms.
     *
     * Never replace jwt.verify() with jwt.decode().
     */
    payload =
      jwt.verify(
        token,
        jwtSecret,
        {
          algorithms: [
            "HS256",
          ],
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Token expired",

          message:
            "Your authentication session has expired.",
        });
    }

    if (
      error?.name ===
        "JsonWebTokenError" ||
      error?.name ===
        "NotBeforeError"
    ) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Invalid token",

          message:
            "The authentication token is invalid.",
        });
    }

    console.error(
      "JWT verification error:",
      error
    );

    return res
      .status(401)
      .json({
        success: false,

        error:
          "Authentication failed",

        message:
          "The authentication token could not be verified.",
      });
  }

  const tokenIdentity =
    getVerifiedTokenIdentity(
      payload
    );

  if (!tokenIdentity) {
    return res
      .status(401)
      .json({
        success: false,

        error:
          "Invalid session",

        message:
          "The authentication token does not contain a valid session identity.",
      });
  }

  try {
    /*
     * ==================================================
     * CURRENT CANONICAL USER
     * ==================================================
     *
     * Authorization is based on the current database
     * state, not stale JWT role/status information.
     */
    const [users] =
      await db
        .promise()
        .query(
          `
          SELECT
            id,
            user_id,
            username,
            role,
            status,
            token_version
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [
            tokenIdentity.id,
          ]
        );

    /*
     * User was deleted or no longer exists.
     */
    if (
      users.length === 0
    ) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Session revoked",

          message:
            "Your account is no longer available. Please sign in again or contact an administrator.",
        });
    }

    const user =
      users[0];

    /*
     * ==================================================
     * ACCOUNT STATUS
     * ==================================================
     *
     * Existing JWTs immediately stop working after
     * account deactivation.
     */
    const currentStatus =
      normalizeStatus(
        user.status
      );

    if (
      currentStatus !==
      "ACTIVE"
    ) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Account inactive",

          message:
            "Your account is inactive. Please contact an administrator.",
        });
    }

    /*
     * ==================================================
     * CURRENT ROLE
     * ==================================================
     *
     * Do not trust the role embedded in the JWT.
     *
     * RBAC middleware receives the CURRENT database
     * role through req.user.role.
     */
    const currentRole =
      normalizeRole(
        user.role
      );

    if (
      !CANONICAL_ROLES.has(
        currentRole
      )
    ) {
      console.error(
        `Authentication rejected: user ${user.id} has unsupported role "${user.role}".`
      );

      return res
        .status(401)
        .json({
          success: false,

          error:
            "Invalid account role",

          message:
            "Your account authorization configuration is invalid.",
        });
    }

    /*
     * ==================================================
     * TOKEN VERSION
     * ==================================================
     */

    const currentTokenVersion =
      normalizeTokenVersion(
        user.token_version
      );

    if (
      !currentTokenVersion
    ) {
      console.error(
        `Authentication rejected: user ${user.id} has invalid token_version.`
      );

      return res
        .status(401)
        .json({
          success: false,

          error:
            "Invalid session state",

          message:
            "Your authentication session cannot be validated.",
        });
    }

    /*
     * ==================================================
     * SESSION REVOCATION
     * ==================================================
     *
     * Example:
     *
     * JWT tokenVersion = 1
     * DB  token_version = 1
     *
     * -> valid
     *
     * After a security-sensitive account action:
     *
     * DB token_version = 2
     *
     * Old JWT remains:
     *
     * tokenVersion = 1
     *
     * -> rejected immediately
     */
    if (
      tokenIdentity.tokenVersion !==
      currentTokenVersion
    ) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Session revoked",

          message:
            "Your authentication session is no longer valid. Please sign in again.",
        });
    }

    /*
     * ==================================================
     * TRUSTED SERVER-SIDE PRINCIPAL
     * ==================================================
     *
     * Preserve existing controller compatibility:
     *
     * req.user.id
     * req.user.userId
     *
     * both remain users.id.
     *
     * username and role come from the CURRENT database
     * record rather than from stale JWT claims.
     */
    req.user = {
      id:
        user.id,

      userId:
        user.id,

      username:
        String(
          user.username || ""
        ).trim(),

      role:
        currentRole,

      businessUserId:
        user.user_id,

      tokenVersion:
        currentTokenVersion,
    };

    return next();
  } catch (error) {
    /*
     * SECURITY:
     *
     * Authentication fails closed if the canonical
     * account cannot be verified due to a DB/backend
     * problem.
     */
    console.error(
      "Canonical authentication lookup error:",
      error
    );

    return res
      .status(503)
      .json({
        success: false,

        error:
          "Authentication service unavailable",

        message:
          "Your account session could not be validated. Please try again shortly.",
      });
  }
}

module.exports = {
  verifyToken,
  normalizeRole,
  CANONICAL_ROLES,
};