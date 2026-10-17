const MONTH_OPTIONS = [
  { value: "", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const STATUS_BADGE_CLASSES = {
  Active:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-300",
  Completed:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
  Pending:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",

  /*
   * User-facing separation states.
   *
   * The database may still store deployment_assignments.status
   * as "Cancelled" for legacy compatibility, but HR-facing
   * screens should present the actual separation outcome instead.
   */
  Resigned:
    "border border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300",
  Terminated:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300",
  AWOL:
    "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",
  "Other Separation":
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
  Ended:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",

  /*
   * Kept only as an internal/legacy compatibility style.
   * New UI code should prefer getDeploymentDisplayStatus().
   */
  Cancelled:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
  Separated:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
};

const DEFAULT_STATUS_BADGE_CLASS =
  "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300";

const COMPLETED_DEPLOYMENT_REASONS =
  new Set([
    "Completed Contract",
    "End of Assignment / Pulled Out by Client",
    "Transferred / Reassigned",
  ]);

const CANCELLED_DEPLOYMENT_REASON_MAP = {
  Resignation: "Resigned",
  Resigned: "Resigned",
  AWOL: "AWOL",
  Termination: "Terminated",
  Terminated: "Terminated",
};

const USER_FACING_SEPARATION_STATUS_BY_REASON = {
  Resignation: "Resigned",
  Resigned: "Resigned",
  AWOL: "AWOL",
  Termination: "Terminated",
  Terminated: "Terminated",
  "Other Separation": "Other Separation",
};

const DEPLOYMENT_TIME_ZONE =
  "Asia/Manila";

function getManilaDateOnly(
  value
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          DEPLOYMENT_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
            ].includes(
              part.type
            )
        )
        .map(
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

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function normalizeDeploymentDateOnly(
  value
) {
  if (
    !value ||
    value === "-"
  ) {
    return "";
  }

  if (
    value instanceof Date
  ) {
    return getManilaDateOnly(
      value
    );
  }

  const normalized =
    String(
      value
    ).trim();

  if (!normalized) {
    return "";
  }

  const strictDateMatch =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (
    strictDateMatch
  ) {
    return strictDateMatch[0];
  }

  /*
   * Preserve the stored calendar date for legacy
   * timezone-less MySQL DATETIME values. Do not
   * apply an unverified timezone shift to them.
   */
  const timezoneLessMatch =
    normalized.match(
      /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
    );

  if (
    timezoneLessMatch
  ) {
    return timezoneLessMatch[1];
  }

  return getManilaDateOnly(
    normalized
  );
}

function parseDeploymentBusinessDate(
  value
) {
  const dateOnly =
    normalizeDeploymentDateOnly(
      value
    );

  if (!dateOnly) {
    return null;
  }

  const date =
    new Date(
      `${dateOnly}T00:00:00+08:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function normalizeRemarks(value) {
  return String(
    value || ""
  ).trim();
}

function isOtherSeparationRemarks(
  remarks
) {
  return normalizeRemarks(
    remarks
  ).startsWith(
    "[Other Separation]"
  );
}

export function getMonthOptions() {
  return MONTH_OPTIONS;
}

export function getYearOptions(
  deployments = []
) {
  const years =
    new Set();

  deployments.forEach(
    (deployment) => {
      const rawDate =
        deployment?.start ||
        deployment?.contractStart ||
        deployment?.contract_start ||
        deployment?.createdAt ||
        deployment?.created_at;

      const dateOnly =
        normalizeDeploymentDateOnly(
          rawDate
        );

      if (dateOnly) {
        years.add(
          dateOnly.slice(
            0,
            4
          )
        );
      }
    }
  );

  return [
    {
      value: "",
      label: "All Years",
    },
    ...Array.from(years)
      .sort(
        (
          first,
          second
        ) =>
          Number(second) -
          Number(first)
      )
      .map(
        (year) => ({
          value: year,
          label: year,
        })
      ),
  ];
}

/*
 * Canonical INTERNAL deployment lifecycle normalization.
 *
 * IMPORTANT:
 * "Cancelled" is intentionally preserved here because the current
 * backend/database uses it as a compatibility lifecycle bucket for
 * separation outcomes such as Resigned, AWOL, and Terminated.
 *
 * Do not use this function directly as the HR-facing label when an
 * end reason is available. Use getDeploymentDisplayStatus() instead.
 */
export function normalizeDeploymentStatus(
  status
) {
  const normalizedStatus =
    String(
      status || ""
    )
      .trim()
      .toLowerCase();

  if (
    normalizedStatus ===
    "active"
  ) {
    return "Active";
  }

  if (
    normalizedStatus ===
    "completed"
  ) {
    return "Completed";
  }

  if (
    normalizedStatus ===
      "cancelled" ||
    normalizedStatus ===
      "canceled"
  ) {
    return "Cancelled";
  }

  if (
    normalizedStatus ===
    "pending"
  ) {
    return "Pending";
  }

  if (
    normalizedStatus ===
    "separated"
  ) {
    return "Separated";
  }

  return (
    String(
      status || ""
    ).trim() ||
    "Pending"
  );
}

/*
 * HR-facing deployment status.
 *
 * Current database compatibility:
 *   status = "Cancelled", end_reason = "Resigned"
 *     -> "Resigned"
 *
 *   status = "Cancelled", end_reason = "Terminated"
 *     -> "Terminated"
 *
 *   status = "Cancelled", end_reason = "AWOL"
 *     -> "AWOL"
 *
 *   status = "Cancelled", end_reason = "Terminated",
 *   remarks prefixed with "[Other Separation]"
 *     -> "Other Separation"
 *
 * If an old/unknown Cancelled record has no reliable reason,
 * present the neutral label "Ended" instead of exposing the
 * misleading legacy word "Cancelled".
 */
export function getDeploymentDisplayStatus(
  status,
  endReason = "",
  endRemarks = ""
) {
  const normalizedStatus =
    normalizeDeploymentStatus(
      status
    );

  if (
    normalizedStatus !==
    "Cancelled"
  ) {
    return normalizedStatus;
  }

  if (
    isOtherSeparationRemarks(
      endRemarks
    )
  ) {
    return "Other Separation";
  }

  const normalizedReason =
    String(
      endReason || ""
    ).trim();

  return (
    USER_FACING_SEPARATION_STATUS_BY_REASON[
      normalizedReason
    ] ||
    "Ended"
  );
}

export function formatDisplayDate(
  dateValue
) {
  const date =
    parseDeploymentBusinessDate(
      dateValue
    );

  if (!date) {
    return (
      dateValue &&
      dateValue !== "-"
        ? String(dateValue)
        : "-"
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        DEPLOYMENT_TIME_ZONE,
      year:
        "numeric",
      month:
        "short",
      day:
        "numeric",
    }
  ).format(
    date
  );
}

export function formatLongDisplayDate(
  dateValue
) {
  const date =
    parseDeploymentBusinessDate(
      dateValue
    );

  if (!date) {
    return (
      dateValue &&
      dateValue !== "-"
        ? String(dateValue)
        : "Not Set"
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        DEPLOYMENT_TIME_ZONE,
      year:
        "numeric",
      month:
        "long",
      day:
        "numeric",
    }
  ).format(
    date
  );
}

export function formatDateForInput(
  dateValue
) {
  return normalizeDeploymentDateOnly(
    dateValue
  );
}

/*
 * Badge styling accepts the internal status plus optional end metadata.
 * Existing one-argument callers remain compatible.
 */
export function getStatusBadgeClass(
  status,
  endReason = "",
  endRemarks = ""
) {
  const displayStatus =
    getDeploymentDisplayStatus(
      status,
      endReason,
      endRemarks
    );

  return (
    STATUS_BADGE_CLASSES[
      displayStatus
    ] ||
    DEFAULT_STATUS_BADGE_CLASS
  );
}

export function getDeploymentTimelineInfo(
  deploymentStart,
  separationDate
) {
  if (
    !deploymentStart ||
    deploymentStart === "-"
  ) {
    return "Deployment start date is not available.";
  }

  if (
    !separationDate ||
    separationDate === "-"
  ) {
    return "Deployment is continuous and remains active until an authorized separation is recorded.";
  }

  return `Separated on ${formatLongDisplayDate(
    separationDate
  )}.`;
}

export function normalizeSeparationReason(
  value,
  remarks = ""
) {
  const reason =
    String(
      value || ""
    ).trim();

  const cleanRemarks =
    normalizeRemarks(
      remarks
    );

  if (
    reason === "Resigned" ||
    reason === "Resignation"
  ) {
    return "Resignation";
  }

  if (
    reason === "Terminated" ||
    reason === "Termination"
  ) {
    return cleanRemarks.startsWith(
      "[Other Separation]"
    )
      ? "Other Separation"
      : "Termination";
  }

  return reason || "-";
}

export function buildDeploymentStatusPayload({
  separationReason,
  separationRemarks,
}) {
  const reason =
    String(
      separationReason ||
        ""
    ).trim();

  const endRemarks =
    normalizeRemarks(
      separationRemarks
    );

  /*
   * Normal deployment completion reasons
   * remain unchanged.
   */
  if (
    COMPLETED_DEPLOYMENT_REASONS.has(
      reason
    )
  ) {
    return {
      status:
        "Completed",

      endReason:
        reason,

      endRemarks,
    };
  }

  /*
   * "Other Separation" remains a user-facing HR option.
   *
   * The current backend/database lifecycle model accepts
   * only the legacy separation bucket:
   *
   *   status = "Cancelled"
   *
   * with these authoritative end reasons:
   *
   * - Resigned
   * - AWOL
   * - Terminated
   *
   * Therefore we preserve compatibility internally while
   * preventing "Cancelled" from being shown to HR users.
   *
   * UI reason:
   *   Other Separation
   *
   * Backend reason:
   *   Terminated
   *
   * Remarks:
   *   [Other Separation] <details>
   *
   * normalizeSeparationReason() converts this representation
   * back to "Other Separation" for forms/history.
   */
  if (
    reason ===
    "Other Separation"
  ) {
    if (!endRemarks) {
      throw new Error(
        "Please provide details for Other Separation."
      );
    }

    return {
      status:
        "Cancelled",

      endReason:
        "Terminated",

      endRemarks:
        `[Other Separation] ${endRemarks}`.trim(),
    };
  }

  const cancelledReason =
    CANCELLED_DEPLOYMENT_REASON_MAP[
      reason
    ];

  if (cancelledReason) {
    return {
      status:
        "Cancelled",

      endReason:
        cancelledReason,

      endRemarks,
    };
  }

  throw new Error(
    "Select a valid deployment end reason before saving."
  );
}

export function buildLegacySeparationPayload({
  separationDate,
  separationReason,
  separationRemarks,
}) {
  const cleanRemarks =
    normalizeRemarks(
      separationRemarks
    );

  const isResignation =
    separationReason ===
    "Resignation";

  const isOtherSeparation =
    separationReason ===
    "Other Separation";

  return {
    contractEnd:
      separationDate,

    endReason:
      isResignation
        ? "Resigned"
        : "Terminated",

    endRemarks:
      isOtherSeparation
        ? `[Other Separation] ${cleanRemarks}`.trim()
        : cleanRemarks,
  };
}