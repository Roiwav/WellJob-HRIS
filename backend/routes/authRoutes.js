"use strict";

const express = require("express");

const {
  rateLimit,
} = require("express-rate-limit");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  login,
} = require("../controllers/authController");

const {
  requestEmailVerification,
  verifyEmail,
  resetPasswordWithToken,
} = require("../controllers/recoveryController");

const {
  submitPasswordResetRequest,
} = require("../controllers/passwordResetSubmissionController");

const {
  getRecoveryEmailStatus,
} = require("../controllers/recoveryEmailStatusController");

const {
  listPendingPasswordResetRequests,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
} = require("../controllers/passwordResetReviewController");

const router = express.Router();

/*
 * In-memory limiters are suitable for the current
 * local development setup.
 *
 * A shared limiter store is required when deploying
 * across multiple backend instances.
 */

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message:
      "Too many recovery requests. Please try again later.",
  },
});

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message:
      "Too many attempts. Please try again later.",
  },
});

/*
 * Login
 */

router.post(
  "/login",
  login
);

/*
 * Recovery email status
 */

router.get(
  "/auth/recovery-email-status",
  verifyToken,
  getRecoveryEmailStatus
);

/*
 * Email verification
 *
 * Preserve the existing verification process.
 */

router.post(
  "/auth/request-email-verification",
  verifyToken,
  recoveryLimiter,
  requestEmailVerification
);

router.post(
  "/auth/verify-email",
  tokenLimiter,
  verifyEmail
);

/*
 * Forgot Password
 *
 * IMPORTANT:
 *
 * This endpoint now creates a pending review request.
 * It does NOT generate a reset token or send a reset email.
 *
 * The submission controller requires:
 * - email
 * - username
 * - fullName
 *
 * The approval controller handles reset-email delivery
 * after an authorized reviewer verifies the requester.
 */

router.post(
  "/auth/forgot-password",
  recoveryLimiter,
  submitPasswordResetRequest
);

/*
 * Existing one-time reset-link endpoint
 *
 * Keep this route unchanged. It will process reset
 * links generated after an authorized approval.
 */

router.post(
  "/auth/reset-password",
  tokenLimiter,
  resetPasswordWithToken
);

/*
 * Authorized reviewer queue
 *
 * verifyToken loads the reviewer's CURRENT role,
 * account status, and token version from the database.
 *
 * The review controller performs additional authorization
 * and transaction-level checks before processing a request.
 */

router.get(
  "/auth/password-reset-requests",
  verifyToken,
  listPendingPasswordResetRequests
);

router.post(
  "/auth/password-reset-requests/:id/approve",
  verifyToken,
  approvePasswordResetRequest
);

router.post(
  "/auth/password-reset-requests/:id/reject",
  verifyToken,
  rejectPasswordResetRequest
);

module.exports = router;