const express = require("express");

const router = express.Router();

const {
  getDeployments,
  updateDeploymentStatus,
} = require("../controllers/deploymentController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * VIEW DEPLOYMENTS
 *
 * SUPER_ADMIN:
 * - View-only access
 *
 * HR_MANAGER / HR_STAFF:
 * - Operational access
 *
 * IT_SUPPORT:
 * - No deployment access
 */
router.get(
  "/deployments",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getDeployments
);

/*
 * UPDATE DEPLOYMENT STATUS
 *
 * Only HR roles responsible for employee
 * deployment operations may complete or
 * cancel a deployment.
 */
router.patch(
  "/deployments/:employeeId/status",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  updateDeploymentStatus
);

module.exports = router;