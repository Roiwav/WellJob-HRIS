import authenticatedFetch from "../authenticatedFetch";
import { API_BASE } from "../../config/api";

const SMART_SUGGESTION_TIME_ZONE =
  "Asia/Manila";

export function canViewSmartSuggestions(
  role
) {
  return [
    "HR_MANAGER",
    "SUPER_ADMIN",
  ].includes(role);
}

export function getSmartSuggestionUserKey(
  user
) {
  return String(
    user?.id ||
      user?.userId ||
      user?.employeeId ||
      user?.username ||
      user?.name ||
      user?.role ||
      "UNKNOWN_USER"
  );
}

export async function requestSmartSuggestionJson(
  endpoint,
  options = {}
) {
  const response =
    await authenticatedFetch(
      `${API_BASE}${endpoint}`,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/*
 * SAVE SMART SUGGESTION ACTION
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
 * userKey and role are sent only to preserve
 * the existing frontend/backend contract.
 *
 * Backend identity and authorization come
 * exclusively from the verified JWT.
 */
export async function takeSmartSuggestionAction({
  user,
  suggestionKey,
  actionType,
  actionNotes = "",
}) {
  return requestSmartSuggestionJson(
    "/smart-suggestions/action",
    {
      method: "POST",

      body: JSON.stringify({
        userKey:
          getSmartSuggestionUserKey(
            user
          ),

        role:
          user?.role || "",

        suggestionKey,

        actionType,

        actionNotes,
      }),
    }
  );
}

/*
 * DISMISS SMART SUGGESTION
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
 * userKey and role are compatibility fields only.
 * Backend ownership comes from verified req.user.
 */
export async function dismissSmartSuggestion({
  user,
  suggestionKey,
  dismissReason = "",
}) {
  return requestSmartSuggestionJson(
    "/smart-suggestions/dismiss",
    {
      method: "POST",

      body: JSON.stringify({
        userKey:
          getSmartSuggestionUserKey(
            user
          ),

        role:
          user?.role || "",

        suggestionKey,

        dismissReason,
      }),
    }
  );
}

export function getSuggestionPriorityClasses(
  priority
) {
  switch (priority) {
    case "High":
      return {
        card:
          "border-rose-500/30 bg-rose-500/10 text-rose-300",

        badge:
          "bg-rose-500/15 text-rose-300 border-rose-500/30",

        icon:
          "bg-rose-500/15 text-rose-300",
      };

    case "Medium":
      return {
        card:
          "border-amber-500/30 bg-amber-500/10 text-amber-300",

        badge:
          "bg-amber-500/15 text-amber-300 border-amber-500/30",

        icon:
          "bg-amber-500/15 text-amber-300",
      };

    default:
      return {
        card:
          "border-sky-500/30 bg-sky-500/10 text-sky-300",

        badge:
          "bg-sky-500/15 text-sky-300 border-sky-500/30",

        icon:
          "bg-sky-500/15 text-sky-300",
      };
  }
}

export function getSuggestionCategoryClasses(
  category
) {
  switch (category) {
    case "Workforce":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";

    case "Incident Prevention":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";

    case "Compliance":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

    case "Deployment":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";

    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

export function formatSuggestionDate(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  let date = null;

  if (
    value instanceof Date
  ) {
    date = value;
  } else if (
    typeof value ===
      "number"
  ) {
    const milliseconds =
      value <
      100000000000
        ? value * 1000
        : value;

    date =
      new Date(
        milliseconds
      );
  } else {
    const normalized =
      String(
        value
      ).trim();

    if (!normalized) {
      return "-";
    }

    if (
      /^\d{10,13}$/.test(
        normalized
      )
    ) {
      const numericValue =
        Number(
          normalized
        );

      const milliseconds =
        numericValue <
        100000000000
          ? numericValue * 1000
          : numericValue;

      date =
        new Date(
          milliseconds
        );
    } else {
      /*
       * Compatibility handling for legacy
       * timezone-less MySQL DATETIME values.
       *
       * Preserve the stored wall-clock value for
       * display instead of applying an unverified
       * blanket historical UTC conversion.
       *
       * Values that already include Z or an explicit
       * offset are treated as absolute instants.
       */
      const timezoneLessMatch =
        normalized.match(
          /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/
        );

      if (
        timezoneLessMatch
      ) {
        const millisecondsPart =
          timezoneLessMatch[3]
            ? `.${timezoneLessMatch[3].padEnd(
                3,
                "0"
              )}`
            : "";

        date =
          new Date(
            `${timezoneLessMatch[1]}T${timezoneLessMatch[2]}${millisecondsPart}+08:00`
          );
      } else {
        date =
          new Date(
            normalized
          );
      }
    }
  }

  if (
    !date ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        SMART_SUGGESTION_TIME_ZONE,
      month:
        "short",
      day:
        "2-digit",
      hour:
        "numeric",
      minute:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    date
  );
}