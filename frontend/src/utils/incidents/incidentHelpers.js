import { enrichIncidentIntelligence } from "../incidentIntelligence";

export function safeParse() {
  return [];
}

export function getUserIdentity(user) {
  return {
    id: user?.userId || user?.user_id || user?.id || user?.employeeId || "N/A",
    username: user?.username || "Unknown",
    name:
      user?.full_name ||
      user?.fullName ||
      user?.fullname ||
      user?.display_name ||
      user?.displayName ||
      user?.name ||
      user?.username ||
      "Unknown",
    role: user?.role || "Unknown",
  };
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

export function normalizeStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const map = {
    OPEN: "Open",
    INVESTIGATING: "Investigating",
    FOR_REVIEW: "For Review",
    CLOSED: "Closed",
    RESOLVED: "For Review",
  };

  return map[normalized] || status || "Open";
}

export function normalizeIncidentWithRules(incident, allIncidents = []) {
  const timelineEvents = Array.isArray(incident.timelineEvents)
    ? incident.timelineEvents
    : Array.isArray(incident.timeline_events)
    ? incident.timeline_events
    : Array.isArray(incident.timeline)
    ? incident.timeline
    : [];

  return enrichIncidentIntelligence(
    {
      ...incident,
      status: normalizeStatus(incident.status),
      investigation: incident.investigation || null,
      resolution: incident.resolution || null,
      review: incident.review || null,

      timelineEvents,
      timeline_events: timelineEvents,
      timeline: timelineEvents,
    },
    allIncidents
  );
}

export function getVisibleIncidents(rawIncidents = [], rawEmployees = []) {
  const activeEmployees = rawEmployees.filter((emp) => {
    const isArchived = emp?.archived === true || Number(emp?.archived) === 1;
    return !isArchived;
  });

  const enriched = rawIncidents.map((item) =>
    normalizeIncidentWithRules(item, rawIncidents)
  );

  return enriched.filter((incident) =>
    activeEmployees.some((emp) => {
      const employeeId = String(emp.id || emp.employeeId || emp.employee_id || "");
      const employeeName = String(emp.name || emp.full_name || emp.fullName || "");
      const incidentEmployeeId = String(
        incident.employeeId || incident.employee_id || incident.empId || ""
      );
      const incidentEmployeeName = String(
        incident.employee || incident.employeeName || incident.employee_name || ""
      );

      return (
        (!!employeeId && employeeId === incidentEmployeeId) ||
        (!!employeeName && employeeName === incidentEmployeeName)
      );
    })
  );
}

export function createTimelineItem({ title, description, createdBy, status }) {
  return {
    id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    createdAt: new Date().toISOString(),
    createdBy,
    status,
  };
}

export function getEmployeeIncidentStats(employeeId, incidents = []) {
  const employeeCases = incidents.filter(
    (inc) => String(inc.employeeId || inc.employee_id || "") === String(employeeId)
  );

  const openCases = employeeCases.filter((inc) =>
    ["Open", "Investigating", "For Review"].includes(normalizeStatus(inc.status))
  );

  const criticalCases = employeeCases.filter(
    (inc) => inc.severity === "Critical"
  );

  return {
    totalCases: employeeCases.length,
    openCases: openCases.length,
    criticalCases: criticalCases.length,
    lastIncidentDate:
      employeeCases[0]?.reportedAt ||
      employeeCases[0]?.reported_at ||
      employeeCases[0]?.date ||
      null,
  };
}

export function updateEmployeeKpiAfterIncident() {
  return null;
}