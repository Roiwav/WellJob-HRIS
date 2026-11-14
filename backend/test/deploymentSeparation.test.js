const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { isCurrentWorkforceStatus } = require("../utils/workforceScope");

function fixture({ failAt, role = "HR_STAFF", assignmentStatus = "Active" } = {}) {
  let state = {
    employee: { id: 7, name: "Test Employee", status: "Deployed", employment_status: "Active", workforce_status: "Deployed", archived: 0 },
    assignment: { id: 12, employee_id: 7, status: assignmentStatus, company: "Test Company", start_date: "2026-01-01" },
    legacy: [], employment: [], audits: [],
  };
  let snapshot;
  let released = false;
  let began = false;
  const connection = {
    async beginTransaction() { began = true; snapshot = structuredClone(state); },
    async commit() {},
    async rollback() { state = snapshot; },
    release() { released = true; },
    async query(raw, params = []) {
      const sql = raw.replace(/\s+/g, " ").trim();
      if (failAt && sql.includes(failAt)) throw new Error("Injected transaction failure");
      if (sql.startsWith("SELECT employee_id")) return [[{ employee_id: 7 }]];
      if (sql.includes("FROM employees")) {
        assert.match(sql, /FOR UPDATE/);
        assert.match(sql, /employment_status, workforce_status/);
        return [[{ ...state.employee }]];
      }
      if (sql.startsWith("SELECT id FROM deployment_assignments")) return [[{ id: 12 }]];
      if (sql.includes("FROM deployment_assignments")) {
        assert.deepEqual(Array.from(params), [12, 7]);
        return [[{ ...state.assignment }]];
      }
      if (sql.startsWith("UPDATE deployment_assignments")) {
        assert.equal(params[4], 12);
        state.assignment.end_date = params[0];
        state.assignment.status = params[3];
        state.assignment.end_reason = params[1];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE employees")) {
        assert.match(sql, /status = \?, employment_status = \?, workforce_status = \?/);
        [state.employee.status, state.employee.employment_status, state.employee.workforce_status] = params;
        state.employee.contractEnd = params[3];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO employee_status_history")) { state.legacy.push(Array.from(params)); return [{}]; }
      if (sql.startsWith("INSERT INTO employee_employment_history")) { state.employment.push(Array.from(params)); return [{}]; }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const context = {
    exports: {}, console: { error() {} },
    require(name) {
      if (name === "../config/db") return { promise: () => ({ getConnection: async () => connection }) };
      if (name === "../utils/auditLogger") return {
        AUDIT_CATEGORY: { OPERATIONAL: "OPERATIONAL" },
        async logAudit(actor, options) {
          assert.equal(options.connection, connection);
          assert.equal(options.throwOnError, true);
          if (failAt === "audit") throw new Error("Injected audit failure");
          state.audits.push(actor);
        },
      };
      throw new Error(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../controllers/deploymentController"), "utf8"), context);
  return {
    get state() { return state; },
    get released() { return released; },
    get began() { return began; },
    async run(reason = "Resigned", endDate = "2026-11-10") {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await context.exports.updateDeploymentStatus({
        params: { deploymentId: "12" },
        body: { status: ["Completed Contract", "End of Assignment / Pulled Out by Client", "Transferred / Reassigned"].includes(reason) ? "Completed" : "Cancelled", endDate, endReason: reason, endRemarks: "Reviewed remarks" },
        user: { id: 3, username: "staff", role, fullName: "Test Staff" },
      }, res);
      return res;
    },
  };
}

for (const [reason, employment, workforce] of [
  ["Resigned", "Resigned", null], ["AWOL", "Terminated", null],
  ["Terminated", "Terminated", null], ["Completed Contract", "Active", "Floating / Standby"],
  ["End of Assignment / Pulled Out by Client", "Active", "Floating / Standby"],
  ["Transferred / Reassigned", "Active", "Floating / Standby"],
]) {
  test(`${reason}: assignment, employee scope and histories transition together; retry creates no duplicate`, async () => {
    const f = fixture();
    const res = await f.run(reason);
    assert.equal(res.statusCode, 200);
    assert.equal(f.state.employee.employment_status, employment);
    assert.equal(f.state.employee.workforce_status, workforce);
    assert.equal(isCurrentWorkforceStatus(f.state.employee.status), employment === "Active");
    assert.equal(f.state.assignment.status, workforce ? "Completed" : "Cancelled");
    assert.equal(f.state.assignment.end_reason, reason);
    assert.equal(f.state.assignment.end_date, "2026-11-10");
    assert.equal(f.state.employee.contractEnd, "2026-11-10");
    assert.equal(f.state.legacy.length, 1);
    assert.equal(f.state.legacy[0][3], "2026-11-10 00:00:00");
    assert.equal(f.state.employment.length, workforce ? 0 : 1);
    if (!workforce) assert.deepEqual(f.state.employment[0], [7, "Active", employment, "2026-11-10 00:00:00", reason, "Reviewed remarks", 3]);
    assert.equal(f.state.audits.length, 1);
    assert.equal(res.body.employmentStatus, employment);
    assert.equal(res.body.workforceStatus, workforce);
    assert.equal(f.released, true);
    const again = await f.run(reason);
    assert.equal(again.statusCode, 409);
    assert.equal(f.state.legacy.length, 1);
    assert.equal(f.state.employment.length, workforce ? 0 : 1);
  });
}
test("HR Manager may end an active assignment", async () => {
  const f = fixture({ role: "HR_MANAGER" });
  const res = await f.run("Transferred / Reassigned");
  assert.equal(res.statusCode, 200);
  assert.equal(f.state.assignment.status, "Completed");
  assert.equal(f.state.employee.employment_status, "Active");
  assert.equal(f.state.employee.workforce_status, "Floating / Standby");
});
test("assignment end date earlier than assignment start is rejected without mutation", async () => {
  const f = fixture();
  const before = structuredClone(f.state);
  const res = await f.run("Transferred / Reassigned", "2025-12-31");
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /earlier than the deployment start date/i);
  assert.deepEqual(f.state, before);
  assert.equal(f.released, true);
});

for (const invalidDate of ["", "2026-02-30", "not-a-date", "2999-01-01"]) {
  test(`invalid assignment end date ${JSON.stringify(invalidDate)} is rejected before mutation`, async () => {
    const f = fixture();
    const before = structuredClone(f.state);
    const res = await f.run("Transferred / Reassigned", invalidDate);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(f.state, before);
    assert.equal(f.began, false);
  });
}
for (const failAt of ["UPDATE employees", "INSERT INTO employee_status_history", "INSERT INTO employee_employment_history", "audit"]) {
  test(`failure at ${failAt} rolls back all changes`, async () => {
    const f = fixture({ failAt });
    const before = structuredClone(f.state);
    assert.equal((await f.run()).statusCode, 500);
    assert.deepEqual(f.state, before);
    assert.equal(f.released, true);
  });
}
for (const role of ["HR_COORDINATOR", "SUPER_ADMIN", "IT_SUPPORT"]) {
  test(`${role} cannot end deployment`, async () => {
    const f = fixture({ role });
    assert.equal((await f.run()).statusCode, 403);
    assert.equal(f.began, false);
  });
}
