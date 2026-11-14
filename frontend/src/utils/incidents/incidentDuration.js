// Display-only duration: do not alter incident timestamps or KPI decay inputs.
export function getIncidentDaysOpen(incident, now = Date.now()) {
  const start = new Date(incident?.reportedAt || incident?.reported_at || incident?.date || incident?.incident_date || "").getTime();
  const closed = ["closed", "resolved"].includes(String(incident?.status || "").toLowerCase());
  const end = closed
    ? new Date(incident?.closedAt || incident?.closed_at || incident?.reviewedAt || incident?.reviewed_at || incident?.review?.reviewedAt || "").getTime()
    : Number(now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86400000);
}

export function getIncidentDaysOpenLabel(incident, now = Date.now()) {
  const days = getIncidentDaysOpen(incident, now);
  if (days === null) return "Duration unavailable";
  return `${days} ${days === 1 ? "day" : "days"}`;
}
