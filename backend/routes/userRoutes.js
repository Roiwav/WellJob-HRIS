
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const sensitiveSelfServiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message:
      "Too many sensitive account requests. Please try again later.",
  },
});

const {
  getUsers,
  getCompanyOptions,
  createUser,
  resendAccountCredentials,
  updateAssignedCompany,
  updateRecoveryEmail,
  registerOwnRecoveryEmail,
  toggleStatus,
  changePassword,
} = require("../controllers/userController");

const {
  uploadMyAvatar,
  getAvatar,
  removeMyAvatar,
} = require("../controllers/avatarController");

const avatarUpload = require("../middleware/avatarUpload");

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
 * REGISTER OWN RECOVERY EMAIL - SUPER ADMIN ONLY
 * ==================================================
 *
 * This owner-only route must remain before dynamic
 * /users/:id routes so "me" is never interpreted as
 * an administrative target ID.
 */
router.put(
  "/users/me/recovery-email",
  verifyToken,
  sensitiveSelfServiceLimiter,
  registerOwnRecoveryEmail
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

/*
 * ==================================================
 * PROFILE PICTURE — UPLOAD OR REPLACE OWN AVATAR
 * ==================================================
 *
 * Available to all authenticated WELLJOB user roles.
 *
 * PUT /api/users/me/avatar
 *
 * Request:
 * Content-Type: multipart/form-data
 * Image field name: avatar
 *
 * Users can update only their own profile picture.
 * The target user ID is taken from the verified JWT.
 */
router.put(
  "/users/me/avatar",
  verifyToken,
  avatarUpload,
  uploadMyAvatar
);

/*
 * ==================================================
 * PROFILE PICTURE — REMOVE OWN AVATAR
 * ==================================================
 *
 * DELETE /api/users/me/avatar
 *
 * Users can remove only their own profile picture.
 */
router.delete(
  "/users/me/avatar",
  verifyToken,
  removeMyAvatar
);

/*
 * ==================================================
 * PROFILE PICTURE — GET AVATAR
 * ==================================================
 *
 * GET /api/users/:id/avatar
 *
 * Profile pictures are retrieved through an
 * authenticated endpoint, not express.static().
 *
 * Access to this endpoint requires a valid session.
 * The avatarController validates the requested user
 * ID and retrieves the corresponding stored image.
 */
router.get(
  "/users/:id/avatar",
  verifyToken,
  getAvatar
);

module.exports = router;