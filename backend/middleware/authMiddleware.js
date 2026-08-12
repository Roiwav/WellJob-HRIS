const jwt = require("jsonwebtoken");

const CANONICAL_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "IT_SUPPORT",
]);

function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "SUPER_ADMIN",

    HRMANAGER: "HR_MANAGER",
    HR_MANAGER: "HR_MANAGER",

    HRSTAFF: "HR_STAFF",
    HR_STAFF: "HR_STAFF",

    ITSUPPORT: "IT_SUPPORT",
    IT_SUPPORT: "IT_SUPPORT",
  };

  return aliases[normalized] || normalized;
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret) {
    return null;
  }

  return secret;
}

function getBearerToken(req) {
  const authorizationHeader = String(
    req.headers?.authorization || ""
  ).trim();

  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (
    String(scheme).toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function getVerifiedUser(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const rawUserId =
    payload.userId ??
    payload.id ??
    payload.user_id;

  const username = String(
    payload.username || ""
  ).trim();

  const role = normalizeRole(
    payload.role
  );

  const hasUserId =
    rawUserId !== undefined &&
    rawUserId !== null &&
    String(rawUserId).trim() !== "";

  if (
    !hasUserId ||
    !username ||
    !CANONICAL_ROLES.has(role)
  ) {
    return null;
  }

  return {
    id: rawUserId,
    userId: rawUserId,
    username,
    role,
  };
}

function verifyToken(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      message:
        "A valid Authorization Bearer token is required.",
    });
  }

  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    console.error(
      "JWT authentication configuration error: JWT_SECRET is not configured."
    );

    return res.status(500).json({
      success: false,
      error: "Server configuration error",
      message:
        "Authentication service is not configured correctly.",
    });
  }

  try {
    /*
     * jwt.verify() verifies:
     * - token signature
     * - expiration (exp)
     * - not-before claim (nbf), when present
     *
     * Do not replace this with jwt.decode().
     */
    const payload = jwt.verify(
      token,
      jwtSecret
    );

    const verifiedUser =
      getVerifiedUser(payload);

    if (!verifiedUser) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message:
          "The authentication token does not contain a valid user identity.",
      });
    }

    /*
     * This is now the trusted server-side principal.
     *
     * Future controllers and RBAC middleware must use:
     * req.user.id
     * req.user.userId
     * req.user.username
     * req.user.role
     *
     * Never use body/query role values for authorization.
     */
    req.user = verifiedUser;

    return next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired",
        message:
          "Your authentication session has expired.",
      });
    }

    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message:
          "The authentication token is invalid.",
      });
    }

    console.error(
      "JWT verification error:",
      error
    );

    return res.status(401).json({
      success: false,
      error: "Authentication failed",
      message:
        "The authentication token could not be verified.",
    });
  }
}

module.exports = {
  verifyToken,
  normalizeRole,
  CANONICAL_ROLES,
};