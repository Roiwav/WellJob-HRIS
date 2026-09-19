"use strict";

/*
 * WELLJOB HRIS
 * Forgot Password - Reviewer Authorization Policy
 *
 * This module checks role-based eligibility only.
 *
 * IMPORTANT:
 * The caller must separately verify that:
 * - the reviewer has a valid authenticated session;
 * - the reviewer account is currently Active;
 * - the target account is currently Active;
 * - the request is still PENDING and has not expired;
 * - the request is processed atomically.
 *
 * Do not use browser-supplied role or user ID values
 * as the authorization source.
 */

const REVIEWER_ROLES = new Set([
  "SUPER_ADMIN",
  "IT_SUPPORT",
]);

const REQUESTER_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
  "IT_SUPPORT",
]);

function parseUserId(value) {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized = String(value).trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed)
    ? parsed
    : null;
}

function isAuthorizedPasswordResetReviewer({
  reviewerId,
  reviewerRole,
  requesterId,
  requesterRole,
} = {}) {
  const validReviewerId = parseUserId(reviewerId);
  const validRequesterId = parseUserId(requesterId);

  if (
    validReviewerId === null ||
    validRequesterId === null
  ) {
    return false;
  }

  /*
   * Absolute rule: No self-approval.
   */
  if (validReviewerId === validRequesterId) {
    return false;
  }

  /*
   * Roles must already be canonical values loaded
   * from the database.
   *
   * Unknown roles fail closed.
   */
  if (
    !REVIEWER_ROLES.has(reviewerRole) ||
    !REQUESTER_ROLES.has(requesterRole)
  ) {
    return false;
  }

  /*
   * Super Admin may review IT Support requests only.
   *
   * Super Admin cannot approve their own request
   * or bypass the agreed approval process for
   * HR accounts.
   */
  if (reviewerRole === "SUPER_ADMIN") {
    return requesterRole === "IT_SUPPORT";
  }

  /*
   * IT Support may review:
   * - Super Admin requests;
   * - HR Manager requests;
   * - HR Staff requests;
   * - HR Coordinator requests;
   * - another IT Support account's request.
   *
   * The self-approval check above remains mandatory.
   */
  return reviewerRole === "IT_SUPPORT";
}

module.exports = {
  isAuthorizedPasswordResetReviewer,
};