const express = require("express");
const router = express.Router();

const {
  getLogsByCategory,
  createAuditLog,
} = require("../controllers/auditLogController");

router.get("/audit-logs/:category", getLogsByCategory);
router.post("/audit-logs", createAuditLog);

// 🔥 BAGONG ROUTE: Tatanggap ng data kapag may nag-add/edit/archive ng employee
router.post("/audit-logs", createLog);

module.exports = router;