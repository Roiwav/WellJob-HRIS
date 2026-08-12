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
 * Technical account-support responsibility.
 */
router.put(
  "/users/reset/:id",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  resetPassword
);

/*
 * ACTIVATE / DEACTIVATE USER ACCOUNT
 *
 * Technical account-support responsibility.
 */
router.put(
  "/users/toggle/:id",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  toggleStatus
);

module.exports = router;