const SEVERITY_ORDER = [
  "Minor",
  "Major",
  "Critical",
];

const STATUS_ORDER = [
  "Open",
  "Investigating",
  "For Review",
  "Closed",
];

function clean(value) {
  return String(value || "").trim();
}

function toTitleCase(value) {
  return clean(value)
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) =>
      character.toUpperCase()
    );
}

export function normalizeDashboardIncidentSeverity(value) {
  const normalized = toTitleCase(value);

  return SEVERITY_ORDER.includes(normalized)
    ? normalized
    : "Other / Unspecified";
}

export function normalizeDashboardIncidentStatus(value) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "Unspecified";
  }

  if (normalized === "for review") {
    return "For Review";
  }

  if (["resolved", "closed"].includes(normalized)) {
    return "Closed";
  }

  return toTitleCase(normalized);
}

export function buildDashboardIncidentSummary(
  incidents = [],
  companyIncidentTotal = null
) {
  const records = Array.isArray(incidents)
    ? incidents
    : [];
  const severityCounts = new Map();
  const statusCounts = new Map();

  for (const incident of records) {
    const severity =
      normalizeDashboardIncidentSeverity(
        incident?.severity
      );
    const status =
      normalizeDashboardIncidentStatus(
        incident?.status
      );

    severityCounts.set(
      severity,
      (severityCounts.get(severity) || 0) + 1
    );
    statusCounts.set(
      status,
      (statusCounts.get(status) || 0) + 1
    );
  }

  const severityRows = [
    ...SEVERITY_ORDER.map((severity) => ({
      label: severity,
      count: severityCounts.get(severity) || 0,
    })),
    ...(severityCounts.has("Other / Unspecified")
      ? [{
          label: "Other / Unspecified",
          count:
            severityCounts.get("Other / Unspecified") || 0,
        }]
      : []),
  ];
  const statusRows = [
    ...STATUS_ORDER.filter((status) =>
      statusCounts.has(status)
    ).map((status) => ({
      label: status,
      count: statusCounts.get(status) || 0,
    })),
    ...[...statusCounts.entries()]
      .filter(([status]) =>
        !STATUS_ORDER.includes(status)
      )
      .sort(([first], [second]) =>
        first.localeCompare(second)
      )
      .map(([label, count]) => ({
        label,
        count,
      })),
  ];
  const hasCompanyTotal =
    companyIncidentTotal !== null &&
    companyIncidentTotal !== undefined &&
    String(companyIncidentTotal).trim() !== "" &&
    Number.isFinite(Number(companyIncidentTotal));
  const normalizedCompanyTotal = hasCompanyTotal
    ? Number(companyIncidentTotal)
    : null;

  return {
    total: records.length,
    severityRows,
    statusRows,
    severityTotal: severityRows.reduce(
      (sum, row) => sum + row.count,
      0
    ),
    statusTotal: statusRows.reduce(
      (sum, row) => sum + row.count,
      0
    ),
    companyIncidentTotal: hasCompanyTotal
      ? normalizedCompanyTotal
      : null,
    companyDifference: hasCompanyTotal
      ? records.length - normalizedCompanyTotal
      : null,
  };
}
