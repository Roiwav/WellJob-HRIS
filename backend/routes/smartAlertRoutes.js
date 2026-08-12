const express = require("express");

const router = express.Router();

const {
  getSmartAlerts,
  markSmartAlertRead,
  dismissSmartAlert,
  markAllSmartAlertsRead,
} = require("../controllers/smartAlertController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const SMART_ALERT_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
];

router.get(
  "/smart-alerts",
  verifyToken,
  authorizeRoles(...SMART_ALERT_ROLES),
  getSmartAlerts
);

router.post(
  "/smart-alerts/read",
  verifyToken,
  authorizeRoles(...SMART_ALERT_ROLES),
  markSmartAlertRead
);

router.post(
  "/smart-alerts/dismiss",
  verifyToken,
  authorizeRoles(...SMART_ALERT_ROLES),
  dismissSmartAlert
);

router.post(
  "/smart-alerts/read-all",
  verifyToken,
  authorizeRoles(...SMART_ALERT_ROLES),
  markAllSmartAlertsRead
);

module.exports = router;