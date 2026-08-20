// userRoutes.js

const express = require("express");

const router = express.Router();

const {
  getUsers,
  createUser,
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
 * USER ACCOUNT LIST
 *
 * SUPER_ADMIN:
 * - needs the list for account administration
 *
 * IT_SUPPORT:
 * - needs the list for technical account maintenance
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
 * CREATE SYSTEM USER
 *
 * Only SUPER_ADMIN may create internal system accounts.
 */
router.post(
  "/users",
  verifyToken,
  authorizeRoles("SUPER_ADMIN"),
  createUser
);

/*
 * CHANGE OWN PASSWORD
 *
 * Any authenticated canonical user may change
 * their own password.
 *
 * changePassword uses req.user as the trusted identity.
 */
router.put(
  "/users/change-password",
  verifyToken,
  changePassword
);

/*
 * RESET USER PASSWORD
 *
 * Route-level access is available to SUPER_ADMIN and
 * IT_SUPPORT, but the controller enforces the target-role
 * hierarchy using canonical database state:
 *
 * SUPER_ADMIN -> HR_MANAGER / HR_STAFF / IT_SUPPORT
 * IT_SUPPORT  -> HR_STAFF only
 *
 * SUPER_ADMIN targets and self-targeting are rejected by
 * the controller.
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
 * ACTIVATE / DEACTIVATE USER ACCOUNT
 *
 * Uses the same target-role hierarchy as resetPassword.
 * SUPER_ADMIN accounts cannot be toggled through this
 * administrative endpoint.
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