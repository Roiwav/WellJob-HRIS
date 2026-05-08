const EXPIRABLE_DOCUMENTS = ["Barangay Clearance", "NBI/Police Clearance"];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isActiveIncident(status) {
  return ["open", "investigating", "for review", "for_review"].includes(
    normalizeText(status)
  );
}

function isDeployed(employee) {
  const status = normalizeText(employee?.status);
  return status === "deployed" || status === "active deployed";
}

function getIncidentDate(incident) {
  return (
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.createdAt ||
    incident?.created_at ||
    incident?.date ||
    ""
  );
}

function getEmployeeDate(employee) {
  return (
    employee?.contractStart ||
    employee?.contract_start ||
    employee?.createdAt ||
    employee?.created_at ||
    ""
  );
}

function getCurrentPeriod({ selectedYear, selectedMonth }) {
  const now = new Date();
  const currentYear = selectedYear || String(now.getFullYear());
  const currentMonth =
    Number(selectedMonth) > 0 ? Number(selectedMonth) : now.getMonth() + 1;

  return {
    year: Number(currentYear),
    month: currentMonth,
  };
}

function getPreviousPeriod(period) {
  if (period.month === 1) {
    return {
      year: period.year - 1,
      month: 12,
    };
  }

  return {
    year: period.year,
    month: period.month - 1,
  };
}

function isInPeriod(value, period) {
  const normalized = normalizeDate(value);
  if (!normalized) return false;

  const [year, month] = normalized.split("-").map(Number);

  return year === period.year && month === period.month;
}

function isInSelectedRange(value, selectedYear, selectedMonth) {
  const normalized = normalizeDate(value);
  if (!normalized) return false;

  const [year, month] = normalized.split("-").map(Number);

  if (String(year) !== String(selectedYear)) return false;
  if (Number(selectedMonth) > 0 && month !== Number(selectedMonth)) return false;

  return true;
}

function getCaseAgeInDays(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function getDocumentExpiration(doc) {
  return (
    doc?.expirationDate ||
    doc?.expiration_date ||
    doc?.expiryDate ||
    doc?.expiresAt ||
    ""
  );
}

function getDocumentName(doc) {
  return doc?.name || doc?.documentName || doc?.document_name || "Document";
}

function isExpirableDocument(doc) {
  return EXPIRABLE_DOCUMENTS.includes(getDocumentName(doc));
}

function getDaysBeforeExpiration(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getExpiringDocumentRows(employees = []) {
  const rows = [];

  employees.forEach((employee) => {
    const docs = Array.isArray(employee.documents) ? employee.documents : [];

    docs.forEach((doc) => {
      if (!isExpirableDocument(doc)) return;

      const expirationDate = getDocumentExpiration(doc);
      const daysLeft = getDaysBeforeExpiration(expirationDate);

      if (daysLeft === null) return;

      if (daysLeft >= 0 && daysLeft <= 30) {
        rows.push({
          employee: employee.name || "Unknown Employee",
          employeeId: employee.employeeId || employee.id || "-",
          company: employee.company || "Unassigned",
          document: getDocumentName(doc),
          expirationDate: formatDate(expirationDate),
          daysLeft: `${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          status: daysLeft <= 7 ? "Urgent" : "Expiring Soon",
          rawDaysLeft: daysLeft,
        });
      }
    });
  });

  return rows.sort((a, b) => a.rawDaysLeft - b.rawDaysLeft);
}

function buildComplianceBreakdown(expiringRows = []) {
  const map = {};

  expiringRows.forEach((row) => {
    map[row.document] = (map[row.document] || 0) + 1;
  });

  return Object.entries(map)
    .map(([document, count]) => ({
      document,
      count,
      recommendation:
        count >= 10
          ? "Schedule batch renewal follow-up."
          : "Send renewal reminder.",
    }))
    .sort((a, b) => b.count - a.count);
}

function buildRiskSites(incidents = []) {
  const map = {};

  incidents.forEach((incident) => {
    const company = incident.company || "Unassigned";

    if (!map[company]) {
      map[company] = {
        company,
        total: 0,
        active: 0,
        critical: 0,
        major: 0,
        minor: 0,
      };
    }

    map[company].total += 1;

    if (isActiveIncident(incident.status)) {
      map[company].active += 1;
    }

    if (incident.severity === "Critical") map[company].critical += 1;
    else if (incident.severity === "Major") map[company].major += 1;
    else map[company].minor += 1;
  });

  return Object.values(map)
    .filter((site) => site.company !== "Unassigned")
    .map((site) => ({
      ...site,
      riskScore: site.critical * 5 + site.major * 3 + site.minor,
      recommendation:
        site.critical > 0
          ? "Coordinate with client site and prioritize management review."
          : site.total >= 5
          ? "Conduct site coordination and reinforce HR monitoring."
          : "Continue regular site monitoring.",
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.total - a.total);
}

function buildPositiveSignals({ employees, incidents, utilizationRate, expiringRows }) {
  const signals = [];

  const activeIncidents = incidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const criticalIncidents = incidents.filter(
    (incident) => incident.severity === "Critical"
  );

  const activeIncidentRate =
    employees.length > 0
      ? Math.round((activeIncidents.length / employees.length) * 100)
      : 0;

  if (utilizationRate >= 85 && activeIncidentRate <= 5) {
    signals.push({
      title: "Strong deployment utilization",
      basis: `${utilizationRate}% utilization with controlled incident rate.`,
      recommendation:
        "Maintain current deployment planning and prepare backup manpower pool.",
    });
  }

  if (criticalIncidents.length === 0 && employees.length > 0) {
    signals.push({
      title: "No critical incident pattern",
      basis: "No critical incidents detected in the selected reporting scope.",
      recommendation:
        "Continue current monitoring and recognize teams maintaining discipline.",
    });
  }

  if (expiringRows.length === 0 && employees.length > 0) {
    signals.push({
      title: "Good compliance standing",
      basis: "No compliance document is expiring within 30 days.",
      recommendation:
        "Maintain document monitoring process as standard renewal practice.",
    });
  }

  const deployedByCompany = {};

  employees.forEach((employee) => {
    if (!isDeployed(employee)) return;

    const company = employee.company || "Unassigned";

    deployedByCompany[company] = (deployedByCompany[company] || 0) + 1;
  });

  const incidentsByCompany = {};

  incidents.forEach((incident) => {
    const company = incident.company || "Unassigned";
    incidentsByCompany[company] = (incidentsByCompany[company] || 0) + 1;
  });

  const stableSite = Object.entries(deployedByCompany)
    .map(([company, deployed]) => ({
      company,
      deployed,
      incidents: incidentsByCompany[company] || 0,
    }))
    .filter(
      (site) =>
        site.company !== "Unassigned" && site.deployed >= 5 && site.incidents <= 1
    )
    .sort((a, b) => b.deployed - a.deployed)[0];

  if (stableSite) {
    signals.push({
      title: `Stable client site: ${stableSite.company}`,
      basis: `${stableSite.deployed} deployed employee(s) with ${stableSite.incidents} incident record(s).`,
      recommendation:
        "Document effective site practices and replicate them to other client sites.",
    });
  }

  return signals;
}

function makeTrend(current, previous, badWhenUp = false) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;

  if (previousValue === 0 && currentValue === 0) {
    return {
      label: "No change",
      direction: "flat",
      tone: "neutral",
    };
  }

  if (previousValue === 0) {
    return {
      label: "New activity",
      direction: "up",
      tone: badWhenUp ? "bad" : "good",
    };
  }

  const diff = currentValue - previousValue;
  const percent = Math.abs(Math.round((diff / previousValue) * 100));

  if (diff === 0) {
    return {
      label: "No change",
      direction: "flat",
      tone: "neutral",
    };
  }

  const isUp = diff > 0;

  return {
    label: `${isUp ? "↑" : "↓"} ${percent}% vs last month`,
    direction: isUp ? "up" : "down",
    tone: badWhenUp ? (isUp ? "bad" : "good") : isUp ? "good" : "bad",
  };
}

function buildMoM({
  employees,
  incidents,
  currentPeriod,
  previousPeriod,
  kpis,
  utilizationRate,
}) {
  const currentEmployeeRecords = employees.filter((employee) =>
    isInPeriod(getEmployeeDate(employee), currentPeriod)
  );

  const previousEmployeeRecords = employees.filter((employee) =>
    isInPeriod(getEmployeeDate(employee), previousPeriod)
  );

  const currentDeployed = employees.filter(
    (employee) => isDeployed(employee) && isInPeriod(getEmployeeDate(employee), currentPeriod)
  );

  const previousDeployed = employees.filter(
    (employee) => isDeployed(employee) && isInPeriod(getEmployeeDate(employee), previousPeriod)
  );

  const currentIncidents = incidents.filter((incident) =>
    isInPeriod(getIncidentDate(incident), currentPeriod)
  );

  const previousIncidents = incidents.filter((incident) =>
    isInPeriod(getIncidentDate(incident), previousPeriod)
  );

  const currentActiveIncidents = currentIncidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const previousActiveIncidents = previousIncidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  return {
    total: makeTrend(currentEmployeeRecords.length, previousEmployeeRecords.length),
    deployed: makeTrend(currentDeployed.length, previousDeployed.length),
    available: {
      label: `${Number(kpis.available) || 0} floating`,
      direction: "flat",
      tone: "neutral",
    },
    utilizationRate: {
      label: `${Number(utilizationRate) || 0}% current`,
      direction: "flat",
      tone: utilizationRate >= 80 ? "good" : utilizationRate < 60 ? "bad" : "neutral",
    },
    activeIncidents: makeTrend(
      currentActiveIncidents.length,
      previousActiveIncidents.length,
      true
    ),
    expiringDocs: {
      label: `${Number(kpis.expiringDocs) || 0} due soon`,
      direction: Number(kpis.expiringDocs) > 0 ? "up" : "flat",
      tone: Number(kpis.expiringDocs) > 0 ? "bad" : "good",
    },
  };
}

function buildWorkforceHealth({
  employees,
  selectedIncidents,
  utilizationRate,
  expiringRows,
  overdueCases,
}) {
  const activeIncidents = selectedIncidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const criticalIncidents = selectedIncidents.filter(
    (incident) => incident.severity === "Critical"
  );

  const activeIncidentRate =
    employees.length > 0
      ? Math.round((activeIncidents.length / employees.length) * 100)
      : 0;

  let score = 100;
  const reasons = [];

  if (criticalIncidents.length > 0) {
    score -= 25;
    reasons.push(`${criticalIncidents.length} critical incident case(s) detected`);
  }

  if (activeIncidentRate >= 10) {
    score -= 25;
    reasons.push(`${activeIncidentRate}% active incident rate`);
  }

  if (overdueCases.length > 0) {
    score -= 15;
    reasons.push(`${overdueCases.length} case(s) older than 30 days`);
  }

  if (expiringRows.length >= 10) {
    score -= 15;
    reasons.push(`${expiringRows.length} expiring compliance document(s)`);
  }

  if (utilizationRate < 60 && employees.length > 0) {
    score -= 10;
    reasons.push(`Low deployment utilization at ${utilizationRate}%`);
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 85) {
    return {
      score,
      level: "Good",
      title: "Workforce health is good",
      summary:
        "Current workforce indicators show stable utilization, compliance, and incident monitoring.",
      reasons: reasons.length ? reasons : ["No major workforce risk detected"],
      tone: "emerald",
    };
  }

  if (score >= 70) {
    return {
      score,
      level: "Stable",
      title: "Workforce health is stable",
      summary:
        "Overall status is manageable, but selected indicators should remain under regular HR monitoring.",
      reasons,
      tone: "blue",
    };
  }

  if (score >= 50) {
    return {
      score,
      level: "Needs Attention",
      title: "Workforce health needs attention",
      summary:
        "Several operational indicators require preventive action and follow-up.",
      reasons,
      tone: "amber",
    };
  }

  return {
    score,
    level: "Critical",
    title: "Workforce health is critical",
    summary:
      "High-risk workforce indicators require immediate HR and management review.",
    reasons,
    tone: "red",
  };
}

// ================= ADAPTIVE FORECASTING ENGINE (8 CATEGORIES) =================

function getIncidentsLastNDays(incidents, days) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - days);
  pastDate.setHours(0, 0, 0, 0);

  return incidents.filter(inc => {
    const d = new Date(getIncidentDate(inc));
    return d >= pastDate && d <= today;
  });
}

// Adaptive Risk Logic: Base sa porsyento ng populasyon ng kumpanya (Adaptive sa 1,700+ employees)
function getDynamicRisk(count, range, totalEmployees) {
  const empCount = Math.max(totalEmployees, 100); 

  if (range === 'weekly') {
    const crit = Math.max(10, Math.ceil(0.01 * empCount));   // 1.0% Threshold
    const high = Math.max(5, Math.ceil(0.005 * empCount));  // 0.5% Threshold
    if (count >= crit) return { priority: "Critical", tone: "red" };
    if (count >= high) return { priority: "High", tone: "amber" };
    return { priority: "Medium", tone: "blue" };
  } else {
    const crit = Math.max(25, Math.ceil(0.03 * empCount));  // 3.0% Threshold
    const high = Math.max(12, Math.ceil(0.015 * empCount)); // 1.5% Threshold
    if (count >= crit) return { priority: "Critical", tone: "red" };
    if (count >= high) return { priority: "High", tone: "amber" };
    return { priority: "Medium", tone: "blue" };
  }
}

function generateCategoryForecast(incidents, range, totalEmployees) {
  const empCount = Math.max(totalEmployees, 100);
  // Minimum count para lumabas ang card (Weekly: 0.1% | Monthly: 0.3%)
  const minToShow = range === 'weekly' 
    ? Math.max(2, Math.ceil(0.001 * empCount)) 
    : Math.max(5, Math.ceil(0.003 * empCount));

  // 8 Major Categories ayon sa inyong Code of Conduct
  const counts = { c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0 };

  incidents.forEach((incident) => {
    const v = (incident.violation || incident.violationType || "").toLowerCase();
    
    // I. ABSENCES AND TARDINESS
    if (v.includes("awol") || v.includes("absence") || v.includes("tardiness") || v.includes("undertime") || v.includes("leave") || v.includes("abandonment")) counts.c1++;
    // II. DISORDERLY CONDUCT AND MISBEHAVIOR
    else if (v.includes("fight") || v.includes("assault") || v.includes("threat") || v.includes("misbehavior") || v.includes("quarrel") || v.includes("discourteous") || v.includes("scandal") || v.includes("gambling")) counts.c2++;
    // III. INSUBORDINATION / DISOBEDIENCE
    else if (v.includes("insubordination") || v.includes("disobey") || v.includes("refusal") || v.includes("defiance") || v.includes("disrespect")) counts.c3++;
    // IV. NEGLECT OF DUTY
    else if (v.includes("neglect") || v.includes("sleeping") || v.includes("loitering") || v.includes("careless") || v.includes("abandoning post") || v.includes("non-work")) counts.c4++;
    // V. BETRAYAL OF TRUST / DISHONESTY (Zero Tolerance)
    else if (v.includes("theft") || v.includes("steal") || v.includes("fraud") || v.includes("falsification") || v.includes("integrity") || v.includes("dishonesty") || v.includes("property damage") || v.includes("sabotage")) counts.c5++;
    // VI. HEALTH, SAFETY, SECURITY, AND SANITATION
    else if (v.includes("safety") || v.includes("ppe") || v.includes("hazard") || v.includes("smoking") || v.includes("sanitation") || v.includes("id") || v.includes("uniform")) counts.c6++;
    // VII. SEXUAL HARASSMENT (Zero Tolerance)
    else if (v.includes("harassment") || v.includes("sexual") || v.includes("lewd") || v.includes("indecent")) counts.c7++;
    // VIII. HABITUAL VIOLATIONS
    else if (v.includes("habitual") || v.includes("recurring") || v.includes("repeated")) counts.c8++;
  });

  const predictions = [];
  const addPred = (id, category, count, title, actionW, actionM, zeroTolerance = false) => {
    if (count >= (zeroTolerance ? 1 : minToShow)) {
      const risk = getDynamicRisk(count, range, totalEmployees);
      predictions.push({
        id, 
        category, 
        title, 
        count,
        action: range === 'weekly' ? actionW : actionM,
        priority: zeroTolerance ? "Critical" : risk.priority,
        tone: zeroTolerance ? "red" : risk.tone
      });
    }
  };

  addPred("c1", "I. ABSENCES AND TARDINESS", counts.c1, "Manpower Shortage Forecast", "Spike in absences detected this week. Alert standby personnel immediately.", "Consistent attendance issues this month. Review deployment schedules and shift viability.");
  addPred("c2", "II. DISORDERLY CONDUCT AND MISBEHAVIOR", counts.c2, "Workplace Harmony Risk", "Misbehavior reported recently. Intervention required to prevent site tension.", "Misconduct trend detected. Initiate site-wide Code of Conduct re-orientation.");
  addPred("c3", "III. INSUBORDINATION / DISOBEDIENCE", counts.c3, "Command Breakdown Alert", "Refusal to follow orders noted. Stern warnings required to maintain authority.", "Pattern of defiance forming. Review supervisor effectiveness and site command chain.");
  addPred("c4", "IV. NEGLECT OF DUTY", counts.c4, "Service Quality Degradation", "Duty neglect or sleeping on post detected. Immediate coaching required.", "Habitual neglect suggests low engagement. Re-assess workload or site placement.");
  addPred("c5", "V. BETRAYAL OF TRUST / DISHONESTY", counts.c5, "Security & Integrity Breach", "Dishonesty/Theft detected. Secure premises and initiate immediate investigation.", "Zero tolerance breach. Immediate replacement and legal clearance processing needed.", true);
  addPred("c6", "VI. HEALTH, SAFETY, SECURITY, AND SANITATION", counts.c6, "Liability & Hazard Alert", "Safety violation reported. Correct immediately to prevent accidents or penalties.", "Consistent safety non-compliance. Schedule mandatory safety refresher for the team.");
  addPred("c7", "VII. SEXUAL HARASSMENT", counts.c7, "Legal & Compliance Risk", "Harassment complaint detected. Enforce preventive suspension immediately.", "Harassment case recorded. Review site security and legal compliance protocols.", true);
  addPred("c8", "VIII. HABITUAL VIOLATIONS", counts.c8, "Policy Failure Forecast", "Employee reaching habitual status. Prepare disciplinary committee review.", "Pattern of recidivism detected. Systematic review of disciplinary history required.");

  return predictions.sort((a, b) => b.count - a.count);
}

// ==========================================================

function buildRowsForIncidents(incidents = []) {
  return incidents.map((incident) => ({
    id: incident.id || "-",
    employee: incident.employee || incident.employeeName || "Unknown Employee",
    company: incident.company || "Unassigned",
    violation:
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "No violation type",
    severity: incident.severity || "Minor",
    status: incident.status || "Open",
    date: formatDate(getIncidentDate(incident)),
    age: `${getCaseAgeInDays(getIncidentDate(incident))} day(s)`,
  }));
}

function buildUtilizationRows(employees = []) {
  const map = {};

  employees.forEach((employee) => {
    const company = employee.company || "Unassigned";

    if (!map[company]) {
      map[company] = {
        company,
        deployed: 0,
        available: 0,
        total: 0,
      };
    }

    map[company].total += 1;

    if (isDeployed(employee)) map[company].deployed += 1;
    else map[company].available += 1;
  });

  return Object.values(map)
    .map((row) => ({
      ...row,
      utilization: row.total > 0 ? `${Math.round((row.deployed / row.total) * 100)}%` : "0%",
    }))
    .sort((a, b) => b.total - a.total);
}

export function buildDashboardInsights({
  employees = [],
  incidents = [],
  selectedYear,
  selectedMonth,
  kpis = {},
  utilizationRate = 0,
}) {
  const currentPeriod = getCurrentPeriod({ selectedYear, selectedMonth });
  const previousPeriod = getPreviousPeriod(currentPeriod);

  const selectedIncidents = incidents.filter((incident) =>
    isInSelectedRange(getIncidentDate(incident), selectedYear, selectedMonth)
  );

  const activeIncidents = selectedIncidents.filter((incident) =>
    isActiveIncident(incident.status)
  );

  const overdueCases = activeIncidents.filter(
    (incident) => getCaseAgeInDays(getIncidentDate(incident)) > 30
  );

  const caseAging = {
    zeroToSeven: activeIncidents.filter(
      (incident) => getCaseAgeInDays(getIncidentDate(incident)) <= 7
    ).length,
    eightToThirty: activeIncidents.filter((incident) => {
      const age = getCaseAgeInDays(getIncidentDate(incident));
      return age >= 8 && age <= 30;
    }).length,
    overThirty: overdueCases.length,
    recommendation:
      overdueCases.length > 0
        ? "Prioritize HR case review for cases older than 30 days."
        : "Current case aging is within normal monitoring range.",
  };

  const expiringRows = getExpiringDocumentRows(employees);
  const complianceBreakdown = buildComplianceBreakdown(expiringRows);
  const riskSites = buildRiskSites(selectedIncidents);
  const positiveSignals = buildPositiveSignals({
    employees,
    incidents: selectedIncidents,
    utilizationRate,
    expiringRows,
  });

  const health = buildWorkforceHealth({
    employees,
    selectedIncidents,
    utilizationRate,
    expiringRows,
    overdueCases,
  });

  const mom = buildMoM({
    employees,
    incidents,
    currentPeriod,
    previousPeriod,
    kpis,
    utilizationRate,
  });

  // I-pass natin ang kabuuang bilang ng mga empleyado at BUONG raw incidents list
  const totalEmployees = employees.length;
  const incidentsLast7Days = getIncidentsLastNDays(incidents, 7);
  const incidentsLast30Days = getIncidentsLastNDays(incidents, 30);

  const predictions = {
    weekly: generateCategoryForecast(incidentsLast7Days, 'weekly', totalEmployees),
    monthly: generateCategoryForecast(incidentsLast30Days, 'monthly', totalEmployees),
    totalEmployees: totalEmployees,
  };

  return {
    health,
    mom,
    riskSites,
    caseAging,
    complianceBreakdown,
    positiveSignals,
    predictions, 
    drilldowns: {
      utilizationRate: {
        title: "Deployment Utilization Details",
        description: "Company-level deployment and availability distribution.",
        columns: [
          { key: "company", label: "Company" },
          { key: "deployed", label: "Deployed" },
          { key: "available", label: "Available" },
          { key: "total", label: "Total" },
          { key: "utilization", label: "Utilization" },
        ],
        rows: buildUtilizationRows(employees),
      },
      expiringDocuments: {
        title: "Expiring Compliance Documents",
        description: "Employee compliance documents due within 30 days.",
        columns: [
          { key: "employeeId", label: "Employee ID" },
          { key: "employee", label: "Employee" },
          { key: "company", label: "Company" },
          { key: "document", label: "Document" },
          { key: "expirationDate", label: "Expiration" },
          { key: "daysLeft", label: "Days Left" },
          { key: "status", label: "Status" },
        ],
        rows: expiringRows,
      },
      riskSites: {
        title: "Top Risk Client Sites",
        description: "Client companies with the highest incident concentration in the selected report scope.",
        columns: [
          { key: "company", label: "Company" },
          { key: "total", label: "Total Cases" },
          { key: "active", label: "Active" },
          { key: "critical", label: "Critical" },
          { key: "major", label: "Major" },
          { key: "recommendation", label: "Recommendation" },
        ],
        rows: riskSites,
      },
      overdueCases: {
        title: "Overdue Case Aging",
        description: "Active cases that are older than 30 days.",
        columns: [
          { key: "id", label: "Case ID" },
          { key: "employee", label: "Employee" },
          { key: "company", label: "Company" },
          { key: "violation", label: "Violation" },
          { key: "severity", label: "Severity" },
          { key: "status", label: "Status" },
          { key: "age", label: "Age" },
        ],
        rows: buildRowsForIncidents(overdueCases),
      },
      complianceBreakdown: {
        title: "Compliance Breakdown",
        description: "Document types with upcoming expiration concerns.",
        columns: [
          { key: "document", label: "Document" },
          { key: "count", label: "Expiring Count" },
          { key: "recommendation", label: "Recommended Action" },
        ],
        rows: complianceBreakdown,
      },
      positiveSignals: {
        title: "Positive Performance Signals",
        description: "Workforce practices worth maintaining, recognizing, or replicating.",
        columns: [
          { key: "title", label: "Positive Signal" },
          { key: "basis", label: "Basis" },
          { key: "recommendation", label: "Recommendation" },
        ],
        rows: positiveSignals,
      },
    },
  };
}