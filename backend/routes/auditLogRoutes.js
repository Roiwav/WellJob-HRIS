const express = require("express");
const router = express.Router();

// 🔥 FIX: Siguraduhing nandito ang createLog sa loob ng curly braces!
const { getLogsByCategory, getAllLogs, createLog } = require("../controllers/auditLogController");

router.get("/audit-logs", getAllLogs);
router.get("/audit-logs/:category", getLogsByCategory);
router.post("/audit-logs", createLog);

module.exports = router;
