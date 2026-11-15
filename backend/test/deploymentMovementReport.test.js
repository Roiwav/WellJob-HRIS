"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const report = require("../utils/deploymentMovementReport");
const controllerSource = fs.readFileSync(
  path.resolve(__dirname, "../controllers/deploymentAttemptController.js"),
  "utf8"
);

test("assignment completion and separation classification preserves truthful categories", () => {
  assert.equal(
    report.getAssignmentMovement("Completed", "Transferred / Reassigned", ""),
    report.MOVEMENT_TYPE.TRANSFERRED
  );
  assert.equal(
    report.getAssignmentMovement(
      "Completed",
      "End of Assignment / Pulled Out by Client",
      ""
    ),
    report.MOVEMENT_TYPE.DEPLOYMENT_ENDED
  );
  assert.equal(
    report.getAssignmentMovement("Completed", "Completed Contract", ""),
    report.MOVEMENT_TYPE.DEPLOYMENT_ENDED
  );
  assert.equal(
    report.getAssignmentMovement("Completed", "Legacy End Reason", ""),
    report.MOVEMENT_TYPE.OTHER_COMPLETION
  );
  assert.equal(
    report.getAssignmentMovement("Cancelled", "Resigned", ""),
    report.MOVEMENT_TYPE.RESIGNED
  );
  assert.equal(
    report.getAssignmentMovement("Cancelled", "Terminated", ""),
    report.MOVEMENT_TYPE.TERMINATED
  );
  assert.equal(
    report.getAssignmentMovement("Cancelled", "AWOL", ""),
    report.MOVEMENT_TYPE.AWOL
  );
});

test("legacy completion display maps Completed Contract without changing raw reason", () => {
  assert.equal(
    report.getAssignmentDisplayReason(
      report.MOVEMENT_TYPE.DEPLOYMENT_ENDED,
      "Completed Contract"
    ),
    "Deployment Ended"
  );
});

test("stable source-qualified identities distinguish completion from separation", () => {
  assert.equal(
    report.getAssignmentEventKey(42, report.MOVEMENT_TYPE.TRANSFERRED),
    "assignment-42-completed"
  );
  assert.equal(
    report.getAssignmentEventKey(42, report.MOVEMENT_TYPE.RESIGNED),
    "assignment-42-separation"
  );
});

test("duplicate prevention uses event identity rather than employee/date/company fields", () => {
  const events = report.deduplicateEvents([
    { eventKey: "attempt-5-scheduled", employeeId: 1 },
    { eventKey: "attempt-5-scheduled", employeeId: 1 },
    { eventKey: "attempt-5-deployed", employeeId: 1 },
  ]);
  assert.deepEqual(
    events.map((event) => event.eventKey),
    ["attempt-5-scheduled", "attempt-5-deployed"]
  );
});

test("historical company matching is normalized and remains snapshot based", () => {
  assert.equal(report.companyMatches(" Company A ", "company a"), true);
  assert.equal(report.companyMatches("Company A", "Company B"), false);
  assert.equal(report.normalizeCompanyFilter(" ALL "), null);
});

test("summary categories are disjoint and equal total filtered events", () => {
  const events = [
    { company: "Company A", movement: report.MOVEMENT_TYPE.SCHEDULED },
    { company: "Company A", movement: report.MOVEMENT_TYPE.DEPLOYED },
    { company: "Company A", movement: report.MOVEMENT_TYPE.TRANSFERRED },
    { company: "Company B", movement: report.MOVEMENT_TYPE.SCHEDULED },
    { company: "Company B", movement: report.MOVEMENT_TYPE.DEPLOYMENT_ENDED },
    { company: "Company B", movement: report.MOVEMENT_TYPE.RESIGNED },
  ];
  const summary = report.buildSummary(events);
  assert.equal(summary.overall.totalEvents, events.length);
  assert.equal(summary.overall.transferredReassigned, 1);
  assert.equal(summary.overall.deploymentEnded, 1);
  assert.equal(summary.overall.resigned, 1);
  assert.equal(summary.totalsMatch, true);
});

test("chronological ordering uses occurrence timestamp, then business date and numeric source id", () => {
  const events = [
    {
      eventKey: "attempt-10-scheduled",
      movement: report.MOVEMENT_TYPE.SCHEDULED,
      sourceId: 10,
      occurredAt: "2026-11-10T01:00:00.000Z",
      businessDate: "2026-12-01",
    },
    {
      eventKey: "attempt-9-no-show",
      movement: report.MOVEMENT_TYPE.NO_SHOW,
      sourceId: 9,
      occurredAt: "2026-11-10T03:00:00.000Z",
      businessDate: "2026-11-09",
    },
    {
      eventKey: "assignment-11-completed",
      movement: report.MOVEMENT_TYPE.TRANSFERRED,
      sourceId: 11,
      occurredAt: null,
      businessDate: "2026-11-08",
    },
  ].sort(report.compareEventsNewestFirst);
  assert.deepEqual(
    events.map((event) => event.eventKey),
    ["attempt-9-no-show", "attempt-10-scheduled", "assignment-11-completed"]
  );
});

test("pagination is bounded, stable, and corrects an out-of-range page", () => {
  const events = Array.from({ length: 5 }, (_, index) => ({ eventKey: `event-${index + 1}` }));
  assert.deepEqual(report.paginateEvents(events, 2, 2), {
    events: events.slice(2, 4),
    pagination: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
  });
  assert.equal(report.paginateEvents(events, 99, 2).pagination.page, 3);
});

test("controller enforces company authorization, full export, snapshots, and no mutation", () => {
  assert.match(controllerSource, /HR Coordinators may only report on their assigned company/);
  assert.match(controllerSource, /filterMeta:\s*\{[\s\S]*companies:/);
  assert.match(controllerSource, /exportAll/);
  assert.match(controllerSource, /historicalCompany:\s*row\.company/);
  assert.match(controllerSource, /historicalPosition:\s*row\.position/);
  assert.match(controllerSource, /assignments\.ended_by_user_id AS endedByUserId/);

  const canonicalBlock = controllerSource.slice(
    controllerSource.indexOf("Canonical Deployment Activity History implementation"),
    controllerSource.indexOf(
      "HR STAFF: SCHEDULE EMPLOYEE FOR DEPLOYMENT",
      controllerSource.indexOf("Canonical Deployment Activity History implementation")
    )
  );
  assert.doesNotMatch(canonicalBlock, /UPDATE\s+deployment_/i);
  assert.doesNotMatch(canonicalBlock, /INSERT\s+INTO\s+deployment_/i);
});

test("actor mapping uses direct attempt and assignment-end actor IDs without inference", () => {
  assert.match(
    controllerSource,
    /performedByUserId:\s*row\.createdByUserId\s*\?\s*Number\(row\.createdByUserId\)\s*:\s*null/
  );
  assert.match(
    controllerSource,
    /performedByUserId:\s*row\.resolvedByUserId\s*\?\s*Number\(row\.resolvedByUserId\)\s*:\s*null/
  );

  const assignmentEventBlock = controllerSource.slice(
    controllerSource.indexOf("for (const row of assignmentRows)"),
    controllerSource.indexOf("const authorizedEvents", controllerSource.indexOf("for (const row of assignmentRows)"))
  );

  assert.match(
    assignmentEventBlock,
    /performedByUserId:\s*row\.endedByUserId\s*\?\s*Number\(row\.endedByUserId\)\s*:\s*null/
  );
  assert.doesNotMatch(assignmentEventBlock, /changed_by_user_id|createdByUserId/i);
});