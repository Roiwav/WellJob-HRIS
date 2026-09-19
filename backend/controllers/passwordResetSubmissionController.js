"use strict";

const {
  createPendingPasswordResetRequest,
} = require("../services/passwordResetRequestService");

/*
 * WELLJOB HRIS
 * Forgot Password - Pending Request Submission
 *
 * This controller is STAGED ONLY.
 *
 * Do not mount this controller on the public
 * forgot-password route until the reviewer UI
 * and approval workflow have been validated.
 *
 * This controller:
 * - accepts email, username, and fullName;
 * - delegates eligibility checks to the service;
 * - creates a pending request when eligible;
 * - never generates a reset token;
 * - never sends a password-reset email;
 * - returns the same public confirmation regardless
 *   of whether an account matched.
 */

const GENERIC_RECOVERY_MESSAGE =
  "If the submitted details are eligible for recovery, " +
  "your request will be reviewed. A password-reset link " +
  "may be sent to the account's verified recovery email " +
  "after approval.";

async function submitPasswordResetRequest(req, res) {
  const email = req.body?.email;
  const username = req.body?.username;
  const fullName = req.body?.fullName;

  try {
    await createPendingPasswordResetRequest({
      email,
      username,
      fullName,
    });
  } catch (error) {
    /*
     * Do not expose account eligibility, database errors,
     * email addresses, or other submitted identity details
     * in the public response or application logs.
     *
     * Operational monitoring should separately alert
     * administrators when request creation fails.
     */
    console.error(
      "PASSWORD RESET SUBMISSION ERROR:",
      error?.code || "request failed"
    );
  }

  /*
   * Do not return queued, requestId, or account details
   * to an unauthenticated requester.
   */
  return res.json({
    message: GENERIC_RECOVERY_MESSAGE,
  });
}

module.exports = {
  submitPasswordResetRequest,
};