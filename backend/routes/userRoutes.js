const express = require("express");

const router = express.Router();

const {
  getUsers,
  getCompanyOptions,
  createUser,
  resendAccountCredentials,
  updateAssignedCompany,
  updateRecoveryEmail,
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
 * RESEND FAILED INITIAL ACCOUNT CREDENTIALS
 * ==================================================
 *
 * SUPER_ADMIN ONLY.
 *
 * Controller allows resend only when:
 * - Account is Inactive
 * - Initial credentials delivery status is FAILED
 * - Initial password change is still required
 *
 * A new temporary password is generated exclusively
 * on the backend and sent to the registered email.
 */
router.post(
  "/users/:id/resend-credentials",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  resendAccountCredentials
);

/*
 * ==================================================
 * CHANGE OWN PASSWORD
 * ==================================================
 */
router.put(
  "/users/change-password",
  verifyToken,
  changePassword
);

/*
 * ==================================================
 * REGISTER / UPDATE RECOVERY EMAIL
 * ==================================================
 */
router.put(
  "/users/:id/recovery-email",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN"
  ),
  updateRecoveryEmail
);

/*
 * ==================================================
 * ASSIGN HR COORDINATOR COMPANY
 * ==================================================
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