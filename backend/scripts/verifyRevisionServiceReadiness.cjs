"use strict";
// Read-only role requests and SMTP authentication. This script never sends mail.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const root = path.resolve(__dirname, "../..");
const results = { emailSent: false, checks: [] };
async function main() {
  const session = JSON.parse(fs.readFileSync(path.join(root, "backend/.env.revision-session.local"), "utf8"));
  assert.equal(session.baseUrl, "http://127.0.0.1:5064");
  const fixtures = JSON.parse(fs.readFileSync(path.join(root, "artifacts/revision-guide/runtime-fixtures.json"), "utf8"));
  for (const [role, employeeId, expected] of [
    ["staff", fixtures.browserEmployee.id, 200],
    ["otherStaff", fixtures.browserEmployee.id, 200],
    ["manager", fixtures.browserEmployee.id, 200],
    ["admin", fixtures.browserEmployee.id, 200],
    ["coordinatorA", fixtures.browserDeployed.id, 200],
    ["coordinatorB", fixtures.otherCompanyEmployee.id, 200],
    ["it", fixtures.browserEmployee.id, 403],
  ]) {
    const response = await fetch(`${session.baseUrl}/api/employees/${employeeId}`, { headers: { Authorization: `Bearer ${session.users[role].token}` }, signal: AbortSignal.timeout(15000) });
    await response.arrayBuffer();
    assert.equal(response.status, expected, `${role} employee read`);
    results.checks.push({ name: `Real isolated employee access: ${role}`, status: "PASS", expectedStatus: expected });
  }
  const env = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env")));
  const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"].filter((key) => !env[key]);
  if (missing.length) {
    results.checks.push({ name: "SMTP configuration", status: "UNAVAILABLE", missing });
  } else {
    const port = Number(env.SMTP_PORT);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    assert.equal(/[\r\n]/.test(env.SMTP_FROM), false);
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000, logger: false, debug: false });
    try {
      assert.equal(await transport.verify(), true);
      results.checks.push({ name: "Actual configured SMTP connection and authentication; no message sent", status: "PASS" });
    } catch (error) {
      results.checks.push({ name: "SMTP authentication", status: "FAIL", code: error.code || "UNKNOWN", responseCode: error.responseCode || null });
      process.exitCode = 1;
    } finally { transport.close(); }
  }
  fs.writeFileSync(path.join(root, "artifacts/revision-guide/service-readiness-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
