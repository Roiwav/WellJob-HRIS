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

export function getDateOnly(isoDate) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split("T")[0];
  }

  return date.toISOString().split("T")[0];
}

export function formatDateTime(isoDate) {
  if (!isoDate) return "-";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
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
      const dateA = new Date(getIncidentDateValue(a)).getTime() || 0;
      const dateB = new Date(getIncidentDateValue(b)).getTime() || 0;
      return dateB - dateA;
    });
}

export function buildFinalIncident({
  formData,
  penaltyData,
  existingIncidents = [],
}) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const now = formData.reportedAt || new Date().toISOString();

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