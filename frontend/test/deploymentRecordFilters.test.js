import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEPLOYMENT_END_REASON_GROUPS,
  getDeploymentEndReasonOptions,
  reconcileDeploymentEndReason,
} from "../src/utils/deployments/deploymentRecordFilters.js";

const deploymentsSource = fs.readFileSync(
  new URL("../src/pages/Deployments.jsx", import.meta.url),
  "utf8"
);
const deploymentPdfSource = fs.readFileSync(
  new URL("../src/utils/deployments/deploymentPdfExport.js", import.meta.url),
  "utf8"
);
const deploymentTableSource = fs.readFileSync(
  new URL("../src/components/deployments/table/DeploymentTable.jsx", import.meta.url),
  "utf8"
);
const deploymentModalSource = fs.readFileSync(
  new URL("../src/components/deployments/modals/DeploymentModal.jsx", import.meta.url),
  "utf8"
);
const employeeModalSource = fs.readFileSync(
  new URL("../src/components/employees/EmployeeModal.jsx", import.meta.url),
  "utf8"
);

test("deployment records expose Completed status and a separate End Reason filter", () => {
  assert.match(deploymentsSource, /label:\s*"Completed"/);
  assert.match(deploymentsSource, /Record Status/);
  assert.match(deploymentsSource, /Deployment End Reason/);
  assert.match(deploymentsSource, /All Reasons/);
  assert.match(deploymentsSource, /endReason:\s*selectedEndReason/);
  assert.match(deploymentsSource, /Deployment Activity History/);
  assert.doesNotMatch(
    deploymentsSource,
    /item\.deployment_location \|\|\s*item\.company/
  );
});

test("historical end reasons remain selectable without duplicating known values", () => {
  assert.deepEqual(
    getDeploymentEndReasonOptions([
      "Completed Contract",
      "Legacy Client Pullout",
      "Transferred / Reassigned",
    ]),
    [
      {
        value: "End of Assignment / Pulled Out by Client",
        label: "End of Assignment / Pulled Out by Client",
        group: DEPLOYMENT_END_REASON_GROUPS.DEPLOYMENT_END,
      },
      {
        value: "Transferred / Reassigned",
        label: "Transferred / Reassigned",
        group: DEPLOYMENT_END_REASON_GROUPS.DEPLOYMENT_END,
      },
      {
        value: "Resigned",
        label: "Resigned",
        group: DEPLOYMENT_END_REASON_GROUPS.EMPLOYMENT_SEPARATION,
      },
      {
        value: "Terminated",
        label: "Terminated",
        group: DEPLOYMENT_END_REASON_GROUPS.EMPLOYMENT_SEPARATION,
      },
      {
        value: "AWOL",
        label: "AWOL",
        group: DEPLOYMENT_END_REASON_GROUPS.EMPLOYMENT_SEPARATION,
      },
      {
        value: "Completed Contract",
        label: "Deployment Ended",
        group: DEPLOYMENT_END_REASON_GROUPS.DEPLOYMENT_END,
      },
      {
        value: "Legacy Client Pullout",
        label: "Legacy Client Pullout",
        group: DEPLOYMENT_END_REASON_GROUPS.HISTORICAL,
      },
    ]
  );
});

test("duplicate presentation labels retain distinct raw filter values", () => {
  assert.deepEqual(
    getDeploymentEndReasonOptions([
      "Completed Contract",
      "Deployment Ended",
    ]).slice(-2),
    [
      {
        value: "Completed Contract",
        label: "Deployment Ended (legacy record)",
        group: DEPLOYMENT_END_REASON_GROUPS.DEPLOYMENT_END,
      },
      {
        value: "Deployment Ended",
        label: "Deployment Ended (recorded reason)",
        group: DEPLOYMENT_END_REASON_GROUPS.HISTORICAL,
      },
    ]
  );
});

test("all required deployment presentation paths use the central reason mapping", () => {
  assert.match(deploymentTableSource, /getDeploymentEndReasonDisplay\(/);
  assert.match(deploymentModalSource, /getDeploymentEndReasonDisplay\(/);
  assert.match(employeeModalSource, /getDeploymentEndReasonDisplay\(/);
  assert.match(deploymentPdfSource, /getDeploymentEndReasonDisplay\(/);
  assert.match(deploymentPdfSource, /"Deployment End"/);
  assert.match(deploymentPdfSource, /"Record status"/);
  assert.match(deploymentPdfSource, /"Deployment End Reason"/);
});

test("ordinary deployment presentation files do not hardcode the legacy phrase", () => {
  for (const source of [
    deploymentTableSource,
    deploymentModalSource,
    employeeModalSource,
    deploymentsSource,
    deploymentPdfSource,
  ]) {
    assert.doesNotMatch(source, /Completed Contract/);
  }
});

test("incompatible assignment status changes clear stale end reasons", () => {
  assert.equal(
    reconcileDeploymentEndReason(
      "Completed",
      "Transferred / Reassigned"
    ),
    "Transferred / Reassigned"
  );
  assert.equal(
    reconcileDeploymentEndReason(
      "",
      "End of Assignment / Pulled Out by Client"
    ),
    "End of Assignment / Pulled Out by Client"
  );
  assert.equal(
    reconcileDeploymentEndReason(
      "Resigned",
      "Transferred / Reassigned"
    ),
    ""
  );
});