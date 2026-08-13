const db = require("../config/db");

function cleanValue(
  value,
  maxLength = null
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  const text =
    String(value).trim();

  if (
    Number.isInteger(maxLength) &&
    maxLength > 0
  ) {
    return text.slice(
      0,
      maxLength
    );
  }

  return text;
}

function cleanSuggestionKey(value) {
  return cleanValue(value)
    .replace(
      /[^a-zA-Z0-9:_-]/g,
      "_"
    )
    .slice(0, 180);
}

/*
 * SECURITY:
 * State ownership comes exclusively from
 * the authenticated JWT identity.
 *
 * req.body.userKey and req.body.role are
 * intentionally never used here.
 */
function getTrustedSuggestionIdentity(
  req
) {
  const user =
    req?.user || {};

  const userKey =
    cleanValue(
      user.id ??
        user.userId ??
        user.username,
      180
    );

  const role =
    cleanValue(
      user.role,
      50
    )
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  return {
    userKey,
    role,
  };
}

async function getSuggestionStates({
  userKey,
  role,
}) {
  if (
    !userKey ||
    !role
  ) {
    return new Map();
  }

  const [rows] =
    await db.promise().query(
      `
      SELECT
        suggestion_key,
        action_type,
        action_notes,
        action_at,
        is_dismissed,
        dismiss_reason,
        dismissed_at,
        created_at,
        updated_at
      FROM smart_suggestion_states
      WHERE
        user_key = ?
        AND role = ?
      `,
      [
        userKey,
        role,
      ]
    );

  return new Map(
    rows.map((row) => [
      row.suggestion_key,
      row,
    ])
  );
}

function applySuggestionStates(
  suggestions,
  stateMap
) {
  return suggestions.map(
    (suggestion) => {
      const state =
        stateMap.get(
          suggestion.suggestionKey
        );

      const actionType =
        state?.action_type ||
        null;

      const actionNotes =
        state?.action_notes ||
        "";

      const actionAt =
        state?.action_at ||
        null;

      const isDismissed =
        Number(
          state?.is_dismissed ||
            0
        ) === 1;

      return {
        ...suggestion,

        actionType,
        actionNotes,
        actionAt,

        isReviewed:
          Boolean(actionType),

        isDismissed,

        dismissReason:
          state?.dismiss_reason ||
          "",

        dismissedAt:
          state?.dismissed_at ||
          null,

        stateUpdatedAt:
          state?.updated_at ||
          null,
      };
    }
  );
}

async function getSuggestionState({
  userKey,
  role,
  suggestionKey,
}) {
  const [rows] =
    await db.promise().query(
      `
      SELECT
        suggestion_key,
        action_type,
        action_notes,
        action_at,
        is_dismissed,
        dismiss_reason,
        dismissed_at,
        created_at,
        updated_at
      FROM smart_suggestion_states
      WHERE
        user_key = ?
        AND role = ?
        AND suggestion_key = ?
      LIMIT 1
      `,
      [
        userKey,
        role,
        suggestionKey,
      ]
    );

  return rows[0] || null;
}

async function saveSuggestionAction({
  userKey,
  role,
  suggestionKey,
  actionType,
  actionNotes,
}) {
  await db.promise().query(
    `
    INSERT INTO smart_suggestion_states
    (
      user_key,
      role,
      suggestion_key,
      action_type,
      action_notes,
      action_at,
      is_dismissed,
      created_at,
      updated_at
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      ?,
      NOW(),
      0,
      NOW(),
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      action_type =
        VALUES(action_type),

      action_notes =
        VALUES(action_notes),

      action_at =
        NOW(),

      updated_at =
        NOW()
    `,
    [
      userKey,
      role,
      suggestionKey,
      actionType,
      actionNotes || null,
    ]
  );

  return getSuggestionState({
    userKey,
    role,
    suggestionKey,
  });
}

async function saveSuggestionDismiss({
  userKey,
  role,
  suggestionKey,
  dismissReason,
}) {
  await db.promise().query(
    `
    INSERT INTO smart_suggestion_states
    (
      user_key,
      role,
      suggestion_key,
      is_dismissed,
      dismiss_reason,
      dismissed_at,
      created_at,
      updated_at
    )
    VALUES
    (
      ?,
      ?,
      ?,
      1,
      ?,
      NOW(),
      NOW(),
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      is_dismissed = 1,

      dismiss_reason =
        VALUES(dismiss_reason),

      dismissed_at =
        NOW(),

      updated_at =
        NOW()
    `,
    [
      userKey,
      role,
      suggestionKey,
      dismissReason || null,
    ]
  );

  return getSuggestionState({
    userKey,
    role,
    suggestionKey,
  });
}

function normalizeStateResponse(
  state
) {
  if (!state) {
    return null;
  }

  return {
    suggestionKey:
      state.suggestion_key,

    actionType:
      state.action_type ||
      null,

    actionNotes:
      state.action_notes ||
      "",

    actionAt:
      state.action_at ||
      null,

    isReviewed:
      Boolean(
        state.action_type
      ),

    isDismissed:
      Number(
        state.is_dismissed ||
          0
      ) === 1,

    dismissReason:
      state.dismiss_reason ||
      "",

    dismissedAt:
      state.dismissed_at ||
      null,

    updatedAt:
      state.updated_at ||
      null,
  };
}

module.exports = {
  cleanValue,
  cleanSuggestionKey,

  getTrustedSuggestionIdentity,

  getSuggestionStates,
  applySuggestionStates,

  saveSuggestionAction,
  saveSuggestionDismiss,

  normalizeStateResponse,
};