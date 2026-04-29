const express = require("express");
const router = express.Router();

// 🔥 Idinagdag ang createLog sa import
const { getLogsByCategory, getAllLogs, createLog } = require("../controllers/auditLogController");

router.get("/audit-logs", getAllLogs);
router.get("/audit-logs/:category", getLogsByCategory);

// 🔥 BAGONG ROUTE: Tatanggap ng data kapag may nag-add/edit/archive ng employee
router.post("/audit-logs", createLog);

module.exports = router;