import { enrichIncidentIntelligence } from "../incidentIntelligence";

const EMPLOYEES_KEY = "employees";

export function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getUserIdentity(user) {
  return {
    id: user?.userId || user?.id || user?.employeeId || "N/A",
    username: user?.username || "Unknown",
    name: user?.name || user?.fullName || user?.username || "Unknown",
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
  const map = {
    OPEN: "Open",
    INVESTIGATING: "Investigating",
    FOR_REVIEW: "For Review",
    CLOSED: "Closed",
    RESOLVED: "For Review",
  };

  return map[status] || status || "Open";
}

export function normalizeIncidentWithRules(incident, allIncidents = []) {
  return enrichIncidentIntelligence(
    {
      ...incident,
      status: normalizeStatus(incident.status),
      investigation: incident.investigation || null,
      resolution: incident.resolution || null,
      review: incident.review || null,
      timeline: Array.isArray(incident.timeline) ? incident.timeline : [],
    },
    allIncidents
  );
}

export function getVisibleIncidents(rawIncidents = [], rawEmployees = []) {
  const activeEmployees = rawEmployees.filter((emp) => !emp.archived);

  const enriched = rawIncidents.map((item) =>
    normalizeIncidentWithRules(item, rawIncidents)
  );

  return enriched.filter((incident) =>
    activeEmployees.some(
      (emp) =>
        String(emp.id || emp.employeeId || emp.name) ===
          String(incident.employeeId || incident.employee) ||
        String(emp.name) === String(incident.employee)
    )
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
    (inc) => String(inc.employeeId) === String(employeeId)
  );

  const openCases = employeeCases.filter((inc) =>
    ["Open", "Investigating", "For Review"].includes(inc.status)
  );

  const criticalCases = employeeCases.filter(
    (inc) => inc.severity === "Critical"
  );

  return {
    totalCases: employeeCases.length,
    openCases: openCases.length,
    criticalCases: criticalCases.length,
    lastIncidentDate:
      employeeCases[0]?.reportedAt || employeeCases[0]?.date || null,
  };
}

export function updateEmployeeKpiAfterIncident(
  employeeId,
  incident,
  incidents = []
) {
  const employees = safeParse(EMPLOYEES_KEY);
  const stats = getEmployeeIncidentStats(employeeId, incidents);

  const updatedEmployees = employees.map((emp) => {
    const sameEmployee =
      String(emp.id || emp.employeeId || "") === String(employeeId);

    if (!sameEmployee) return emp;

    const currentScore = Number(emp.performanceScore || emp.kpiScore || 100);

    const penalty =
      incident.severity === "Critical"
        ? 10
        : incident.severity === "Major"
        ? 5
        : 2;

    return {
      ...emp,
      incidentCount: stats.totalCases,
      openIncidentCount: stats.openCases,
      criticalIncidentCount: stats.criticalCases,
      lastIncidentDate: incident.reportedAt || incident.date,
      performanceScore: Math.max(0, currentScore - penalty),
      kpiScore: Math.max(0, currentScore - penalty),
    };
  });

  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(updatedEmployees));
}