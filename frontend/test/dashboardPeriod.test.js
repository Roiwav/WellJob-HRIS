import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DASHBOARD_REPORTING_YEARS,
  buildDashboardWorkforceRequestUrl,
  getDashboardPeriodLabel,
  isLatestDashboardRequest,
  normalizeDashboardReportingYear,
  shouldShowDashboardReportingPanels,
} from "../src/utils/dashboard/dashboardPeriod.js";

const testDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);
const dashboardSource = fs.readFileSync(
  path.resolve(
    testDirectory,
    "../src/pages/Dashboard.jsx"
  ),
  "utf8"
);
const kpiCardsSource = fs.readFileSync(
  path.resolve(
    testDirectory,
    "../src/components/dashboard/cards/KPICards.jsx"
  ),
  "utf8"
);

test("Dashboard reporting years are limited to 2025 and 2026", () => {
  assert.deepEqual(DASHBOARD_REPORTING_YEARS, [2026, 2025]);
  assert.equal(normalizeDashboardReportingYear("2025"), 2025);
  assert.equal(normalizeDashboardReportingYear("2026"), 2026);
  assert.equal(normalizeDashboardReportingYear("1998"), 2026);
  assert.match(
    dashboardSource,
    /setSelectedYear\(nextYear\)/
  );
  assert.match(
    dashboardSource,
    /availableYears =\s*DASHBOARD_REPORTING_YEARS/
  );
});

test("Dashboard workforce requests preserve selected month and year", () => {
  assert.equal(
    buildDashboardWorkforceRequestUrl("/api/dashboard/monthly-workforce", {
      selectedMonth: 5,
      selectedYear: 2025,
    }),
    "/api/dashboard/monthly-workforce?month=4&year=2025"
  );
  assert.equal(
    buildDashboardWorkforceRequestUrl("/api/dashboard/monthly-workforce", {
      selectedMonth: 0,
      selectedYear: 2026,
    }),
    "/api/dashboard/monthly-workforce?month=all&year=2026"
  );
});

test("Dashboard uses the matching backend period label for UI and PDF scope", () => {
  assert.equal(
    getDashboardPeriodLabel({
      selectedMonth: 0,
      selectedYear: 2026,
      report: {
        filters: {
          month: null,
          year: 2026,
          label: "Year to Date 2026 (as of November 16, 2026)",
        },
      },
    }),
    "Year to Date 2026 (as of November 16, 2026)"
  );
});

test("only the latest Dashboard period request may update rendered results", () => {
  assert.equal(isLatestDashboardRequest(4, 5), false);
  assert.equal(isLatestDashboardRequest(5, 5), true);
});

test("Dashboard restores the live KPI structure without an extra overview heading", () => {
  assert.doesNotMatch(
    dashboardSource,
    /Current Workforce Snapshot/
  );
  assert.doesNotMatch(
    dashboardSource,
    /Latest authorized workforce, active incident, and compliance figures/
  );
  assert.doesNotMatch(
    dashboardSource,
    /Client Company Summary|Workforce totals for each client company in the selected period/
  );
  assert.doesNotMatch(dashboardSource, />\s*Workforce Overview\s*</);
  assert.match(dashboardSource, /<KPICards/);
  assert.match(dashboardSource, /<WorkforceHealthBanner/);
  assert.doesNotMatch(dashboardSource, /Company Breakdown/);
  assert.match(
    dashboardSource,
    /<MonthlyWorkforceSummary[\s\S]*report=\{[\s\S]*monthlyWorkforceReport/
  );
  assert.doesNotMatch(
    dashboardSource,
    /All Months is selected\. The charts and trends below cover the full selected year/
  );
});

test("reporting panel visibility follows the current filter values", () => {
  assert.equal(
    shouldShowDashboardReportingPanels({
      selectedMonth: 0,
      selectedYear: 2026,
      currentYear: 2026,
    }),
    false
  );
  assert.equal(
    shouldShowDashboardReportingPanels({
      selectedMonth: 6,
      selectedYear: 2026,
      currentYear: 2026,
    }),
    true
  );
  assert.equal(
    shouldShowDashboardReportingPanels({
      selectedMonth: 0,
      selectedYear: 2025,
      currentYear: 2026,
    }),
    true
  );
  assert.equal(
    shouldShowDashboardReportingPanels({
      selectedMonth: 6,
      selectedYear: 2025,
      currentYear: 2026,
    }),
    true
  );
  assert.equal(
    shouldShowDashboardReportingPanels({
      selectedMonth: "0",
      selectedYear: "2026",
      currentYear: "2026",
    }),
    false
  );
  assert.doesNotMatch(dashboardSource, /hasUserChangedReportingPeriod/);
  assert.match(
    dashboardSource,
    /shouldShowDashboardReportingPanels\(\{[\s\S]*selectedMonth,[\s\S]*selectedYear,[\s\S]*currentYear,[\s\S]*\}\)/
  );
  assert.match(
    dashboardSource,
    /\{showReportingPanels && \([\s\S]*data-testid="dashboard-reporting-panels"[\s\S]*<MonthlyWorkforceSummary[\s\S]*<SelectedPeriodIncidentSummary/
  );
  assert.equal(
    (dashboardSource.match(/data-testid="dashboard-reporting-panels"/g) || []).length,
    1
  );
  assert.doesNotMatch(
    dashboardSource.slice(
      dashboardSource.indexOf("const handleRefresh ="),
      dashboardSource.indexOf("const isCurrentYear =")
    ),
    /setSelectedMonth|setSelectedYear/
  );
});

test("two reporting panels use compact responsive metrics and preserve workforce values", () => {
  assert.match(dashboardSource, /grid grid-cols-1 items-start gap-4 lg:grid-cols-2/);
  assert.match(dashboardSource, /grid grid-cols-2 gap-px[\s\S]*sm:grid-cols-4/);
  assert.match(
    dashboardSource,
    /isFullYear \? "Annual Workforce Summary" : "Monthly Workforce Summary"/
  );
  assert.match(
    dashboardSource,
    /getDashboardPeriodLabel\(\{[\s\S]*report,[\s\S]*monthNames: FULL_MONTH_LIST/
  );
  for (const label of [
    "Total Employees",
    "Deployed",
    "For Deployment",
    "Floating / Standby",
    "Resigned",
    "Terminated",
    "AWOL",
    "Other Separation",
  ]) {
    assert.match(dashboardSource, new RegExp(label.replace("/", "\\/")));
  }
  for (const valueKey of [
    "overall.totalEmployees",
    "overall.deployed",
    "overall.forDeployment",
    "overall.floatingStandby",
    "overall.resigned",
    "overall.terminated",
    "overall.awol",
    "overall.otherSeparation",
  ]) {
    assert.match(dashboardSource, new RegExp(valueKey.replace(".", "\\.")));
  }
});

test("live KPI cards preserve original labels, progress bars, actions, and layout", () => {
  for (const key of [
    "total",
    "deployed",
    "available",
    "utilizationRate",
    "activeIncidents",
    "expiringDocs",
  ]) {
    assert.match(kpiCardsSource, new RegExp(`id: "${key}"`));
  }
  assert.match(kpiCardsSource, /grid-cols-1[\s\S]*sm:grid-cols-2[\s\S]*xl:grid-cols-6/);
  assert.match(kpiCardsSource, /rounded-2xl[\s\S]*p-4/);
  assert.match(kpiCardsSource, /Deployed Employees/);
  assert.match(kpiCardsSource, /Available Employees/);
  assert.match(kpiCardsSource, /Expiring Documents/);
  assert.match(kpiCardsSource, /function MetricProgress/);
  assert.match(kpiCardsSource, /role:\s*"progressbar"/);
  assert.match(kpiCardsSource, />\s*View details\s*</);
  assert.match(kpiCardsSource, /onCardClick/);
});

test("selected-period incident panel and company incident scope remain connected", () => {
  assert.match(dashboardSource, /Incidents in Selected Period/);
  assert.match(dashboardSource, /Total Recorded Incidents/);
  assert.match(dashboardSource, /buildDashboardIncidentSummary\([\s\S]*reportScope\.incidents/);
  assert.match(dashboardSource, /periodEndExclusive/);
  assert.match(dashboardSource, /Current Case Status/);
  assert.match(dashboardSource, /summary\.statusRows\.map/);
  assert.match(dashboardSource, /px-3 py-1\.5 text-\[10px\]/);
  assert.match(dashboardSource, /Ended Deployments[\s\S]*Incidents/);
});

test("Dashboard refresh, PDF authorization, and stale-response guard remain wired", () => {
  assert.match(
    dashboardSource,
    /onClick=\{[\s\S]*handleRefresh/
  );
  assert.match(
    dashboardSource,
    /permission=\{[\s\S]*PERMISSIONS\.CAN_EXPORT_PDF/
  );
  assert.match(
    dashboardSource,
    /isLatestDashboardRequest\(/
  );
  assert.match(
    dashboardSource,
    /Workforce and Activity Summary by Client Company[\s\S]*buildDashboardCompanyActivityRows\(companies\)/
  );
  assert.doesNotMatch(
    dashboardSource.slice(
      dashboardSource.indexOf("const handleExportPDF ="),
      dashboardSource.indexOf("if (loading) {")
    ),
    /showReportingPanels/
  );
});
