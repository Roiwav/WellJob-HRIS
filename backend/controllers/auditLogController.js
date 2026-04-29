// controllers/auditLogController.js

const db = require("../config/db");

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
  const { category } = req.params;

  try {
    const [logs] = await db.promise().query(
      "SELECT * FROM audit_logs WHERE category = ? ORDER BY created_at DESC",
      [category]
    );
    res.json(logs); 
  } catch (err) {
    console.error("Fetch Audit Logs by Category Error:", err);
    res.status(200).json([]); 
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