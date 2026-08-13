const {
  cleanValue,
  cleanSuggestionKey,
  getTrustedSuggestionIdentity,
  saveSuggestionAction,
  saveSuggestionDismiss,
  normalizeStateResponse,
} = require("../utils/smartSuggestionState");

const ALLOWED_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
]);

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
 * userKey and role from the request body are
 * intentionally ignored for identity/authority.
 *
 * Ownership comes only from verified req.user.
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

      const suggestionKey =
        cleanSuggestionKey(
          req?.body?.suggestionKey
        );

      const actionType =
        cleanValue(
          req?.body?.actionType,
          100
        );

      const actionNotes =
        cleanValue(
          req?.body?.actionNotes,
          5000
        );

      if (!suggestionKey) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Suggestion key is required.",
          });
      }

      if (!actionType) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Action type is required.",
          });
      }

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

      return res.status(200).json({
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
 * userKey and role supplied by the frontend
 * are not trusted.
 *
 * Ownership comes only from verified req.user.
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

      const suggestionKey =
        cleanSuggestionKey(
          req?.body?.suggestionKey
        );

      const dismissReason =
        cleanValue(
          req?.body?.dismissReason,
          5000
        );

      if (!suggestionKey) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Suggestion key is required.",
          });
      }

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

      return res.status(200).json({
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