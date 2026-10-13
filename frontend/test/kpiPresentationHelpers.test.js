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