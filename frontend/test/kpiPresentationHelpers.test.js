import test from "node:test";
import assert from "node:assert/strict";

import {
  clarifyActiveAssessmentText,
  formatCount,
  getRuleIndicatorLabel,
} from "../src/utils/kpi/kpiPresentationHelpers.js";

test(
  "clarifyActiveAssessmentText uses HR-friendly current assessment wording",
  () => {
    assert.equal(
      clarifyActiveAssessmentText(
        "1 critical incident(s), 3 total recorded violation(s), and a severity score of 7.25."
      ),
      "1 critical incident, 3 violations still counted, and a current severity score of 7.25."
    );

    assert.equal(
      clarifyActiveAssessmentText(
        "Employee requires a plan because there are 2 recorded violation(s) with a total severity score of 4."
      ),
      "Employee requires a plan because there are 2 violations still counted with a current severity score of 4."
    );
  }
);

test(
  "clarifyActiveAssessmentText clarifies rule indicators and original points",
  () => {
    assert.equal(
      clarifyActiveAssessmentText(
        "High confidence because the record includes 1 critical case(s), 1 violation(s), and an active severity score of 5. Historical severity score: 8."
      ),
      "Strong rule indicators are present because the record includes 1 critical case, 1 violation still counted, and a current severity score of 5. Original total severity points: 8."
    );

    assert.equal(clarifyActiveAssessmentText(null), "");
  }
);

test("formatCount uses correct singular and plural wording", () => {
  assert.equal(formatCount(1, "critical incident"), "1 critical incident");
  assert.equal(formatCount(3, "critical incident"), "3 critical incidents");
  assert.equal(formatCount(0, "violation"), "0 violations");
  assert.equal(
    clarifyActiveAssessmentText("1 recurring attendance case(s)"),
    "1 recurring attendance case"
  );
});

test("historical KPI text is normalized for presentation without mutating the source record", () => {
  const record = {
    correctiveActionBasis:
      "1 critical incident(s), 4 total recorded violation(s), and 2 recurring attendance case(s).",
    notes:
      "Historical HR notes remain unchanged.",
  };
  const before = structuredClone(record);

  const displayed =
    clarifyActiveAssessmentText(
      record.correctiveActionBasis
    );

  assert.equal(
    displayed,
    "1 critical incident, 4 violations still counted, and 2 recurring attendance cases."
  );
  assert.deepEqual(record, before);
});

test("historical KPI presentation keeps null and already-correct text safe", () => {
  assert.equal(
    clarifyActiveAssessmentText(null),
    ""
  );
  assert.equal(
    clarifyActiveAssessmentText(
      "1 critical incident was recorded."
    ),
    "1 critical incident was recorded."
  );
  assert.equal(
    clarifyActiveAssessmentText(
      "2 recurring attendance cases were recorded."
    ),
    "2 recurring attendance cases were recorded."
  );
});

test("Decision History and Recommendation Review normalize persisted reason text at display boundaries", async () => {
  const [{ readFile }, { fileURLToPath }, { dirname, resolve }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
    import("node:path"),
  ]);
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const [historySource, reviewSource] = await Promise.all([
    readFile(resolve(testDirectory, "../src/components/kpi/sections/DecisionHistorySection.jsx"), "utf8"),
    readFile(resolve(testDirectory, "../src/components/kpi/sections/RecommendationReviewSection.jsx"), "utf8"),
  ]);

  assert.match(historySource, /clarifyActiveAssessmentText\(\s*record\?\.correctiveActionBasis/);
  assert.match(reviewSource, /const recommendationReason\s*=\s*clarifyActiveAssessmentText/);
  assert.match(reviewSource, /const followUpReason\s*=\s*clarifyActiveAssessmentText/);
  assert.equal(
    (reviewSource.match(/clarifyActiveAssessmentText\(/g) || []).length,
    4
  );
});

test("confirmed KPI and incident UI surfaces use count-aware presentation helpers", async () => {
  const [{ readFile }, { fileURLToPath }, { dirname, resolve }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
    import("node:path"),
  ]);
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const paths = [
    "../src/components/kpi/sections/RecommendationReviewSection.jsx",
    "../src/components/kpi/sections/WorkforceStandingSnapshot.jsx",
    "../src/components/kpi/table/RiskTable.jsx",
    "../src/pages/KPIReports.jsx",
    "../src/components/incidents/modals/ConfirmStartInvestigationModal.jsx",
    "../src/components/incidents/modals/ReviewCaseModal.jsx",
  ];
  const sources = await Promise.all(
    paths.map((filePath) =>
      readFile(resolve(testDirectory, filePath), "utf8")
    )
  );

  for (const source of sources) {
    assert.match(source, /formatCount/);
    assert.doesNotMatch(
      source,
      /\b(?:employee|incident|violation|case|day)\(s\)/i
    );
  }
});

test(
  "getRuleIndicatorLabel avoids statistical confidence language",
  () => {
    assert.equal(
      getRuleIndicatorLabel("High Confidence"),
      "Strong Rule Indicators"
    );
    assert.equal(
      getRuleIndicatorLabel("Moderate Confidence"),
      "Moderate Rule Indicators"
    );
    assert.equal(
      getRuleIndicatorLabel("Low Confidence"),
      "Limited Rule Indicators"
    );
  }
);