const express = require("express");
const router = express.Router();

const {
  getKpiDecisionHistory,
  createKpiDecision,
  deleteKpiDecision,
} = require("../controllers/kpiDecisionController");

router.get("/kpi/decision-history", getKpiDecisionHistory);
router.post("/kpi/decision-history", createKpiDecision);
router.delete("/kpi/decision-history/:id", deleteKpiDecision);

module.exports = router;