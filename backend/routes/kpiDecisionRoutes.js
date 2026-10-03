const express = require("express");

const router = express.Router();

const {
  getKpiDecisionHistory,
  createKpiDecision,
  getKpiEvaluation,
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

router.get(
  "/kpi/evaluation/:employeeId",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getKpiEvaluation
);

router.post(
  "/kpi/decision-history",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  createKpiDecision
);

/*
 * KPI decision history is intentionally append-only.
 *
 * Completed HR decisions are immutable audit records.
 * There is no normal DELETE endpoint.
 */

module.exports = router;