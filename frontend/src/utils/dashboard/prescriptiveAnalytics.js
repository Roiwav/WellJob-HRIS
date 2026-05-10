function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isActiveIncident(status) {
  const normalized = normalizeText(status);

  return ["open", "investigating", "for review", "for_review"].includes(
    normalized
  );
}

function getIncidentCompany(incident) {
  return incident.company || incident.clientCompany || "Unassigned";
}

function getTopCompanyByIncidents(incidents = []) {
  const companyMap = {};

  incidents.forEach((incident) => {
    const company = getIncidentCompany(incident);
    companyMap[company] = (companyMap[company] || 0) + 1;
  });

  const sorted = Object.entries(companyMap).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return { company: "N/A", count: 0 };
  }

  return {
    company: sorted[0][0],
    count: sorted[0][1],
  };
}

function getTopViolation(incidents = []) {
  const violationMap = {};

  incidents.forEach((incident) => {
    const violation =
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "Unspecified Violation";

    violationMap[violation] = (violationMap[violation] || 0) + 1;
  });

  const sorted = Object.entries(violationMap).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return { violation: "N/A", count: 0 };
  }

  return {
    violation: sorted[0][0],
    count: sorted[0][1],
  };
}

function sortActions(actions) {
  const priorityOrder = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return [...actions].sort((a, b) => {
    const priorityA = priorityOrder[a.priority] || 99;
    const priorityB = priorityOrder[b.priority] || 99;

    if (priorityA !== priorityB) return priorityA - priorityB;

    return 0;
  });
}

export function buildExecutiveActionItems({
  employees = [],
  incidents = [],
  kpis = {},
  utilizationRate = 0,
}) {
  const actions = [];

  const totalEmployees = Number(kpis.total) || employees.length || 0;
  const expiringDocs = Number(kpis.expiringDocs) || 0;

  // Management Prescriptive Insights should focus only on current unresolved cases.
  // Closed incidents remain in history/KPI records, but are excluded from this action queue.
  const activeIncidents = incidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const criticalIncidents = activeIncidents.filter(
    (incident) => incident.severity === "Critical"
  );

  const majorIncidents = activeIncidents.filter(
    (incident) => incident.severity === "Major"
  );

  const topCompany = getTopCompanyByIncidents(activeIncidents);
  const topViolation = getTopViolation(activeIncidents);

  const activeIncidentRate =
    totalEmployees > 0
      ? Math.round((activeIncidents.length / totalEmployees) * 100)
      : 0;

  const criticalIncidentRate =
    totalEmployees > 0
      ? Math.round((criticalIncidents.length / totalEmployees) * 100)
      : 0;

  if (criticalIncidents.length > 0) {
    actions.push({
      id: "critical-incident-review",
      type: "Incident",
      priority: "High",
      mode: "corrective",
      title: "Critical active cases detected",
      recommendation:
        "Prioritize management review for active critical cases and monitor disciplinary action progress until closure.",
      basis: `${criticalIncidents.length} active critical case(s) detected. Active critical incident rate is ${criticalIncidentRate}%.`,
    });
  }

  if (activeIncidentRate >= 10) {
    actions.push({
      id: "active-incident-surge",
      type: "Policy",
      priority: "High",
      mode: "corrective",
      title: "High active incident rate detected",
      recommendation:
        "Issue an HR advisory and implement stricter monitoring for the next 30 days to reduce unresolved cases.",
      basis: `${activeIncidentRate}% of the active workforce has open, investigating, or for-review cases.`,
    });
  } else if (activeIncidents.length >= 5) {
    actions.push({
      id: "incident-follow-up",
      type: "Incident",
      priority: "Medium",
      mode: "preventive",
      title: "Multiple active cases require follow-up",
      recommendation:
        "Assign HR personnel to review pending cases weekly and ensure that every case status is updated until closure.",
      basis: `${activeIncidents.length} active incident case(s) currently require monitoring.`,
    });
  }

  if (topViolation.count >= 5) {
    actions.push({
      id: "top-violation-policy",
      type: "Trend",
      priority: "Medium",
      mode: "preventive",
      title: `Recurring active violation trend: ${topViolation.violation}`,
      recommendation:
        "Review the related policy and conduct a focused orientation or memo campaign for this recurring active violation.",
      basis: `${topViolation.count} active case(s) are related to ${topViolation.violation}.`,
    });
  }

  if (topCompany.count >= 5 && topCompany.company !== "Unassigned") {
    actions.push({
      id: "client-site-optimization",
      type: "Deployment",
      priority: "Medium",
      mode: "corrective",
      title: `High active incident concentration at ${topCompany.company}`,
      recommendation:
        "Coordinate with the client site, conduct a site visit, and evaluate supervision, work conditions, or deployment assignments.",
      basis: `${topCompany.count} active incident case(s) are linked to ${topCompany.company}.`,
    });
  }

  if (majorIncidents.length >= 10) {
    actions.push({
      id: "training-resource-allocation",
      type: "Policy",
      priority: "Medium",
      mode: "preventive",
      title: "Major active case volume suggests training need",
      recommendation:
        "Allocate HR training resources for policy reinforcement, work ethics, attendance discipline, and quality-of-work refresher sessions.",
      basis: `${majorIncidents.length} active major case(s) detected.`,
    });
  }

  if (utilizationRate < 60 && totalEmployees > 0) {
    actions.push({
      id: "deployment-utilization",
      type: "Deployment",
      priority: "Low",
      mode: "preventive",
      title: "Low deployment utilization rate",
      recommendation:
        "Review floating employees and coordinate with client companies for possible redeployment opportunities.",
      basis: `Current utilization rate is ${utilizationRate}%.`,
    });
  }

  if (expiringDocs >= 10) {
    actions.push({
      id: "document-compliance",
      type: "Compliance",
      priority: "Medium",
      mode: "preventive",
      title: "High number of expiring compliance documents",
      recommendation:
        "Schedule a compliance follow-up campaign and notify employees with documents expiring within 30 days.",
      basis: `${expiringDocs} compliance document(s) are expiring soon.`,
    });
  } else if (expiringDocs > 0) {
    actions.push({
      id: "document-reminder",
      type: "Compliance",
      priority: "Low",
      mode: "preventive",
      title: "Compliance document renewal needed",
      recommendation:
        "Send reminders to employees with upcoming document expiration dates.",
      basis: `${expiringDocs} compliance document(s) require renewal monitoring.`,
    });
  }

  return sortActions(actions).slice(0, 6);
}