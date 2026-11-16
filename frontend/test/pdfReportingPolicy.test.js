import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDirectory, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");

function read(relativePath) {
  return fs.readFileSync(path.resolve(repositoryRoot, relativePath), "utf8");
}

const employee = read("frontend/src/components/employees/EmployeeModal.jsx");
const attendance = read("frontend/src/pages/Attendance.jsx");
const dashboard = read("frontend/src/pages/Dashboard.jsx");
const dashboardPeriod = read("frontend/src/utils/dashboard/dashboardPeriod.js");
const incidents = read("frontend/src/utils/incidents/incidentPdfExport.js");
const kpi = read("frontend/src/utils/kpi/kpiPdfExport.js");
const professionalDeployments = read("frontend/src/utils/deployments/deploymentPdfExport.js");
const deploymentActivity = read("frontend/src/utils/deployments/deploymentActivityPdfExport.js");
const reportUtility = read("frontend/src/utils/pdf/reportPdf.js");
const app = read("frontend/src/App.jsx");
const rolePermissions = read("frontend/src/constants/rolePermissions.js");
const incidentRoutes = read("backend/routes/incidentRoutes.js");
const deploymentRoutes = read("backend/routes/deploymentRoutes.js");
const movementController = read("backend/controllers/deploymentAttemptController.js");
const attendanceRoutes = read("backend/routes/attendanceRoutes.js");
const kpiRoutes = read("backend/routes/kpiDataRoutes.js");

test("seven active PDF report generators remain implemented with shared branding", () => {
  assert.match(employee, /Employee Profile Report/i);
  assert.match(attendance, /ATTENDANCE RECORD REPORT/);
  assert.match(dashboard, /Workforce Operations Dashboard Report/);
  assert.match(professionalDeployments, /Deployment and Separation Report/);
  assert.match(deploymentActivity, /Deployment Activity History Report/);
  assert.match(incidents, /Incident Records Report/);
  assert.match(kpi, /KPI and Performance Report/);

  for (const source of [employee, attendance, dashboard, deploymentActivity, professionalDeployments, incidents, kpi]) {
    assert.match(source, /addReportFooters/);
  }
  assert.match(reportUtility, /Welljob Solutions and General Services Inc\./);
  assert.match(reportUtility, /Page \$\{pageNumber\} of \$\{pageCount\}/);
});

test("report access remains role-restricted without granting Technical IT Support HR exports", () => {
  assert.match(rolePermissions, /SUPER_ADMIN[\s\S]*CAN_EXPORT_PDF/);
  assert.match(rolePermissions, /HR_MANAGER[\s\S]*CAN_EXPORT_PDF/);
  assert.doesNotMatch(
    rolePermissions.slice(rolePermissions.indexOf("[ROLES.IT_SUPPORT]")),
    /CAN_EXPORT_PDF/
  );

  assert.match(app, /HR Coordinator is intentionally excluded from:[\s\S]*Dashboard[\s\S]*KPI Reports/);
  assert.match(attendanceRoutes, /role !==[\s\S]*"HR_COORDINATOR"/);
  assert.match(kpiRoutes, /"SUPER_ADMIN"[\s\S]*"HR_MANAGER"[\s\S]*"HR_STAFF"/);
  assert.doesNotMatch(kpiRoutes, /HR_COORDINATOR|IT_SUPPORT/);
  assert.match(incidentRoutes, /"SUPER_ADMIN"[\s\S]*"HR_MANAGER"[\s\S]*"HR_COORDINATOR"[\s\S]*getIncidentReport/);
  assert.doesNotMatch(
    incidentRoutes.slice(incidentRoutes.indexOf("/incidents/report"), incidentRoutes.indexOf("INCIDENT FORM EMPLOYEE SEARCH")),
    /HR_STAFF|IT_SUPPORT/
  );
  assert.match(deploymentRoutes, /"SUPER_ADMIN"[\s\S]*"HR_MANAGER"[\s\S]*"HR_STAFF"[\s\S]*"HR_COORDINATOR"[\s\S]*getDeploymentReport/);
});

test("coordinator-scoped report endpoints enforce assigned-company restrictions", () => {
  assert.match(movementController, /HR Coordinators may only report on their assigned company/);
  assert.match(movementController, /actor\.role === "HR_COORDINATOR" \? actor\.assignedCompany/);
  assert.match(incidentRoutes, /Coordinator company scope is enforced by the controller/);
  assert.match(deploymentRoutes, /query parameters cannot override company scope/);
});

test("KPI report separates employee performance from authoritative incident case status", () => {
  assert.match(kpi, /Employee Performance Overview/);
  assert.match(kpi, /Incident Case Summary/);
  assert.match(kpi, /Case Status/);
  assert.match(kpi, /activeViolationCount/);
  assert.match(kpi, /caseStatuses/);
  assert.doesNotMatch(kpi, /approved decay rules|Decision-support output/);
  assert.doesNotMatch(kpi, /doc\.addPage\(\)[\s\S]{0,300}Decision-support reminder/);
});

test("employee profile PDF uses authorized current and previous deployment history", () => {
  assert.match(employee, /deploymentGroups/);
  assert.match(employee, /Current Deployment/);
  assert.match(employee, /Previous Deployments/);
  assert.match(employee, /No active deployment\./);
  assert.doesNotMatch(employee, /No previous deployment records\./);
  assert.match(employee, /pendingDeploymentAttempt/);
  assert.match(employee, /awaiting a deployment schedule/);
  assert.match(employee, /deploymentError/);
});

test("dashboard PDF distinguishes full-year activity from monthly workforce reporting", () => {
  assert.match(dashboardPeriod, /Full Year \$\{normalizedYear\}/);
  assert.match(dashboard, /Current authorized workforce snapshot/);
  assert.doesNotMatch(dashboard, />\s*Workforce Overview\s*</);
  assert.match(dashboard, /Workforce and Activity Summary by Client Company/);
  assert.match(dashboard, /Ended Deployments/);
  assert.match(dashboard, /Highest Monthly Deployment Activity/);
  assert.match(dashboard, /Highest Monthly Incident Activity/);
});

test("operational PDFs contain no research or demonstration notices", () => {
  const allReportSources = [employee, attendance, dashboard, deploymentActivity, professionalDeployments, incidents, kpi].join("\n");
  assert.doesNotMatch(
    allReportSources,
    /Demonstration Report|Mock Data|Synthetic Records|For Academic Evaluation|Testing Purposes Only|Research Copy/i
  );
});