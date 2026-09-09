const express = require("express");

const router = express.Router();

const {
  getKpiData,
} = require("../controllers/kpiDataController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

router.get(
  "/kpi/data",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getKpiData
);

module.exports = router;