import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeKpiEvaluationSnapshot,
  requestKPIDecisionJson,
} from "../src/hooks/useKPIDecisionQueries.js";

test(
  "KPI decision requests preserve HTTP 409 details for stale-snapshot recovery",
  async () => {
    const originalFetch =
      globalThis.fetch;

    const originalLocalStorage =
      globalThis.localStorage;

    globalThis.localStorage = {
      getItem: () =>
        "fictional-test-token",
    };

    globalThis.fetch =
      async () =>
        new Response(
          JSON.stringify({
            error:
              "The KPI assessment changed.",
            code:
              "STALE_KPI_SNAPSHOT",
          }),
          {
            status: 409,
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

    try {
      await assert.rejects(
        requestKPIDecisionJson(
          "http://test.invalid/api/kpi/decision-history",
          {
            method: "POST",
            body: "{}",
          }
        ),
        (error) => {
          assert.equal(
            error.name,
            "KPIDecisionRequestError"
          );

          assert.equal(
            error.status,
            409
          );

          assert.equal(
            error.data?.code,
            "STALE_KPI_SNAPSHOT"
          );

          assert.match(
            error.message,
            /assessment changed/i
          );

          return true;
        }
      );
    } finally {
      globalThis.fetch =
        originalFetch;

      if (
        originalLocalStorage ===
        undefined
      ) {
        delete globalThis.localStorage;
      } else {
        globalThis.localStorage =
          originalLocalStorage;
      }
    }
  }
);

test(
  "a refreshed server evaluation replaces the stale decision snapshot",
  () => {
    const refreshed =
      mergeKpiEvaluationSnapshot(
        {
          id: 71,
          name:
            "Fictional Employee",
          company:
            "Fictional Client",
          violationCount: 1,
          severityScore: 1,
          recommendation:
            "Verbal Counseling",
        },
        {
          employee: {
            id: 71,
            name:
              "Fictional Employee",
            company:
              "Fictional Client",
          },
          evaluation: {
            activeViolationCount: 2,
            historicalViolationCount: 3,
            activeSeverityScore: 4,
            historicalSeverityScore: 6,
            activeCriticalIncidentCount: 1,
            systemRecommendation:
              "Written Warning",
            recommendationReason:
              "Two active incidents require review.",
            suggestedHRAction:
              "HR Investigation",
          },
        }
      );

    assert.equal(
      refreshed.violationCount,
      2
    );

    assert.equal(
      refreshed.severityScore,
      4
    );

    assert.equal(
      refreshed.criticalIncidentCount,
      1
    );

    assert.equal(
      refreshed.recommendation,
      "Written Warning"
    );

    assert.equal(
      refreshed.suggestedHRAction,
      "HR Investigation"
    );

    assert.equal(
      refreshed.historicalSeverityScore,
      6
    );
  }
);

test(
  "snapshot merging rejects a malformed evaluation response",
  () => {
    assert.throws(
      () =>
        mergeKpiEvaluationSnapshot(
          {
            id: 71,
          },
          {
            evaluation: null,
          }
        ),
      /response is invalid/i
    );
  }
);
