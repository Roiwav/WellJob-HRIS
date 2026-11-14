import test from "node:test";
import assert from "node:assert/strict";

import {
  groupEmployeeDeployments,
} from "../src/utils/employees/employeeDeploymentHistory.js";

test("groups a current deployment without an empty previous-history placeholder", () => {
  const result = groupEmployeeDeployments([
    {
      id: 1,
      company: "Current Client",
      status: "Active",
      displayStatus: "Deployed",
      startDate: "2026-01-10",
    },
  ]);

  assert.equal(result.current.length, 1);
  assert.equal(result.previous.length, 0);
  assert.equal(result.all.length, 1);
});

test("keeps current first and sorts previous deployments newest to oldest", () => {
  const result = groupEmployeeDeployments([
    { id: 2, company: "Older", status: "Completed", startDate: "2024-01-01", endDate: "2024-12-31" },
    { id: 1, company: "Current", status: "Active", startDate: "2026-03-01" },
    { id: 3, company: "Newer", status: "Completed", startDate: "2025-01-01", endDate: "2025-12-31" },
  ]);

  assert.deepEqual(result.all.map((deployment) => deployment.company), [
    "Current",
    "Newer",
    "Older",
  ]);
});

test("supports previous-only and separated deployment histories", () => {
  const result = groupEmployeeDeployments([
    { id: 1, company: "Client A", status: "Cancelled", displayStatus: "Resigned", endDate: "2026-05-20" },
  ]);

  assert.equal(result.current.length, 0);
  assert.equal(result.previous[0].displayStatus, "Resigned");
});

test("preserves a recorded assignment end reason without inventing one", () => {
  const result = groupEmployeeDeployments([
    {
      id: 1,
      company: "Client A",
      status: "Completed",
      endDate: "2026-05-20",
      endReason: "Transferred / Reassigned",
    },
    {
      id: 2,
      company: "Client B",
      status: "Completed",
      endDate: "2026-06-20",
    },
  ]);

  assert.equal(result.previous[1].endReason, "Transferred / Reassigned");
  assert.equal(result.previous[0].endReason, "");
});

test("deduplicates assignment IDs and preserves verified missing details as empty", () => {
  const result = groupEmployeeDeployments([
    { id: 7, company: "Client A", status: "Completed" },
    { id: 7, company: "Client A", status: "Completed" },
    { id: 8, status: "Completed" },
  ]);

  assert.equal(result.all.length, 2);
  assert.equal(result.all[1].company, "");
  assert.equal(result.all[1].location, "");
});

test("returns empty groups when no deployment records exist", () => {
  assert.deepEqual(groupEmployeeDeployments([]), {
    current: [],
    previous: [],
    all: [],
  });
});