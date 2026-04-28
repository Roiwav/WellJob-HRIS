const express = require("express");
const router = express.Router();

const {
  getLogsByCategory,
  createAuditLog,
} = require("../controllers/auditLogController");

router.get("/audit-logs/:category", getLogsByCategory);
router.post("/audit-logs", createAuditLog);

module.exports = router;