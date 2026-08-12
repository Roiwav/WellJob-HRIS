const db = require("../config/db");

const {
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

function cleanCategory(category) {
  const value = String(
    category || ""
  )
    .trim()
    .toUpperCase();

  if (
    value ===
    AUDIT_CATEGORY.TECHNICAL
  ) {
    return AUDIT_CATEGORY.TECHNICAL;
  }

  if (
    value ===
    AUDIT_CATEGORY.OPERATIONAL
  ) {
    return AUDIT_CATEGORY.OPERATIONAL;
  }

  return null;
}

/*
 * GET ALL AUDIT LOGS
 *
 * Access control is handled by
 * auditLogRoutes.js.
 *
 * Database failures must return
 * an actual server error instead
 * of pretending the audit log is
 * successfully empty.
 */
exports.getAllLogs =
  async (
    req,
    res
  ) => {
    try {
      const [logs] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM audit_logs
            ORDER BY
              created_at DESC,
              id DESC
            `
          );

      return res
        .status(200)
        .json(logs);
    } catch (error) {
      console.error(
        "Fetch All Audit Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to fetch audit logs.",
          message:
            "The audit log records could not be retrieved.",
        });
    }
  };

/*
 * GET AUDIT LOGS BY CATEGORY
 *
 * Supported categories:
 * - TECHNICAL
 * - OPERATIONAL
 */
exports.getLogsByCategory =
  async (
    req,
    res
  ) => {
    const category =
      cleanCategory(
        req.params.category
      );

    if (!category) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid audit log category.",
          message:
            "Audit log category must be TECHNICAL or OPERATIONAL.",
        });
    }

    try {
      const [logs] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              user_id,
              username,
              role,
              category,
              action,
              description,
              created_at,
              full_name
            FROM audit_logs
            WHERE category = ?
            ORDER BY
              created_at DESC,
              id DESC
            `,
            [
              category,
            ]
          );

      return res
        .status(200)
        .json(logs);
    } catch (error) {
      console.error(
        "Fetch Audit Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to fetch audit logs.",
          message:
            "The requested audit log records could not be retrieved.",
        });
    }
  };