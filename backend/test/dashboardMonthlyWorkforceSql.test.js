"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const controllerSource = fs.readFileSync(
  path.resolve(__dirname, "../controllers/dashboardController.js"),
  "utf8"
);

const monthlyWorkforceSource = controllerSource.slice(
  controllerSource.indexOf("exports.getDashboardMonthlyWorkforce"),
  controllerSource.indexOf("exports.getDashboardOverview")
);

test("monthly workforce SQL uses descriptive non-reserved window aliases", () => {
  assert.match(
    monthlyWorkforceSource,
    /ROW_NUMBER\(\) OVER \([\s\S]*?\) AS status_rank[\s\S]*?ranked\.status_rank = 1/
  );
  assert.match(
    monthlyWorkforceSource,
    /ROW_NUMBER\(\) OVER \([\s\S]*?\) AS assignment_rank[\s\S]*?ranked\.assignment_rank = 1/
  );
  assert.match(
    monthlyWorkforceSource,
    /ROW_NUMBER\(\) OVER \([\s\S]*?\) AS separation_rank[\s\S]*?ranked\.separation_rank = 1/
  );
  assert.doesNotMatch(
    monthlyWorkforceSource,
    /\bAS\s+row_number\b|\branked\.row_number\b/i
  );
});

test("monthly workforce route remains restricted to established dashboard roles", () => {
  const routeSource = fs.readFileSync(
    path.resolve(__dirname, "../routes/dashboardRoutes.js"),
    "utf8"
  );

  const routeBlock = routeSource.slice(
    routeSource.indexOf('"/dashboard/monthly-workforce"'),
    routeSource.indexOf("module.exports")
  );

  assert.match(routeBlock, /verifyToken/);
  assert.match(routeBlock, /authorizeRoles\(\s*\.\.\.DASHBOARD_ROLES/);
  assert.match(routeSource, /"SUPER_ADMIN"[\s\S]*"HR_MANAGER"[\s\S]*"HR_STAFF"/);
});

test("monthly workforce endpoint applies requested month and year to the report period", () => {
  assert.match(
    monthlyWorkforceSource,
    /normalizeMonthlyReportMonth\([\s\S]*?req\.query\?\.month/
  );
  assert.match(
    monthlyWorkforceSource,
    /normalizeMonthlyReportYear\([\s\S]*?req\.query\?\.year/
  );
  assert.match(
    monthlyWorkforceSource,
    /month === "ALL"[\s\S]*?buildAnnualReportPeriod\([\s\S]*?year[\s\S]*?buildMonthlyReportPeriod\([\s\S]*?year[\s\S]*?month/
  );
  assert.match(
    monthlyWorkforceSource,
    /endedDeploymentRows[\s\S]*?incidentActivityRows[\s\S]*?period\.start[\s\S]*?period\.endExclusive/
  );
});