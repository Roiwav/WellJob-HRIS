import authenticatedFetch from "../authenticatedFetch";
import { API_BASE } from "../../config/api";

const SMART_ALERT_TIME_ZONE =
  "Asia/Manila";

export function canViewSmartAlerts(role) {
  return [
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR",
    "SUPER_ADMIN",
  ].includes(role);
}

export function getUserKey(user) {
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

export function getAlertPriorityClasses(
  priority
) {
  switch (priority) {
    case "High":
      return {
        card:
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300",

        icon:
          "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",

        badge:
          "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      };

    case "Medium":
      return {
        card:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",

        icon:
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",

        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      };

    default:
      return {
        card:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300",

        icon:
          "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",

        badge:
          "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      };
  }
}

export function getSmartAlertEventTimestamp(
  value
) {
  if (
    value &&
    typeof value === "object"
  ) {
    const directTimestamp =
      Number(
        value.timestamp ??
          value.notificationTimestamp ??
          value.notification_timestamp
      );

    if (
      Number.isFinite(
        directTimestamp
      ) &&
      directTimestamp > 0
    ) {
      /*
       * Support either milliseconds or Unix seconds.
       */
      return directTimestamp <
        100000000000
        ? directTimestamp *
            1000
        : directTimestamp;
    }

    return getSmartAlertEventTimestamp(
      value.date ??
        value.notificationGeneratedAt ??
        value.notification_generated_at ??
        value.createdAt ??
        value.created_at ??
        value.updatedAt ??
        value.updated_at
    );
  }

  if (!value) {
    return 0;
  }

  const numericValue =
    Number(
      value
    );

  if (
    Number.isFinite(
      numericValue
    ) &&
    numericValue > 0 &&
    String(
      value
    ).trim() !== ""
  ) {
    return numericValue <
      100000000000
      ? numericValue *
          1000
      : numericValue;
  }

  const parsed =
    new Date(
      value
    ).getTime();

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

export function sortSmartAlertsByRecency(
  alerts = []
) {
  return (
    Array.isArray(
      alerts
    )
      ? [...alerts]
      : []
  ).sort(
    (a, b) => {
      const timestampDiff =
        getSmartAlertEventTimestamp(
          b
        ) -
        getSmartAlertEventTimestamp(
          a
        );

      if (timestampDiff !== 0) {
        return timestampDiff;
      }

      return String(
        b?.alertKey ||
          ""
      ).localeCompare(
        String(
          a?.alertKey ||
            ""
        )
      );
    }
  );
}

export function formatSmartAlertDate(
  value
) {
  const timestamp =
    getSmartAlertEventTimestamp(
      value
    );

  if (!timestamp) {
    return "-";
  }

  /*
   * Notification timestamps are always presented in
   * Welljob's business timezone, regardless of the
   * viewer's browser/device timezone.
   */
  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        SMART_ALERT_TIME_ZONE,
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    new Date(
      timestamp
    )
  );
}

export function formatSmartAlertRelativeTime(
  value,
  nowValue = Date.now()
) {
  const timestamp =
    getSmartAlertEventTimestamp(
      value
    );

  if (!timestamp) {
    return "-";
  }

  const now =
    Number(
      nowValue
    );

  const safeNow =
    Number.isFinite(
      now
    )
      ? now
      : Date.now();

  const diffMs =
    Math.max(
      0,
      safeNow -
        timestamp
    );

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  if (diffMs < minute) {
    return "now";
  }

  if (diffMs < hour) {
    return `${Math.floor(
      diffMs /
        minute
    )}m`;
  }

  if (diffMs < day) {
    return `${Math.floor(
      diffMs /
        hour
    )}h`;
  }

  if (diffMs < 7 * day) {
    return `${Math.floor(
      diffMs /
        day
    )}d`;
  }

  if (diffMs < 30 * day) {
    return `${Math.floor(
      diffMs /
        (7 * day)
    )}w`;
  }

  if (diffMs < 365 * day) {
    return `${Math.floor(
      diffMs /
        (30 * day)
    )}mo`;
  }

  return `${Math.floor(
    diffMs /
      (365 * day)
  )}y`;
}

function getManilaDateKey(
  value
) {
  const timestamp =
    getSmartAlertEventTimestamp(
      value
    );

  if (!timestamp) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          SMART_ALERT_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date(
        timestamp
      )
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day
  ) {
    return "";
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function isSmartAlertToday(
  value,
  nowValue = Date.now()
) {
  const alertDateKey =
    getManilaDateKey(
      value
    );

  if (!alertDateKey) {
    return false;
  }

  const nowTimestamp =
    Number(
      nowValue
    );

  const safeNow =
    Number.isFinite(
      nowTimestamp
    )
      ? nowTimestamp
      : Date.now();

  return (
    alertDateKey ===
    getManilaDateKey(
      safeNow
    )
  );
}

export async function requestSmartAlertJson(
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
      response.status === 401
        ? "Session expired. Please sign in again."
        : "Notifications could not be updated. Please try again."
    );
  }

  return data;
}