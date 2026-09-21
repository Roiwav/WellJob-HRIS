const express = require("express");

const router = express.Router();

const {
  getDeployments,
  getDeploymentCompanyOptions,
  getDeploymentPositionOptions,
  updateDeploymentStatus,
} = require("../controllers/deploymentController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * ==================================================
 * DEPLOYMENT COMPANY OPTIONS
 * ==================================================
 *
 * Operational read-only endpoint.
 *
 * HR_MANAGER / HR_STAFF:
 * - may retrieve ACTIVE client companies
 * - used by deployment create/edit forms
 *
 * This route is intentionally separate from the
 * System Configuration management endpoints.
 *
 * HR Coordinator is excluded because deployment
 * access is read-only for that role.
 */
router.get(
  "/deployments/options/companies",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getDeploymentCompanyOptions
);

/*
 * ==================================================
 * DEPLOYMENT POSITION OPTIONS
 * ==================================================
 *
 * Operational read-only endpoint.
 *
 * Example:
 *
 * GET /deployments/options/positions?company=Toyota Philippines
 *
 * Returns only ACTIVE positions belonging to the
 * selected ACTIVE client company.
 */
router.get(
  "/deployments/options/positions",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getDeploymentPositionOptions
);

/*
 * ==================================================
 * VIEW DEPLOYMENTS
 * ==================================================
 *
 * HR_COORDINATOR:
 * - may view deployment records
 * - controller restricts results to the
 *   coordinator's assigned company
 *
 * IMPORTANT:
 * Route access alone is not the security boundary.
 * backend/controllers/deploymentController.js also
 * enforces the actual company scope.
 */
router.get(
  "/deployments",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getDeployments
);

/*
 * ==================================================
 * UPDATE DEPLOYMENT STATUS
 * ==================================================
 *
 * HR Coordinator is intentionally excluded.
 *
 * They may view deployments but cannot:
 *
 * - end an assignment
 * - change deployment status
 * - modify deployment information
 */
router.patch(
  "/deployments/:deploymentId/status",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  updateDeploymentStatus
);

module.exports = router;