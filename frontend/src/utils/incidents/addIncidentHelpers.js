import { enrichIncidentIntelligence } from "../incidentIntelligence";

export const severityStyle = {
  Minor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Major: "bg-amber-100 text-amber-700 border-amber-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

export const penaltyLevelStyle = {
  Warning: "bg-sky-100 text-sky-700 border-sky-200",
  "Warning / 1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "15–30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
};

const ACTIVE_CASE_STATUSES = ["Open", "Investigating", "For Review"];

const INCIDENT_TIME_ZONE =
  "Asia/Manila";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeIncidentStatus(status) {
  const normalized = String(status || "Open").trim().toUpperCase();

  const map = {
    OPEN: "Open",
    INVESTIGATING: "Investigating",
    FOR_REVIEW: "For Review",
    CLOSED: "Closed",
    RESOLVED: "For Review",
  };

  return map[normalized] || status || "Open";
}

function getIncidentViolation(incident) {
  return (
    incident?.violation ||
    incident?.violationType ||
    incident?.violation_type ||
    ""
  );
}

function getIncidentDateValue(incident) {
  return (
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.createdAtTimestamp ||
    incident?.created_at_timestamp ||
    incident?.createdAt ||
    incident?.created_at ||
    ""
  );
}

function isClosedIncident(incident) {
  return normalizeIncidentStatus(incident?.status) === "Closed";
}

function isActiveIncident(incident) {
  return ACTIVE_CASE_STATUSES.includes(normalizeIncidentStatus(incident?.status));
}

function normalizeDateTimeTimestamp(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isNaN(timestamp)
      ? 0
      : timestamp;
  }

  const normalized =
    String(value).trim();

  if (!normalized) {
    return 0;
  }

  const numericValue =
    Number(normalized);

  if (
    Number.isFinite(numericValue) &&
    numericValue > 0
  ) {
    return numericValue < 100000000000
      ? numericValue * 1000
      : numericValue;
  }

  /*
   * A date-only value is already a business calendar
   * date. Interpret it at Manila midnight so another
   * browser timezone cannot shift the calendar day.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
  ) {
    const parsed =
      new Date(
        `${normalized}T00:00:00+08:00`
      ).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }

  /*
   * Legacy MySQL DATETIME values may not contain an
   * explicit timezone. These represent Welljob local
   * business time, so attach the Manila offset before
   * parsing.
   */
  const mysqlDateTimeMatch =
    normalized.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)$/
    );

  if (mysqlDateTimeMatch) {
    const parsed =
      new Date(
        `${mysqlDateTimeMatch[1]}T${mysqlDateTimeMatch[2]}+08:00`
      ).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }

  const parsed =
    new Date(normalized).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function getManilaDateParts(value) {
  const timestamp =
    normalizeDateTimeTimestamp(value);

  if (!timestamp) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          INCIDENT_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date(timestamp)
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
            ].includes(part.type)
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
    return null;
  }

  return {
    year:
      values.year,
    month:
      values.month,
    day:
      values.day,
  };
}

export function generateIncidentId(existingIncidents = []) {
  const maxNumber = existingIncidents.reduce((max, item) => {
    const rawId = item.displayId || item.id || "";
    const match = String(rawId).match(/INC-(\d+)/i);

    if (match) {
      const num = Number(match[1]);
      return Number.isFinite(num) && num > max ? num : max;
    }

    const numericId = Number(rawId);
    return Number.isFinite(numericId) && numericId > max ? numericId : max;
  }, 0);

  return `INC-${String(maxNumber + 1).padStart(4, "0")}`;
}

export function getDateOnly(value) {
  /*
   * Preserve an already-valid date-only business value
   * exactly as supplied.
   */
  const normalized =
    String(value ?? "").trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
  ) {
    return normalized;
  }

  /*
   * Convert an absolute timestamp to its PHILIPPINE
   * calendar date, never its UTC calendar date.
   *
   * Example:
   * 2026-10-16T19:22:00.000Z
   * = Oct 17, 2026 03:22 AM in Manila
   * => 2026-10-17
   */
  const dateParts =
    getManilaDateParts(value);

  if (dateParts) {
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }

  /*
   * Invalid/missing input falls back to the current
   * Manila business date instead of UTC date.
   */
  const currentDateParts =
    getManilaDateParts(
      Date.now()
    );

  if (!currentDateParts) {
    return "";
  }

  return `${currentDateParts.year}-${currentDateParts.month}-${currentDateParts.day}`;
}

export function formatDateTime(value) {
  const timestamp =
    normalizeDateTimeTimestamp(
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
    new Date(timestamp)
  );
}

export function getOrdinalSuffix(number) {
  if (number === 1) return "st";
  if (number === 2) return "nd";
  if (number === 3) return "rd";
  return "th";
}

export function findActiveDeployment(deployments = [], employee) {
  return deployments.find((dep) => {
    const sameId =
      String(dep.employeeId || dep.id || "").trim() ===
      String(employee.employeeId || employee.id || "").trim();

    const sameName =
      String(dep.employee || "").trim().toLowerCase() ===
      String(employee.employee || employee.name || "").trim().toLowerCase();

    const status = String(dep.status || dep.deploymentStatus || "Active")
      .trim()
      .toLowerCase();

    return (
      (sameId || sameName) &&
      ["active", "deployed", "ongoing"].includes(status)
    );
  });
}

export function getDuplicateIncidentCandidates(existingIncidents = [], formData) {
  if (!formData?.employeeId || !formData?.violation) return [];

  return existingIncidents
    .filter((incident) => {
      if (isClosedIncident(incident)) return false;

      const sameEmployee =
        String(incident.employeeId || incident.employee_id || "").trim() ===
        String(formData.employeeId || "").trim();

      const sameViolation =
        normalizeText(getIncidentViolation(incident)) ===
        normalizeText(formData.violation);

      return sameEmployee && sameViolation && isActiveIncident(incident);
    })
    .sort((a, b) => {
      const dateA =
        normalizeDateTimeTimestamp(
          getIncidentDateValue(a)
        );

      const dateB =
        normalizeDateTimeTimestamp(
          getIncidentDateValue(b)
        );

      return dateB - dateA;
    });
}

export function buildFinalIncident({
  formData,
  penaltyData,
  existingIncidents = [],
}) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  /*
   * reportedAt remains an absolute ISO instant.
   * The business incident date is derived separately
   * through getDateOnly(), which uses Asia/Manila.
   *
   * The backend still remains authoritative for the
   * actual database created_at workflow timestamp.
   */
  const now =
    formData.reportedAt ||
    new Date().toISOString();

  const createdBy =
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    user?.username ||
    "Unknown";

  return enrichIncidentIntelligence(
    {
      ...formData,
      ...penaltyData,
      status: "Open",
      date: getDateOnly(now),
      reportedAt: now,
      reportedBy: createdBy,
      actions: [],
      reviewComments: [],
      duplicateVerified: Boolean(formData.duplicateVerified),
      duplicateVerificationNote: formData.duplicateVerificationNote || "",
      timeline: [
        {
          id: `TL-${Date.now()}`,
          title: "Incident Reported",
          description: formData.duplicateVerified
            ? "Incident report was created after duplicate verification."
            : "Incident report was created and saved.",
          createdAt: now,
          createdBy,
          status: "Open",
        },
      ],
    },
    existingIncidents
  );
}