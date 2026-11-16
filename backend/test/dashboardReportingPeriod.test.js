"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAnnualReportPeriod,
  buildMonthlyReportPeriod,
} = require("../utils/dashboardReportingPeriod");

const MANILA_NOVEMBER_16 = new Date(
  "2026-11-16T04:00:00.000Z"
);

test("completed Dashboard years use a finalized year-end workforce cutoff", () => {
  assert.deepEqual(
    buildAnnualReportPeriod(2025, MANILA_NOVEMBER_16),
    {
      start: "2025-01-01",
      endExclusive: "2026-01-01",
      label: "Full Year 2025",
      snapshotKind: "YEAR_END",
    }
  );
});

test("ongoing Dashboard years use an observed as-of date and year-to-date activity", () => {
  assert.deepEqual(
    buildAnnualReportPeriod(2026, MANILA_NOVEMBER_16),
    {
      start: "2026-01-01",
      endExclusive: "2026-11-17",
      label: "Year to Date 2026 (as of November 16, 2026)",
      snapshotKind: "CURRENT_DATE",
    }
  );
});

test("specific Dashboard months retain month-end boundaries", () => {
  assert.deepEqual(buildMonthlyReportPeriod(2025, 4), {
    start: "2025-05-01",
    endExclusive: "2025-06-01",
    label: "May 2025",
    snapshotKind: "MONTH_END",
  });
});
