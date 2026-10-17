const express = require("express");

const router = express.Router();

const {
  getDashboardOverview,
  getDashboardMonthlyWorkforce,
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


/*
 * ==================================================
 * DASHBOARD OVERVIEW
 * ==================================================
 *
 * Existing live Dashboard data:
 * - workforce KPI cards
 * - employee data
 * - incident data
 * - deployment trend
 * - expiring compliance documents
 *
 * Access:
 * - Super Admin
 * - HR Manager
 * - HR Staff
 */
router.get(
  "/dashboard/overview",
  verifyToken,
  authorizeRoles(
    ...DASHBOARD_ROLES
  ),
  getDashboardOverview
);


/*
 * ==================================================
 * MONTHLY WORKFORCE SUMMARY
 * ==================================================
 *
 * GET /dashboard/monthly-workforce
 *
 * Management reporting source for:
 * - Super Admin
 * - HR Manager
 * - HR Staff
 *
 * Supported query filters:
 * - month: JavaScript month index 0..11
 * - year: four-digit year
 *
 * There is intentionally NO company filter.
 *
 * Response includes:
 * - overall monthly workforce summary
 * - automatic per-company breakdown
 * - overall total derived from company rows
 * - available report years
 *
 * User-facing workforce categories:
 * - Deployed
 * - For Deployment
 * - Floating / Standby
 * - Resigned
 * - Terminated
 * - AWOL
 * - Other Separation
 *
 * Historical reporting logic and workforce-state
 * classification remain authoritative inside
 * dashboardController.js.
 */
router.get(
  "/dashboard/monthly-workforce",
  verifyToken,
  authorizeRoles(
    ...DASHBOARD_ROLES
  ),
  getDashboardMonthlyWorkforce
);


module.exports = router;