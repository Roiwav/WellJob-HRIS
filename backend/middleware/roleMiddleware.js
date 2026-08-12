const {
  normalizeRole,
  CANONICAL_ROLES,
} = require("./authMiddleware");

/**
 * Creates middleware that allows access only to the specified roles.
 *
 * IMPORTANT:
 * Authorization authority comes exclusively from req.user,
 * which must already have been established by verifyToken().
 *
 * Never authorize using:
 * - req.body.role
 * - req.query.role
 * - req.body.userId
 * - req.query.userId
 */
function authorizeRoles(...allowedRoles) {
  const normalizedAllowedRoles = new Set(
    allowedRoles
      .flat()
      .map((role) => normalizeRole(role))
      .filter((role) => CANONICAL_ROLES.has(role))
  );

  if (normalizedAllowedRoles.size === 0) {
    throw new Error(
      "authorizeRoles requires at least one valid canonical role."
    );
  }

  return function roleAuthorizationMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message:
          "A verified authenticated user is required before authorization.",
      });
    }

    const role = normalizeRole(req.user.role);

    if (!CANONICAL_ROLES.has(role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message:
          "Your account role is not authorized to access this resource.",
      });
    }

    if (!normalizedAllowedRoles.has(role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message:
          "You do not have permission to perform this action.",
      });
    }

    /*
     * Preserve only the verified/canonical principal.
     *
     * req.body.role / req.query.role and userId equivalents
     * may still exist for compatibility or display purposes,
     * but they are never consulted here for authorization.
     */
    req.user = {
      ...req.user,
      role,
    };

    return next();
  };
}

module.exports = {
  authorizeRoles,
};