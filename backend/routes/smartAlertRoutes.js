const express = require("express");
const router = express.Router();

const {
  getSmartAlerts,
  markSmartAlertRead,
  dismissSmartAlert,
  markAllSmartAlertsRead,
} = require("../controllers/smartAlertController");

router.get("/smart-alerts", getSmartAlerts);
router.post("/smart-alerts/read", markSmartAlertRead);
router.post("/smart-alerts/dismiss", dismissSmartAlert);
router.post("/smart-alerts/read-all", markAllSmartAlertsRead);

module.exports = router;