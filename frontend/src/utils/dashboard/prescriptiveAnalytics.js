function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isActiveIncident(status) {
  const normalized = normalizeText(status);

  return [
    "open",
    "investigating",
    "for review",
    "for_review",
  ].includes(normalized);
}

function getIncidentCompany(incident) {
  return (
    incident.company ||
    incident.clientCompany ||
    "Unassigned"
  );
}

function getTopCompanyByIncidents(incidents = []) {
  const companyMap = {};

  incidents.forEach((incident) => {
    const company =
      getIncidentCompany(incident);

    companyMap[company] =
      (companyMap[company] || 0) + 1;
  });

  const sorted =
    Object.entries(companyMap).sort(
      (a, b) => b[1] - a[1]
    );

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

    violationMap[violation] =
      (violationMap[violation] || 0) + 1;
  });

  const sorted =
    Object.entries(violationMap).sort(
      (a, b) => b[1] - a[1]
    );

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

function getRatePercent(count, total) {
  const safeCount =
    Number(count) || 0;
  const safeTotal =
    Number(total) || 0;

  if (safeTotal <= 0) {
    return 0;
  }

  return Number(
    (
      (safeCount / safeTotal) *
      100
    ).toFixed(1)
  );
}

function sortActions(actions) {
  const priorityOrder = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return [...actions].sort((a, b) => {
    const priorityA =
      priorityOrder[a.priority] || 99;
    const priorityB =
      priorityOrder[b.priority] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

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

  const totalEmployees =
    Number(kpis.total) ||
    employees.length ||
    0;

  const expiringDocs =
    Number(kpis.expiringDocs) || 0;

  const activeIncidents =
    incidents.filter((incident) =>
      isActiveIncident(
        incident.status
      )
    );

  const criticalIncidents =
    activeIncidents.filter(
      (incident) =>
        normalizeText(
          incident.severity
        ) === "critical"
    );

  const majorIncidents =
    activeIncidents.filter(
      (incident) =>
        normalizeText(
          incident.severity
        ) === "major"
    );

  const topCompany =
    getTopCompanyByIncidents(
      activeIncidents
    );

  const topViolation =
    getTopViolation(
      activeIncidents
    );

  const activeIncidentRate =
    getRatePercent(
      activeIncidents.length,
      totalEmployees
    );

  const criticalIncidentRate =
    getRatePercent(
      criticalIncidents.length,
      totalEmployees
    );

  if (criticalIncidents.length > 0) {
    actions.push({
      id: "critical-incident-review",
      type: "Incident",
      priority: "High",
      mode: "corrective",
      title:
        "Critical active cases detected",
      recommendation:
        "Prioritize authorized management review for active critical cases and monitor the documented corrective-action process until closure.",
      basis:
        `${criticalIncidents.length} active critical case(s) detected, representing ${criticalIncidentRate}% of the current workforce.`,
    });
  }

  if (activeIncidentRate >= 10) {
    actions.push({
      id: "active-incident-surge",
      type: "Policy",
      priority: "High",
      mode: "corrective",
      title:
        "High active incident rate detected",
      recommendation:
        "Coordinate an HR management review, reinforce case monitoring, and determine appropriate preventive measures under current company policy.",
      basis:
        `${activeIncidentRate}% of the current workforce has an open, investigating, or for-review case.`,
    });
  } else if (
    activeIncidents.length >= 5
  ) {
    actions.push({
      id: "incident-follow-up",
      type: "Incident",
      priority: "Medium",
      mode: "preventive",
      title:
        "Multiple active cases require follow-up",
      recommendation:
        "Assign authorized HR personnel to review pending cases regularly and ensure that case status, resolution notes, and supporting proof remain updated until closure.",
      basis:
        `${activeIncidents.length} active incident case(s) currently require monitoring.`,
    });
  }

  if (topViolation.count >= 5) {
    actions.push({
      id: "top-violation-policy",
      type: "Trend",
      priority: "Medium",
      mode: "preventive",
      title:
        `Recurring active violation trend: ${topViolation.violation}`,
      recommendation:
        "Review the related policy and conduct a focused orientation, reminder, or preventive HR intervention for the recurring violation.",
      basis:
        `${topViolation.count} active case(s) are related to ${topViolation.violation}.`,
    });
  }

  if (
    topCompany.count >= 5 &&
    topCompany.company !==
      "Unassigned"
  ) {
    actions.push({
      id: "client-site-optimization",
      type: "Deployment",
      priority: "Medium",
      mode: "corrective",
      title:
        `High active incident concentration at ${topCompany.company}`,
      recommendation:
        "Coordinate with the client site and review supervision, working conditions, deployment assignments, and other operational factors that may require HR attention.",
      basis:
        `${topCompany.count} active incident case(s) are linked to ${topCompany.company}.`,
    });
  }

  if (majorIncidents.length >= 10) {
    actions.push({
      id: "training-resource-allocation",
      type: "Policy",
      priority: "Medium",
      mode: "preventive",
      title:
        "Major active case volume suggests training need",
      recommendation:
        "Consider focused policy reinforcement, work-ethics guidance, attendance discipline, or role-specific refresher sessions based on the affected cases.",
      basis:
        `${majorIncidents.length} active major case(s) detected.`,
    });
  }

  if (
    utilizationRate < 60 &&
    totalEmployees > 0
  ) {
    actions.push({
      id: "deployment-utilization",
      type: "Deployment",
      priority: "Low",
      mode: "preventive",
      title:
        "Low deployment utilization rate",
      recommendation:
        "Review floating employees and coordinate with client companies regarding suitable redeployment opportunities.",
      basis:
        `Current utilization rate is ${utilizationRate}%.`,
    });
  }

  if (expiringDocs >= 10) {
    actions.push({
      id: "document-compliance",
      type: "Compliance",
      priority: "Medium",
      mode: "preventive",
      title:
        "High number of expiring compliance documents",
      recommendation:
        "Prioritize compliance follow-up and remind affected employees to submit renewed documents before expiration.",
      basis:
        `${expiringDocs} compliance document(s) are expiring within the monitored window.`,
    });
  } else if (expiringDocs > 0) {
    actions.push({
      id: "document-reminder",
      type: "Compliance",
      priority: "Low",
      mode: "preventive",
      title:
        "Compliance document renewal needed",
      recommendation:
        "Send renewal reminders to employees with upcoming document expiration dates.",
      basis:
        `${expiringDocs} compliance document(s) require renewal monitoring.`,
    });
  }

  return sortActions(
    actions
  ).slice(0, 6);
}