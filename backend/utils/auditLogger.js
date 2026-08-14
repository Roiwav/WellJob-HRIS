const db = require("../config/db");

const AUDIT_CATEGORY = {
  TECHNICAL: "TECHNICAL",
  OPERATIONAL: "OPERATIONAL",
};

function cleanValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const trimmed =
    String(value).trim();

  return trimmed === ""
    ? null
    : trimmed;
}

/*
 * AUDIT LOGGER
 *
 * Default behavior remains backward-compatible:
 *
 * await logAudit(data)
 *
 * - uses the normal DB pool
 * - audit failures are logged
 * - audit failures do NOT break existing callers
 *
 * Transactional callers may explicitly provide:
 *
 * await logAudit(
 *   data,
 *   {
 *     connection,
 *     throwOnError: true,
 *   }
 * );
 *
 * This allows a security-sensitive multi-step
 * operation to include its audit row in the same
 * database transaction.
 */
async function logAudit(
  data = {},
  options = {}
) {
  const {
    connection = null,
    throwOnError = false,
  } = options || {};

  try {
    const userId =
      cleanValue(
        data.userId ||
        data.user_id
      );

    const username =
      cleanValue(
        data.username
      );

    const role =
      cleanValue(
        data.role
      );

    const category =
      cleanValue(
        data.category
      ) ||
      AUDIT_CATEGORY.TECHNICAL;

    const action =
      cleanValue(
        data.action
      ) ||
      "UNKNOWN_ACTION";

    const fullName =
      cleanValue(
        data.fullName
      ) ||
      cleanValue(
        data.full_name
      ) ||
      cleanValue(
        data.name
      ) ||
      username ||
      "Unknown User";

    const description =
      cleanValue(
        data.description
      ) || "";

    /*
     * When a PromisePoolConnection is supplied,
     * the audit INSERT participates in the same
     * transaction as the caller.
     *
     * Otherwise retain the existing pool behavior.
     */
    const queryTarget =
      connection ||
      db.promise();

    await queryTarget.query(
      `
      INSERT INTO audit_logs
      (
        user_id,
        username,
        role,
        category,
        action,
        description,
        full_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        username,
        role,
        category,
        action,
        description,
        fullName,
      ]
    );

    return true;
  } catch (err) {
    console.error(
      "Audit error:",
      err
    );

    /*
     * Existing callers keep the historical
     * non-blocking audit behavior.
     *
     * Only callers that explicitly request
     * throwOnError participate in transaction
     * failure handling.
     */
    if (throwOnError) {
      throw err;
    }

    return false;
  }
}

module.exports = {
  logAudit,
  AUDIT_CATEGORY,
};