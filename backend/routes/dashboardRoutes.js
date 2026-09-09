const express = require("express");

const router = express.Router();

const {
  getDashboardOverview,
} = require("../controllers/dashboardController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const DASHBOARD_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
];

router.get(
  "/dashboard/overview",
  verifyToken,
  authorizeRoles(...DASHBOARD_ROLES),
  getDashboardOverview
);

module.exports = router;