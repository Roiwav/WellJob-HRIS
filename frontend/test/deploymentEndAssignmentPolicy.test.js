import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL(
    "../src/components/deployments/table/DeploymentTable.jsx",
    import.meta.url
  ),
  "utf8"
);

test("Deployment Tracking exposes the required End Assignment terminology", () => {
  for (const label of [
    'title="End Assignment"',
    "Assignment End Date",
    "Assignment End Reason",
    "Confirm Assignment End",
  ]) {
    assert.match(source, new RegExp(label));
  }
});

test("assignment completion and employment separation reasons are visibly grouped", () => {
  assert.match(source, /Assignment completion — employment remains Active/);
  assert.match(source, /Employment separation — employment status changes/);

  for (const reason of [
    "Completed Contract",
    "End of Assignment / Pulled Out by Client",
    "Transferred / Reassigned",
    "Resignation",
    "Termination",
    "AWOL",
  ]) {
    assert.match(source, new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const optionDefinitions = source.slice(
    source.indexOf("const ASSIGNMENT_COMPLETION_REASON_OPTIONS"),
    source.indexOf("function getDeploymentKey")
  );
  assert.doesNotMatch(optionDefinitions, /Other Separation/);
});

test("frontend action remains unavailable to read-only roles and inactive assignments", () => {
  assert.match(
    source,
    /const canEndAssignment =\s*!readOnly &&\s*internalStatus === "Active";/
  );
  assert.match(source, /\{canEndAssignment && \(/);
});