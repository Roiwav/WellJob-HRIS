"use strict";
// Real services, isolated fixtures only. Never selects a production database
// or bucket and never starts account/email/scheduler workflows.
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
require("dotenv").config({ path: path.join(root, "backend/.env.phase3.runtime.local"), override: true, quiet: true });
require("dotenv").config({ path: path.join(root, "backend/.env"), quiet: true });
assert.equal(process.env.DB_NAME, "welljob_phase3_test", "Refusing any database except the existing isolated test database");
assert.equal(process.env.DB_EXPECTED_NAME, "welljob_phase3_test");
assert.equal(process.env.SUPABASE_STORAGE_BUCKET, "welljob-phase3-test", "Refusing a production storage bucket");
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.NODE_ENV = "test";
process.env.FRONTEND_ORIGIN = "http://127.0.0.1:4178";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "9";
process.env.SMTP_USER = "fictional-no-delivery";
process.env.SMTP_PASSWORD = "fictional-no-delivery";
const db = require("../config/db");
const { supabase, SUPABASE_STORAGE_BUCKET } = require("../config/supabase");
const output = path.join(root, "artifacts/revision-guide");
const sessionFile = path.join(root, "backend/.env.revision-session.local");
const runId = `${Date.now()}-${process.pid}`;
const tag = crypto.randomBytes(5).toString("hex").replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit)));
const checks = [];
const fixtures = { runId, companyA: `Revision Fictional Client A ${runId}`, companyB: `Revision Fictional Client B ${runId}`, position: "Revision Test Associate", employees: [], users: {} };
let server;
const pass = (name, detail = "") => { checks.push({ name, status: "PASS", detail }); console.log(`PASS: ${name}`); };

async function preflight() {
  const [[row]] = await db.promise().query("SELECT DATABASE() AS selectedDatabase, VERSION() AS version");
  assert.equal(row.selectedDatabase, "welljob_phase3_test");
  const [tls] = await db.promise().query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  assert.ok(tls[0]?.Value, "Database connection must use TLS");
  const { data: bucket, error } = await supabase.storage.getBucket(SUPABASE_STORAGE_BUCKET);
  if (error) throw new Error(`Isolated bucket preflight failed: ${error.message}`);
  assert.equal(bucket.public, false, "Test bucket must remain private");
  pass("Real MySQL and private Supabase preflight", { database: row.selectedDatabase, version: row.version, tls: true, bucket: bucket.id, public: false });
}

async function request(route, { role = "staff", method = "GET", body, token } = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
    method, headers: { Authorization: `Bearer ${token || fixtures.users[role].token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}
function status(result, expected, label) { assert.equal(result.status, expected, `${label}: HTTP ${result.status}: ${JSON.stringify(result.data)}`); return result.data; }
const governmentDocuments = [
  { name: "SSS (ID or E1 form)", documentNumber: "0012345678" },
  { name: "PhilHealth (ID or MDF Form)", documentNumber: "001234567890" },
  { name: "Pag-IBIG (ID or MDRF Form)", documentNumber: "000123456789" },
];
function employeeBody(name, deployed = false, company = fixtures.companyA) {
  return { name: `Revision ${name} ${tag}`, birthday: "2000-01-01", dateHired: "2025-01-01", company, position: fixtures.position, status: deployed ? "Deployed" : "Floating / Standby", ...(deployed ? { contractStart: "2025-01-02" } : {}), documents: governmentDocuments };
}
async function createEmployee(name, deployed = false, company) {
  const body = employeeBody(name, deployed, company);
  const data = status(await request("/employees", { method: "POST", body }), 201, "Create fictional employee");
  const record = { id: data.id, body };
  fixtures.employees.push(record);
  return record;
}
async function setup() {
  const jwt = require("jsonwebtoken");
  for (const company of [fixtures.companyA, fixtures.companyB]) {
    const [result] = await db.promise().query("INSERT INTO client_companies (company_name,is_active) VALUES (?,1)", [company]);
    await db.promise().query("INSERT INTO company_positions (company_id,position_name,is_active) VALUES (?,?,1)", [result.insertId, fixtures.position]);
  }
  for (const [key, role, company] of [
    ["staff", "HR_STAFF", null], ["otherStaff", "HR_STAFF", null], ["manager", "HR_MANAGER", null],
    ["coordinatorA", "HR_COORDINATOR", fixtures.companyA], ["coordinatorB", "HR_COORDINATOR", fixtures.companyB],
    ["admin", "SUPER_ADMIN", null], ["it", "IT_SUPPORT", null],
  ]) {
    const username = `revision_${key}_${runId}`;
    const [result] = await db.promise().query("INSERT INTO users (full_name,username,password,role,assigned_company,status,must_change_password,token_version) VALUES (?,?,?,?,?,'Active',0,1)", [`Revision Fictional ${role}`, username, "fixture-no-interactive-password", role, company]);
    const claims = { id: result.insertId, username, tokenVersion: 1 };
    fixtures.users[key] = { id: result.insertId, username, role, fullName: `Revision Fictional ${role}`, assignedCompany: company, token: jwt.sign(claims, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "2h" }) };
  }
  const app = require("../app");
  server = await new Promise((resolve) => { const instance = app.listen(5064, "127.0.0.1", () => resolve(instance)); });
  pass("Fictional runtime fixtures created in isolated database");
}
async function separationChecks() {
  for (const [reason, employment] of [["Resigned", "Resigned"], ["AWOL", "Terminated"], ["Terminated", "Terminated"], ["Completed Contract", "Active"]]) {
    const employee = await createEmployee(reason.replace(/ /g, ""), true);
    const [[assignment]] = await db.promise().query("SELECT id FROM deployment_assignments WHERE employee_id=? AND status='Active'", [employee.id]);
    assert.ok(assignment);
    const before = await db.promise().query("SELECT COUNT(*) AS total FROM employee_status_history WHERE employee_id=?", [employee.id]);
    const action = { status: reason === "Completed Contract" ? "Completed" : "Cancelled", endReason: reason, endRemarks: `Fictional revision verification ${runId}` };
    const response = status(await request(`/deployments/${assignment.id}/status`, { method: "PATCH", body: action }), 200, reason);
    const [[saved]] = await db.promise().query("SELECT status,employment_status,workforce_status FROM employees WHERE id=?", [employee.id]);
    assert.equal(saved.employment_status, employment);
    assert.equal(saved.status, employment === "Active" ? "Floating / Standby" : "Inactive");
    assert.equal(saved.workforce_status, employment === "Active" ? "Floating / Standby" : null);
    assert.equal(response.employmentStatus, employment);
    const [[active]] = await db.promise().query("SELECT COUNT(*) AS total FROM deployment_assignments WHERE employee_id=? AND status='Active'", [employee.id]);
    assert.equal(active.total, 0);
    const [[history]] = await db.promise().query("SELECT COUNT(*) AS total FROM employee_employment_history WHERE employee_id=? AND source_event='EMPLOYMENT_SEPARATED'", [employee.id]);
    assert.equal(history.total, employment === "Active" ? 0 : 1);
    status(await request(`/deployments/${assignment.id}/status`, { method: "PATCH", body: action }), 409, "Duplicate separation");
    const [[after]] = await db.promise().query("SELECT COUNT(*) AS total FROM employee_status_history WHERE employee_id=?", [employee.id]);
    assert.equal(after.total, before[0][0].total + 1);
    for (const scope of ["active", "archived"]) {
      const list = status(await request(`/employees?view=summary&scope=${scope}&search=${encodeURIComponent(employee.body.name)}&pageSize=100`, { role: "manager" }), 200, "Employee scope");
      const present = list.employees.some((row) => Number(row.id) === employee.id);
      if (employment !== "Active") assert.equal(present, scope === "archived");
    }
    pass(`Real MySQL ${reason}: atomic state, history, retry and scopes`);
  }
  const racing = await createEmployee("Concurrent Separation", true);
  const [[assignment]] = await db.promise().query("SELECT id FROM deployment_assignments WHERE employee_id=? AND status='Active'", [racing.id]);
  const races = await Promise.all(["Resigned", "Terminated"].map((reason) => request(`/deployments/${assignment.id}/status`, { method: "PATCH", body: { status: "Cancelled", endReason: reason } })));
  assert.deepEqual(races.map((result) => result.status).sort(), [200, 409]);
  const [[history]] = await db.promise().query("SELECT COUNT(*) AS total FROM employee_employment_history WHERE employee_id=? AND source_event='EMPLOYMENT_SEPARATED'", [racing.id]);
  assert.equal(history.total, 1);
  pass("Real MySQL simultaneous separation: one winner, one conflict, one history row");

  // Fault injection uses real pooled MySQL connections and real transaction
  // writes. Only the selected failing SQL is replaced with a real SQL error.
  const { updateDeploymentStatus } = require("../controllers/deploymentController");
  for (const failure of ["UPDATE employees", "INSERT INTO employee_status_history", "INSERT INTO employee_employment_history", "INSERT INTO audit_logs"]) {
    const employee = await createEmployee("Rollback Probe", true);
    const [[assignment]] = await db.promise().query("SELECT id FROM deployment_assignments WHERE employee_id=? AND status='Active'", [employee.id]);
    const snapshot = async () => {
      const [employees] = await db.promise().query("SELECT status,employment_status,workforce_status,contractEnd,contractEndReason,contractEndedAt FROM employees WHERE id=?", [employee.id]);
      const [assignments] = await db.promise().query("SELECT status,end_date,end_reason,ended_at FROM deployment_assignments WHERE id=?", [assignment.id]);
      const [legacy] = await db.promise().query("SELECT id FROM employee_status_history WHERE employee_id=?", [employee.id]);
      const [employment] = await db.promise().query("SELECT id FROM employee_employment_history WHERE employee_id=?", [employee.id]);
      return { employees, assignments, legacy, employment };
    };
    const before = await snapshot();
    const originalPromise = db.promise;
    db.promise = function () {
      const pool = originalPromise.call(db);
      return new Proxy(pool, { get(target, property) {
        if (property === "getConnection") return async () => {
          const connection = await target.getConnection();
          return new Proxy(connection, { get(conn, key) {
            if (key === "query") return (sql, params) => {
              if (String(sql).replace(/\s+/g, " ").trim().startsWith(failure)) return conn.query("SELECT revision_intentionally_missing_column");
              return conn.query(sql, params);
            };
            const value = conn[key]; return typeof value === "function" ? value.bind(conn) : value;
          } });
        };
        const value = target[property]; return typeof value === "function" ? value.bind(target) : value;
      } });
    };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    try {
      await updateDeploymentStatus({ params: { deploymentId: String(assignment.id) }, body: { status: "Cancelled", endReason: "Resigned" }, user: fixtures.users.staff }, res);
    } finally { db.promise = originalPromise; }
    assert.equal(res.code, 500);
    assert.deepEqual(await snapshot(), before);
    pass(`Real MySQL rollback after injected SQL failure: ${failure}`);
  }
}
async function workflowChecks() {
  const employee = await createEmployee("Arrival Workflow");
  const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const scheduledDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const makeAttempt = async () => {
    const data = status(await request(`/employees/${employee.id}/deployment-attempts`, { method: "POST", body: { scheduledDate, scheduledTime: "09:00", remarks: "Fictional arrival regression" } }), 201, "Schedule arrival");
    return data.attemptId || data.data?.attemptId || data.id || data.attempt?.attemptId;
  };
  let attemptId = await makeAttempt();
  assert.ok(attemptId);
  status(await request(`/deployment-attempts/${attemptId}/no-show`, { role: "coordinatorB", method: "PATCH", body: {} }), 403, "Cross-company No Show");
  status(await request(`/deployment-attempts/${attemptId}/no-show`, { role: "coordinatorA", method: "PATCH", body: { remarks: "Fixture did not arrive" } }), 200, "No Show");
  const [[floating]] = await db.promise().query("SELECT status,workforce_status FROM employees WHERE id=?", [employee.id]);
  assert.equal(floating.status, "Floating / Standby");
  assert.equal(floating.workforce_status, "Floating / Standby");
  attemptId = await makeAttempt();
  status(await request(`/deployment-attempts/${attemptId}/confirm-arrival`, { role: "coordinatorA", method: "PATCH", body: { actualArrivalDate: date } }), 200, "Confirm Arrival");
  const [[arrived]] = await db.promise().query("SELECT status,workforce_status FROM employees WHERE id=?", [employee.id]);
  assert.equal(arrived.status, "Deployed");
  assert.equal(arrived.workforce_status, "Deployed");
  pass("Real Confirm Arrival / No Show and cross-company denial remain correct");
  fixtures.browserEmployee = await createEmployee("Browser Employee");
  fixtures.browserDeployed = await createEmployee("Browser Deployed", true);
  fixtures.otherCompanyEmployee = await createEmployee("Other Company Employee", true, fixtures.companyB);
  const calendar = status(await request(`/employees/${fixtures.browserEmployee.id}`), 200, "Employee calendar serialization");
  assert.equal(calendar.birthday, "2000-01-01");
  assert.equal(calendar.date_hired, "2025-01-01");
  const [[types]] = await db.promise().query("SELECT CAST('2025-01-01' AS DATE) AS calendarDay, CAST('2025-01-01 12:00:00' AS DATETIME) AS timestampValue");
  assert.equal(types.calendarDay, "2025-01-01");
  assert.ok(types.timestampValue instanceof Date);
  pass("MySQL DATE values retain their calendar date through the employee API; DATETIME behavior is unchanged");
}
async function serviceChecks() {
  const jwt = require("jsonwebtoken");
  const employee = fixtures.browserEmployee;
  const expired = jwt.sign({ id: fixtures.users.staff.id, username: fixtures.users.staff.username, tokenVersion: 1 }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: -10 });
  status(await request(`/employees/${employee.id}`, { token: expired }), 401, "Expired session");
  status(await request(`/employees/${fixtures.otherCompanyEmployee.id}`, { role: "coordinatorA" }), 404, "Cross-company employee");
  status(await request(`/employees/${employee.id}`, { role: "it" }), 403, "IT employee access");
  status(await request(`/employees/${fixtures.browserDeployed.id}`, { role: "coordinatorA" }), 200, "Same-company employee");
  pass("Real expired-session, role and company access enforcement");
  const createLink = async () => status(await request(`/employees/${employee.id}/mobile-handoff`, { method: "POST", body: {} }), 201, "Create phone session");
  const link = await createLink();
  assert.ok(link.token);
  status(await request("/employee-mobile-handoffs/resolve", { role: "otherStaff", method: "POST", body: { token: link.token } }), 410, "Phone ownership");
  status(await request("/employee-mobile-handoffs/resolve", { method: "POST", body: { token: link.token } }), 200, "Resolve phone session");
  status(await request("/employee-mobile-handoffs/resolve", { method: "POST", body: { token: link.token } }), 410, "Phone one-time consumption");
  const expiredLink = await createLink();
  await db.promise().query("UPDATE employee_mobile_handoffs SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE token_hash=? AND created_by_user_id=?", [crypto.createHash("sha256").update(expiredLink.token).digest("hex"), fixtures.users.staff.id]);
  status(await request("/employee-mobile-handoffs/resolve", { method: "POST", body: { token: expiredLink.token } }), 410, "Phone expiry");
  pass("Real phone-link ownership, one-time consumption and database UTC expiry");

  const buffer = Buffer.from("%PDF-1.4\n% Fictional revision document\n%%EOF\n");
  const authorization = status(await request("/employee-documents/upload-authorizations", { method: "POST", body: { purpose: "update", employeeId: employee.id, files: [{ clientIndex: 0, name: `revision-${runId}.pdf`, type: "application/pdf", size: buffer.length }] } }), 200, "Authorize real private upload");
  assert.equal(authorization.uploads.length, 1);
  const upload = authorization.uploads[0];
  const put = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": "application/pdf", "x-upsert": "false" }, body: buffer });
  assert.ok(put.ok, `Private upload HTTP ${put.status}`);
  const documents = [...governmentDocuments, { name: "NBI/Police Clearance", expirationDate: "2027-11-12", documentNumber: "", filePath: "" }];
  status(await request(`/employees/${employee.id}`, { method: "PUT", body: { ...employee.body, documents, directUploads: [{ descriptor: upload.descriptor, documentIndex: 3 }] } }), 200, "Finalize real upload");
  const [[document]] = await db.promise().query("SELECT id,file_path FROM employee_documents WHERE employee_id=? AND name='NBI/Police Clearance'", [employee.id]);
  assert.ok(document?.file_path);
  const { data: binary, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(document.file_path);
  if (error) throw error;
  assert.deepEqual(Buffer.from(await binary.arrayBuffer()), buffer);
  const protectedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/employee-documents/${document.id}/file`, { headers: { Authorization: `Bearer ${fixtures.users.staff.token}` } });
  assert.equal(protectedResponse.status, 200);
  assert.deepEqual(Buffer.from(await protectedResponse.arrayBuffer()), buffer);
  status(await request(`/employee-documents/${document.id}/file`, { role: "coordinatorB" }), 404, "Cross-company document");
  fixtures.browserDocumentId = document.id;
  pass("Actual private Supabase signed upload, finalization, protected download and denied cross-company access");
}
function saveEvidence() {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "runtime-results.json"), JSON.stringify({ database: "welljob_phase3_test", bucket: SUPABASE_STORAGE_BUCKET, runId, checks, count: checks.length }, null, 2));
  const { users, ...safeFixtures } = fixtures;
  fs.writeFileSync(path.join(output, "runtime-fixtures.json"), JSON.stringify({ ...safeFixtures, users: Object.fromEntries(Object.entries(users).map(([key, { token, ...user }]) => [key, user])) }, null, 2));
}
async function main() {
  await preflight();
  if (process.argv.includes("--preflight")) return;
  assert.ok(process.argv.includes("--confirm-test-writes"), "Explicit --confirm-test-writes is required");
  await setup();
  await separationChecks();
  await workflowChecks();
  await serviceChecks();
  saveEvidence();
  if (process.argv.includes("--serve")) {
    fs.writeFileSync(sessionFile, JSON.stringify({ baseUrl: "http://127.0.0.1:5064", ...fixtures }));
    console.log("READY: isolated real-service browser runtime on localhost:5064; session material stored only in ignored local file");
    await new Promise((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  server?.closeAllConnections();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  await db.promise().end();
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
});
