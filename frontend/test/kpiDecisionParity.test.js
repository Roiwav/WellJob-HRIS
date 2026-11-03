import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { createRequire } from "node:module";

import {
  buildKPIEmployees,
} from "../src/utils/kpi/kpiHelpers.js";
import {
  buildCoordinatorAwarenessDecisionSupport,
  buildEmployeeDetailsDecisionSupport,
} from "../src/utils/employees/employeeDetailsDecisionSupport.js";

process.env.NODE_ENV = "test";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ??= "";
process.env.DB_NAME ||= "welljob_test";

const require = createRequire(
  import.meta.url
);
const {
  __test: {
    buildTrustedDecisionSnapshot,
  },
} = require(
  "../../backend/controllers/kpiDecisionController.js"
);

const EVALUATION_DATE =
  new Date("2026-10-13T12:00:00.000Z");

function buildTerminationGateIncidents(
  latestIncidentDate
) {
  return [
    {
      id: 101,
      employee_id: 7001,
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
      employee_id: 7001,
      violation_type:
        `Fictional major conduct incident ${index + 1}`,
      severity: "Major",
      status: "Resolved",
      incident_date: "2026-04-01",
      reviewed_at: "2026-07-12",
    })),
  ];
}

function withFrozenDate(callback) {
  const RealDate = globalThis.Date;

  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(
        ...(args.length > 0
          ? args
          : [EVALUATION_DATE.getTime()])
      );
    }

    static now() {
      return EVALUATION_DATE.getTime();
    }
  };

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function buildFrontendEmployee(
  incidents
) {
  return withFrozenDate(() =>
    buildKPIEmployees(
      [
        {
          id: 7001,
          name: "Alex Fiction",
          company: "Fictional Client",
          status: "Deployed",
        },
      ],
      incidents
    )[0]
  );
}

function buildLateIncidentFixtures() {
  const currentLateIncident = {
    id: 201,
    employee_id: 7001,
    violation_type: "Late",
    severity: "Minor",
    status: "Open",
    incident_date: "2026-10-01",
  };
  const fullyDecayedLateIncident = {
    id: 202,
    employee_id: 7001,
    violation_type: "Late",
    severity: "Minor",
    status: "Resolved",
    incident_date: "2025-01-01",
    reviewed_at: "2025-01-15",
  };
  const partiallyDecayedLateIncident = {
    id: 203,
    employee_id: 7001,
    violation_type: "Late",
    severity: "Minor",
    status: "Resolved",
    incident_date: "2026-04-01",
    reviewed_at: "2026-07-12",
  };

  return {
    currentOnly: [
      currentLateIncident,
    ],
    currentPlusHistory: [
      currentLateIncident,
      fullyDecayedLateIncident,
    ],
    currentPlusActiveResolved: [
      currentLateIncident,
      partiallyDecayedLateIncident,
    ],
  };
}

test(
  "frontend report builder returns Suspension Review for the Improving termination-gate fixture",
  () => {
    const employee =
      buildFrontendEmployee(
        buildTerminationGateIncidents(
          "2026-04-13"
        )
      );

    assert.equal(
      employee.behaviorTrend,
      "Improving"
    );
    assert.equal(
      employee.activeCriticalIncidentCount,
      1
    );
    assert.equal(
      employee.activeViolationCount,
      5
    );
    assert.equal(
      employee.activeSeverityScore,
      12.75
    );
    assert.equal(
      employee.suggestedHRAction,
      "Suspension Review"
    );
  }
);

test(
  "frontend report builder returns Termination Review for the otherwise-identical Stable fixture",
  () => {
    const employee =
      buildFrontendEmployee(
        buildTerminationGateIncidents(
          "2026-06-13"
        )
      );

    assert.equal(
      employee.behaviorTrend,
      "Stable"
    );
    assert.equal(
      employee.activeCriticalIncidentCount,
      1
    );
    assert.equal(
      employee.activeViolationCount,
      5
    );
    assert.equal(
      employee.activeSeverityScore,
      12.75
    );
    assert.equal(
      employee.suggestedHRAction,
      "Termination Review"
    );
  }
);

test(
  "frontend and backend suggested HR actions match for Improving and Stable fixtures",
  () => {
    for (const fixture of [
      {
        latestIncidentDate:
          "2026-04-13",
        expectedAction:
          "Suspension Review",
      },
      {
        latestIncidentDate:
          "2026-06-13",
        expectedAction:
          "Termination Review",
      },
    ]) {
      const incidents =
        buildTerminationGateIncidents(
          fixture.latestIncidentDate
        );
      const frontendEmployee =
        buildFrontendEmployee(
          incidents
        );
      const backendSnapshot =
        buildTrustedDecisionSnapshot(
          incidents,
          EVALUATION_DATE
        );

      assert.equal(
        frontendEmployee.suggestedHRAction,
        fixture.expectedAction
      );
      assert.equal(
        backendSnapshot.suggestedHRAction,
        fixture.expectedAction
      );
      assert.equal(
        frontendEmployee.suggestedHRAction,
        backendSnapshot.suggestedHRAction
      );
    }
  }
);

test(
  "current Late plus fully decayed historical Late remains Verbal Counseling in both engines",
  () => {
    const fixtures =
      buildLateIncidentFixtures();

    const currentFrontend =
      buildFrontendEmployee(
        fixtures.currentOnly
      );
    const currentBackend =
      buildTrustedDecisionSnapshot(
        fixtures.currentOnly,
        EVALUATION_DATE
      );
    const historicalFrontend =
      buildFrontendEmployee(
        fixtures.currentPlusHistory
      );
    const historicalBackend =
      buildTrustedDecisionSnapshot(
        fixtures.currentPlusHistory,
        EVALUATION_DATE
      );

    assert.equal(
      currentFrontend.recommendation,
      "Verbal Counseling"
    );
    assert.equal(
      currentBackend.systemRecommendation,
      "Verbal Counseling"
    );
    assert.equal(
      historicalFrontend.activeViolationCount,
      1
    );
    assert.equal(
      historicalBackend.activeViolationCount,
      1
    );
    assert.equal(
      historicalFrontend.activeSeverityScore,
      1
    );
    assert.equal(
      historicalBackend.activeSeverityScore,
      1
    );
    assert.equal(
      historicalFrontend.recommendation,
      "Verbal Counseling"
    );
    assert.equal(
      historicalBackend.systemRecommendation,
      "Verbal Counseling"
    );
  }
);

test(
  "current Late plus resolved Late with remaining points establishes repetition in both engines",
  () => {
    const incidents =
      buildLateIncidentFixtures()
        .currentPlusActiveResolved;
    const frontendEmployee =
      buildFrontendEmployee(
        incidents
      );
    const backendSnapshot =
      buildTrustedDecisionSnapshot(
        incidents,
        EVALUATION_DATE
      );

    assert.equal(
      frontendEmployee.activeViolationCount,
      2
    );
    assert.equal(
      backendSnapshot.activeViolationCount,
      2
    );
    assert.equal(
      frontendEmployee.recommendation,
      "Seminar & Webinar"
    );
    assert.equal(
      backendSnapshot.systemRecommendation,
      "Seminar & Webinar"
    );
  }
);

test(
  "old unresolved Late retains full points and remains in current pattern analysis",
  () => {
    const incidents = [
      {
        id: 204,
        employee_id: 7001,
        violation_type: "Late",
        severity: "Minor",
        status: "Open",
        incident_date: "2020-01-01",
      },
      buildLateIncidentFixtures()
        .currentOnly[0],
    ];
    const frontendEmployee =
      buildFrontendEmployee(
        incidents
      );
    const backendSnapshot =
      buildTrustedDecisionSnapshot(
        incidents,
        EVALUATION_DATE
      );

    assert.equal(
      frontendEmployee.activeSeverityScore,
      2
    );
    assert.equal(
      backendSnapshot.activeSeverityScore,
      2
    );
    assert.equal(
      frontendEmployee.recommendation,
      "Seminar & Webinar"
    );
    assert.equal(
      backendSnapshot.systemRecommendation,
      "Seminar & Webinar"
    );
  }
);

test(
  "exactly twelve months since resolution contributes points while just over twelve months contributes zero",
  () => {
    const incidents = [
      {
        id: 205,
        employee_id: 7001,
        violation_type: "Late",
        severity: "Minor",
        status: "Resolved",
        incident_date: "2025-10-01",
        reviewed_at: "2025-10-13",
      },
      {
        id: 206,
        employee_id: 7001,
        violation_type: "Late",
        severity: "Minor",
        status: "Resolved",
        incident_date: "2025-10-01",
        reviewed_at: "2025-10-12",
      },
    ];
    const frontendEmployee =
      buildFrontendEmployee(
        incidents
      );
    const backendSnapshot =
      buildTrustedDecisionSnapshot(
        incidents,
        EVALUATION_DATE
      );

    assert.equal(
      frontendEmployee.historicalViolationCount,
      2
    );
    assert.equal(
      backendSnapshot.historicalViolationCount,
      2
    );
    assert.equal(
      frontendEmployee.activeViolationCount,
      1
    );
    assert.equal(
      backendSnapshot.activeViolationCount,
      1
    );
    assert.equal(
      frontendEmployee.activeSeverityScore,
      0.25
    );
    assert.equal(
      backendSnapshot.activeSeverityScore,
      0.25
    );
  }
);

test(
  "only fully decayed incidents retain history without current pattern contribution",
  () => {
    const incidents = [
      {
        id: 207,
        employee_id: 7001,
        violation_type: "Late",
        severity: "Minor",
        status: "Resolved",
        incident_date: "2024-01-01",
        reviewed_at: "2024-01-15",
      },
      {
        id: 208,
        employee_id: 7001,
        violation_type: "Late",
        severity: "Minor",
        status: "Resolved",
        incident_date: "2024-02-01",
        reviewed_at: "2024-02-15",
      },
    ];
    const frontendEmployee =
      buildFrontendEmployee(
        incidents
      );
    const backendSnapshot =
      buildTrustedDecisionSnapshot(
        incidents,
        EVALUATION_DATE
      );

    assert.equal(
      frontendEmployee.historicalViolationCount,
      2
    );
    assert.equal(
      backendSnapshot.historicalViolationCount,
      2
    );
    assert.equal(
      frontendEmployee.activeViolationCount,
      0
    );
    assert.equal(
      backendSnapshot.activeViolationCount,
      0
    );
    assert.equal(
      frontendEmployee.recommendation,
      "Retain / Maintain Good Standing"
    );
    assert.equal(
      backendSnapshot.systemRecommendation,
      "Retain / Maintain Good Standing"
    );
  }
);

test(
  "Employee Details and KPI workflow match for two current Critical incidents below five violations",
  () => {
    const incidents = [
      {
        id: 301,
        employee_id: 7001,
        violation_type: "Fictional critical incident one",
        severity: "Critical",
        status: "Open",
        incident_date: "2026-10-01",
      },
      {
        id: 302,
        employee_id: 7001,
        violation_type: "Fictional critical incident two",
        severity: "Critical",
        status: "Open",
        incident_date: "2026-10-02",
      },
    ];
    const kpiEmployee =
      buildFrontendEmployee(
        incidents
      );
    const modalDecision =
      buildEmployeeDetailsDecisionSupport(
        incidents,
        EVALUATION_DATE
      );

    assert.equal(
      kpiEmployee.activeViolationCount,
      2
    );
    assert.equal(
      kpiEmployee.suggestedHRAction,
      "Suspension Review"
    );
    assert.equal(
      modalDecision.suggestedHRAction,
      kpiEmployee.suggestedHRAction
    );
    assert.equal(
      modalDecision.suggestedHRActionReason,
      kpiEmployee.suggestedHRActionReason
    );
  }
);

test(
  "coordinator awareness remains aggregate-only and does not expose a workflow recommendation",
  () => {
    const awareness =
      buildCoordinatorAwarenessDecisionSupport({
        total: 2,
        activeTotal: 1,
        critical: 1,
        activeCritical: 1,
        severityScore: 5,
        activeSeverityScore: 5,
      });
    const noHistory =
      buildCoordinatorAwarenessDecisionSupport({
        total: 0,
        activeTotal: 0,
        critical: 0,
        activeCritical: 0,
        severityScore: 0,
        activeSeverityScore: 0,
      });

    assert.equal(
      awareness.awarenessMessage,
      "HR Review Required"
    );
    assert.match(
      awareness.awarenessReason,
      /awareness only/i
    );
    assert.equal(
      Object.hasOwn(
        awareness,
        "suggestedHRAction"
      ),
      false
    );
    assert.equal(
      noHistory.awarenessMessage,
      "Retain"
    );
  }
);