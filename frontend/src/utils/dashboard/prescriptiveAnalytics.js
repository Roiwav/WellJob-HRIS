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
    return {
      company: "N/A",
      count: 0,
    };
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
    return {
      violation: "N/A",
      count: 0,
    };
  }

  return {
    violation: sorted[0][0],
    count: sorted[0][1],
  };
}

export function buildExecutiveActionItems({
  employees = [],
  incidents = [],
  kpis = {},
  utilizationRate = 0,
}) {
  const actions = [];

  const totalEmployees = Number(kpis.total) || employees.length || 0;
  const activeIncidents = incidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const criticalIncidents = incidents.filter(
    (incident) => incident.severity === "Critical"
  );

  const majorIncidents = incidents.filter(
    (incident) => incident.severity === "Major"
  );

  const expiringDocs = Number(kpis.expiringDocs) || 0;

  const topCompany = getTopCompanyByIncidents(incidents);
  const topViolation = getTopViolation(incidents);

  const activeIncidentRate =
    totalEmployees > 0
      ? Math.round((activeIncidents.length / totalEmployees) * 100)
      : 0;

  if (criticalIncidents.length > 0) {
    actions.push({
      id: "critical-incident-review",
      type: "Incident",
      priority: "High",
      title: "Critical incident cases detected",
      recommendation:
        "Conduct immediate management review for critical cases and prioritize disciplinary action tracking until resolution.",
      basis: `${criticalIncidents.length} critical incident case(s) found in the current records.`,
    });
  }

  if (activeIncidentRate >= 10) {
    actions.push({
      id: "active-incident-surge",
      type: "Policy",
      priority: "High",
      title: "High active incident rate detected",
      recommendation:
        "Issue an HR advisory and implement stricter monitoring for the next 30 days to reduce unresolved incident cases.",
      basis: `${activeIncidentRate}% of active workforce has open, investigating, or for-review cases.`,
    });
  } else if (activeIncidents.length >= 5) {
    actions.push({
      id: "incident-follow-up",
      type: "Incident",
      priority: "Medium",
      title: "Multiple active cases require follow-up",
      recommendation:
        "Assign HR personnel to review pending cases weekly and ensure case status is updated until closure.",
      basis: `${activeIncidents.length} active incident case(s) currently require monitoring.`,
    });
  }

  if (topViolation.count >= 5) {
    actions.push({
      id: "top-violation-policy",
      type: "Trend",
      priority: "Medium",
      title: `Recurring violation trend: ${topViolation.violation}`,
      recommendation:
        "Review related company policies and consider conducting a focused orientation or memo campaign for this recurring violation.",
      basis: `${topViolation.count} record(s) are related to ${topViolation.violation}.`,
    });
  }

  if (topCompany.count >= 5 && topCompany.company !== "Unassigned") {
    actions.push({
      id: "client-site-optimization",
      type: "Deployment",
      priority: "Medium",
      title: `High incident concentration at ${topCompany.company}`,
      recommendation:
        "Coordinate with the client site, conduct a site visit, and evaluate whether supervision, work conditions, or deployment assignments need adjustment.",
      basis: `${topCompany.count} incident record(s) are linked to ${topCompany.company}.`,
    });
  }

  if (majorIncidents.length >= 10) {
    actions.push({
      id: "training-resource-allocation",
      type: "Policy",
      priority: "Medium",
      title: "Major incident volume suggests training need",
      recommendation:
        "Allocate HR training resources for policy reinforcement, work ethics, and quality-of-work refresher sessions.",
      basis: `${majorIncidents.length} major incident case(s) detected.`,
    });
  }

  if (utilizationRate < 60 && totalEmployees > 0) {
    actions.push({
      id: "deployment-utilization",
      type: "Deployment",
      priority: "Low",
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
      title: "Compliance document renewal needed",
      recommendation:
        "Send reminders to employees with upcoming document expiration dates.",
      basis: `${expiringDocs} compliance document(s) require renewal monitoring.`,
    });
  }

  if (actions.length === 0 && totalEmployees > 0) {
    actions.push({
      id: "stable-workforce",
      type: "Good",
      priority: "Good",
      title: "Workforce status is within normal range",
      recommendation:
        "Continue regular HR monitoring and maintain current deployment and compliance review practices.",
      basis:
        "No critical incident surge, major compliance risk, or low utilization signal detected.",
    });
  }

  return actions.slice(0, 6);
}