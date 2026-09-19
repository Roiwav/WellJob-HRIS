const express = require("express");

const router = express.Router();

const {
  getUsers,
  getCompanyOptions,
  createUser,
  updateAssignedCompany,
  resetPassword,
  toggleStatus,
  changePassword,
} = require("../controllers/userController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * ==================================================
 * USER ACCOUNT LIST
 * ==================================================
 *
 * SUPER_ADMIN:
 * - account administration
 *
 * IT_SUPPORT:
 * - technical account maintenance
 *
 * Controller-level rules still determine which
 * target accounts may actually be modified.
 */
router.get(
  "/users",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "IT_SUPPORT"
  ),
  getUsers
);

/*
 * ==================================================
 * HR COORDINATOR COMPANY OPTIONS
 * ==================================================
 *
 * SUPER ADMIN ONLY.
 *
 * Returns the canonical company names already used
 * by employee/deployment records.
 *
 * This endpoint is used by the Super Admin Portal
 * so HR Coordinator assignment uses an existing
 * company instead of unrestricted free-text input.
 */
router.get(
  "/users/company-options",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  getCompanyOptions
);

/*
 * ==================================================
 * CREATE SYSTEM USER
 * ==================================================
 *
 * Only SUPER_ADMIN may create internal system
 * accounts.
 *
 * HR Coordinator creation additionally requires a
 * valid assigned company, enforced by the controller.
 */
router.post(
  "/users",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  createUser
);

/*
 * ==================================================
 * CHANGE OWN PASSWORD
 * ==================================================
 *
 * Any authenticated canonical user may change their
 * own password.
 *
 * changePassword uses req.user as the trusted
 * authenticated identity.
 */
router.put(
  "/users/change-password",
  verifyToken,
  changePassword
);

/*
 * ==================================================
 * ASSIGN HR COORDINATOR COMPANY
 * ==================================================
 *
 * SUPER ADMIN ONLY.
 *
 * HR Coordinator cannot:
 *
 * - assign their own company
 * - change their own company
 * - provide a company scope through normal
 *   employee/deployment/incident requests
 *
 * The controller validates that:
 *
 * - the target account exists
 * - the target is HR_COORDINATOR
 * - the requested company is canonical
 *
 * Changing the assignment also invalidates the
 * coordinator's existing session through
 * token_version.
 */
router.put(
  "/users/:id/assigned-company",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  updateAssignedCompany
);

/*
 * ==================================================
 * RESET USER PASSWORD
 * ==================================================
 *
 * Route-level access:
 *
 * SUPER_ADMIN
 * IT_SUPPORT
 *
 * Controller-level target hierarchy:
 *
 * SUPER_ADMIN
 *   -> HR_MANAGER
 *   -> HR_STAFF
 *   -> HR_COORDINATOR
 *   -> IT_SUPPORT
 *
 * IT_SUPPORT
 *   -> HR_STAFF only
 *
 * SUPER_ADMIN targets and self-targeting are
 * rejected by the controller.
 */
router.put(
  "/users/reset/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "IT_SUPPORT"
  ),
  resetPassword
);

/*
 * ==================================================
 * ACTIVATE / DEACTIVATE USER ACCOUNT
 * ==================================================
 *
 * Uses the same target-role hierarchy as password
 * reset.
 *
 * HR Coordinator may be managed by Super Admin,
 * but not by IT Support.
 *
 * SUPER_ADMIN accounts cannot be toggled through
 * this administrative endpoint.
 */
router.put(
  "/users/toggle/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "IT_SUPPORT"
  ),
  toggleStatus
);

module.exports = router;