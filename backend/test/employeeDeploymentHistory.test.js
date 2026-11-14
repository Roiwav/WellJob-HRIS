"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function loadController({ employeeRows, assignmentRows }) {
  const databasePath = require.resolve("../config/db");
  const auditPath = require.resolve("../utils/auditLogger");
  const controllerPath = require.resolve("../controllers/deploymentController");
  const previous = new Map([
    [databasePath, require.cache[databasePath]],
    [auditPath, require.cache[auditPath]],
    [controllerPath, require.cache[controllerPath]],
  ]);
  const queries = [];

  const mockDb = {
    promise() {
      return {
        async query(sql, parameters) {
          const normalized = String(sql).replace(/\s+/g, " ").trim();
          assert.doesNotMatch(normalized, /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE)\b/i);
          queries.push({ sql: normalized, parameters });

          if (/SELECT e\.id FROM employees AS e/i.test(normalized)) {
            return [employeeRows];
          }
          if (/FROM deployment_assignments AS da WHERE da\.employee_id = \?/i.test(normalized)) {
            return [assignmentRows];
          }
          throw new Error(`Unexpected query: ${normalized}`);
        },
      };
    },
  };

  try {
    require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: mockDb };
    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: { logAudit: async () => {}, AUDIT_CATEGORY: {} },
    };
    delete require.cache[controllerPath];
    const controller = require("../controllers/deploymentController");
    return { handler: controller.getEmployeeDeploymentHistory, queries };
  } finally {
    for (const [modulePath, cached] of previous) {
      if (cached) require.cache[modulePath] = cached;
      else delete require.cache[modulePath];
    }
  }
}

async function runHistoryRequest({
  role,
  assignedCompany,
  employeeRows,
  assignmentRows,
}) {
  const {
    handler,
    queries,
  } = loadController({
    employeeRows,
    assignmentRows,
  });
  const res = response();

  await handler(
    {
      params: {
        employeeId:
          "77",
      },
      user: {
        role,
        assignedCompany,
      },
    },
    res
  );

  return {
    queries,
    res,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("authorized deployed coordinator receives company-scoped current and historical assignments", async () => {
  const {
    queries,
    res,
  } = await runHistoryRequest({
    role:
      "HR_COORDINATOR",
    assignedCompany:
      "Current Client",
    employeeRows: [{ id: 77 }],
    assignmentRows: [
      { deploymentId: 2, employeeId: 77, company: "Current Client", position: "Guard", startDate: "2026-01-01", endDate: null, deploymentStatus: "Active" },
      { deploymentId: 1, employeeId: 77, company: "Current Client", position: "Guard", startDate: "2025-01-01", endDate: "2025-12-01", endReason: "Transferred / Reassigned", deploymentStatus: "Completed" },
    ],
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.deployments.map((item) => item.displayStatus), ["Deployed", "Completed"]);
  assert.equal(res.body.deployments[0].endReason, "");
  assert.equal(res.body.deployments[1].endReason, "Transferred / Reassigned");
  assert.equal(res.body.deployments[0].location, "");
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /e\.workforce_status = 'Deployed'/);
  assert.match(queries[0].sql, /da_overview\.status = 'Active'/);
  assert.match(queries[0].sql, /da_conflict\.status = 'Active'/);
  assert.match(queries[1].sql, /LOWER\( TRIM\( da\.company \) \) = LOWER\( TRIM\(\?\) \)/);
  assert.deepEqual(queries[1].parameters, [77, "Current Client"]);
});

test("authorized For Deployment coordinator with a matching live attempt receives an empty assignment history", async () => {
  const {
    queries,
    res,
  } = await runHistoryRequest({
    role:
      "HR_COORDINATOR",
    assignedCompany:
      "Authorized Client",
    employeeRows: [
      {
        id: 77,
      },
    ],
    assignmentRows: [],
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.deployments, []);
  assert.match(queries[0].sql, /e\.workforce_status = 'For Deployment'/);
  assert.match(queries[0].sql, /FROM deployment_attempts AS dpa_overview/);
  assert.match(queries[0].sql, /dpa_overview\.status = 'For Deployment'/);
  assert.deepEqual(queries[0].parameters, [77, "Authorized Client"]);
  assert.equal(queries.length, 2);
});

for (const scenario of [
  "cross-company employee",
  "archived employee",
  "separated employee",
  "inactive employee",
  "employee with conflicting active assignments",
]) {
  test(`coordinator access fails closed for ${scenario}`, async () => {
    const {
      queries,
      res,
    } = await runHistoryRequest({
      role:
        "HR_COORDINATOR",
      assignedCompany:
        "Authorized Client",
      employeeRows: [],
      assignmentRows: [],
    });

    assert.equal(res.statusCode, 404);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /e\.archived = 0/);
    assert.match(queries[0].sql, /e\.employment_status = 'Active'/);
    assert.match(queries[0].sql, /da_conflict\.status = 'Active'/);
    assert.deepEqual(queries[0].parameters, [77, "Authorized Client"]);
  });
}

for (const role of [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
]) {
  test(`${role} retains authorized deployment-history access without coordinator company filtering`, async () => {
    const {
      queries,
      res,
    } = await runHistoryRequest({
      role,
      employeeRows: [
        {
          id: 77,
        },
      ],
      assignmentRows: [
        {
          deploymentId: 10,
          employeeId: 77,
          company:
            "Historical Client",
          position:
            "Guard",
          startDate:
            "2025-01-01",
          endDate:
            "2025-12-01",
          deploymentStatus:
            "Completed",
        },
      ],
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.deployments.length, 1);
    assert.deepEqual(queries[0].parameters, [77]);
    assert.deepEqual(queries[1].parameters, [77]);
    assert.doesNotMatch(queries[1].sql, /LOWER\( TRIM\( da\.company \) \) = LOWER\( TRIM\(\?\) \)/);
  });
}