const db = require("../config/db");

const AUDIT_CATEGORY = {
  TECHNICAL: "TECHNICAL",
  OPERATIONAL: "OPERATIONAL",
};

async function logAudit(data) {
  try {
    await db.promise().query(
      `INSERT INTO audit_logs 
       (user_id, username, role, category, action, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
        data.username || null,
        data.role || null,
        data.category || AUDIT_CATEGORY.TECHNICAL,
        data.action || "UNKNOWN_ACTION",
        data.description || "",
      ]
    );
  } catch (err) {
    console.error("Audit error:", err);
  }
}

module.exports = {
  logAudit,
  AUDIT_CATEGORY,
};