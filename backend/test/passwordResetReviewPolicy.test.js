"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAuthorizedPasswordResetReviewer,
} = require("../utils/passwordResetReviewPolicy");

function canReview(overrides = {}) {
  return isAuthorizedPasswordResetReviewer({
    reviewerId: 10,
    reviewerRole: "IT_SUPPORT",
    requesterId: 20,
    requesterRole: "HR_STAFF",
    ...overrides,
  });
}

test("IT Support may review HR account requests", () => {
  for (const requesterRole of [
    "HR_STAFF",
    "HR_MANAGER",
    "HR_COORDINATOR",
  ]) {
    assert.equal(
      canReview({ requesterRole }),
      true,
      requesterRole
    );
  }
});

test("IT Support may review a Super Admin request", () => {
  assert.equal(
    canReview({ requesterRole: "SUPER_ADMIN" }),
    true
  );
});

test("Another IT Support may review an IT Support request", () => {
  assert.equal(
    canReview({
      reviewerId: 10,
      requesterId: 20,
      requesterRole: "IT_SUPPORT",
    }),
    true
  );
});

test("Super Admin may review an IT Support request", () => {
  assert.equal(
    canReview({
      reviewerRole: "SUPER_ADMIN",
      requesterRole: "IT_SUPPORT",
    }),
    true
  );
});

test("Super Admin may not review HR account requests", () => {
  for (const requesterRole of [
    "HR_STAFF",
    "HR_MANAGER",
    "HR_COORDINATOR",
  ]) {
    assert.equal(
      canReview({
        reviewerRole: "SUPER_ADMIN",
        requesterRole,
      }),
      false,
      requesterRole
    );
  }
});

test("Super Admin may not review a Super Admin request", () => {
  assert.equal(
    canReview({
      reviewerRole: "SUPER_ADMIN",
      requesterRole: "SUPER_ADMIN",
    }),
    false
  );
});

test("No reviewer may approve their own request", () => {
  for (const reviewerRole of [
    "IT_SUPPORT",
    "SUPER_ADMIN",
  ]) {
    assert.equal(
      canReview({
        reviewerId: 10,
        reviewerRole,
        requesterId: 10,
        requesterRole: "IT_SUPPORT",
      }),
      false,
      reviewerRole
    );
  }
});

test("HR accounts cannot act as reviewers", () => {
  for (const reviewerRole of [
    "HR_STAFF",
    "HR_MANAGER",
    "HR_COORDINATOR",
  ]) {
    assert.equal(
      canReview({ reviewerRole }),
      false,
      reviewerRole
    );
  }
});

test("Unknown roles are denied", () => {
  assert.equal(
    canReview({ reviewerRole: "UNKNOWN" }),
    false
  );

  assert.equal(
    canReview({ requesterRole: "UNKNOWN" }),
    false
  );
});

test("Invalid user IDs are denied", () => {
  assert.equal(
    canReview({ reviewerId: "not-an-id" }),
    false
  );

  assert.equal(
    canReview({ requesterId: null }),
    false
  );

  assert.equal(
    canReview({ reviewerId: 0 }),
    false
  );
});
