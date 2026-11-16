import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKpiCompanySummary,
  buildKpiSummaryRows,
  exportKPIReportPDF,
} from "../src/utils/kpi/kpiPdfExport.js";
import {
  buildIncidentCompanyOverview,
  exportIncidentReportPDF,
} from "../src/utils/incidents/incidentPdfExport.js";
import { exportProfessionalDeploymentReportPDF } from "../src/utils/deployments/deploymentPdfExport.js";
import {
  drawDeploymentActivityStackedCell,
  exportDeploymentActivityReportPDF,
} from "../src/utils/deployments/deploymentActivityPdfExport.js";

function pageText(doc, pageNumber) {
  return doc.internal.pages[pageNumber].join(" ");
}

const user = {
  first_name: "Maria",
  last_name: "Santos",
  role: "HR_MANAGER",
};

test("KPI percentages preserve nonzero values below one percent", () => {
  assert.deepEqual(buildKpiSummaryRows({ Monitor: 1 }, 250), [["Monitor", 1, "0.4%"]]);
});

test("KPI company summary preserves incident snapshot company attribution", () => {
  const summary = buildKpiCompanySummary([
    {
      company: "Current Client",
      riskLevel: "Low Risk",
      scoredIncidents: [
        { company: "Historical Client", isActive: false },
        { company: "Current Client", isActive: true },
      ],
    },
  ]);
  const current = summary.find((row) => row.company === "Current Client");
  const historical = summary.find((row) => row.company === "Historical Client");
  assert.equal(current.employeesCovered, 1);
  assert.equal(current.lowRisk, 1);
  assert.equal(current.currentIncidents, 1);
  assert.equal(current.historicalIncidents, 1);
  assert.equal(historical.employeesCovered, 0);
  assert.equal(historical.currentIncidents, 0);
  assert.equal(historical.historicalIncidents, 1);
});

test("KPI PDF keeps the complete risk table on page two and removes technical notices", async () => {
  const employees = [
    ["Low Risk", "Good Standing"],
    ["Monitor", "Minor Concern"],
    ["Repeat", "Needs Improvement"],
    ["High Risk", "Critical Concern"],
  ].map(([riskLevel, kpiLevel], index) => ({
    id: index + 1,
    company: "Client A",
    riskLevel,
    kpiLevel,
    activeViolationCount: index,
    historicalViolationCount: index + 1,
    scoredIncidents: [],
  }));
  const doc = await exportKPIReportPDF({
    user,
    totalEmployees: employees.length,
    employees,
    save: false,
  });
  assert.ok(doc.internal.getNumberOfPages() >= 3);
  const secondPage = pageText(doc, 2);
  for (const label of ["Low Risk", "Monitor", "Repeat", "High Risk"]) {
    assert.match(secondPage, new RegExp(label));
  }
  const allText = doc.internal.pages.slice(1).map((_, index) => pageText(doc, index + 1)).join(" ");
  assert.doesNotMatch(allText, /approved decay rules|Decision-support output/i);
  assert.match(allText, /Page 1 of/);
});

test("incident company overview lists zero-incident companies only with an authoritative roster", () => {
  const incidents = [{ id: 1, company: "Client A", employeeId: 10, employee: "Employee One" }];
  assert.deepEqual(buildIncidentCompanyOverview(incidents).withoutIncidents, []);
  assert.deepEqual(
    buildIncidentCompanyOverview(incidents, ["Client A", "Client B"]).withoutIncidents,
    ["Client B"]
  );
});

test("incident PDF groups detail records by company without a redundant company column", async () => {
  const incidents = [
    { id: 1, company: "Client A", employeeId: 10, employee: "Employee One", violation: "Attendance Concern", severity: "Minor", status: "Open", incidentDate: "2026-10-01", reportedByFullName: "HR Manager" },
    { id: 2, company: "Client B", employeeId: 20, employee: "Employee Two", violation: "Conduct Concern", severity: "Major", status: "Closed", incidentDate: "2026-10-02", reportedByFullName: "HR Manager" },
  ];
  const doc = await exportIncidentReportPDF({
    incidents,
    authorizedCompanies: ["Client A", "Client B", "Client C"],
    user,
    filters: { month: "10", year: "2026" },
    save: false,
  });
  const allText = doc.internal.pages.slice(1).map((_, index) => pageText(doc, index + 1)).join(" ");
  assert.match(allText, /Companies with No Recorded Incidents/);
  assert.match(allText, /Client C/);
  assert.match(allText, /Case No\./);
  assert.doesNotMatch(allText, /Freq\.|Violation Type|Incident ID/);
  assert.equal((allText.match(/INC-0001/g) || []).length, 1);
  assert.equal((allText.match(/INC-0002/g) || []).length, 1);
});

test("deployment PDF reserves page one for summary and limits detail rows to verified employment separation", async () => {
  const doc = await exportProfessionalDeploymentReportPDF({
    reportData: {
      generatedAt: "2026-11-15T12:00:00Z",
      summary: { totalRecords: 2, deployed: 1, completed: 1, resigned: 0, terminated: 0, awol: 0, ended: 0 },
      deployments: [
        { deploymentId: 1, employeeId: 10, employee: "Employee One", company: "Historical Client", position: "Guard", startDate: "2025-01-01", endDate: "2025-12-31", displayStatus: "Completed", endReason: "Completed Contract" },
        { deploymentId: 2, employeeId: 20, employee: "Employee Two", company: "Current Client", position: "Driver", startDate: "2026-01-01", endDate: "2026-10-01", displayStatus: "Resigned", endReason: "Resigned" },
      ],
      scope: {},
    },
    user,
    selectedYear: "2026",
    save: false,
  });
  assert.match(pageText(doc, 1), /Total Deployment Records/);
  assert.match(pageText(doc, 1), /Completed Deployments/);
  assert.doesNotMatch(pageText(doc, 1), /Employee One/);
  assert.ok(doc.internal.getNumberOfPages() >= 2);
  const details = doc.internal.pages.slice(2).map((_, index) => pageText(doc, index + 2)).join(" ");
  assert.match(details, /Historical Client/);
  assert.match(details, /Current Client/);
  assert.match(details, /Employee Two/);
  assert.match(details, /Driver/);
  assert.doesNotMatch(details, /Employee One/);
});

test("activity PDF renders stacked date/time and employee/position with professional secondary styling", () => {
  const calls = [];
  const doc = {
    setFont: (...args) => calls.push(["font", ...args]),
    setFontSize: (...args) => calls.push(["fontSize", ...args]),
    setTextColor: (...args) => calls.push(["textColor", ...args]),
    text: (...args) => calls.push(["text", ...args]),
  };
  drawDeploymentActivityStackedCell(
    doc,
    { x: 10, y: 20 },
    { primaryLines: ["Nov 10, 2026"], secondaryLines: ["4:19 PM"] }
  );
  assert.deepEqual(calls.filter(([type]) => type === "fontSize").map((call) => call[1]), [7.6, 6.7]);
  assert.deepEqual(calls.filter(([type]) => type === "textColor").map((call) => call.slice(1)), [
    [30, 41, 59],
    [71, 85, 105],
  ]);
  assert.equal(calls.some((call) => call[0] === "text" && call[1][0] === "Nov 10, 2026"), true);
  assert.equal(calls.some((call) => call[0] === "text" && call[1][0] === "4:19 PM"), true);
});

test("activity PDF preserves all filtered records, exact headings, metadata, pagination, and footers", async () => {
  const events = Array.from({ length: 48 }, (_, index) => ({
    id: `event-${index + 1}`,
    employeeName: `Employee ${index + 1}`,
    historicalPosition: index % 2 ? "Merchandiser" : "Team Leader",
    historicalCompany: index % 2 ? "Client Alpha" : "Client Beta",
    movement: index % 3 ? "Arrival Confirmed" : "Did Not Report",
    toStatus: index % 3 ? "Deployed" : "Floating / Standby",
    occurredAt: `2026-11-${String((index % 20) + 1).padStart(2, "0")}T08:19:00.000Z`,
    rawReason: index % 3 ? "Arrival confirmed" : "Employee did not report to site",
    remarks: index === 0 ? "Client transfer approved." : "",
  }));
  const doc = await exportDeploymentActivityReportPDF({
    reportData: {
      events,
      filters: {
        company: null,
        month: 10,
        year: 2026,
        periodLabel: "November 2026",
      },
      summary: { totalEvents: events.length },
      pagination: { total: events.length },
      meta: { generatedAt: "2026-11-15T12:00:00.000Z", filteredEventRows: events.length },
    },
    user,
    save: false,
  });
  const allText = doc.internal.pages.slice(1).map((_, index) => pageText(doc, index + 1)).join(" ");
  assert.match(allText, /DEPLOYMENT ACTIVITY HISTORY REPORT/);
  assert.match(allText, /Reporting Period: November 2026/);
  assert.match(allText, /Client Company: All Authorized Companies/);
  assert.match(allText, /Total Recorded Activities: 48/);
  assert.match(allText, /Date/);
  assert.match(allText, /Employee/);
  assert.match(allText, /Client Company/);
  assert.match(allText, /Activity/);
  assert.match(allText, /Status/);
  assert.match(allText, /Remarks/);
  assert.doesNotMatch(allText, /New Status|Event Date and Time|Activity Details|Performed By/);
  assert.match(allText, /Employee 1/);
  assert.match(allText, /Employee 48/);
  assert.match(allText, /Team Leader/);
  assert.match(allText, /4:19 PM/);
  assert.match(allText, /Client transfer approved\./);
  assert.ok(doc.internal.getNumberOfPages() > 1);
  assert.match(allText, /Page 1 of/);
  assert.match(pageText(doc, 2), /Welljob Solutions and General Services Inc\./);
});