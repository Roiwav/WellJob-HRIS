"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = {
  exports: {},
  console,
  process: {
    env: {
      NODE_ENV: "test",
    },
  },
  require(name) {
    if (name === "../config/db") {
      return {};
    }

    if (name === "../utils/auditLogger") {
      return {
        logAudit() {},
        AUDIT_CATEGORY: {},
      };
    }

    throw new Error(`Unexpected dependency: ${name}`);
  },
};

vm.runInNewContext(
  fs.readFileSync(
    require.resolve("../controllers/deploymentController"),
    "utf8"
  ),
  context
);

const {
  __test: {
    buildDeploymentSummaryFilters,
    normalizeDeploymentEndReasonFilter,
  },
} = context.exports;

test("deployment end reason filtering uses an exact normalized stored reason", () => {
  const result = buildDeploymentSummaryFilters({
    search: "",
    status: "Completed",
    endReason: normalizeDeploymentEndReasonFilter(
      " Transferred / Reassigned "
    ),
    month: null,
    year: null,
  });

  assert.match(result.whereSql, /da\.status = 'Completed'/);
  assert.match(result.whereSql, /da\.end_reason/);
  assert.deepEqual(
    Array.from(result.params),
    ["transferred / reassigned"]
  );
});

test("combined filters retain coordinator company authorization scope", () => {
  const result = buildDeploymentSummaryFilters({
    search: "employee",
    status: "Completed",
    endReason: "End of Assignment / Pulled Out by Client",
    month: 10,
    year: 2026,
    coordinatorCompany: "Authorized Client",
  });

  assert.match(result.whereSql, /da\.company/);
  assert.equal(result.params[0], "Authorized Client");
  assert.ok(result.params.includes("end of assignment / pulled out by client"));
  assert.ok(result.params.includes(11));
  assert.ok(result.params.includes(2026));
});