// routes/auditLogRoutes.js

const express = require("express");
const router = express.Router();

const { getLogsByCategory } = require("../controllers/auditLogController");

// 🔥 Kapag may nag-request ng /api/audit-logs/TECHNICAL, ipapasa niya rito
router.get("/audit-logs/:category", getLogsByCategory);

module.exports = router;