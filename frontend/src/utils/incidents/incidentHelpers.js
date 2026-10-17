import { enrichIncidentIntelligence } from "../incidentIntelligence";

const INCIDENT_TIME_ZONE =
  "Asia/Manila";

export function safeParse() {
  return [];
}

function firstNonEmptyValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

function firstNonEmptyText(...values) {
  const value = firstNonEmptyValue(
    ...values
  );

  return value === null
    ? ""
    : String(value).trim();
}

function canonicalUserId(value) {
  const normalized =
    String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericValue =
    Number(normalized);

  return (
    Number.isSafeInteger(
      numericValue
    ) &&
    numericValue > 0
  )
    ? numericValue
    : null;
}

function firstCanonicalUserId(
  ...values
) {
  for (const value of values) {
    const id =
      canonicalUserId(value);

    if (id) {
      return id;
    }
  }

  return null;
}

function normalizeIncidentDateTimeTimestamp(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (
    value instanceof Date
  ) {
    const timestamp =
      value.getTime();

    return Number.isNaN(
      timestamp
    )
      ? 0
      : timestamp;
  }

  const normalized =
    String(
      value
    ).trim();

  if (!normalized) {
    return 0;
  }

  const numericValue =
    Number(
      normalized
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

  /*
   * Date-only values are business calendar dates.
   * Interpret them as Manila midnight rather than UTC
   * midnight so a browser timezone cannot shift them.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    const parsed =
      new Date(
        `${normalized}T00:00:00+08:00`
      ).getTime();

    return Number.isNaN(
      parsed
    )
      ? 0
      : parsed;
  }

  /*
   * Legacy MySQL DATETIME values may arrive without
   * any timezone marker:
   *
   *   2026-10-17 01:47:00
   *   2026-10-17T01:47:00
   *
   * Those values represent Welljob's local business
   * time, so attach the Manila UTC+08:00 offset before
   * parsing.
   */
  const mysqlDateTimeMatch =
    normalized.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)$/
    );

  if (
    mysqlDateTimeMatch
  ) {
    const parsed =
      new Date(
        `${mysqlDateTimeMatch[1]}T${mysqlDateTimeMatch[2]}+08:00`
      ).getTime();

    return Number.isNaN(
      parsed
    )
      ? 0
      : parsed;
  }

  /*
   * ISO strings with Z / explicit offsets already
   * represent an absolute instant and should be parsed
   * directly.
   */
  const parsed =
    new Date(
      normalized
    ).getTime();

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

export function getUserIdentity(user) {
  /*
   * IMPORTANT:
   *
   * `userId` / `user_id` are not guaranteed to be the
   * canonical numeric users.id in this application.
   *
   * Example:
   *   id      = 2
   *   userId  = "HM01"
   *   user_id = "HM01"
   *
   * Incident investigation ownership is based on the
   * canonical numeric users.id recorded in the Incident
   * timeline. Therefore select the first VALID POSITIVE
   * NUMERIC account ID instead of the first non-empty alias.
   *
   * employeeId is intentionally NOT used as an account-ID
   * fallback because an employee record ID is a different
   * identity domain from users.id.
   */
  const id =
    firstCanonicalUserId(
      user?.id,
      user?.accountId,
      user?.account_id,
      user?.userId,
      user?.user_id
    );

  const assignedCompany =
    firstNonEmptyText(
      user?.assignedCompany,
      user?.assigned_company,
      user?.company,
      user?.companyName,
      user?.company_name
    );

  return {
    id,

    username:
      firstNonEmptyText(
        user?.username,
        user?.email
      ) || "Unknown",

    name:
      firstNonEmptyText(
        user?.full_name,
        user?.fullName,
        user?.fullname,
        user?.display_name,
        user?.displayName,
        user?.name,
        user?.username,
        user?.email
      ) || "Unknown",

    /*
     * Keep the authenticated raw role. The Incident
     * eligibility helper performs canonical role
     * normalization in one place.
     */
    role:
      firstNonEmptyText(
        user?.role
      ) || "Unknown",

    assignedCompany,
    assigned_company:
      assignedCompany,
  };
}

export function formatDateTime(
  value
) {
  const timestamp =
    normalizeIncidentDateTimeTimestamp(
      value
    );

  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        INCIDENT_TIME_ZONE,
      year:
        "numeric",
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
    new Date(
      timestamp
    )
  );
}

export function normalizeStatus(
  status
) {
  const normalized =
    String(
      status || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /\s+/g,
        "_"
      );

  const map = {
    OPEN:
      "Open",

    INVESTIGATING:
      "Investigating",

    FOR_REVIEW:
      "For Review",

    CLOSED:
      "Closed",

    /*
     * Preserve existing frontend compatibility behavior.
     * Do not change legacy RESOLVED interpretation as part
     * of the Start Investigation identity fix.
     */
    RESOLVED:
      "For Review",
  };

  return (
    map[
      normalized
    ] ||
    status ||
    "Open"
  );
}

export function normalizeIncidentWithRules(
  incident,
  allIncidents = []
) {
  const timelineEvents =
    Array.isArray(
      incident
        ?.timelineEvents
    )
      ? incident
          .timelineEvents
      : Array.isArray(
          incident
            ?.timeline_events
        )
        ? incident
            .timeline_events
        : Array.isArray(
            incident
              ?.timeline
          )
          ? incident
              .timeline
          : [];

  return enrichIncidentIntelligence(
    {
      ...incident,

      status:
        normalizeStatus(
          incident?.status
        ),

      investigation:
        incident
          ?.investigation ||
        null,

      resolution:
        incident
          ?.resolution ||
        null,

      review:
        incident
          ?.review ||
        null,

      timelineEvents,

      timeline_events:
        timelineEvents,

      timeline:
        timelineEvents,
    },

    allIncidents
  );
}

export function getVisibleIncidents(
  rawIncidents = [],
  rawEmployees = []
) {
  const activeEmployees =
    rawEmployees.filter(
      (
        emp
      ) => {
        const isArchived =
          emp?.archived ===
            true ||
          Number(
            emp?.archived
          ) === 1;

        return !isArchived;
      }
    );

  const enriched =
    rawIncidents.map(
      (
        item
      ) =>
        normalizeIncidentWithRules(
          item,
          rawIncidents
        )
    );

  return enriched.filter(
    (
      incident
    ) =>
      activeEmployees.some(
        (
          emp
        ) => {
          const employeeId =
            String(
              emp?.id ||
              emp?.employeeId ||
              emp?.employee_id ||
              ""
            );

          const employeeName =
            String(
              emp?.name ||
              emp?.full_name ||
              emp?.fullName ||
              ""
            );

          const incidentEmployeeId =
            String(
              incident
                ?.employeeId ||
              incident
                ?.employee_id ||
              incident
                ?.empId ||
              ""
            );

          const incidentEmployeeName =
            String(
              incident
                ?.employee ||
              incident
                ?.employeeName ||
              incident
                ?.employee_name ||
              ""
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
      )
  );
}

export function createTimelineItem({
  title,
  description,
  createdBy,
  status,
}) {
  return {
    id:
      `TL-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    title,
    description,

    /*
     * ISO UTC is the correct transport format.
     * formatDateTime() converts it to Asia/Manila only
     * at presentation time.
     */
    createdAt:
      new Date()
        .toISOString(),

    createdBy,
    status,
  };
}

export function getEmployeeIncidentStats(
  employeeId,
  incidents = []
) {
  const employeeCases =
    incidents.filter(
      (
        inc
      ) =>
        String(
          inc?.employeeId ||
          inc?.employee_id ||
          ""
        ) ===
        String(
          employeeId
        )
    );

  const openCases =
    employeeCases.filter(
      (
        inc
      ) =>
        [
          "Open",
          "Investigating",
          "For Review",
        ].includes(
          normalizeStatus(
            inc?.status
          )
        )
    );

  const criticalCases =
    employeeCases.filter(
      (
        inc
      ) =>
        inc?.severity ===
        "Critical"
    );

  return {
    totalCases:
      employeeCases.length,

    openCases:
      openCases.length,

    criticalCases:
      criticalCases.length,

    lastIncidentDate:
      employeeCases[0]
        ?.reportedAt ||
      employeeCases[0]
        ?.reported_at ||
      employeeCases[0]
        ?.date ||
      null,
  };
}

export function updateEmployeeKpiAfterIncident() {
  return null;
}