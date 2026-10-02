"use strict";

function parseCanonicalUserId(value) {
  const normalized = String(
    value ?? ""
  ).trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericValue =
    Number(normalized);

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}

function evaluateIndependentIncidentReview({
  reviewerUserId,
  investigationStartedById,
  resolutionSubmittedById,
} = {}) {
  const reviewerId =
    parseCanonicalUserId(
      reviewerUserId
    );

  if (!reviewerId) {
    return {
      allowed: false,
      statusCode: 403,
      code: "REVIEWER_ID_REQUIRED",
      message:
        "Independent incident review requires a canonical reviewer user ID.",
    };
  }

  const protectedActorIds =
    [
      parseCanonicalUserId(
        investigationStartedById
      ),
      parseCanonicalUserId(
        resolutionSubmittedById
      ),
    ].filter(Boolean);

  if (
    protectedActorIds.length === 0
  ) {
    return {
      allowed: false,
      statusCode: 409,
      code: "REVIEW_IDENTITY_UNVERIFIABLE",
      message:
        "Independent review cannot be verified because this case has no canonical investigator or proof-submitter user ID.",
    };
  }

  if (
    protectedActorIds.includes(
      reviewerId
    )
  ) {
    return {
      allowed: false,
      statusCode: 403,
      code: "SELF_REVIEW_FORBIDDEN",
      message:
        "Independent review is required. The investigator or proof submitter cannot approve, close, or return their own submitted case.",
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    code: "INDEPENDENT_REVIEW_ALLOWED",
    message:
      "Independent reviewer verified.",
  };
}

module.exports = {
  parseCanonicalUserId,
  evaluateIndependentIncidentReview,
};