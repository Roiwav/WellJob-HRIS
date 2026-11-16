export const DASHBOARD_REPORTING_YEARS = Object.freeze([
  2026,
  2025,
]);

export function normalizeDashboardReportingYear(
  value,
  fallback = DASHBOARD_REPORTING_YEARS[0]
) {
  const year = Number(value);

  return DASHBOARD_REPORTING_YEARS.includes(year)
    ? year
    : fallback;
}

export function buildDashboardWorkforceRequestUrl(
  baseUrl,
  {
    selectedMonth,
    selectedYear,
  }
) {
  const params = new URLSearchParams({
    month:
      Number(selectedMonth) === 0
        ? "all"
        : String(Number(selectedMonth) - 1),
    year: String(
      normalizeDashboardReportingYear(selectedYear)
    ),
  });

  return `${baseUrl}?${params.toString()}`;
}

export function isLatestDashboardRequest(
  requestId,
  latestRequestId
) {
  return requestId === latestRequestId;
}

export function shouldShowDashboardReportingPanels({
  selectedMonth,
  selectedYear,
  currentYear,
}) {
  const currentSupportedReportingYear =
    normalizeDashboardReportingYear(currentYear);

  return !(
    Number(selectedMonth) === 0 &&
    Number(selectedYear) ===
      currentSupportedReportingYear
  );
}

export function getDashboardPeriodLabel({
  selectedMonth,
  selectedYear,
  report,
  monthNames = [],
}) {
  const normalizedYear =
    normalizeDashboardReportingYear(selectedYear);
  const reportYear = Number(report?.filters?.year);
  const reportMonth = report?.filters?.month;
  const expectedMonth =
    Number(selectedMonth) === 0
      ? null
      : Number(selectedMonth) - 1;

  if (
    reportYear === normalizedYear &&
    reportMonth === expectedMonth &&
    report?.filters?.label
  ) {
    return String(report.filters.label);
  }

  if (Number(selectedMonth) === 0) {
    return `Full Year ${normalizedYear}`;
  }

  return `${
    monthNames[Number(selectedMonth) - 1] || "Selected Month"
  } ${normalizedYear}`;
}
