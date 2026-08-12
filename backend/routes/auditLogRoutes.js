const express = require("express");

const router = express.Router();

const {
  getLogsByCategory,
  getAllLogs,
} = require("../controllers/auditLogController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * CATEGORY-SPECIFIC AUDIT ACCESS
 *
 * TECHNICAL:
 * - IT_SUPPORT only
 *
 * OPERATIONAL:
 * - SUPER_ADMIN only
 *
 * Invalid categories continue to the
 * controller so its existing 400
 * validation response is preserved.
 */
function authorizeAuditCategory(
  req,
  res,
  next
) {
  const category = String(
    req.params.category || ""
  )
    .trim()
    .toUpperCase();

  const role = String(
    req.user?.role || ""
  )
    .trim()
    .toUpperCase();

  if (
    category === "TECHNICAL"
  ) {
    if (
      role !== "IT_SUPPORT"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Forbidden",
          message:
            "You do not have permission to view technical audit logs.",
        });
    }

    return next();
  }

  if (
    category === "OPERATIONAL"
  ) {
    if (
      role !== "SUPER_ADMIN"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Forbidden",
          message:
            "You do not have permission to view operational audit logs.",
        });
    }

    return next();
  }

  return next();
}

router.get(
  "/audit-logs",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  getAllLogs
);

router.get(
  "/audit-logs/:category",
  verifyToken,
  authorizeAuditCategory,
  getLogsByCategory
);

/*
 * SECURITY:
 *
 * There is intentionally NO public/client-facing
 * POST /audit-logs endpoint.
 *
 * Audit records must be produced by trusted
 * backend business operations through the
 * internal auditLogger utility.
 *
 * This prevents authenticated clients from
 * fabricating arbitrary audit events.
 */

module.exports = router;