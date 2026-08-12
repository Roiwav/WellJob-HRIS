const express = require("express");

const router = express.Router();

const {
  getKpiDecisionHistory,
  createKpiDecision,
  deleteKpiDecision,
} = require("../controllers/kpiDecisionController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

router.get(
  "/kpi/decision-history",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getKpiDecisionHistory
);

router.post(
  "/kpi/decision-history",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  createKpiDecision
);

router.delete(
  "/kpi/decision-history/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  deleteKpiDecision
);

module.exports = router;