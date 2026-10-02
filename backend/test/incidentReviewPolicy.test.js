"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseCanonicalUserId,
  evaluateIndependentIncidentReview,
} = require("../utils/incidentReviewPolicy");

test(
  "canonical user IDs accept positive integer strings and numbers only",
  () => {
    assert.equal(
      parseCanonicalUserId(12),
      12
    );

    assert.equal(
      parseCanonicalUserId(" 12 "),
      12
    );

    assert.equal(
      parseCanonicalUserId(0),
      null
    );

    assert.equal(
      parseCanonicalUserId("user-12"),
      null
    );
  }
);

test(
  "different canonical reviewer is allowed",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: 20,
        investigationStartedById: 10,
        resolutionSubmittedById: 10,
      });

    assert.equal(
      result.allowed,
      true
    );

    assert.equal(
      result.code,
      "INDEPENDENT_REVIEW_ALLOWED"
    );
  }
);

test(
  "investigator cannot review their own submitted case",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: 10,
        investigationStartedById: "10",
        resolutionSubmittedById: 11,
      });

    assert.equal(
      result.allowed,
      false
    );

    assert.equal(
      result.statusCode,
      403
    );

    assert.equal(
      result.code,
      "SELF_REVIEW_FORBIDDEN"
    );
  }
);

test(
  "proof submitter cannot review their own submitted case",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: "11",
        investigationStartedById: 10,
        resolutionSubmittedById: 11,
      });

    assert.equal(
      result.allowed,
      false
    );

    assert.equal(
      result.statusCode,
      403
    );

    assert.equal(
      result.code,
      "SELF_REVIEW_FORBIDDEN"
    );
  }
);

test(
  "review is rejected when reviewer has no canonical user ID",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: null,
        investigationStartedById: 10,
        resolutionSubmittedById: 10,
      });

    assert.equal(
      result.allowed,
      false
    );

    assert.equal(
      result.statusCode,
      403
    );

    assert.equal(
      result.code,
      "REVIEWER_ID_REQUIRED"
    );
  }
);

test(
  "review fails closed when legacy case has no canonical investigator or submitter ID",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: 20,
        investigationStartedById: null,
        resolutionSubmittedById: null,
      });

    assert.equal(
      result.allowed,
      false
    );

    assert.equal(
      result.statusCode,
      409
    );

    assert.equal(
      result.code,
      "REVIEW_IDENTITY_UNVERIFIABLE"
    );
  }
);

test(
  "one canonical protected actor ID is sufficient when reviewer differs",
  () => {
    const result =
      evaluateIndependentIncidentReview({
        reviewerUserId: 20,
        investigationStartedById: null,
        resolutionSubmittedById: 10,
      });

    assert.equal(
      result.allowed,
      true
    );
  }
);