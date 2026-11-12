"use strict";
// Reviewed one-record correction. Default is a READ ONLY dry run.
// No assignment, incident, original history, date, reason or remarks is changed.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const root = path.resolve(__dirname, "../..");
const apply = process.argv.includes("--apply");
if (apply) {
  assert.ok(process.argv.includes("--approved-employee=1665") && process.argv.includes("--approved-assignment=1865"), "Explicit approval of employee #1665 / assignment #1865 is required");
}
async function main() {
  const env = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env")));
  const isolated = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env.phase3.runtime.local")));
  assert.equal(env.DB_NAME, "defaultdb");
  assert.equal(env.DB_HOST, isolated.DB_HOST);
  const connection = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, dateStrings: true,
    ssl: { ca: Buffer.from(isolated.DB_SSL_CA_BASE64, "base64").toString("utf8"), rejectUnauthorized: true, minVersion: "TLSv1.2", servername: env.DB_HOST } });
  let committed = false;
  try {
    await connection.query(apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY");
    const [[database]] = await connection.query("SELECT DATABASE() AS selectedDatabase");
    assert.equal(database.selectedDatabase, "defaultdb");
    const lock = apply ? " FOR UPDATE" : "";
    const [[employee]] = await connection.query(`SELECT id,status,employment_status,workforce_status,archived,contractEnd,contractEndReason,contractEndRemarks,contractEndedAt FROM employees WHERE id=1665${lock}`);
    const [assignments] = await connection.query(`SELECT id,status,end_reason,end_remarks,end_date,ended_at FROM deployment_assignments WHERE employee_id=1665 ORDER BY id DESC${lock}`);
    assert.ok(employee, "Employee no longer exists");
    const last = assignments[0];
    assert.equal(last?.id, 1865, "Latest assignment changed; requires new review");
    assert.equal(last.status, "Cancelled");
    assert.equal(last.end_reason, "Resigned");
    assert.equal(assignments.some((row) => row.status === "Active"), false);
    assert.equal(employee.archived, 0);
    assert.equal(employee.contractEndReason, "Resigned");
    assert.equal(employee.contractEnd, last.end_date);
    const [oldHistory] = await connection.query("SELECT id,from_status,to_status,effective_at,reason,remarks,source_event,changed_by_user_id FROM employee_status_history WHERE employee_id=1665 AND to_status='Inactive' AND reason='Resigned' ORDER BY id DESC LIMIT 1");
    assert.ok(oldHistory[0], "Original resignation workforce event is required; no date/actor may be guessed");
    const original = oldHistory[0];
    const [employmentHistory] = await connection.query("SELECT id FROM employee_employment_history WHERE employee_id=1665 AND to_status='Resigned' AND reason='Resigned'");
    const correct = employee.status === "Inactive" && employee.employment_status === "Resigned" && employee.workforce_status === null;
    if (!correct) {
      assert.equal(employee.status, "Inactive");
      assert.equal(employee.employment_status, "Active");
      assert.equal(employee.workforce_status, "Deployed");
    }
    assert.ok(original.effective_at);
    const plan = {
      mode: apply ? "APPLY" : "READ_ONLY_DRY_RUN", employeeId: 1665, assignmentId: 1865,
      before: { status: employee.status, employment_status: employee.employment_status, workforce_status: employee.workforce_status },
      after: { status: "Inactive", employment_status: "Resigned", workforce_status: null },
      originalWorkforceHistoryId: original.id,
      preservedEffectiveAtStored: original.effective_at,
      originalSeparationActorId: original.changed_by_user_id,
      addMissingEmploymentHistory: employmentHistory.length === 0,
      preserveAssignmentAndOriginalHistory: true, alreadyCorrect: correct && employmentHistory.length > 0,
    };
    const beforeSnapshot = { employee, assignments, originalWorkforceEvent: original, matchingEmploymentHistory: employmentHistory };
    fs.mkdirSync(path.join(root, "artifacts/revision-guide"), { recursive: true });
    fs.writeFileSync(path.join(root, "artifacts/revision-guide/employee-1665-correction-plan.json"), JSON.stringify(plan, null, 2));
    if (!apply) { console.log(JSON.stringify(plan, null, 2)); return; }
    fs.writeFileSync(path.join(root, "backend/.env.revision-1665-backup.local"), JSON.stringify(beforeSnapshot, null, 2));
    if (!correct) {
      const [result] = await connection.query("UPDATE employees SET employment_status='Resigned',workforce_status=NULL WHERE id=1665 AND status='Inactive' AND employment_status='Active' AND workforce_status='Deployed' AND archived=0");
      assert.equal(result.affectedRows, 1);
    }
    if (employmentHistory.length === 0) {
      await connection.query(`INSERT INTO employee_employment_history (employee_id,from_status,to_status,effective_at,reason,remarks,source_event,changed_by_user_id)
        VALUES (1665,'Active','Resigned',?,?,?,'EMPLOYMENT_SEPARATED',?)`, [original.effective_at, original.reason, original.remarks, original.changed_by_user_id]);
    }
    if (!plan.alreadyCorrect) {
      await connection.query(`INSERT INTO audit_logs (user_id,username,full_name,role,category,action,description)
        VALUES (NULL,NULL,'Approved revision data correction','SYSTEM','OPERATIONAL','REPAIR_EMPLOYEE_SEPARATION_STATE',?)`,
      ["Corrected employee #1665 canonical employment/workforce state using recorded Resigned assignment #1865 and original workforce event #" + original.id + ". Original separation timestamp, actor, reason and remarks were preserved; assignments, incidents and prior history were not rewritten."]);
    }
    const [[verified]] = await connection.query("SELECT status,employment_status,workforce_status FROM employees WHERE id=1665");
    assert.equal(verified.employment_status, "Resigned"); assert.equal(verified.workforce_status, null);
    const [[count]] = await connection.query("SELECT COUNT(*) AS total FROM employee_employment_history WHERE employee_id=1665 AND to_status='Resigned' AND reason='Resigned'");
    assert.equal(count.total, 1);
    await connection.commit(); committed = true;
    fs.writeFileSync(path.join(root, "artifacts/revision-guide/employee-1665-correction-result.json"), JSON.stringify({ ...plan, committed: true, verified, historyRows: count.total }, null, 2));
    console.log(JSON.stringify({ employeeId: 1665, committed: true, verified, historyRows: count.total }, null, 2));
  } finally { if (!committed) await connection.rollback(); await connection.end(); }
}
main().catch((error) => { console.error(`Correction stopped: ${error.message}`); process.exitCode = 1; });
