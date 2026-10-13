import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateSeveritySnapshot,
} from "../src/utils/kpi/severityDecayHelpers.js";

const AS_OF = new Date("2026-10-13T12:00:00.000Z");

test("frontend decay helper matches active and historical policy", () => {
  const snapshot = calculateSeveritySnapshot(
    [
      {
        severity: "Major",
        status: "Closed",
        incidentDate: "2026-07-12",
        reviewedAt: "2026-07-12",
      },
      {
        severity: "Critical",
        status: "Open",
        incidentDate: "2026-10-01",
      },
    ],
    AS_OF
  );

  assert.equal(snapshot.historicalSeverityScore, 8);
  assert.equal(snapshot.activeSeverityScore, 7.25);
  assert.equal(snapshot.historicalViolationCount, 2);
  assert.equal(snapshot.activeViolationCount, 2);
  assert.equal(snapshot.behaviorTrend, "Worsening");
});

test("frontend helper expires resolved incidents older than twelve months", () => {
  const snapshot = calculateSeveritySnapshot(
    [
      {
        severity: "Critical",
        status: "Resolved",
        incidentDate: "2025-01-01",
        reviewedAt: "2025-01-10",
      },
    ],
    AS_OF
  );

  assert.equal(snapshot.historicalSeverityScore, 5);
  assert.equal(snapshot.activeSeverityScore, 0);
  assert.equal(snapshot.activeCriticalIncidentCount, 0);
  assert.equal(snapshot.behaviorTrend, "Improving");
});