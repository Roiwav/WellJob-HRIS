const db = require("../config/db");

const AUDIT_CATEGORY = {
  TECHNICAL: "TECHNICAL",
  OPERATIONAL: "OPERATIONAL",
};

function cleanValue(value) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

async function logAudit(data = {}) {
  try {
    const userId = cleanValue(data.userId || data.user_id);
    const username = cleanValue(data.username);
    const role = cleanValue(data.role);
    const category = cleanValue(data.category) || AUDIT_CATEGORY.TECHNICAL;
    const action = cleanValue(data.action) || "UNKNOWN_ACTION";

    const fullName =
      cleanValue(data.fullName) ||
      cleanValue(data.full_name) ||
      cleanValue(data.name) ||
      username ||
      "Unknown User";

    const description = cleanValue(data.description) || "";

    await db.promise().query(
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
      [userId, username, role, category, action, description, fullName]
    );
  } catch (err) {
    console.error("Audit error:", err);
  }
}

module.exports = {
  logAudit,
  AUDIT_CATEGORY,
};