const db = require("../config/db");
const { logAudit, AUDIT_CATEGORY } = require("../utils/auditLogger");

function cleanCategory(category) {
  const value = String(category || "").trim().toUpperCase();

  if (value === AUDIT_CATEGORY.TECHNICAL) return AUDIT_CATEGORY.TECHNICAL;
  if (value === AUDIT_CATEGORY.OPERATIONAL) return AUDIT_CATEGORY.OPERATIONAL;

  return null;
}

exports.getAllLogs = async (req, res) => {
  try {
    const [logs] = await db.promise().query(
      "SELECT * FROM audit_logs ORDER BY created_at DESC"
    );
    res.json(logs);
  } catch (err) {
    console.error("Fetch All Audit Logs Error:", err);
    res.status(200).json([]); 
  }
};

exports.getLogsByCategory = async (req, res) => {
  const category = cleanCategory(req.params.category);

  if (!category) {
    return res.status(400).json({
      error: "Invalid audit log category.",
    });
  }

  try {
    const [logs] = await db.promise().query(
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
      ORDER BY created_at DESC, id DESC
      `,
      [category]
    );

    res.json(logs);
  } catch (err) {
    console.error("Fetch Audit Logs Error:", err);
    res.status(200).json([]);
  }
};

exports.createAuditLog = async (req, res) => {
  try {
    const {
      userId,
      user_id,
      username,
      fullName,
      full_name,
      role,
      category,
      action,
      description,
    } = req.body;

    await logAudit({
      userId: userId || user_id,
      username,
      fullName: fullName || full_name,
      role,
      category: cleanCategory(category) || AUDIT_CATEGORY.OPERATIONAL,
      action,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Audit log created successfully.",
    });
  } catch (err) {
    console.error("Create Audit Log Error:", err);
    res.status(500).json({
      error: "Failed to create audit log.",
    });
  }
};

// 🔥 FIX: Tinanggal natin ang 'full_name' sa INSERT query para hindi mag-error ang MySQL
exports.createLog = async (req, res) => {
  try {
    const { userId, username, role, category, action, description } = req.body;
    
    await db.promise().query(
      `INSERT INTO audit_logs (user_id, username, role, category, action, description) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId || "-", 
        username || "-", 
        role || "-", 
        category || "OPERATIONAL", 
        action, 
        description
      ]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Create Audit Log Error:", err);
    res.status(500).json({ error: "Failed to create log" });
  }
};