const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { isCurrentWorkforceStatus } = require("../utils/workforceScope");

function fixture({ failAt, role = "HR_STAFF", assignmentStatus = "Active" } = {}) {
  let state = {
    employee: { id: 7, name: "Test Employee", status: "Deployed", employment_status: "Active", workforce_status: "Deployed", archived: 0 },
    assignment: { id: 12, employee_id: 7, status: assignmentStatus, company: "Test Company" },
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
        assert.equal(params[3], 12);
        state.assignment.status = params[2];
        state.assignment.end_reason = params[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE employees")) {
        assert.match(sql, /status = \?, employment_status = \?, workforce_status = \?/);
        [state.employee.status, state.employee.employment_status, state.employee.workforce_status] = params;
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
    async run(reason = "Resigned") {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await context.exports.updateDeploymentStatus({
        params: { deploymentId: "12" },
        body: { status: reason.includes("Contract") ? "Completed" : "Cancelled", endReason: reason, endRemarks: "Reviewed remarks" },
        user: { id: 3, username: "staff", role, fullName: "Test Staff" },
      }, res);
      return res;
    },
  };
}

for (const [reason, employment, workforce] of [
  ["Resigned", "Resigned", null], ["AWOL", "Terminated", null],
  ["Terminated", "Terminated", null], ["Completed Contract", "Active", "Floating / Standby"],
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
    assert.equal(f.state.legacy.length, 1);
    assert.equal(f.state.employment.length, workforce ? 0 : 1);
    if (!workforce) assert.deepEqual(f.state.employment[0], [7, "Active", employment, reason, "Reviewed remarks", 3]);
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
