"use strict";
// Read-only release/data inspection. Contains no production mutation path.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const root = path.resolve(__dirname, "../..");
const output = path.join(root, "artifacts/revision-guide");
async function productionRecord() {
  const config = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env")));
  const isolated = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env.phase3.runtime.local")));
  assert.equal(config.DB_NAME, "defaultdb");
  assert.equal(config.DB_HOST, isolated.DB_HOST, "Production TLS certificate must belong to the same verified host");
  const connection = await mysql.createConnection({ host: config.DB_HOST, port: Number(config.DB_PORT), user: config.DB_USER, password: config.DB_PASSWORD, database: config.DB_NAME, dateStrings: true,
    ssl: { ca: Buffer.from(isolated.DB_SSL_CA_BASE64, "base64").toString("utf8"), rejectUnauthorized: true, minVersion: "TLSv1.2", servername: config.DB_HOST } });
  try {
    await connection.query("START TRANSACTION READ ONLY");
    const [[target]] = await connection.query("SELECT DATABASE() AS selectedDatabase");
    assert.equal(target.selectedDatabase, "defaultdb");
    const [employees] = await connection.query("SELECT id,status,employment_status,workforce_status,archived,contractStart,contractEnd,contractEndReason,contractEndRemarks,contractEndedAt FROM employees WHERE id=1665");
    const [assignments] = await connection.query("SELECT id,employee_id,start_date,end_date,end_reason,end_remarks,status,ended_at FROM deployment_assignments WHERE employee_id=1665 ORDER BY id DESC");
    const [workforceHistory] = await connection.query("SELECT id,from_status,to_status,effective_at,reason,remarks,source_event,changed_by_user_id FROM employee_status_history WHERE employee_id=1665 ORDER BY id DESC");
    const [employmentHistory] = await connection.query("SELECT id,from_status,to_status,effective_at,reason,remarks,source_event,changed_by_user_id FROM employee_employment_history WHERE employee_id=1665 ORDER BY id DESC");
    const [[scopes]] = await connection.query(`SELECT
      SUM(archived=0 AND employment_status='Active') AS active,
      SUM(archived=1 OR employment_status IN ('Resigned','Terminated') OR status='Inactive') AS separated
      FROM employees WHERE id=1665`);
    const backup = JSON.parse(fs.readFileSync(path.join(root, "backend/.env.revision-1665-backup.local"), "utf8"));
    const preservedAssignment = backup.assignments.find((row) => row.id === 1865);
    const currentAssignment = assignments.find((row) => row.id === 1865);
    for (const key of Object.keys(preservedAssignment)) assert.deepEqual(currentAssignment[key], preservedAssignment[key]);
    assert.deepEqual(workforceHistory.find((row) => row.id === backup.originalWorkforceEvent.id), backup.originalWorkforceEvent);
    const snapshot = { inspectedAt: new Date().toISOString(), database: target.selectedDatabase, employeeId: 1665, employees, assignments, workforceHistory, employmentHistory };
    fs.writeFileSync(path.join(root, "backend/.env.revision-production-snapshot.local"), JSON.stringify(snapshot, null, 2));
    const employee = employees[0];
    const last = assignments[0];
    const separation = last?.status === "Cancelled" && ["Resigned", "Terminated", "AWOL"].includes(last.end_reason);
    const desiredEmployment = last?.end_reason === "Resigned" ? "Resigned" : "Terminated";
    return { readOnly: true, employeeId: 1665, found: Boolean(employee), employee: employee ? { legacy: employee.status, employment: employee.employment_status, workforce: employee.workforce_status, archived: employee.archived } : null,
      latestAssignment: last ? { id: last.id, status: last.status, endReason: last.end_reason, endDate: last.end_date, endedAt: last.ended_at } : null,
      activeAssignments: assignments.filter((row) => row.status === "Active").length,
      employmentHistoryCount: employmentHistory.length,
      resignationHistoryCount: employmentHistory.filter((row) => row.to_status === "Resigned" && row.reason === "Resigned").length,
      scopeMembership: scopes,
      originalAssignmentAndWorkforceEventPreserved: true,
      mismatch: Boolean(employee && separation && (employee.status !== "Inactive" || employee.employment_status !== desiredEmployment || employee.workforce_status !== null)),
      proposedState: separation ? { status: "Inactive", employment_status: desiredEmployment, workforce_status: null } : null,
      modified: false };
  } finally { await connection.rollback(); await connection.end(); }
}
function token() {
  const candidates = [path.join(process.env.APPDATA || "", "com.vercel.cli/Data/auth.json"), path.join(process.env.APPDATA || "", "com.vercel.cli/auth.json"), path.join(os.homedir(), ".vercel/auth.json"), path.join(process.env.LOCALAPPDATA || "", "com.vercel.cli/auth.json")];
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  for (const file of candidates) { if (fs.existsSync(file)) { const value = JSON.parse(fs.readFileSync(file, "utf8")).token; if (value) return value; } }
  return null;
}
async function vercelAccess() {
  const auth = token();
  if (!auth) return { available: false, reason: "No saved Vercel CLI authentication" };
  const checks = [];
  for (const route of ["/v2/user", "/v2/teams"]) {
    const response = await fetch(`https://api.vercel.com${route}`, { headers: { Authorization: `Bearer ${auth}` } });
    const data = await response.json().catch(() => ({}));
    checks.push({ endpoint: route, status: response.status, code: data.error?.code || null, message: data.error?.message || null, teams: Array.isArray(data.teams) ? data.teams.map((team) => ({ id: team.id, slug: team.slug })) : undefined });
  }
  return { available: checks.every((check) => check.status === 200), checks };
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const result = {};
  for (const [name, action] of [["productionRecord", productionRecord], ["vercelAccess", vercelAccess]]) {
    try { result[name] = await action(); }
    catch (error) { result[name] = { error: error.message }; }
  }
  fs.writeFileSync(path.join(output, "release-inspection.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
