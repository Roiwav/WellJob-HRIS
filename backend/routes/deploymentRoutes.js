const express = require("express");
const router = express.Router();

const {
  getDeployments,
  updateDeploymentStatus,
} = require("../controllers/deploymentController");

router.get("/deployments", getDeployments);
router.patch("/deployments/:employeeId/status", updateDeploymentStatus);

module.exports = router;