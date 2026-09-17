const {
  cleanValue,
  cleanSuggestionKey,
  getTrustedSuggestionIdentity,
  saveSuggestionAction,
  saveSuggestionDismiss,
  normalizeStateResponse,
} = require("../utils/smartSuggestionState");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const ALLOWED_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
]);

const ALLOWED_ACTION_TYPES =
  new Map([
    [
      "reviewed",
      "Reviewed",
    ],
  ]);

const MAX_SUGGESTION_KEY_LENGTH =
  180;

const MAX_ACTION_NOTES_LENGTH =
  5000;

const MAX_DISMISS_REASON_LENGTH =
  5000;

function validateAuthenticatedActor(req) {
  const identity =
    getTrustedSuggestionIdentity(req);

  if (!identity.userKey) {
    return {
      ok: false,
      status: 401,
      error:
        "Authenticated user identity is required.",
    };
  }

  if (
    !ALLOWED_ROLES.has(
      identity.role
    )
  ) {
    return {
      ok: false,
      status: 403,
      error:
        "You do not have permission to update smart suggestions.",
    };
  }

  return {
    ok: true,
    ...identity,
  };
}

function validateSuggestionKey(value) {
  /*
   * Do not truncate before validation.
   *
   * Truncating first could turn an overlong client
   * value into a different valid persisted key.
   */
  const rawValue =
    cleanValue(value);

  if (!rawValue) {
    return {
      ok: false,
      value: "",
      error:
        "Suggestion key is required.",
    };
  }

  /*
   * Generated suggestion keys contain only:
   * letters, numbers, colon, underscore, and hyphen.
   *
   * Reject malformed or overlong client input instead
   * of silently rewriting it into another key.
   */
  if (
    rawValue.length >
      MAX_SUGGESTION_KEY_LENGTH ||
    !/^[a-zA-Z0-9:_-]+$/.test(
      rawValue
    )
  ) {
    return {
      ok: false,
      value: "",
      error:
        "Suggestion key is invalid.",
    };
  }

  const cleanedKey =
    cleanSuggestionKey(
      rawValue
    );

  if (
    !cleanedKey ||
    cleanedKey !== rawValue
  ) {
    return {
      ok: false,
      value: "",
      error:
        "Suggestion key is invalid.",
    };
  }

  return {
    ok: true,
    value: cleanedKey,
  };
}

function validateActionType(value) {
  const normalized =
    cleanValue(
      value,
      100
    ).toLowerCase();

  const canonicalValue =
    ALLOWED_ACTION_TYPES.get(
      normalized
    );

  if (!canonicalValue) {
    return {
      ok: false,
      value: "",
      error:
        "Invalid smart suggestion action type.",
    };
  }

  return {
    ok: true,
    value:
      canonicalValue,
  };
}

function getAuditActor(req, actor) {
  const user =
    req?.user || {};

  return {
    userId:
      user.id ??
      user.userId ??
      actor.userKey,

    username:
      user.username ||
      null,

    role:
      actor.role,

    fullName:
      user.full_name ||
      user.fullName ||
      user.name ||
      user.username ||
      "Unknown User",
  };
}

async function writeSuggestionAudit({
  req,
  actor,
  action,
  suggestionKey,
  description,
}) {
  const auditActor =
    getAuditActor(
      req,
      actor
    );

  await logAudit({
    ...auditActor,

    category:
      AUDIT_CATEGORY.OPERATIONAL,

    action,

    description:
      `${description} Suggestion key: ${suggestionKey}.`,
  });
}

/*
 * POST /api/smart-suggestions/action
 *
 * Compatibility payload:
 * {
 *   userKey,
 *   role,
 *   suggestionKey,
 *   actionType,
 *   actionNotes
 * }
 *
 * SECURITY:
 * - userKey and role from the request body are ignored.
 * - Ownership and authority come only from verified req.user.
 * - The current UI contract supports only "Reviewed".
 * - This endpoint records review state only; it does not
 *   automatically modify employees, incidents, deployments,
 *   disciplinary records, or any other business record.
 */
exports.takeSmartSuggestionAction =
  async (req, res) => {
    try {
      const actor =
        validateAuthenticatedActor(
          req
        );

      if (!actor.ok) {
        return res
          .status(actor.status)
          .json({
            success: false,
            error:
              actor.error,
          });
      }

      const suggestionKeyResult =
        validateSuggestionKey(
          req?.body?.suggestionKey
        );

      if (
        !suggestionKeyResult.ok
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              suggestionKeyResult.error,
          });
      }

      const actionTypeResult =
        validateActionType(
          req?.body?.actionType
        );

      if (!actionTypeResult.ok) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              actionTypeResult.error,
          });
      }

      const suggestionKey =
        suggestionKeyResult.value;

      const actionType =
        actionTypeResult.value;

      const actionNotes =
        cleanValue(
          req?.body?.actionNotes,
          MAX_ACTION_NOTES_LENGTH
        );

      const savedState =
        await saveSuggestionAction({
          userKey:
            actor.userKey,

          role:
            actor.role,

          suggestionKey,

          actionType,

          actionNotes,
        });

      const state =
        normalizeStateResponse(
          savedState
        );

      await writeSuggestionAudit({
        req,
        actor,
        action:
          "SMART_SUGGESTION_REVIEWED",
        suggestionKey,
        description:
          "Reviewed a rule-based smart suggestion.",
      });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Suggestion action saved successfully.",

          suggestionKey,

          state,
        });
    } catch (error) {
      console.error(
        "SMART SUGGESTION ACTION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to save smart suggestion action.",
        });
    }
  };

/*
 * POST /api/smart-suggestions/dismiss
 *
 * Compatibility payload:
 * {
 *   userKey,
 *   role,
 *   suggestionKey,
 *   dismissReason
 * }
 *
 * SECURITY:
 * - userKey and role supplied by the frontend are ignored.
 * - Ownership and authority come only from verified req.user.
 * - Dismissal stores per-user review state only.
 * - No business record is automatically changed.
 */
exports.dismissSmartSuggestion =
  async (req, res) => {
    try {
      const actor =
        validateAuthenticatedActor(
          req
        );

      if (!actor.ok) {
        return res
          .status(actor.status)
          .json({
            success: false,
            error:
              actor.error,
          });
      }

      const suggestionKeyResult =
        validateSuggestionKey(
          req?.body?.suggestionKey
        );

      if (
        !suggestionKeyResult.ok
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              suggestionKeyResult.error,
          });
      }

      const suggestionKey =
        suggestionKeyResult.value;

      const dismissReason =
        cleanValue(
          req?.body?.dismissReason,
          MAX_DISMISS_REASON_LENGTH
        );

      const savedState =
        await saveSuggestionDismiss({
          userKey:
            actor.userKey,

          role:
            actor.role,

          suggestionKey,

          dismissReason,
        });

      const state =
        normalizeStateResponse(
          savedState
        );

      await writeSuggestionAudit({
        req,
        actor,
        action:
          "SMART_SUGGESTION_DISMISSED",
        suggestionKey,
        description:
          "Dismissed a rule-based smart suggestion.",
      });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Suggestion dismissed successfully.",

          suggestionKey,

          state,
        });
    } catch (error) {
      console.error(
        "SMART SUGGESTION DISMISS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to dismiss smart suggestion.",
        });
    }
  };
