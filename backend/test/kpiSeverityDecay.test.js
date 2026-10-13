const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateEmployeeSeveritySnapshot,
  scoreIncident,
} = require("../utils/kpiSeverityDecayService");

const AS_OF = new Date("2026-10-13T12:00:00.000Z");

function closedMajor(resolutionDate) {
  return {
    severity: "Major",
    status: "Closed",
    incident_date: "2025-01-01",
    reviewed_at: resolutionDate,
  };
}

test("active incidents retain full points regardless of age", () => {
  const result = scoreIncident(
    {
      severity: "Critical",
      status: "Investigating",
      incident_date: "2020-01-01",
    },
    AS_OF
  );

  assert.equal(result.activePoints, 5);
  assert.equal(result.decayMultiplier, 1);
});

test("closed incidents decay at exact completed-month boundaries", () => {
  assert.equal(scoreIncident(closedMajor("2026-07-13"), AS_OF).activePoints, 3);
  assert.equal(scoreIncident(closedMajor("2026-07-12"), AS_OF).activePoints, 2.25);
  assert.equal(scoreIncident(closedMajor("2026-04-12"), AS_OF).activePoints, 1.5);
  assert.equal(scoreIncident(closedMajor("2026-01-12"), AS_OF).activePoints, 0.75);
  assert.equal(scoreIncident(closedMajor("2025-10-12"), AS_OF).activePoints, 0);
});

test("invalid dates fail safely without reducing points", () => {
  const result = scoreIncident(
    {
      severity: "Major",
      status: "Closed",
      incident_date: "not-a-date",
      reviewed_at: "not-a-date",
    },
    AS_OF
  );

  assert.equal(result.activePoints, 3);
  assert.equal(result.decayMultiplier, 1);
});

test("snapshot separates historical and active values", () => {
  const snapshot = calculateEmployeeSeveritySnapshot(
    [
      closedMajor("2025-01-01"),
      {
        severity: "Minor",
        status: "Open",
        incident_date: "2026-10-01",
      },
    ],
    AS_OF
  );

  assert.equal(snapshot.historicalViolationCount, 2);
  assert.equal(snapshot.activeViolationCount, 1);
  assert.equal(snapshot.historicalSeverityScore, 4);
  assert.equal(snapshot.activeSeverityScore, 1);
  assert.equal(snapshot.behaviorTrend, "Worsening");
});

test("resolved employee with six incident-free months is improving", () => {
  const snapshot = calculateEmployeeSeveritySnapshot(
    [
      {
        severity: "Critical",
        status: "Resolved",
        incident_date: "2026-03-01",
        reviewed_at: "2026-03-15",
      },
    ],
    AS_OF
  );

  assert.equal(snapshot.behaviorTrend, "Improving");
  assert.equal(snapshot.historicalSeverityScore, 5);
  assert.equal(snapshot.activeSeverityScore, 2.5);
});