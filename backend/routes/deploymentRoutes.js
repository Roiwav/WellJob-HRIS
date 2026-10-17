const express = require("express");

const router = express.Router();

const {
  getDeployments,
  getDeploymentReport,
  getDeploymentCompanyOptions,
  getDeploymentPositionOptions,
  updateDeploymentStatus,
} = require("../controllers/deploymentController");

const {
  getDeploymentAttempts,
  getDeploymentMovementReport,
  createDeploymentAttempt,
  confirmDeploymentArrival,
  markDeploymentNoShow,
  withdrawDeploymentAttempt,
} = require("../controllers/deploymentAttemptController");

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
 * VIEW DEPLOYMENT ATTEMPTS
 * ==================================================
 *
 * GET /deployment-attempts
 *
 * SUPER_ADMIN / HR_MANAGER / HR_STAFF:
 * - may view deployment-attempt records
 *
 * HR_COORDINATOR:
 * - may view only attempts belonging to the
 *   coordinator's assigned company
 * - company scope is enforced again inside the
 *   controller and is not trusted to route access alone
 *
 * Supported optional query filters:
 * - status
 * - employeeId
 * - limit
 */
router.get(
  "/deployment-attempts",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getDeploymentAttempts
);


/*
 * ==================================================
 * DEPLOYMENT MOVEMENT / ACTIVITY REPORT
 * ==================================================
 *
 * GET /deployment-movements/report
 *
 * Supported filters:
 * - month
 * - year
 *
 * Month may be omitted for an All Months / yearly view.
 * There is intentionally no company query filter.
 *
 * Movement categories:
 * - Scheduled for Deployment
 * - Successfully Deployed
 * - No Show
 * - Withdrawn
 * - Resigned
 * - Terminated
 * - AWOL
 * - Other Separation
 *
 * SUPER_ADMIN / HR_MANAGER / HR_STAFF:
 * - may view the overall movement report
 * - receive automatic per-company breakdown
 *
 * HR_COORDINATOR:
 * - may view only movements belonging to the
 *   coordinator's authenticated assigned company
 * - company scope is enforced inside the controller
 *
 * IMPORTANT:
 * Route authorization only allows the role to reach
 * the endpoint. Company scoping remains authoritative
 * inside deploymentAttemptController.js.
 */
router.get(
  "/deployment-movements/report",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getDeploymentMovementReport
);


/*
 * ==================================================
 * HR STAFF — SCHEDULE FOR DEPLOYMENT
 * ==================================================
 *
 * POST /employees/:employeeId/deployment-attempts
 *
 * Business result:
 * - employee workforce_status -> For Deployment
 * - deployment_attempts -> For Deployment
 * - NO deployment_assignments row yet
 *
 * A real deployment assignment is created only after
 * the assigned HR Coordinator confirms actual arrival.
 */
router.post(
  "/employees/:employeeId/deployment-attempts",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  createDeploymentAttempt
);


/*
 * ==================================================
 * HR COORDINATOR — CONFIRM ARRIVAL
 * ==================================================
 *
 * PATCH /deployment-attempts/:attemptId/confirm-arrival
 *
 * Business result:
 * - attempt -> Deployed
 * - employee workforce_status -> Deployed
 * - actual arrival date is captured
 * - one Active deployment_assignments row is created
 *
 * The controller also verifies that the Coordinator is
 * assigned to the same company as the deployment attempt.
 */
router.patch(
  "/deployment-attempts/:attemptId/confirm-arrival",
  verifyToken,
  authorizeRoles(
    "HR_COORDINATOR"
  ),
  confirmDeploymentArrival
);


/*
 * ==================================================
 * HR COORDINATOR — MARK NO SHOW
 * ==================================================
 *
 * PATCH /deployment-attempts/:attemptId/no-show
 *
 * Business result:
 * - attempt -> No Show
 * - employee workforce_status -> Floating / Standby
 * - NO deployment_assignments row is created
 *
 * The controller also verifies assigned-company scope.
 */
router.patch(
  "/deployment-attempts/:attemptId/no-show",
  verifyToken,
  authorizeRoles(
    "HR_COORDINATOR"
  ),
  markDeploymentNoShow
);


/*
 * ==================================================
 * HR STAFF — WITHDRAW DEPLOYMENT SCHEDULE
 * ==================================================
 *
 * PATCH /deployment-attempts/:attemptId/withdraw
 *
 * Business result:
 * - attempt -> Withdrawn
 * - employee workforce_status -> Floating / Standby
 * - NO deployment_assignments row is created
 *
 * "Withdrawn" is intentionally different from the
 * legacy internal deployment_assignments "Cancelled"
 * lifecycle value.
 */
router.patch(
  "/deployment-attempts/:attemptId/withdraw",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  withdrawDeploymentAttempt
);


/*
 * ==================================================
 * DEPLOYMENT REPORT DATA
 * ==================================================
 *
 * GET /deployments/report
 *
 * Used by the Deployment page PDF export.
 *
 * Supported report filters:
 * - search
 * - status
 * - month
 * - year
 *
 * User-facing reporting values currently used by
 * the Deployment page include:
 * - Deployed
 * - Resigned
 * - Terminated
 * - AWOL
 * - Other Separation
 *
 * Internal compatibility values remain handled by
 * deploymentController.js and are not exposed as
 * the primary HR-facing terminology.
 *
 * HR_COORDINATOR:
 * - may export records only for the Coordinator's
 *   authenticated assigned company
 * - company scope is enforced inside the controller
 * - query parameters cannot override company scope
 *
 * SUPER_ADMIN / HR_MANAGER / HR_STAFF:
 * - retain authorized deployment-report visibility
 *
 * IMPORTANT:
 * The controller remains the security boundary.
 */
router.get(
  "/deployments/report",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getDeploymentReport
);


/*
 * ==================================================
 * VIEW ACTUAL DEPLOYMENTS
 * ==================================================
 *
 * HR_COORDINATOR:
 * - may view actual deployment records
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
 * UPDATE ACTUAL DEPLOYMENT STATUS
 * ==================================================
 *
 * This is the existing actual-assignment lifecycle.
 *
 * HR Coordinator is intentionally excluded.
 *
 * They may view actual deployments but cannot:
 * - end an assignment
 * - change deployment status
 * - modify deployment information
 *
 * NOTE:
 * This route is separate from the new pre-deployment
 * arrival-confirmation workflow above.
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