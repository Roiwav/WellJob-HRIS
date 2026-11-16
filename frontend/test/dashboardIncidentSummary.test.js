import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardIncidentSummary,
} from "../src/utils/dashboard/dashboardIncidentSummary.js";

test("selected-period incident severity totals reconcile", () => {
  const summary = buildDashboardIncidentSummary([
    { severity: "Minor", status: "Open" },
    { severity: "Major", status: "Investigating" },
    { severity: "Critical", status: "for_review" },
    { severity: "Minor", status: "Resolved" },
  ], 4);

  assert.equal(summary.total, 4);
  assert.equal(summary.severityTotal, 4);
  assert.equal(summary.statusTotal, 4);
  assert.deepEqual(summary.severityRows, [
    { label: "Minor", count: 2 },
    { label: "Major", count: 1 },
    { label: "Critical", count: 1 },
  ]);
  assert.deepEqual(summary.statusRows, [
    { label: "Open", count: 1 },
    { label: "Investigating", count: 1 },
    { label: "For Review", count: 1 },
    { label: "Closed", count: 1 },
  ]);
  assert.equal(summary.companyDifference, 0);
});

test("actual nonstandard incident values remain visible without inventing standard counts", () => {
  const summary = buildDashboardIncidentSummary([
    { severity: "", status: "Pending HR Action" },
  ], 0);

  assert.equal(summary.total, 1);
  assert.equal(summary.severityTotal, 1);
  assert.deepEqual(summary.severityRows.at(-1), {
    label: "Other / Unspecified",
    count: 1,
  });
  assert.deepEqual(summary.statusRows, [
    { label: "Pending Hr Action", count: 1 },
  ]);
  assert.equal(summary.companyDifference, 1);
});

test("Other / Unspecified is omitted when every incident has a supported severity", () => {
  const summary = buildDashboardIncidentSummary([
    { severity: "Minor" },
    { severity: "Major" },
    { severity: "Critical" },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.severityTotal, 3);
  assert.deepEqual(summary.severityRows, [
    { label: "Minor", count: 1 },
    { label: "Major", count: 1 },
    { label: "Critical", count: 1 },
  ]);
});
