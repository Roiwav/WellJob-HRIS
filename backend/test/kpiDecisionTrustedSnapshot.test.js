"use strict";

process.env.NODE_ENV = "test";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ??= "";
process.env.DB_NAME ||= "welljob_test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  __test: {
    buildTrustedDecisionSnapshot,
  },
} = require("../controllers/kpiDecisionController");

const EVALUATION_DATE =
  new Date("2026-10-13T12:00:00.000Z");

function buildTerminationGateIncidents(
  latestIncidentDate
) {
  return [
    {
      id: 101,
      violation_type: "Fictional critical conduct incident",
      severity: "Critical",
      status: "Resolved",
      incident_date: latestIncidentDate,
      reviewed_at: "2026-07-12",
    },
    ...[
      102,
      103,
      104,
      105,
    ].map((id, index) => ({
      id,
      violation_type:
        `Fictional major conduct incident ${index + 1}`,
      severity: "Major",
      status: "Resolved",
      incident_date: "2026-04-01",
      reviewed_at: "2026-07-12",
    })),
  ];
}

test(
  "trusted snapshot skips termination review when the calculated trend is Improving",
  () => {
    const snapshot =
      buildTrustedDecisionSnapshot(
        buildTerminationGateIncidents(
          "2026-04-13"
        ),
        EVALUATION_DATE
      );

    assert.equal(
      snapshot.behaviorTrend,
      "Improving"
    );
    assert.equal(
      snapshot.activeCriticalIncidentCount,
      1
    );
    assert.equal(
      snapshot.activeViolationCount,
      5
    );
    assert.equal(
      snapshot.activeSeverityScore,
      12.75
    );
    assert.equal(
      snapshot.suggestedHRAction,
      "Suspension Review"
    );
  }
);

test(
  "trusted snapshot retains termination review for an otherwise-identical Stable case",
  () => {
    const snapshot =
      buildTrustedDecisionSnapshot(
        buildTerminationGateIncidents(
          "2026-06-13"
        ),
        EVALUATION_DATE
      );

    assert.equal(
      snapshot.behaviorTrend,
      "Stable"
    );
    assert.equal(
      snapshot.activeCriticalIncidentCount,
      1
    );
    assert.equal(
      snapshot.activeViolationCount,
      5
    );
    assert.equal(
      snapshot.activeSeverityScore,
      12.75
    );
    assert.equal(
      snapshot.suggestedHRAction,
      "Termination Review"
    );
  }
);