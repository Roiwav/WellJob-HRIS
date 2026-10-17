const db = require("../config/db");

const {
  evaluateStartInvestigation,
  getCreateIncidentActorSelect,
  getIncidentCreator,
  getReportingPath,
} = require("../utils/incidentInvestigationPolicy");

const ALERT_PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const ALLOWED_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
  "SUPER_ADMIN",
]);

const REVIEWER_ROLES = new Set([
  "HR_MANAGER",
  "SUPER_ADMIN",
]);

const COMPLIANCE_ALERT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
]);

const COMPLIANCE_EXPIRING_SOON_DAYS = 30;
const COMPLIANCE_NOTIFICATION_HOUR_MANILA = 8;

const MANILA_UTC_OFFSET_HOURS = 8;

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "SUPERADMIN",
      "SUPER_ADMIN",
      "ADMIN",
    ].includes(role)
  ) {
    return "SUPER_ADMIN";
  }

  if (
    [
      "HRMANAGER",
      "HR_MANAGER",
    ].includes(role)
  ) {
    return "HR_MANAGER";
  }

  if (
    [
      "HRSTAFF",
      "HR_STAFF",
    ].includes(role)
  ) {
    return "HR_STAFF";
  }

  if (
    [
      "HRCOORDINATOR",
      "HR_COORDINATOR",
    ].includes(role)
  ) {
    return "HR_COORDINATOR";
  }

  if (
    [
      "ITSUPPORT",
      "IT_SUPPORT",
    ].includes(role)
  ) {
    return "IT_SUPPORT";
  }

  return role || "USER";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeIdentity(value) {
  return normalizeText(value);
}

function getAssignedCompany(req) {
  return cleanValue(
    req?.user?.assignedCompany ??
      req?.user?.assigned_company
  );
}

function cleanValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeStatus(value) {
  const status =
    normalizeText(value);

  if (
    status === "for_review" ||
    status === "for review" ||
    status === "resolved"
  ) {
    return "For Review";
  }

  if (
    status === "investigating"
  ) {
    return "Investigating";
  }

  if (
    status === "closed"
  ) {
    return "Closed";
  }

  if (
    status === "open"
  ) {
    return "Open";
  }

  return value || "Open";
}

function normalizeSeverity(value) {
  const severity =
    normalizeText(value);

  if (
    severity === "critical"
  ) {
    return "Critical";
  }

  if (
    severity === "major"
  ) {
    return "Major";
  }

  if (
    severity === "minor"
  ) {
    return "Minor";
  }

  return value || "Minor";
}

function isReviewerRole(role) {
  return REVIEWER_ROLES.has(
    role
  );
}

function toTimestamp(value) {
  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;
}

function normalizeEpochMilliseconds(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
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
    numericValue > 0
  ) {
    return numericValue <
      100000000000
      ? numericValue *
          1000
      : numericValue;
  }

  return 0;
}

function timestampToIsoString(
  timestamp
) {
  const normalizedTimestamp =
    normalizeEpochMilliseconds(
      timestamp
    );

  if (!normalizedTimestamp) {
    return null;
  }

  return new Date(
    normalizedTimestamp
  ).toISOString();
}

/*
 * Notification timestamps are separate from the
 * business dates shown in Incident and Compliance
 * records.
 *
 * For incident alerts, use the authoritative database
 * event timestamp exposed as Unix milliseconds by SQL.
 * This avoids Node/Vercel timezone interpretation from
 * shifting MySQL timestamps.
 *
 * The legacy toTimestamp() helper remains unchanged
 * because existing alert keys may already depend on it.
 */
function getIncidentNotificationTimestamp(
  incident
) {
  const status =
    normalizeStatus(
      incident?.status
    );

  const fallback =
    toTimestamp(
      getIncidentDate(
        incident
      )
    );

  if (
    status === "Closed" ||
    isReturnedCase(
      incident
    )
  ) {
    return (
      normalizeEpochMilliseconds(
        incident?.reviewedAtTimestamp ??
          incident?.reviewed_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.lastActionAtTimestamp ??
          incident?.last_action_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.updatedAtTimestamp ??
          incident?.updated_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.createdAtTimestamp ??
          incident?.created_at_timestamp
      ) ||
      fallback
    );
  }

  if (
    status === "For Review"
  ) {
    return (
      normalizeEpochMilliseconds(
        incident?.resolutionSubmittedAtTimestamp ??
          incident?.resolution_submitted_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.updatedAtTimestamp ??
          incident?.updated_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.createdAtTimestamp ??
          incident?.created_at_timestamp
      ) ||
      fallback
    );
  }

  if (
    status === "Investigating"
  ) {
    return (
      normalizeEpochMilliseconds(
        incident?.investigationStartedAtTimestamp ??
          incident?.investigation_started_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.updatedAtTimestamp ??
          incident?.updated_at_timestamp
      ) ||
      normalizeEpochMilliseconds(
        incident?.createdAtTimestamp ??
          incident?.created_at_timestamp
      ) ||
      fallback
    );
  }

  return (
    normalizeEpochMilliseconds(
      incident?.createdAtTimestamp ??
        incident?.created_at_timestamp
    ) ||
    fallback
  );
}

function cleanAlertKey(value) {
  return String(value || "")
    .replace(
      /[^a-zA-Z0-9:_-]/g,
      "_"
    )
    .slice(0, 180);
}

/*
 * SECURITY:
 * Alert state ownership now comes only from
 * the authenticated JWT identity.
 *
 * Client query/body userKey, userId, username,
 * name, etc. are intentionally ignored.
 */
function getUserKey(req) {
  const databaseUserId =
    Number(
      req?.user?.id
    );

  if (
    !Number.isSafeInteger(
      databaseUserId
    ) ||
    databaseUserId <= 0
  ) {
    return "";
  }

  return String(
    databaseUserId
  );
}

/*
 * SECURITY:
 * Role now comes exclusively from req.user,
 * which is populated by verifyToken.
 */
function getRole(req) {
  return normalizeRole(
    req?.user?.role
  );
}

function getTrustedIdentityValues(
  req
) {
  const user =
    req?.user || {};

  return [
    user.id,
    user.userId,
    user.username,
  ]
    .map(cleanValue)
    .filter(Boolean);
}

/*
 * Adds only database-resolved aliases for the
 * already-authenticated JWT user.
 *
 * This preserves old incident records that may
 * identify an actor by full name while preventing
 * clients from claiming another user's identity.
 */
function getCurrentUserAliases(
  req,
  userNameMap = new Map()
) {
  const trustedValues =
    getTrustedIdentityValues(req);

  const aliases =
    new Set(
      trustedValues
        .map(
          normalizeIdentity
        )
        .filter(Boolean)
    );

  trustedValues.forEach(
    (value) => {
      const profile =
        userNameMap.get(
          normalizeIdentity(
            value
          )
        );

      if (!profile) {
        return;
      }

      [
        profile.name,
        profile.username,
      ]
        .map(
          normalizeIdentity
        )
        .filter(Boolean)
        .forEach(
          (alias) => {
            aliases.add(
              alias
            );
          }
        );
    }
  );

  return aliases;
}

/*
 * SECURITY:
 *
 * Smart-alert read/dismiss state belongs strictly to
 * the authenticated database account.
 *
 * Only canonical users.id is used as smart_alert_states
 * user_key. Historical name/username aliases remain
 * available only for incident-recipient resolution and
 * never for state ownership.
 */
function getTrustedStateUserKeys(
  req
) {
  const userKey =
    getUserKey(req);

  return userKey
    ? [
        userKey,
      ]
    : [];
}

function addAlias(
  map,
  key,
  profile
) {
  const alias =
    normalizeIdentity(key);

  if (
    !alias ||
    !profile
  ) {
    return;
  }

  map.set(
    alias,
    profile
  );
}

async function getUserNameMap() {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          role
        FROM users
        `
      );

  const map =
    new Map();

  rows.forEach(
    (user) => {
      const profile = {
        name:
          user.full_name ||
          user.username ||
          "Unknown User",

        username:
          user.username ||
          "",

        role:
          user.role
            ? normalizeRole(
                user.role
              )
            : "",
      };

      [
        user.id,
        user.user_id,
        user.username,
        user.full_name,
      ].forEach(
        (value) => {
          addAlias(
            map,
            value,
            profile
          );
        }
      );
    }
  );

  return map;
}

function resolvePersonProfile(
  value,
  userNameMap,
  fallback = "Unknown User"
) {
  const raw =
    String(
      value || ""
    ).trim();

  if (!raw) {
    return {
      name: fallback,
      username: "",
      role: "",
    };
  }

  const matchedProfile =
    userNameMap.get(
      normalizeIdentity(
        raw
      )
    );

  if (
    matchedProfile
  ) {
    return matchedProfile;
  }

  return {
    name: raw,
    username: "",
    role: "",
  };
}

function hasAliasMatch(
  currentUserAliases,
  values = []
) {
  if (
    !currentUserAliases?.size
  ) {
    return false;
  }

  return values.some(
    (value) =>
      currentUserAliases.has(
        normalizeIdentity(
          value
        )
      )
  );
}

function getReporterValues(
  incident
) {
  return [
    incident.reportedByRaw,
    incident.reported_by_raw,
    incident.reportedBy,
    incident.reportedByName,
    incident.reporterName,
    incident.reported_by,
    incident.createdBy,
    incident.created_by,
  ];
}

/*
 * Canonical CREATE_INCIDENT ownership.
 *
 * Self-notification exclusion must use the canonical report
 * creator captured from incident_timeline, not only the
 * display/reporting name stored on the incident row.
 *
 * Keeping ID, username, and name aliases supports historical
 * records while the canonical numeric users.id remains the
 * strongest identity signal.
 */
function getReportCreatorValues(
  incident
) {
  return [
    incident.reportCreatorId,
    incident.report_creator_id,

    incident.reportCreatorUsername,
    incident.report_creator_username,

    incident.reportCreatorName,
    incident.report_creator_name,
  ].filter(Boolean);
}

function getInvestigatorValues(
  incident
) {
  return [
    incident.investigationStartedById,
    incident.investigation_started_by_id,

    incident.investigationStartedByUsername,
    incident.investigation_started_by_username,

    incident.investigationStartedByName,
    incident.investigation_started_by_name,
  ];
}

function getProofSubmitterValues(
  incident
) {
  return [
    incident.resolutionSubmittedById,
    incident.resolution_submitted_by_id,

    incident.resolutionSubmittedByUsername,
    incident.resolution_submitted_by_username,

    incident.resolutionSubmittedByName,
    incident.resolution_submitted_by_name,
  ];
}

function getReviewerValues(
  incident
) {
  return [
    incident.reviewedById,
    incident.reviewed_by_id,

    incident.reviewedByUsername,
    incident.reviewed_by_username,

    incident.reviewedByName,
    incident.reviewed_by_name,
  ];
}

function getLastActorValues(
  incident
) {
  return [
    incident.lastActionById,
    incident.last_action_by_id,

    incident.lastActionByUsername,
    incident.last_action_by_username,

    incident.lastActionByName,
    incident.last_action_by_name,
  ];
}

function getHandlerValues(
  incident
) {
  return [
    ...getInvestigatorValues(
      incident
    ),

    ...getProofSubmitterValues(
      incident
    ),
  ];
}

function isReturnedCase(
  incident
) {
  const decision =
    normalizeText(
      incident.reviewDecision ||
        incident.review_decision
    );

  return (
    decision ===
      "returned" ||
    decision ===
      "rejected"
  );
}

function normalizeDeploymentAttemptStatus(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (
    normalized ===
      "for deployment"
  ) {
    return "For Deployment";
  }

  if (
    normalized ===
      "deployed"
  ) {
    return "Deployed";
  }

  if (
    normalized ===
      "no show"
  ) {
    return "No Show";
  }

  if (
    normalized ===
      "withdrawn"
  ) {
    return "Withdrawn";
  }

  return cleanValue(
    value
  );
}

function formatAlertDate(
  value
) {
  const isoDate =
    getDateOnlyIsoString(
      value
    );

  if (!isoDate) {
    return "-";
  }

  const [
    year,
    month,
    day,
  ] = isoDate
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      timeZone:
        "UTC",
    }
  ).format(
    date
  );
}

function formatAlertTime(
  value
) {
  const raw =
    cleanValue(
      value
    );

  if (!raw) {
    return "";
  }

  const match =
    raw.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
    );

  if (!match) {
    return "";
  }

  const hour24 =
    Number(
      match[1]
    );

  const minute =
    match[2];

  const suffix =
    hour24 >= 12
      ? "PM"
      : "AM";

  const hour12 =
    hour24 % 12 ||
    12;

  return `${hour12}:${minute} ${suffix}`;
}

function normalizeDeploymentAttempt(
  attempt = {}
) {
  const creatorName =
    attempt.created_by_name ||
    attempt.created_by_username ||
    "";

  const resolverName =
    attempt.resolved_by_name ||
    attempt.resolved_by_username ||
    "";

  return {
    ...attempt,

    attemptId:
      attempt.attempt_id ??
      attempt.id,

    employeeId:
      attempt.employee_id,

    employeeName:
      attempt.employee_name ||
      "Unknown Employee",

    company:
      cleanValue(
        attempt.company
      ),

    position:
      cleanValue(
        attempt.position
      ),

    scheduledDate:
      attempt.scheduled_date ||
      null,

    scheduledTime:
      cleanValue(
        attempt.scheduled_time
      ) ||
      null,

    actualArrivalDate:
      attempt.actual_arrival_date ||
      null,

    status:
      normalizeDeploymentAttemptStatus(
        attempt.status
      ),

    outcomeReason:
      cleanValue(
        attempt.outcome_reason
      ),

    remarks:
      cleanValue(
        attempt.remarks
      ),

    createdAt:
      attempt.created_at ||
      null,

    resolvedAt:
      attempt.resolved_at ||
      null,

    createdByUserId:
      attempt.created_by_user_id ||
      null,

    createdByName:
      creatorName ||
      "HR Staff",

    createdByRole:
      attempt.created_by_role
        ? normalizeRole(
            attempt.created_by_role
          )
        : "HR_STAFF",

    resolvedByUserId:
      attempt.resolved_by_user_id ||
      null,

    resolvedByName:
      resolverName ||
      "HR Coordinator",

    resolvedByRole:
      attempt.resolved_by_role
        ? normalizeRole(
            attempt.resolved_by_role
          )
        : "HR_COORDINATOR",
  };
}

function buildDeploymentAlert(
  attempt,
  role
) {
  const status =
    normalizeDeploymentAttemptStatus(
      attempt?.status
    );

  const company =
    cleanValue(
      attempt?.company
    ) ||
    "the assigned client company";

  const employeeName =
    cleanValue(
      attempt?.employeeName
    ) ||
    "Unknown Employee";

  const scheduledDateLabel =
    formatAlertDate(
      attempt?.scheduledDate
    );

  const scheduledTimeLabel =
    formatAlertTime(
      attempt?.scheduledTime
    );

  if (
    role ===
      "HR_COORDINATOR" &&
    status ===
      "For Deployment"
  ) {
    const date =
      attempt.createdAt ||
      attempt.scheduledDate;

    const timestamp =
      toTimestamp(
        date
      );

    return {
      alertKey:
        cleanAlertKey(
          `DEPLOYMENT:${attempt.attemptId}:SCHEDULED:${timestamp}`
        ),

      sourceType:
        "DEPLOYMENT",

      priority:
        ALERT_PRIORITY.MEDIUM,

      priorityRank:
        getPriorityRank(
          ALERT_PRIORITY.MEDIUM
        ),

      title:
        "Deployment Scheduled",

      message:
        scheduledTimeLabel
          ? `${employeeName} is scheduled to arrive at ${company} on ${scheduledDateLabel} at ${scheduledTimeLabel}.`
          : `${employeeName} is scheduled to arrive at ${company} on ${scheduledDateLabel}.`,

      employee:
        employeeName,

      employeeId:
        attempt.employeeId ||
        null,

      deploymentAttemptId:
        attempt.attemptId ||
        null,

      company,

      position:
        attempt.position ||
        "-",

      status:
        "For Deployment",

      scheduledDate:
        attempt.scheduledDate ||
        null,

      scheduledTime:
        attempt.scheduledTime ||
        null,

      scheduledTimeLabel:
        scheduledTimeLabel ||
        null,

      date,

      timestamp,

      route:
        "/deployments",

      action:
        "view",

      navigationAction:
        "view",

      notificationPurpose:
        "DEPLOYMENT_SCHEDULED",

      performedBy:
        attempt.createdByName ||
        "HR Staff",

      performedByRole:
        attempt.createdByRole ||
        "HR_STAFF",

      recommendedAction:
        scheduledTimeLabel
          ? `Expect the employee on ${scheduledDateLabel} at ${scheduledTimeLabel}, then confirm whether the employee arrives at the client site.`
          : `Expect the employee on ${scheduledDateLabel}, then confirm whether the employee arrives at the client site.`,

      reason:
        "Generated because HR Staff scheduled this employee for deployment to your assigned client company.",
    };
  }

  if (
    ![
      "SUPER_ADMIN",
      "HR_MANAGER",
      "HR_STAFF",
    ].includes(
      role
    )
  ) {
    return null;
  }

  if (
    ![
      "Deployed",
      "No Show",
    ].includes(
      status
    )
  ) {
    return null;
  }

  const date =
    attempt.resolvedAt ||
    attempt.actualArrivalDate ||
    attempt.scheduledDate;

  const timestamp =
    toTimestamp(
      date
    );

  if (
    status ===
      "Deployed"
  ) {
    return {
      alertKey:
        cleanAlertKey(
          `DEPLOYMENT:${attempt.attemptId}:CONFIRMED:${timestamp}`
        ),

      sourceType:
        "DEPLOYMENT",

      priority:
        ALERT_PRIORITY.LOW,

      priorityRank:
        getPriorityRank(
          ALERT_PRIORITY.LOW
        ),

      title:
        "Deployment Confirmed",

      message:
        `${employeeName} has reported to ${company} and is now Deployed.`,

      employee:
        employeeName,

      employeeId:
        attempt.employeeId ||
        null,

      deploymentAttemptId:
        attempt.attemptId ||
        null,

      company,

      position:
        attempt.position ||
        "-",

      status:
        "Deployed",

      scheduledDate:
        attempt.scheduledDate ||
        null,

      scheduledTime:
        attempt.scheduledTime ||
        null,

      scheduledTimeLabel:
        scheduledTimeLabel ||
        null,

      actualArrivalDate:
        attempt.actualArrivalDate ||
        null,

      date,

      timestamp,

      route:
        "/deployments",

      action:
        "view",

      navigationAction:
        "view",

      notificationPurpose:
        "DEPLOYMENT_CONFIRMED",

      performedBy:
        attempt.resolvedByName ||
        "HR Coordinator",

      performedByRole:
        attempt.resolvedByRole ||
        "HR_COORDINATOR",

      recommendedAction:
        "Review the confirmed deployment record for monitoring. No further arrival action is required.",

      reason:
        "Generated because the assigned HR Coordinator confirmed that the employee reported to the client site.",
    };
  }

  return {
    alertKey:
      cleanAlertKey(
        `DEPLOYMENT:${attempt.attemptId}:NO_SHOW:${timestamp}`
      ),

    sourceType:
      "DEPLOYMENT",

    priority:
      ALERT_PRIORITY.MEDIUM,

    priorityRank:
      getPriorityRank(
        ALERT_PRIORITY.MEDIUM
      ),

    title:
      "Deployment No Show",

    message:
      `${employeeName} did not report to ${company} for the scheduled deployment and was returned to Floating / Standby.`,

    employee:
      employeeName,

    employeeId:
      attempt.employeeId ||
      null,

    deploymentAttemptId:
      attempt.attemptId ||
      null,

    company,

    position:
      attempt.position ||
      "-",

    status:
      "No Show",

    scheduledDate:
      attempt.scheduledDate ||
      null,

    scheduledTime:
      attempt.scheduledTime ||
      null,

    scheduledTimeLabel:
      scheduledTimeLabel ||
      null,

    date,

    timestamp,

    route:
      "/deployments",

    action:
      "view",

    navigationAction:
      "view",

    notificationPurpose:
      "DEPLOYMENT_NO_SHOW",

    performedBy:
      attempt.resolvedByName ||
      "HR Coordinator",

    performedByRole:
      attempt.resolvedByRole ||
      "HR_COORDINATOR",

    recommendedAction:
      "Review the No Show record and coordinate any required follow-up before scheduling another deployment.",

    reason:
      "Generated because the assigned HR Coordinator recorded that the employee did not report for the scheduled deployment.",
  };
}

function buildDeploymentAlerts({
  deploymentAttempts,
  role,
  assignedCompany,
}) {
  if (
    !Array.isArray(
      deploymentAttempts
    ) ||
    deploymentAttempts.length ===
      0
  ) {
    return [];
  }

  return deploymentAttempts
    .filter(
      (attempt) => {
        const status =
          normalizeDeploymentAttemptStatus(
            attempt?.status
          );

        if (
          role ===
            "HR_COORDINATOR"
        ) {
          if (
            status !==
              "For Deployment"
          ) {
            return false;
          }

          const attemptCompany =
            cleanValue(
              attempt?.company
            );

          return (
            Boolean(
              assignedCompany &&
              attemptCompany
            ) &&
            normalizeText(
              assignedCompany
            ) ===
              normalizeText(
                attemptCompany
              )
          );
        }

        return (
          [
            "SUPER_ADMIN",
            "HR_MANAGER",
            "HR_STAFF",
          ].includes(
            role
          ) &&
          [
            "Deployed",
            "No Show",
          ].includes(
            status
          )
        );
      }
    )
    .map(
      (attempt) =>
        buildDeploymentAlert(
          attempt,
          role
        )
    )
    .filter(Boolean);
}

function getDateOnlyParts(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const raw =
    String(value).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    return {
      year:
        Number(match[1]),
      month:
        Number(match[2]),
      day:
        Number(match[3]),
    };
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  /*
   * mysql2 represents a MySQL DATE as a JavaScript Date in the
   * Node process timezone. Use the local calendar components here
   * so the original database DATE is preserved instead of shifting
   * backward when the process runs in Asia/Manila.
   */
  return {
    year:
      parsed.getFullYear(),
    month:
      parsed.getMonth() + 1,
    day:
      parsed.getDate(),
  };
}

function getDateOnlyIsoString(
  value
) {
  const parts =
    getDateOnlyParts(
      value
    );

  if (!parts) {
    return "";
  }

  const year =
    String(parts.year)
      .padStart(4, "0");

  const month =
    String(parts.month)
      .padStart(2, "0");

  const day =
    String(parts.day)
      .padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateOnlyTimestamp(
  value
) {
  const parts =
    getDateOnlyParts(
      value
    );

  if (!parts) {
    return null;
  }

  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day
  );
}

function getManilaTodayTimestamp(
  referenceDate = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Manila",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(
      referenceDate
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

  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day)
  );
}

function getManilaBusinessTimeTimestamp({
  year,
  month,
  day,
  dayOffset = 0,
  hour =
    COMPLIANCE_NOTIFICATION_HOUR_MANILA,
}) {
  /*
   * Asia/Manila is UTC+08:00 and does not observe DST.
   *
   * 2026-10-17 08:00 Asia/Manila
   * = 2026-10-17 00:00 UTC.
   */
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day) +
      Number(dayOffset || 0),
    Number(hour) -
      MANILA_UTC_OFFSET_HOURS,
    0,
    0,
    0
  );
}

function getComplianceNaturalTriggerTimestamp(
  expirationDate,
  status
) {
  const parts =
    getDateOnlyParts(
      expirationDate
    );

  if (!parts) {
    return 0;
  }

  if (
    status === "Expired"
  ) {
    return getManilaBusinessTimeTimestamp({
      ...parts,
      dayOffset: 1,
    });
  }

  if (
    status === "Expiring Soon"
  ) {
    return getManilaBusinessTimeTimestamp({
      ...parts,
      dayOffset:
        -COMPLIANCE_EXPIRING_SOON_DAYS,
    });
  }

  return 0;
}

function getComplianceEffectiveTriggerTimestamp(
  document,
  status
) {
  const naturalTriggerTimestamp =
    getComplianceNaturalTriggerTimestamp(
      document?.expirationDate ||
        document?.expiration_date,
      status
    );

  if (!naturalTriggerTimestamp) {
    return 0;
  }

  const documentCreatedTimestamp =
    normalizeEpochMilliseconds(
      document?.createdAtTimestamp ??
        document?.created_at_timestamp
    );

  /*
   * Catch-up rule:
   * If HR creates/renews a document only after it is
   * already inside the alert window, the notification
   * starts when that new document record entered the
   * system instead of being backdated.
   */
  return Math.max(
    naturalTriggerTimestamp,
    documentCreatedTimestamp ||
      0
  );
}

function getComplianceDaysUntilExpiration(
  expirationDate,
  referenceDate = new Date()
) {
  const expirationTimestamp =
    getDateOnlyTimestamp(
      expirationDate
    );

  if (
    expirationTimestamp ===
    null
  ) {
    return null;
  }

  const todayTimestamp =
    getManilaTodayTimestamp(
      referenceDate
    );

  return Math.round(
    (
      expirationTimestamp -
      todayTimestamp
    ) /
      MILLISECONDS_PER_DAY
  );
}

function getComplianceDocumentStatus(
  document,
  referenceDate = new Date()
) {
  const daysUntilExpiration =
    getComplianceDaysUntilExpiration(
      document?.expirationDate ||
        document?.expiration_date,
      referenceDate
    );

  if (
    daysUntilExpiration ===
    null
  ) {
    return null;
  }

  if (
    daysUntilExpiration < 0
  ) {
    return "Expired";
  }

  if (
    daysUntilExpiration <=
    COMPLIANCE_EXPIRING_SOON_DAYS
  ) {
    return "Expiring Soon";
  }

  return null;
}

function normalizeComplianceDocument(
  document = {}
) {
  return {
    ...document,

    documentId:
      document.document_id ??
      document.id,

    employeeId:
      document.employee_id ??
      null,

    employeeName:
      document.employee_name ||
      "Unknown Employee",

    company:
      cleanValue(
        document.employee_company ||
        document.company
      ),

    employeeStatus:
      cleanValue(
        document.employee_status
      ),

    employeeArchived:
      document.employee_archived ===
        true ||
      Number(
        document.employee_archived
      ) === 1,

    documentName:
      cleanValue(
        document.document_name ||
        document.name
      ) ||
      "Compliance Document",

    documentNumber:
      cleanValue(
        document.document_number
      ),

    expirationDate:
      getDateOnlyIsoString(
        document.expiration_date ||
        document.expirationDate
      ) ||
      null,

    createdAt:
      document.document_created_at ||
      document.created_at ||
      null,

    createdAtTimestamp:
      normalizeEpochMilliseconds(
        document.document_created_at_timestamp ??
          document.created_at_timestamp
      ),
  };
}

function buildComplianceAlert(
  document,
  role,
  referenceDate = new Date()
) {
  if (
    !COMPLIANCE_ALERT_ROLES.has(
      role
    )
  ) {
    return null;
  }

  if (
    !document ||
    document.employeeArchived
  ) {
    return null;
  }

  const status =
    getComplianceDocumentStatus(
      document,
      referenceDate
    );

  if (!status) {
    return null;
  }

  const expirationDate =
    document.expirationDate;

  const expirationTimestamp =
    getDateOnlyTimestamp(
      expirationDate
    );

  if (
    expirationTimestamp ===
    null
  ) {
    return null;
  }

  const isExpired =
    status === "Expired";

  /*
   * Notification activation is separate from the
   * compliance business date:
   *
   * - Expiring Soon:
   *   30 days before expiry at 08:00 AM Asia/Manila.
   * - Expired:
   *   the day after expiry at 08:00 AM Asia/Manila.
   * - Catch-up:
   *   a newly recorded/renewed document that is already
   *   inside the alert window starts at its actual
   *   database creation time.
   */
  const triggerTimestamp =
    getComplianceEffectiveTriggerTimestamp(
      document,
      status
    );

  if (!triggerTimestamp) {
    return null;
  }

  const referenceTimestamp =
    referenceDate instanceof Date
      ? referenceDate.getTime()
      : toTimestamp(
          referenceDate
        );

  if (
    referenceTimestamp <
    triggerTimestamp
  ) {
    return null;
  }

  const notificationDate =
    timestampToIsoString(
      triggerTimestamp
    );

  const employeeName =
    cleanValue(
      document.employeeName
    ) ||
    "Unknown Employee";

  const documentName =
    cleanValue(
      document.documentName
    ) ||
    "Compliance Document";

  const expirationLabel =
    formatAlertDate(
      expirationDate
    );

  const priority =
    isExpired
      ? ALERT_PRIORITY.HIGH
      : ALERT_PRIORITY.MEDIUM;

  const statusToken =
    isExpired
      ? "EXPIRED"
      : "EXPIRING_SOON";

  return {
    alertKey:
      cleanAlertKey(
        `COMPLIANCE:${document.documentId}:${statusToken}:${expirationDate}`
      ),

    sourceType:
      "COMPLIANCE",

    priority,

    priorityRank:
      getPriorityRank(
        priority
      ),

    title:
      isExpired
        ? "Compliance Expired"
        : "Compliance Expiring Soon",

    message:
      isExpired
        ? `${employeeName}'s ${documentName} expired on ${expirationLabel}.`
        : `${employeeName}'s ${documentName} will expire on ${expirationLabel}.`,

    employee:
      employeeName,

    employeeId:
      document.employeeId ||
      null,

    company:
      document.company ||
      "",

    documentId:
      document.documentId ||
      null,

    documentName,

    documentNumber:
      document.documentNumber ||
      "",

    expirationDate,

    status,

    complianceStatus:
      status,

    date:
      notificationDate,

    notificationGeneratedAt:
      notificationDate,

    timestamp:
      triggerTimestamp,

    route:
      "/employees",

    action:
      "view",

    navigationAction:
      "view",

    notificationPurpose:
      isExpired
        ? "COMPLIANCE_EXPIRED"
        : "COMPLIANCE_EXPIRING_SOON",

    performedBy:
      "System",

    performedByRole:
      "SYSTEM",

    recommendedAction:
      isExpired
        ? "Review the employee's compliance record and record the renewed document before treating the requirement as current."
        : "Follow up with the employee and record the renewed document before the current requirement expires.",

    reason:
      isExpired
        ? "Generated because the recorded compliance document is already past its expiration date."
        : `Generated because the recorded compliance document will expire within ${COMPLIANCE_EXPIRING_SOON_DAYS} days.`,
  };
}

function buildComplianceAlerts({
  complianceDocuments,
  role,
  referenceDate = new Date(),
}) {
  if (
    !COMPLIANCE_ALERT_ROLES.has(
      role
    ) ||
    !Array.isArray(
      complianceDocuments
    ) ||
    complianceDocuments.length ===
      0
  ) {
    return [];
  }

  return complianceDocuments
    .map(
      (document) =>
        buildComplianceAlert(
          document,
          role,
          referenceDate
        )
    )
    .filter(Boolean);
}

function normalizeEmployee(
  employee = {}
) {
  return {
    ...employee,

    id:
      employee.id,

    name:
      employee.name ||
      employee.full_name ||
      "Unknown Employee",

    company:
      employee.company ||
      "",

    status:
      employee.status ||
      "Unknown",

    archived:
      employee.archived ===
        true ||
      Number(
        employee.archived
      ) === 1,
  };
}

function normalizeIncident(
  incident = {},
  userNameMap = new Map()
) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const violation =
    incident.violation_type ||
    incident.violation ||
    "No violation specified";

  const reportedByRaw =
    incident.reported_by ||
    incident.reportedBy ||
    incident.created_by ||
    incident.createdBy ||
    "Unknown Reporter";

  const lastActionByRaw =
    incident.last_action_by_name ||
    incident.last_action_by_username ||
    incident.last_action_by_id ||
    "";

  const investigationByRaw =
    incident.investigation_started_by_name ||
    incident.investigation_started_by_username ||
    incident.investigation_started_by_id ||
    "";

  const resolutionByRaw =
    incident.resolution_submitted_by_name ||
    incident.resolution_submitted_by_username ||
    incident.resolution_submitted_by_id ||
    "";

  const reviewedByRaw =
    incident.reviewed_by_name ||
    incident.reviewed_by_username ||
    incident.reviewed_by_id ||
    "";

  const reporterProfile =
    resolvePersonProfile(
      reportedByRaw,
      userNameMap,
      "Unknown Reporter"
    );

  const lastActorProfile =
    resolvePersonProfile(
      lastActionByRaw,
      userNameMap,
      ""
    );

  const investigatorProfile =
    resolvePersonProfile(
      investigationByRaw,
      userNameMap,
      ""
    );

  const submitterProfile =
    resolvePersonProfile(
      resolutionByRaw,
      userNameMap,
      ""
    );

  const reviewerProfile =
    resolvePersonProfile(
      reviewedByRaw,
      userNameMap,
      ""
    );

  const reportedByName =
    reporterProfile.name;

  const lastActionByName =
    lastActorProfile.name;

  const investigationStartedByName =
    investigatorProfile.name;

  const resolutionSubmittedByName =
    submitterProfile.name;

  const reviewedByName =
    reviewerProfile.name;

  const reportCreator =
    getIncidentCreator(incident);

  return {
    ...incident,

    id:
      incident.id,

    employeeId:
      incident.employee_id,

    employee_id:
      incident.employee_id,

    employeeName,

    employee:
      employeeName,

    company:
      incident.company ||
      incident.employeeCompany ||
      "",

    violation,

    violationType:
      violation,

    violation_type:
      violation,

    severity:
      normalizeSeverity(
        incident.severity
      ),

    status:
      normalizeStatus(
        incident.status
      ),

    reportedByRaw,

    reported_by_raw:
      reportedByRaw,

    reportedBy:
      reportedByName,

    reportedByName,

    reportedByUsername:
      reporterProfile.username ||
      null,

    reported_by_username:
      reporterProfile.username ||
      null,

    reportedByRole:
      reporterProfile.role ||
      null,

    reported_by_role:
      reporterProfile.role ||
      null,

    reporterName:
      reportedByName,

    reportCreatorId:
      reportCreator.id,

    report_creator_id:
      reportCreator.id,

    reportCreatorUsername:
      reportCreator.username,

    report_creator_username:
      reportCreator.username,

    reportCreatorName:
      reportCreator.name,

    report_creator_name:
      reportCreator.name,

    reportCreatorRole:
      reportCreator.role || null,

    report_creator_role:
      reportCreator.role || null,

    reportingPath:
      getReportingPath(incident),

    reported_by:
      reportedByName,

    date:
      incident.incident_date ||
      incident.created_at,

    incidentDate:
      incident.incident_date ||
      incident.created_at,

    incident_date:
      incident.incident_date,

    createdAt:
      incident.created_at,

    created_at:
      incident.created_at,

    createdAtTimestamp:
      normalizeEpochMilliseconds(
        incident.created_at_timestamp
      ),

    created_at_timestamp:
      normalizeEpochMilliseconds(
        incident.created_at_timestamp
      ),

    updatedAt:
      incident.updated_at ||
      incident.created_at,

    updated_at:
      incident.updated_at ||
      incident.created_at,

    updatedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.updated_at_timestamp
      ),

    updated_at_timestamp:
      normalizeEpochMilliseconds(
        incident.updated_at_timestamp
      ),

    lastActionById:
      incident.last_action_by_id ||
      null,

    last_action_by_id:
      incident.last_action_by_id ||
      null,

    lastActionByUsername:
      incident.last_action_by_username ||
      null,

    last_action_by_username:
      incident.last_action_by_username ||
      null,

    lastActionByName:
      lastActionByName ||
      null,

    last_action_by_name:
      lastActionByName ||
      null,

    lastActionType:
      incident.last_action_type ||
      null,

    last_action_type:
      incident.last_action_type ||
      null,

    lastActionAt:
      incident.last_action_at ||
      null,

    last_action_at:
      incident.last_action_at ||
      null,

    lastActionAtTimestamp:
      normalizeEpochMilliseconds(
        incident.last_action_at_timestamp
      ),

    last_action_at_timestamp:
      normalizeEpochMilliseconds(
        incident.last_action_at_timestamp
      ),

    investigationStartedById:
      incident.investigation_started_by_id ||
      null,

    investigation_started_by_id:
      incident.investigation_started_by_id ||
      null,

    investigationStartedByUsername:
      incident.investigation_started_by_username ||
      null,

    investigation_started_by_username:
      incident.investigation_started_by_username ||
      null,

    investigationStartedByName:
      investigationStartedByName ||
      null,

    investigation_started_by_name:
      investigationStartedByName ||
      null,

    investigationStartedByRole:
      investigatorProfile.role ||
      null,

    investigation_started_by_role:
      investigatorProfile.role ||
      null,

    investigationStartedAt:
      incident.investigation_started_at ||
      null,

    investigation_started_at:
      incident.investigation_started_at ||
      null,

    investigationStartedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.investigation_started_at_timestamp
      ),

    investigation_started_at_timestamp:
      normalizeEpochMilliseconds(
        incident.investigation_started_at_timestamp
      ),

    resolutionSubmittedById:
      incident.resolution_submitted_by_id ||
      null,

    resolution_submitted_by_id:
      incident.resolution_submitted_by_id ||
      null,

    resolutionSubmittedByUsername:
      incident.resolution_submitted_by_username ||
      null,

    resolution_submitted_by_username:
      incident.resolution_submitted_by_username ||
      null,

    resolutionSubmittedByName:
      resolutionSubmittedByName ||
      null,

    resolution_submitted_by_name:
      resolutionSubmittedByName ||
      null,

    resolutionSubmittedByRole:
      submitterProfile.role ||
      null,

    resolution_submitted_by_role:
      submitterProfile.role ||
      null,

    resolutionSubmittedAt:
      incident.resolution_submitted_at ||
      null,

    resolution_submitted_at:
      incident.resolution_submitted_at ||
      null,

    resolutionSubmittedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.resolution_submitted_at_timestamp
      ),

    resolution_submitted_at_timestamp:
      normalizeEpochMilliseconds(
        incident.resolution_submitted_at_timestamp
      ),

    reviewedById:
      incident.reviewed_by_id ||
      null,

    reviewed_by_id:
      incident.reviewed_by_id ||
      null,

    reviewedByUsername:
      incident.reviewed_by_username ||
      null,

    reviewed_by_username:
      incident.reviewed_by_username ||
      null,

    reviewedByName:
      reviewedByName ||
      null,

    reviewed_by_name:
      reviewedByName ||
      null,

    reviewedByRole:
      reviewerProfile.role ||
      null,

    reviewed_by_role:
      reviewerProfile.role ||
      null,

    reviewedAt:
      incident.reviewed_at ||
      null,

    reviewed_at:
      incident.reviewed_at ||
      null,

    reviewedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.reviewed_at_timestamp
      ),

    reviewed_at_timestamp:
      normalizeEpochMilliseconds(
        incident.reviewed_at_timestamp
      ),

    reviewDecision:
      incident.review_decision ||
      null,

    review_decision:
      incident.review_decision ||
      null,

    reviewComments:
      incident.review_comments ||
      null,

    review_comments:
      incident.review_comments ||
      null,
  };
}

function isSameEmployee(
  employee,
  incident
) {
  const employeeId =
    String(
      employee?.id ||
        ""
    );

  const incidentEmployeeId =
    String(
      incident?.employeeId ||
        ""
    );

  const employeeName =
    normalizeText(
      employee?.name
    );

  const incidentEmployeeName =
    normalizeText(
      incident?.employee ||
        incident?.employeeName
    );

  return (
    (
      Boolean(
        employeeId
      ) &&
      employeeId ===
        incidentEmployeeId
    ) ||
    (
      Boolean(
        employeeName
      ) &&
      employeeName ===
        incidentEmployeeName
    )
  );
}

function isAlertVisibleForCurrentUser(
  incident,
  role,
  aliases,
  assignedCompany = "",
  currentUser = {}
) {
  if (
    !ALLOWED_ROLES.has(
      role
    )
  ) {
    return false;
  }

  const status =
    normalizeStatus(
      incident.status
    );

  const isReporter =
    hasAliasMatch(
      aliases,
      getReporterValues(
        incident
      )
    );

  /*
   * The creator of a newly reported Incident must not
   * receive a notification for their own CREATE_INCIDENT
   * event. Use canonical creator metadata rather than
   * reported_by display text so the rule works reliably
   * across HR Manager and HR Coordinator accounts.
   */
  const isReportCreator =
    hasAliasMatch(
      aliases,
      getReportCreatorValues(
        incident
      )
    );

  const isInvestigator =
    hasAliasMatch(
      aliases,
      getInvestigatorValues(
        incident
      )
    );

  const isProofSubmitter =
    hasAliasMatch(
      aliases,
      getProofSubmitterValues(
        incident
      )
    );

  const isHandler =
    hasAliasMatch(
      aliases,
      getHandlerValues(
        incident
      )
    );

  const isReviewer =
    hasAliasMatch(
      aliases,
      getReviewerValues(
        incident
      )
    );

  const isLastActor =
    hasAliasMatch(
      aliases,
      getLastActorValues(
        incident
      )
    );

  const returnedCase =
    isReturnedCase(
      incident
    );

  const startPolicy =
    evaluateStartInvestigation({
      actor: {
        ...currentUser,
        role,
        assignedCompany,
      },
      incident,
    });

  if (
    role ===
    "HR_COORDINATOR"
  ) {
    const incidentCompany =
      cleanValue(
        incident.company
      );

    const hasCompanyScope =
      Boolean(
        assignedCompany &&
          incidentCompany
      ) &&
      normalizeText(
        assignedCompany
      ) ===
        normalizeText(
          incidentCompany
        );

    if (!hasCompanyScope) {
      return false;
    }

    if (status === "Open") {
      /*
       * Same-company coordinator peers may receive the
       * actionable Start Investigation alert, but the
       * coordinator who created the Incident must not
       * receive a notification for their own report.
       */
      return (
        !isReportCreator &&
        startPolicy.allowed
      );
    }

    return [
      "Investigating",
      "For Review",
      "Closed",
    ].includes(status) || returnedCase;
  }

  /*
    NEW INCIDENT

    Recipients:
    - HR Staff
    - HR Manager

    Excluded:
    - Incident creator
    - Super Admin
  */
  if (
    status === "Open"
  ) {
    /*
     * CREATE_INCIDENT self-notification exclusion.
     *
     * The creator must not receive an alert for the
     * Incident they just reported, even when that same
     * user is otherwise eligible to start investigation.
     *
     * Other eligible peers keep their existing actionable
     * or awareness notifications according to policy.
     */
    if (isReportCreator) {
      return false;
    }

    if (startPolicy.allowed) {
      return true;
    }

    return [
      "HR_MANAGER",
      "SUPER_ADMIN",
    ].includes(role);
  }

  /*
    INVESTIGATION STARTED

    Recipients:
    - Incident creator
    - All HR Managers

    Excluded:
    - Assigned investigator
    - Other HR Staff
    - Super Admin
  */
  if (
    status ===
      "Investigating" &&
    !returnedCase
  ) {
    const shouldMonitor =
      isReporter ||
      role ===
        "HR_MANAGER";

    return (
      shouldMonitor &&
      !isInvestigator &&
      !isHandler &&
      !isLastActor
    );
  }

  /*
    CASE RETURNED

    Recipients:
    - Assigned investigator only

    Excluded:
    - Reviewer
    - Other HR users
  */
  if (
    status ===
      "Investigating" &&
    returnedCase
  ) {
    return (
      isInvestigator &&
      !isReviewer &&
      !isLastActor
    );
  }

  /*
    PROOF SUBMITTED

    Recipients:
    - HR Manager
    - Super Admin

    Excluded:
    - Investigator / submitter
  */
  if (
    status ===
    "For Review"
  ) {
    return (
      isReviewerRole(
        role
      ) &&
      !isProofSubmitter &&
      !isLastActor
    );
  }

  /*
    CASE CLOSED

    Recipients:
    - Incident creator
    - Assigned investigator

    Excluded:
    - Reviewer who closed it
  */
  if (
    status ===
    "Closed"
  ) {
    return (
      (
        isReporter ||
        isHandler
      ) &&
      !isReviewer &&
      !isLastActor
    );
  }

  return false;
}

function getIncidentDate(
  incident
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    status ===
      "Closed" ||
    isReturnedCase(
      incident
    )
  ) {
    return (
      incident.reviewedAt ||
      incident.reviewed_at ||
      incident.lastActionAt ||
      incident.last_action_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  if (
    status ===
    "For Review"
  ) {
    return (
      incident.resolutionSubmittedAt ||
      incident.resolution_submitted_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  if (
    status ===
    "Investigating"
  ) {
    return (
      incident.investigationStartedAt ||
      incident.investigation_started_at ||
      incident.updatedAt ||
      incident.updated_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.incident_date
    );
  }

  return (
    incident.createdAt ||
    incident.created_at ||
    incident.incident_date
  );
}

function getIncidentPriority(
  incident,
  role
) {
  const severity =
    normalizeSeverity(
      incident.severity
    );

  const status =
    normalizeStatus(
      incident.status
    );

  if (
    severity ===
      "Critical" &&
    status !==
      "Closed"
  ) {
    return ALERT_PRIORITY.HIGH;
  }

  if (
    status ===
      "For Review" &&
    isReviewerRole(
      role
    )
  ) {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (
    isReturnedCase(
      incident
    )
  ) {
    return ALERT_PRIORITY.MEDIUM;
  }

  if (
    status ===
      "Investigating" ||
    severity ===
      "Major"
  ) {
    return ALERT_PRIORITY.MEDIUM;
  }

  return ALERT_PRIORITY.LOW;
}

function getPriorityRank(
  priority
) {
  if (
    priority ===
    ALERT_PRIORITY.HIGH
  ) {
    return 3;
  }

  if (
    priority ===
    ALERT_PRIORITY.MEDIUM
  ) {
    return 2;
  }

  return 1;
}

function getIncidentTitle(
  incident,
  role,
  priority
) {
  const incidentId =
    incident.id
      ? `#${incident.id}`
      : "Incident";

  const status =
    normalizeStatus(
      incident.status
    );

  if (
    status === "Open" &&
    incident.canStartInvestigation
  ) {
    return `Start Investigation ${incidentId}`;
  }

  if (
    isReturnedCase(
      incident
    )
  ) {
    return `Case Returned for Correction ${incidentId}`;
  }

  if (
    status ===
    "Closed"
  ) {
    return `Case Approved and Closed ${incidentId}`;
  }

  if (
    status ===
      "For Review" &&
    isReviewerRole(
      role
    )
  ) {
    return `Proof Submitted for Review ${incidentId}`;
  }

  if (
    status ===
    "Investigating"
  ) {
    return `Investigation Started ${incidentId}`;
  }

  return `Incident Report for Review ${incidentId}`;
}

function getIncidentRecommendedAction(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    isReturnedCase(
      incident
    )
  ) {
    return "Review the reviewer comments, revise the proof, and resubmit the case for review.";
  }

  if (
    status ===
    "Closed"
  ) {
    return "Review the completed case record. No further action is required.";
  }

  if (
    status ===
      "For Review" &&
    isReviewerRole(
      role
    )
  ) {
    return "Review the submitted proof, then approve and close the case or return it for revision.";
  }

  if (
    status ===
    "Investigating"
  ) {
    return "Monitor the assigned investigation and review its current progress.";
  }

  if (
    status === "Open" &&
    incident.canStartInvestigation
  ) {
    return "Review the incident details and claim investigation responsibility if you are ready to proceed.";
  }

  if (
    normalizeSeverity(
      incident.severity
    ) === "Critical"
  ) {
    return "Review immediately and start the appropriate HR investigation.";
  }

  return "Review the incident for awareness and monitoring. This notification does not assign investigation ownership or request approval.";
}

function getIncidentReason(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    isReturnedCase(
      incident
    )
  ) {
    return "Generated because an authorized reviewer returned the case to the assigned investigator for correction.";
  }

  if (
    status ===
    "Closed"
  ) {
    return "Generated because an authorized reviewer approved and closed the case.";
  }

  if (
    status ===
      "For Review" &&
    isReviewerRole(
      role
    )
  ) {
    return "Generated because investigation proof was submitted and is waiting for an authorized reviewer.";
  }

  if (
    status ===
    "Investigating"
  ) {
    return "Generated because an HR user started the investigation and the case is now being monitored.";
  }

  if (
    status === "Open" &&
    incident.canStartInvestigation
  ) {
    return "Generated because you are currently eligible to claim this investigation.";
  }

  return "Generated because a new incident is available within your authorized management scope for awareness and review.";
}

function getIncidentNavigationAction(
  incident,
  role
) {
  const status =
    normalizeStatus(
      incident.status
    );

  if (
    status ===
      "Investigating" &&
    isReturnedCase(
      incident
    )
  ) {
    return "submit-resolution";
  }

  if (
    status ===
      "For Review" &&
    isReviewerRole(
      role
    )
  ) {
    return "review";
  }

  if (
    status ===
      "Open" &&
    incident.canStartInvestigation
  ) {
    return "start-investigation";
  }

  return "view";
}

function buildIncidentAlert(
  incident,
  role
) {
  const priority =
    getIncidentPriority(
      incident,
      role
    );

  const sourceEventDate =
    getIncidentDate(
      incident
    );

  /*
   * Preserve the historical alert-key timestamp so
   * existing per-user read state does not reset when
   * notification display timing is corrected.
   */
  const alertKeyTimestamp =
    toTimestamp(
      sourceEventDate
    );

  const timestamp =
    getIncidentNotificationTimestamp(
      incident
    );

  const date =
    timestampToIsoString(
      timestamp
    ) ||
    sourceEventDate;

  const status =
    normalizeStatus(
      incident.status
    );

  const severity =
    normalizeSeverity(
      incident.severity
    );

  const reviewDecision =
    incident.reviewDecision ||
    incident.review_decision ||
    "";

  const action =
    getIncidentNavigationAction(
      incident,
      role
    );

  return {
    alertKey:
      cleanAlertKey(
        `INCIDENT:${incident.id}:${
          incident.workflowEventId ||
          incident.workflow_event_id ||
          "CURRENT"
        }:${status}:${reviewDecision}:${
          incident.lastActionType ||
          ""
        }:${alertKeyTimestamp}`
      ),

    sourceType:
      "INCIDENT",

    priority,

    priorityRank:
      getPriorityRank(
        priority
      ),

    title:
      getIncidentTitle(
        incident,
        role,
        priority
      ),

    message:
      `${
        incident.employeeName ||
        "Unknown Employee"
      } • ${
        incident.violationType ||
        "No violation specified"
      }`,

    employee:
      incident.employeeName ||
      "Unknown Employee",

    employeeId:
      incident.employeeId ||
      null,

    incidentId:
      incident.id,

    violation:
      incident.violationType ||
      "-",

    severity,

    status,

    reviewDecision:
      reviewDecision ||
      null,

    reviewComments:
      incident.reviewComments ||
      incident.review_comments ||
      "",

    reportedBy:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    reportedByName:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    reportedByUsername:
      incident.reportedByUsername ||
      incident.reported_by_username ||
      "",

    reportedByRole:
      incident.reportedByRole ||
      incident.reported_by_role ||
      "",

    reporterName:
      incident.reportedByName ||
      incident.reporterName ||
      "-",

    investigationBy:
      incident.investigationStartedByName ||
      incident.investigation_started_by_name ||
      "-",

    investigationStartedByName:
      incident.investigationStartedByName ||
      incident.investigation_started_by_name ||
      "-",

    investigationStartedByUsername:
      incident.investigationStartedByUsername ||
      incident.investigation_started_by_username ||
      "",

    investigationStartedByRole:
      incident.investigationStartedByRole ||
      incident.investigation_started_by_role ||
      "",

    submittedBy:
      incident.resolutionSubmittedByName ||
      incident.resolution_submitted_by_name ||
      "-",

    resolutionSubmittedByName:
      incident.resolutionSubmittedByName ||
      incident.resolution_submitted_by_name ||
      "-",

    resolutionSubmittedByUsername:
      incident.resolutionSubmittedByUsername ||
      incident.resolution_submitted_by_username ||
      "",

    resolutionSubmittedByRole:
      incident.resolutionSubmittedByRole ||
      incident.resolution_submitted_by_role ||
      "",

    reviewedBy:
      incident.reviewedByName ||
      incident.reviewed_by_name ||
      "-",

    reviewedByName:
      incident.reviewedByName ||
      incident.reviewed_by_name ||
      "-",

    reviewedByUsername:
      incident.reviewedByUsername ||
      incident.reviewed_by_username ||
      "",

    reviewedByRole:
      incident.reviewedByRole ||
      incident.reviewed_by_role ||
      "",

    date,

    notificationGeneratedAt:
      date,

    sourceEventDate:
      sourceEventDate ||
      null,

    timestamp,

    route:
      "/incidents",

    action,

    navigationAction:
      action,

    workflowAction:
      incident.lastActionType ||
      incident.last_action_type ||
      null,

    notificationPurpose:
      status === "For Review" &&
      isReviewerRole(role)
        ? "PROOF_SUBMITTED_FOR_REVIEW"
        : status === "Open" &&
            incident.canStartInvestigation
          ? "START_INVESTIGATION"
          : "INCIDENT_REPORT_FOR_REVIEW",

    canStartInvestigation:
      Boolean(
        incident.canStartInvestigation
      ),

    recommendedAction:
      getIncidentRecommendedAction(
        incident,
        role
      ),

    reason:
      getIncidentReason(
        incident,
        role
      ),
  };
}

function buildEmployeePatternAlerts(
  activeEmployees,
  visibleIncidents,
  role
) {
  if (
    ![
      "HR_MANAGER",
      "HR_STAFF",
    ].includes(role)
  ) {
    return [];
  }

  const alerts = [];

  const incidentsByEmployeeId =
    new Map();

  const incidentsByEmployeeName =
    new Map();

  visibleIncidents.forEach(
    (incident) => {
      const status =
        normalizeStatus(
          incident.status
        );

      if (
        ![
          "Open",
          "Investigating",
        ].includes(status)
      ) {
        return;
      }

      const employeeId =
        String(
          incident?.employeeId ||
          ""
        ).trim();

      const employeeName =
        normalizeText(
          incident?.employee ||
          incident?.employeeName
        );

      if (employeeId) {
        const current =
          incidentsByEmployeeId.get(
            employeeId
          ) || [];

        current.push(
          incident
        );

        incidentsByEmployeeId.set(
          employeeId,
          current
        );
      }

      if (employeeName) {
        const current =
          incidentsByEmployeeName.get(
            employeeName
          ) || [];

        current.push(
          incident
        );

        incidentsByEmployeeName.set(
          employeeName,
          current
        );
      }
    }
  );

  activeEmployees.forEach(
    (employee) => {
      const employeeId =
        String(
          employee?.id ||
          ""
        ).trim();

      const employeeName =
        normalizeText(
          employee?.name
        );

      const activeCases =
        (
          employeeId
            ? incidentsByEmployeeId.get(
                employeeId
              )
            : null
        ) ||
        (
          employeeName
            ? incidentsByEmployeeName.get(
                employeeName
              )
            : null
        ) ||
        [];

      if (
        activeCases.length <
        3
      ) {
        return;
      }

      const criticalCount =
        activeCases.filter(
          (incident) =>
            normalizeSeverity(
              incident.severity
            ) === "Critical"
        ).length;

      const latestIncident =
        [
          ...activeCases,
        ].sort(
          (a, b) =>
            toTimestamp(
              getIncidentDate(
                b
              )
            ) -
            toTimestamp(
              getIncidentDate(
                a
              )
            )
        )[0];

      const timestamp =
        toTimestamp(
          getIncidentDate(
            latestIncident
          )
        );

      const priority =
        activeCases.length >=
          5 ||
        criticalCount > 0
          ? ALERT_PRIORITY.HIGH
          : ALERT_PRIORITY.MEDIUM;

      const reporterName =
        latestIncident?.reportedByName ||
        latestIncident?.reporterName ||
        "System Generated";

      alerts.push({
        alertKey:
          cleanAlertKey(
            `EMPLOYEE_PATTERN:${employee.id}:${activeCases.length}:${criticalCount}:${timestamp}`
          ),

        sourceType:
          "EMPLOYEE_PATTERN",

        priority,

        priorityRank:
          getPriorityRank(
            priority
          ),

        title:
          priority ===
          ALERT_PRIORITY.HIGH
            ? "Smart Alert: Repeated Violation Pattern"
            : "Smart Alert: Employee Requires Monitoring",

        message:
          `${employee.name} has ${activeCases.length} active incident cases.`,

        employee:
          employee.name,

        employeeId:
          employee.id,

        incidentId:
          latestIncident?.id ||
          null,

        violation:
          "Repeated incident pattern",

        severity:
          criticalCount > 0
            ? "Critical"
            : "Major",

        status:
          "Active Pattern",

        reportedBy:
          reporterName,

        reportedByName:
          reporterName,

        reporterName,

        date:
          getIncidentDate(
            latestIncident
          ),

        timestamp,

        route:
          "/incidents",

        action:
          "view",

        navigationAction:
          "view",

        recommendedAction:
          "Review the employee incident pattern and consider HR intervention.",

        reason:
          "The system detected repeated active incident records for the same employee.",
      });
    }
  );

  return alerts;
}

async function fetchBaseData() {
  const [
    userNameMap,
    [incidentRows],
    [workflowEventRows],
    [deploymentAttemptRows],
    [complianceDocumentRows],
  ] =
    await Promise.all([
      getUserNameMap(),

      /*
       * Smart Alerts only needs workflow identity,
       * status, severity, timing, and employee
       * context. Avoid transferring full incident
       * rows and derive the employee pattern set
       * from this same query.
       */
      db
        .promise()
        .query(`
          SELECT
            i.id,
            i.employee_id,
            i.company,
            i.violation_type,
            i.severity,
            i.status,
            i.reported_by,
            i.incident_date,
            i.created_at,
            UNIX_TIMESTAMP(i.created_at) * 1000
              AS created_at_timestamp,

            i.updated_at,
            UNIX_TIMESTAMP(i.updated_at) * 1000
              AS updated_at_timestamp,

            i.last_action_by_id,
            i.last_action_by_username,
            i.last_action_by_name,
            i.last_action_type,
            i.last_action_at,
            UNIX_TIMESTAMP(i.last_action_at) * 1000
              AS last_action_at_timestamp,

            i.investigation_started_by_id,
            i.investigation_started_by_username,
            i.investigation_started_by_name,
            i.investigation_started_at,
            UNIX_TIMESTAMP(i.investigation_started_at) * 1000
              AS investigation_started_at_timestamp,

            i.resolution_submitted_by_id,
            i.resolution_submitted_by_username,
            i.resolution_submitted_by_name,
            i.resolution_submitted_at,
            UNIX_TIMESTAMP(i.resolution_submitted_at) * 1000
              AS resolution_submitted_at_timestamp,

            i.reviewed_by_id,
            i.reviewed_by_username,
            i.reviewed_by_name,
            i.reviewed_at,
            UNIX_TIMESTAMP(i.reviewed_at) * 1000
              AS reviewed_at_timestamp,

            i.review_decision,
            i.review_comments,
            ${getCreateIncidentActorSelect("i")},
            e.id AS employeeRecordId,
            e.name AS employeeNameFromEmployee,
            e.company AS employeeCompany,
            e.status AS employeeStatus,
            e.archived AS employeeArchived
          FROM incidents i
          LEFT JOIN employees e
            ON e.id = i.employee_id
        `),

      db
        .promise()
        .query(`
          SELECT
            t.id AS workflow_event_id,
            t.action_type AS workflow_action_type,
            t.created_at AS workflow_event_at,
            UNIX_TIMESTAMP(t.created_at) * 1000
              AS workflow_event_timestamp,

            t.created_by_id AS workflow_actor_id,
            t.created_by_username AS workflow_actor_username,
            t.created_by_name AS workflow_actor_name,
            i.id,
            i.employee_id,
            i.company,
            i.violation_type,
            i.severity,
            i.reported_by,
            i.incident_date,
            i.created_at,
            UNIX_TIMESTAMP(i.created_at) * 1000
              AS created_at_timestamp,

            i.updated_at,
            UNIX_TIMESTAMP(i.updated_at) * 1000
              AS updated_at_timestamp,

            e.id AS employeeRecordId,
            e.name AS employeeNameFromEmployee,
            e.company AS employeeCompany,
            e.status AS employeeStatus,
            e.archived AS employeeArchived
          FROM incident_timeline t
          INNER JOIN incidents i
            ON i.id = t.incident_id
          LEFT JOIN employees e
            ON e.id = i.employee_id
          WHERE t.action_type IN (
            'RETURN_INCIDENT',
            'CLOSE_INCIDENT'
          )
        `),

      db
        .promise()
        .query(`
          SELECT
            da.id AS attempt_id,
            da.employee_id,
            e.name AS employee_name,
            da.company,
            da.position,
            da.scheduled_date,
            da.scheduled_time,
            da.actual_arrival_date,
            da.status,
            da.outcome_reason,
            da.remarks,
            da.created_by_user_id,
            da.resolved_by_user_id,
            da.created_at,
            da.resolved_at,

            creator.full_name AS created_by_name,
            creator.username AS created_by_username,
            creator.role AS created_by_role,

            resolver.full_name AS resolved_by_name,
            resolver.username AS resolved_by_username,
            resolver.role AS resolved_by_role

          FROM deployment_attempts da

          LEFT JOIN employees e
            ON e.id = da.employee_id

          LEFT JOIN users creator
            ON creator.id = da.created_by_user_id

          LEFT JOIN users resolver
            ON resolver.id = da.resolved_by_user_id

          WHERE da.status IN (
            'For Deployment',
            'Deployed',
            'No Show'
          )
        `),

      /*
       * Compliance Smart Alerts use authoritative
       * employee_documents expiration data.
       *
       * Keep only the latest record for the same
       * employee + document name so a renewed
       * requirement does not leave an older expired
       * row generating duplicate alerts.
       */
      db
        .promise()
        .query(`
          SELECT
            ed.id AS document_id,
            ed.employee_id,
            ed.name AS document_name,
            ed.document_number,
            ed.expiration_date,
            ed.created_at AS document_created_at,
            UNIX_TIMESTAMP(ed.created_at) * 1000
              AS document_created_at_timestamp,

            e.name AS employee_name,
            e.company AS employee_company,
            e.status AS employee_status,
            e.archived AS employee_archived

          FROM employee_documents ed

          INNER JOIN employees e
            ON e.id = ed.employee_id

          WHERE
            ed.expiration_date IS NOT NULL

            AND COALESCE(
              e.archived,
              0
            ) = 0

            AND NOT EXISTS (
              SELECT 1

              FROM employee_documents newer_ed

              WHERE
                newer_ed.employee_id =
                  ed.employee_id

                AND LOWER(
                  TRIM(
                    COALESCE(
                      newer_ed.name,
                      ''
                    )
                  )
                ) =
                  LOWER(
                    TRIM(
                      COALESCE(
                        ed.name,
                        ''
                      )
                    )
                  )

                AND (
                  newer_ed.created_at >
                    ed.created_at

                  OR (
                    newer_ed.created_at =
                      ed.created_at

                    AND newer_ed.id >
                      ed.id
                  )
                )
            )
        `),
    ]);

  const employeesById =
    new Map();

  incidentRows.forEach(
    (incident) => {
      const employeeId =
        incident.employeeRecordId;

      if (
        employeeId ===
          null ||
        employeeId ===
          undefined ||
        Number(
          incident.employeeArchived
        ) === 1
      ) {
        return;
      }

      const key =
        String(
          employeeId
        );

      if (
        employeesById.has(
          key
        )
      ) {
        return;
      }

      employeesById.set(
        key,
        normalizeEmployee({
          id:
            employeeId,

          name:
            incident.employeeNameFromEmployee,

          company:
            incident.employeeCompany,

          status:
            incident.employeeStatus,

          archived:
            incident.employeeArchived,
        })
      );
    }
  );

  return {
    userNameMap,

    employees:
      Array.from(
        employeesById.values()
      ),

    incidents:
      incidentRows.map(
        (incident) =>
          normalizeIncident(
            incident,
            userNameMap
          )
      ),

    workflowEvents:
      workflowEventRows.map(
        (event) => {
          const normalized =
            normalizeIncident(
              event,
              userNameMap
            );

          const isReturn =
            event.workflow_action_type ===
            "RETURN_INCIDENT";

          return {
            ...normalized,

            workflowEventId:
              event.workflow_event_id,

            workflow_event_id:
              event.workflow_event_id,

            status:
              isReturn
                ? "Investigating"
                : "Closed",

            reviewDecision:
              isReturn
                ? "Returned"
                : "Approved",

            review_decision:
              isReturn
                ? "Returned"
                : "Approved",

            reviewedAt:
              event.workflow_event_at,

            reviewed_at:
              event.workflow_event_at,

            reviewedAtTimestamp:
              normalizeEpochMilliseconds(
                event.workflow_event_timestamp
              ),

            reviewed_at_timestamp:
              normalizeEpochMilliseconds(
                event.workflow_event_timestamp
              ),

            lastActionAt:
              event.workflow_event_at,

            last_action_at:
              event.workflow_event_at,

            lastActionAtTimestamp:
              normalizeEpochMilliseconds(
                event.workflow_event_timestamp
              ),

            last_action_at_timestamp:
              normalizeEpochMilliseconds(
                event.workflow_event_timestamp
              ),

            lastActionType:
              event.workflow_action_type,

            last_action_type:
              event.workflow_action_type,

            reviewedById:
              event.workflow_actor_id ||
              null,

            reviewed_by_id:
              event.workflow_actor_id ||
              null,

            reviewedByUsername:
              event.workflow_actor_username ||
              null,

            reviewed_by_username:
              event.workflow_actor_username ||
              null,

            reviewedByName:
              event.workflow_actor_name ||
              null,

            reviewed_by_name:
              event.workflow_actor_name ||
              null,
          };
        }
      ),

    deploymentAttempts:
      deploymentAttemptRows.map(
        normalizeDeploymentAttempt
      ),

    complianceDocuments:
      complianceDocumentRows.map(
        normalizeComplianceDocument
      ),
  };
}

function buildSmartAlerts({
  employees,
  incidents,
  deploymentAttempts = [],
  complianceDocuments = [],
  role,
  currentUserAliases,
  assignedCompany,
  currentUser = {},
}) {
  const activeEmployees =
    employees.filter(
      (employee) =>
        !employee.archived
    );

  const activeEmployeeIds =
    new Set();

  const activeEmployeeNames =
    new Set();

  activeEmployees.forEach(
    (employee) => {
      const employeeId =
        String(
          employee?.id ||
          ""
        ).trim();

      const employeeName =
        normalizeText(
          employee?.name
        );

      if (employeeId) {
        activeEmployeeIds.add(
          employeeId
        );
      }

      if (employeeName) {
        activeEmployeeNames.add(
          employeeName
        );
      }
    }
  );

  const candidateIncidents =
    incidents;

  const visibleIncidents =
    candidateIncidents.filter(
      (incident) => {
        const incidentEmployeeId =
          String(
            incident?.employeeId ||
            ""
          ).trim();

        const incidentEmployeeName =
          normalizeText(
            incident?.employee ||
            incident?.employeeName
          );

        const employeeIsActive =
          (
            incidentEmployeeId &&
            activeEmployeeIds.has(
              incidentEmployeeId
            )
          ) ||
          (
            incidentEmployeeName &&
            activeEmployeeNames.has(
              incidentEmployeeName
            )
          );

        const startPolicy =
          evaluateStartInvestigation({
            actor: {
              ...currentUser,
              role,
              assignedCompany,
            },
            incident,
          });

        incident.canStartInvestigation =
          startPolicy.allowed;

        return (
          (
            role ===
              "HR_COORDINATOR" ||
            employeeIsActive
          ) &&
          isAlertVisibleForCurrentUser(
            incident,
            role,
            currentUserAliases,
            assignedCompany,
            currentUser
          )
        );
      }
    );

  const alerts = [
    ...visibleIncidents.map(
      (incident) =>
        buildIncidentAlert(
          incident,
          role
        )
    ),

    ...buildEmployeePatternAlerts(
      activeEmployees,
      visibleIncidents,
      role
    ),

    ...buildDeploymentAlerts({
      deploymentAttempts,
      role,
      assignedCompany,
    }),

    ...buildComplianceAlerts({
      complianceDocuments,
      role,
    }),
  ];

  return alerts.sort(
    (a, b) => {
      if (
        b.timestamp !==
        a.timestamp
      ) {
        return (
          b.timestamp -
          a.timestamp
        );
      }

      return (
        b.priorityRank -
        a.priorityRank
      );
    }
  );
}

async function getAlertStates({
  userKeys,
  role,
}) {
  if (
    !Array.isArray(
      userKeys
    ) ||
    userKeys.length === 0
  ) {
    return new Map();
  }

  const placeholders =
    userKeys
      .map(() => "?")
      .join(", ");

  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          alert_key,
          is_read,
          is_dismissed,
          read_at,
          dismissed_at
        FROM smart_alert_states
        WHERE
          user_key IN (${placeholders})
          AND role = ?
        `,
        [
          ...userKeys,
          role,
        ]
      );

  const stateMap =
    new Map();

  rows.forEach(
    (row) => {
      const existing =
        stateMap.get(
          row.alert_key
        );

      if (!existing) {
        stateMap.set(
          row.alert_key,
          row
        );

        return;
      }

      stateMap.set(
        row.alert_key,
        {
          ...existing,

          is_read:
            Math.max(
              Number(
                existing.is_read ||
                0
              ),
              Number(
                row.is_read ||
                0
              )
            ),

          is_dismissed:
            Math.max(
              Number(
                existing.is_dismissed ||
                0
              ),
              Number(
                row.is_dismissed ||
                0
              )
            ),

          read_at:
            row.read_at ||
            existing.read_at ||
            null,

          dismissed_at:
            row.dismissed_at ||
            existing.dismissed_at ||
            null,
        }
      );
    }
  );

  return stateMap;
}

function applyAlertStates(
  alerts,
  stateMap
) {
  return alerts.map(
    (alert) => {
      const state =
        stateMap.get(
          alert.alertKey
        );

      return {
        ...alert,

        isRead:
          Number(
            state?.is_read ||
            0
          ) === 1,

        isDismissed:
          Number(
            state?.is_dismissed ||
            0
          ) === 1,

        readAt:
          state?.read_at ||
          null,

        dismissedAt:
          state?.dismissed_at ||
          null,
      };
    }
  );
}

function buildSummary(
  alerts
) {
  return {
    total:
      alerts.length,

    unread:
      alerts.filter(
        (alert) =>
          !alert.isRead
      ).length,

    high:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.HIGH
      ).length,

    medium:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.MEDIUM
      ).length,

    low:
      alerts.filter(
        (alert) =>
          alert.priority ===
          ALERT_PRIORITY.LOW
      ).length,
  };
}

async function upsertAlertState({
  userKey,
  role,
  alertKey,
  isRead,
  isDismissed,
}) {
  if (
    !userKey ||
    !role ||
    !alertKey
  ) {
    return;
  }

  await db
    .promise()
    .query(
      `
      INSERT INTO smart_alert_states
      (
        user_key,
        role,
        alert_key,
        is_read,
        is_dismissed,
        read_at,
        dismissed_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        IF(? = 1, NOW(), NULL),
        IF(? = 1, NOW(), NULL)
      )
      ON DUPLICATE KEY UPDATE
        is_read =
          GREATEST(
            is_read,
            VALUES(is_read)
          ),

        is_dismissed =
          GREATEST(
            is_dismissed,
            VALUES(is_dismissed)
          ),

        read_at =
          CASE
            WHEN VALUES(is_read) = 1
              THEN NOW()
            ELSE read_at
          END,

        dismissed_at =
          CASE
            WHEN VALUES(is_dismissed) = 1
              THEN NOW()
            ELSE dismissed_at
          END,

        updated_at =
          NOW()
      `,
      [
        userKey,
        role,
        alertKey,
        isRead
          ? 1
          : 0,
        isDismissed
          ? 1
          : 0,
        isRead
          ? 1
          : 0,
        isDismissed
          ? 1
          : 0,
      ]
    );
}

/*
 * SECURITY:
 *
 * Rebuild the current user's alert set from
 * authoritative backend data before any read/dismiss
 * state mutation.
 *
 * An alertKey sent by the browser identifies an alert;
 * it never grants authority to mutate that alert.
 */
async function getVisibleAlertKeySetForRequest(
  req,
  role
) {
  const {
    employees,
    incidents,
    deploymentAttempts,
    complianceDocuments,
    userNameMap,
  } =
    await fetchBaseData();

  const currentUserAliases =
    getCurrentUserAliases(
      req,
      userNameMap
    );

  const alerts =
    buildSmartAlerts({
      employees,
      incidents,
      deploymentAttempts,
      complianceDocuments,
      role,
      currentUserAliases,
      assignedCompany:
        getAssignedCompany(req),
      currentUser:
        req.user,
    });

  return new Set(
    alerts
      .map(
        (alert) =>
          cleanAlertKey(
            alert?.alertKey
          )
      )
      .filter(Boolean)
  );
}

exports.getSmartAlerts =
  async (
    req,
    res
  ) => {
    try {
      const userKey =
        getUserKey(req);

      const role =
        getRole(req);

      if (
        !userKey
      ) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated user identity is required.",
          });
      }

      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "You do not have permission to access smart alerts.",
          });
      }

      const assignedCompany =
        getAssignedCompany(req);

      if (
        role ===
          "HR_COORDINATOR" &&
        !assignedCompany
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const {
        employees,
        incidents,
        deploymentAttempts,
        complianceDocuments,
        userNameMap,
      } =
        await fetchBaseData();

      const currentUserAliases =
        getCurrentUserAliases(
          req,
          userNameMap
        );

      const trustedStateUserKeys =
        getTrustedStateUserKeys(
          req
        );

      const stateMap =
        await getAlertStates({
          userKeys:
            trustedStateUserKeys,

          role,
        });

      const alerts =
        buildSmartAlerts({
          employees,
          incidents,
          deploymentAttempts,
          complianceDocuments,
          role,

          currentUserAliases,

          assignedCompany,

          currentUser:
            req.user,
        });

      const alertsWithState =
        applyAlertStates(
          alerts,
          stateMap
        );

      const unreadAlerts =
        alertsWithState.filter(
          (alert) =>
            !alert.isRead
        );

      const popupAlert =
        unreadAlerts
          .filter(
            (alert) =>
              !alert.isDismissed
          )
          .sort(
            (a, b) => {
              if (
                b.timestamp !==
                a.timestamp
              ) {
                return (
                  b.timestamp -
                  a.timestamp
                );
              }

              return (
                b.priorityRank -
                a.priorityRank
              );
            }
          )[0] ||
        null;

      return res.json({
        alerts:
          alertsWithState,

        latestAlerts:
          alertsWithState.slice(
            0,
            5
          ),

        unreadCount:
          unreadAlerts.length,

        popupAlert,

        summary:
          buildSummary(
            alertsWithState
          ),
      });
    } catch (error) {
      console.error(
        "GET SMART ALERTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to fetch smart alerts.",
        });
    }
  };

exports.markSmartAlertRead =
  async (
    req,
    res
  ) => {
    try {
      const userKey =
        getUserKey(req);

      const role =
        getRole(req);

      const alertKey =
        cleanAlertKey(
          req?.body?.alertKey
        );

      if (
        !userKey
      ) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated user identity is required.",
          });
      }

      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "You do not have permission to update smart alerts.",
          });
      }

      if (
        !alertKey
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Alert key is required.",
          });
      }

      const visibleAlertKeys =
        await getVisibleAlertKeySetForRequest(
          req,
          role
        );

      if (
        !visibleAlertKeys.has(
          alertKey
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Alert not found.",
          });
      }

      await upsertAlertState({
        userKey,
        role,
        alertKey,

        isRead:
          true,

        isDismissed:
          false,
      });

      return res.json({
        success: true,

        message:
          "Alert marked as read.",
      });
    } catch (error) {
      console.error(
        "MARK SMART ALERT READ ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to mark alert as read.",
        });
    }
  };

exports.dismissSmartAlert =
  async (
    req,
    res
  ) => {
    try {
      const userKey =
        getUserKey(req);

      const role =
        getRole(req);

      const alertKey =
        cleanAlertKey(
          req?.body?.alertKey
        );

      if (
        !userKey
      ) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated user identity is required.",
          });
      }

      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "You do not have permission to update smart alerts.",
          });
      }

      if (
        !alertKey
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Alert key is required.",
          });
      }

      const visibleAlertKeys =
        await getVisibleAlertKeySetForRequest(
          req,
          role
        );

      if (
        !visibleAlertKeys.has(
          alertKey
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Alert not found.",
          });
      }

      await upsertAlertState({
        userKey,
        role,
        alertKey,

        isRead:
          true,

        isDismissed:
          true,
      });

      return res.json({
        success: true,

        message:
          "Alert dismissed.",
      });
    } catch (error) {
      console.error(
        "DISMISS SMART ALERT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to dismiss alert.",
        });
    }
  };

exports.markAllSmartAlertsRead =
  async (
    req,
    res
  ) => {
    try {
      const userKey =
        getUserKey(req);

      const role =
        getRole(req);

      if (
        !userKey
      ) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated user identity is required.",
          });
      }

      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "You do not have permission to update smart alerts.",
          });
      }

      const visibleAlertKeys =
        await getVisibleAlertKeySetForRequest(
          req,
          role
        );

      const alertKeys =
        Array.from(
          visibleAlertKeys
        );

      if (
        alertKeys.length >
        0
      ) {
        await Promise.all(
          alertKeys.map(
            (alertKey) =>
              upsertAlertState({
                userKey,
                role,
                alertKey,

                isRead:
                  true,

                isDismissed:
                  false,
              })
          )
        );
      }

      return res.json({
        success: true,

        message:
          "All visible alerts marked as read.",
      });
    } catch (error) {
      console.error(
        "MARK ALL SMART ALERTS READ ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to mark all alerts as read.",
        });
    }
  };

if (
  process.env.NODE_ENV === "test"
) {
  exports.__test = {
    buildSmartAlerts,
    buildDeploymentAlerts,
    buildDeploymentAlert,
    normalizeDeploymentAttempt,
    formatAlertTime,
    buildComplianceAlerts,
    buildComplianceAlert,
    normalizeComplianceDocument,
    getComplianceDocumentStatus,
    getComplianceDaysUntilExpiration,
    getComplianceNaturalTriggerTimestamp,
    getComplianceEffectiveTriggerTimestamp,
    getIncidentNotificationTimestamp,
    normalizeEpochMilliseconds,
  };
}