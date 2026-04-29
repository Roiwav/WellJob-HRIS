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

function getStableCompanySite({ employees = [], incidents = [] }) {
  const deployedMap = {};
  const incidentMap = {};

  employees.forEach((employee) => {
    const company = employee.company || "Unassigned";
    const status = normalizeText(employee.status);

    if (status === "deployed" || status === "active deployed") {
      deployedMap[company] = (deployedMap[company] || 0) + 1;
    }
  });

  incidents.forEach((incident) => {
    const company = getIncidentCompany(incident);
    incidentMap[company] = (incidentMap[company] || 0) + 1;
  });

  const stableSites = Object.entries(deployedMap)
    .map(([company, deployedCount]) => ({
      company,
      deployedCount,
      incidentCount: incidentMap[company] || 0,
    }))
    .filter(
      (site) =>
        site.company !== "Unassigned" &&
        site.deployedCount >= 5 &&
        site.incidentCount <= 1
    )
    .sort((a, b) => b.deployedCount - a.deployedCount);

  return stableSites[0] || null;
}

function sortActions(actions) {
  const priorityOrder = {
    High: 1,
    Medium: 2,
    Low: 3,
    Good: 4,
  };

  return [...actions].sort((a, b) => {
    const priorityA = priorityOrder[a.priority] || 99;
    const priorityB = priorityOrder[b.priority] || 99;

    if (priorityA !== priorityB) return priorityA - priorityB;

    if (a.mode === "positive" && b.mode !== "positive") return 1;
    if (a.mode !== "positive" && b.mode === "positive") return -1;

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
  const deployedEmployees = Number(kpis.deployed) || 0;
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
  const stableSite = getStableCompanySite({ employees, incidents });

  const activeIncidentRate =
    totalEmployees > 0
      ? Math.round((activeIncidents.length / totalEmployees) * 100)
      : 0;

  const criticalIncidentRate =
    totalEmployees > 0
      ? Math.round((criticalIncidents.length / totalEmployees) * 100)
      : 0;

  // =========================
  // CORRECTIVE / PREVENTIVE ACTIONS
  // =========================

  if (criticalIncidents.length > 0) {
    actions.push({
      id: "critical-incident-review",
      type: "Incident",
      priority: "High",
      mode: "corrective",
      title: "Critical incident cases detected",
      recommendation:
        "Prioritize management review for critical cases and monitor disciplinary action progress until closure.",
      basis: `${criticalIncidents.length} critical incident case(s) detected. Critical incident rate is ${criticalIncidentRate}%.`,
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
      title: `Recurring violation trend: ${topViolation.violation}`,
      recommendation:
        "Review the related policy and conduct a focused orientation or memo campaign for this recurring violation.",
      basis: `${topViolation.count} record(s) are related to ${topViolation.violation}.`,
    });
  }

  if (topCompany.count >= 5 && topCompany.company !== "Unassigned") {
    actions.push({
      id: "client-site-optimization",
      type: "Deployment",
      priority: "Medium",
      mode: "corrective",
      title: `High incident concentration at ${topCompany.company}`,
      recommendation:
        "Coordinate with the client site, conduct a site visit, and evaluate supervision, work conditions, or deployment assignments.",
      basis: `${topCompany.count} incident record(s) are linked to ${topCompany.company}.`,
    });
  }

  if (majorIncidents.length >= 10) {
    actions.push({
      id: "training-resource-allocation",
      type: "Policy",
      priority: "Medium",
      mode: "preventive",
      title: "Major incident volume suggests training need",
      recommendation:
        "Allocate HR training resources for policy reinforcement, work ethics, attendance discipline, and quality-of-work refresher sessions.",
      basis: `${majorIncidents.length} major incident case(s) detected.`,
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

  // =========================
  // POSITIVE / REINFORCEMENT ACTIONS
  // =========================

  if (
    totalEmployees > 0 &&
    utilizationRate >= 85 &&
    activeIncidentRate <= 5
  ) {
    actions.push({
      id: "strong-utilization-low-risk",
      type: "Reinforcement",
      priority: "Good",
      mode: "positive",
      title: "Strong deployment utilization with controlled incident risk",
      recommendation:
        "Maintain the current deployment strategy and prepare a backup manpower pool to sustain client coverage.",
      basis: `${utilizationRate}% utilization rate with only ${activeIncidentRate}% active incident rate.`,
    });
  }

  if (totalEmployees > 0 && criticalIncidents.length === 0) {
    actions.push({
      id: "zero-critical-incidents",
      type: "Reinforcement",
      priority: "Good",
      mode: "positive",
      title: "No critical incident pattern detected",
      recommendation:
        "Continue current HR monitoring practices and recognize teams maintaining discipline and compliance.",
      basis: "There are no critical incident records in the current dataset.",
    });
  }

  if (totalEmployees > 0 && expiringDocs === 0) {
    actions.push({
      id: "strong-compliance-standing",
      type: "Compliance",
      priority: "Good",
      mode: "positive",
      title: "Good compliance standing detected",
      recommendation:
        "Maintain the current document monitoring process and use it as the standard for future onboarding and renewal checks.",
      basis: "No compliance documents are expiring within the monitored period.",
    });
  }

  if (stableSite) {
    actions.push({
      id: "stable-client-site",
      type: "Deployment",
      priority: "Good",
      mode: "positive",
      title: `Stable client site performance at ${stableSite.company}`,
      recommendation:
        "Document the effective practices used at this client site and consider applying them to other deployment locations.",
      basis: `${stableSite.deployedCount} deployed employee(s) with only ${stableSite.incidentCount} incident record(s).`,
    });
  }

  if (
    totalEmployees > 0 &&
    deployedEmployees > 0 &&
    activeIncidentRate <= 3 &&
    criticalIncidents.length === 0
  ) {
    actions.push({
      id: "stable-workforce-monitoring",
      type: "Good",
      priority: "Good",
      mode: "positive",
      title: "Workforce monitoring is stable",
      recommendation:
        "Continue regular KPI review and maintain the current HR monitoring cadence for the next reporting cycle.",
      basis: `Active incident rate is ${activeIncidentRate}% with no critical incident pattern detected.`,
    });
  }

  if (actions.length === 0 && totalEmployees > 0) {
    actions.push({
      id: "normal-range",
      type: "Good",
      priority: "Good",
      mode: "positive",
      title: "Workforce status is within normal range",
      recommendation:
        "Continue regular HR monitoring and maintain current deployment, compliance, and incident review practices.",
      basis:
        "No critical incident surge, major compliance risk, or low utilization signal detected.",
    });
  }

  return sortActions(actions).slice(0, 6);
}