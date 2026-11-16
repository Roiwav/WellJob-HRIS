import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKpiCaseStatusSummary,
  buildKpiCompanySummary,
} from "../src/utils/kpi/kpiPdfExport.js";
import {
  buildDeploymentCompanyGroups,
  isEmploymentSeparationRecord,
} from "../src/utils/deployments/deploymentPdfExport.js";
import {
  buildDeploymentActivityColumns,
  buildDeploymentActivityRemarks,
  formatDeploymentActivityDateTime,
  getDeploymentActivityEmployeeCell,
} from "../src/utils/deployments/deploymentActivityPdfExport.js";
import { buildDashboardCompanyActivityRows } from "../src/utils/dashboard/dashboardReport.js";

test("groups KPI incident cases by authoritative status independently from counted violations", () => {
  const incidents = [
    { company: "Alpha", status: "Open" },
    { company: "Alpha", status: "for_review" },
    { company: "Beta", status: "Closed" },
  ];
  assert.deepEqual(buildKpiCaseStatusSummary(incidents), {
    rows: [
      { status: "Open", count: 1 },
      { status: "For Review", count: 1 },
      { status: "Closed", count: 1 },
    ],
    total: 3,
  });

  const companies = buildKpiCompanySummary(
    [{ company: "Alpha", riskLevel: "High Risk", activeViolationCount: 1 }],
    incidents
  );
  assert.equal(companies.find((row) => row.company === "Alpha").totalCases, 2);
  assert.equal(companies.find((row) => row.company === "Alpha").countedViolations, 1);
});

test("deployment report separates assignment completion from verified employment separation", () => {
  const completed = { company: "Alpha", displayStatus: "Completed" };
  const resigned = { company: "Alpha", displayStatus: "Resigned", position: "Guard" };
  assert.equal(isEmploymentSeparationRecord(completed), false);
  assert.equal(isEmploymentSeparationRecord(resigned), true);

  const [company] = buildDeploymentCompanyGroups(
    [completed, resigned],
    [{ company: "Alpha", floatingStandby: 4 }]
  );
  assert.equal(company.endedDeployments, 2);
  assert.equal(company.floatingStandby, 4);
  assert.deepEqual(company.separations, [resigned]);
});

test("activity PDF uses the final stacked identity layout and historical status", () => {
  const events = [
    {
      company: "Alpha",
      historicalCompany: "Alpha",
      movement: "Successfully Deployed",
      toStatus: "Deployed",
      employeeName: "Arvin E. Abad",
      historicalPosition: "Merchandiser",
      occurredAt: "2026-11-10T08:19:00.000Z",
      performedBy: "Private Actor",
    },
  ];
  const result = buildDeploymentActivityColumns(events, {});
  const keys = result.columns.map((column) => column.key);
  const labels = result.columns.map((column) => column.label);
  assert.deepEqual(keys, ["date", "employee", "company", "activity", "status", "remarks"]);
  assert.equal(labels.includes("Status"), true);
  assert.equal(labels.includes("New Status"), false);
  assert.equal(keys.includes("position"), false);
  assert.equal(keys.includes("time"), false);
  assert.equal(keys.includes("performedBy"), false);
  assert.equal(keys.includes("actor"), false);
  assert.deepEqual(formatDeploymentActivityDateTime(events[0]), {
    primary: "Nov 10, 2026",
    secondary: "4:19 PM",
  });
  assert.deepEqual(getDeploymentActivityEmployeeCell(events[0]), {
    primary: "Arvin E. Abad",
    secondary: "Merchandiser",
  });
  assert.equal(result.columns.find((column) => column.key === "status").value(events[0]), "Deployed");
});

test("activity PDF omits only genuinely fixed filtered columns", () => {
  const alphaEvents = [
    { historicalCompany: "Alpha", movement: "No Show", toStatus: "Floating / Standby" },
    { historicalCompany: "Alpha", movement: "No Show", toStatus: "Floating / Standby" },
  ];
  const fixed = buildDeploymentActivityColumns(alphaEvents, {
    company: "Alpha",
    activityType: "No Show",
    status: "Floating / Standby",
  });
  assert.deepEqual(fixed.columns.map((column) => column.key), ["date", "employee", "remarks"]);
  assert.equal(fixed.fixedCompany, "Alpha");
  assert.equal(fixed.fixedActivity, "No Show");
  assert.equal(fixed.fixedStatus, "Floating / Standby");

  const mixedCompany = buildDeploymentActivityColumns(
    [...alphaEvents, { historicalCompany: "Beta", movement: "No Show", toStatus: "Floating / Standby" }],
    { company: "Alpha" }
  );
  assert.equal(mixedCompany.columns.some((column) => column.key === "company"), true);

  const unfilteredSingleValue = buildDeploymentActivityColumns(alphaEvents, {});
  assert.equal(unfilteredSingleValue.columns.some((column) => column.key === "activity"), true);
  assert.equal(unfilteredSingleValue.columns.some((column) => column.key === "status"), true);
});

test("activity PDF remarks preserve meaningful details without repeating activity or status", () => {
  assert.equal(
    buildDeploymentActivityRemarks({
      movement: "Transferred / Reassigned",
      fromStatus: "Deployed",
      toStatus: "Floating / Standby",
      rawReason: "Transferred / Reassigned",
      displayReason: "Transferred / Reassigned",
      remarks: "Move to Client Beta after turnover.",
    }),
    "Move to Client Beta after turnover."
  );
  assert.equal(
    buildDeploymentActivityRemarks({
      movement: "No Show",
      toStatus: "Floating / Standby",
      rawReason: "Employee did not report to site",
      remarks: "Client advised that the employee missed the call time.",
    }),
    "Client advised that the employee missed the call time.; Employee did not report to site"
  );
  assert.equal(
    buildDeploymentActivityRemarks({
      movement: "Successfully Deployed",
      toStatus: "Deployed",
      displayReason: "Arrival confirmed",
    }),
    "-"
  );
});

test("dashboard company table keeps snapshot and period activity measures distinct", () => {
  assert.deepEqual(
    buildDashboardCompanyActivityRows([
      {
        company: "Alpha",
        floatingStandby: 2,
        deployed: 8,
        endedDeployments: 3,
        incidents: 4,
      },
    ]),
    [["Alpha", 2, 8, 3, 4]]
  );
});