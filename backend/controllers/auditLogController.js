// controllers/auditLogController.js

const db = require("../config/db");

exports.getLogsByCategory = async (req, res) => {
  const { category } = req.params; // Kukunin niya yung salitang 'TECHNICAL' o 'OPERATIONAL'

  try {
    // Kukunin natin sa database yung mga logs na magma-match sa category
    const [logs] = await db.promise().query(
      "SELECT * FROM audit_logs WHERE category = ? ORDER BY created_at DESC",
      [category]
    );

    res.json(logs); // Ibabalik sa frontend bilang malinis na JSON
  } catch (err) {
    console.error("Fetch Audit Logs Error:", err);
    // Nagbabalik tayo ng empty array [] para hindi mag-crash ang frontend kung sakaling wala pang laman o table
    res.status(200).json([]); 
  }
};