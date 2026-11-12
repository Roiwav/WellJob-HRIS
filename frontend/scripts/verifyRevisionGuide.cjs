"use strict";
// Local browser acceptance checks with fictional responses only. No database,
// production credentials, email delivery, storage or remote API is used.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const output = path.join(root, "artifacts/revision-guide");
const origin = "http://127.0.0.1:4176";
const apiOrigin = "http://127.0.0.1:5058";
const browserOrigin = "http://127.0.0.1:9336";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let scenario = "no-show";
let requests = [];
const employee = { id: 1665, employeeId: 1665, name: "Fictional Employee Abad", company: "Fixture Company", position: "Fixture Position", status: "Floating / Standby", employmentStatus: "Active", employment_status: "Active", workforceStatus: "Floating / Standby", workforce_status: "Floating / Standby", dateHired: "2025-01-01", birthday: "2000-01-01", archived: 0,
  documents: [{ id: 702, name: "NBI Clearance", expirationDate: "2025-01-01", expirable: true, filePath: "fixture.pdf" }] };
const incident = { id: 812, employeeId: 1665, employeeName: employee.name, employee_name: employee.name, company: employee.company, violation: "Fixture Violation", severity: "Minor", status: "Closed", reportedAt: "2025-02-01T00:00:00Z", date: "2025-02-01", incident_date: "2025-02-01", reviewedAt: "2025-02-04T00:00:00Z", reviewed_at: "2025-02-04T00:00:00Z", description: "Fictional incident for duration verification", evidence: [] };
function alert() {
  const common = { alertKey: `fixture:${scenario}`, priority: "Medium", employeeId: 1665, employee: employee.name, date: new Date().toISOString(), timestamp: Date.now(), isRead: false, route: "/deployments", sourceType: "DEPLOYMENT", navigationAction: "view" };
  if (scenario === "pending") return { ...common, title: "Fixture Pending Arrival", deploymentAttemptId: 999, notificationPurpose: "DEPLOYMENT_SCHEDULED", status: "For Deployment", message: "Employee awaiting arrival" };
  if (["incident", "unauthorized", "stale-incident"].includes(scenario)) return { ...common, title: "Fixture Incident", route: "/incidents", sourceType: "INCIDENT", incidentId: 812, navigationAction: scenario === "stale-incident" ? "start-investigation" : "view", status: "Closed", message: "Review the exact closed case" };
  if (["compliance", "missing-document"].includes(scenario)) return { ...common, title: "Fixture Compliance", route: "/employees", sourceType: "COMPLIANCE", documentId: 702, documentName: "NBI Clearance", status: "Expired", message: "Review exact NBI Clearance" };
  if (scenario === "kpi") return { ...common, title: "Fixture KPI", route: "/kpi", sourceType: "KPI", status: "Monitor", message: "Review exact employee assessment" };
  return { ...common, title: "Fixture No Show", deploymentAttemptId: 99, notificationPurpose: "DEPLOYMENT_NO_SHOW", status: "No Show", message: "Employee returned to Floating / Standby" };
}
const api = http.createServer((req, res) => {
  const url = new URL(req.url, apiOrigin);
  requests.push(url.pathname + url.search);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.end(); return; }
  const p = url.pathname.replace(/^\/api/, "");
  let data = {};
  if (p === "/smart-alerts") data = { alerts: [alert()], latestAlerts: [alert()], unreadCount: 1, summary: { total: 1, unread: 1 } };
  else if (p.startsWith("/smart-alerts/")) data = { success: true };
  else if (p === "/system/availability" || p === "/settings/maintenance") data = { maintenance: false, maintenanceMode: false };
  else if (p === "/employees") data = { employees: [], pagination: { page: 1, pageSize: 50, total: 2000, totalPages: 40 }, filterMeta: { companies: [employee.company] } };
  else if (p === "/employees/1665") {
    if (scenario === "missing") { res.statusCode = 404; data = { error: "Employee not found" }; }
    else data = scenario === "missing-document" ? { ...employee, documents: [] } : employee;
  }
  else if (p === "/incidents/812") data = incident;
  else if (p.startsWith("/incidents/employee/")) data = [incident];
  else if (p === "/incidents") data = { incidents: [], pagination: { page: 1, total: 2000, totalPages: 40 }, caseCounts: {} };
  else if (p === "/deployments") data = { deployments: [], pagination: { page: 1, total: 0, totalPages: 0 }, summary: {} };
  else if (p === "/deployment-attempts") {
    const target = { attemptId: 999, employeeId: 1665, employeeName: employee.name, company: employee.company, position: employee.position, scheduledDate: "2026-11-12", scheduledTime: "09:00", status: "For Deployment", remarks: "Fixture arrival" };
    data = { data: url.searchParams.has("employeeId") ? [target] : Array.from({ length: 100 }, (_, i) => ({ ...target, attemptId: i + 1, employeeId: i + 1, employeeName: `Fixture Worker ${i + 1}` })) };
  }
  else if (p === "/kpi/data") {
    if (scenario === "error") { res.statusCode = 500; data = {}; }
    else data = { employeesRaw: [employee], incidentsRaw: [], fetchedAt: new Date().toISOString() };
  }
  else if (p === "/kpi/decision-history") {
    const named = { id: 1, employeeId: 1665, employeeName: employee.name, company: employee.company, systemRecommendation: "Verbal Counseling", suggestedHRAction: "Monitor Employee", finalAction: "Monitor Employee", decisionType: "Accepted", decidedBy: "hm01", decidedByName: "Maria Santos", decidedByRole: "HR_MANAGER", decidedAt: "2026-11-12T00:00:00Z", notes: "Historical notes preserved" };
    const records = scenario === "history" ? [named] : scenario === "legacy-history" ? [named, { ...named, id: 2, employeeName: null, decidedBy: "legacy-only-username", decidedByName: null, decidedByRole: "UNRECOGNIZED" }] : [];
    data = { decisions: records, records, total: records.length, pagination: { page: 1, total: records.length, totalPages: 1 }, summary: { total: records.length, accepted: records.length, modified: 0, rejected: 0 } };
  }
  else if (p.includes("companies") || p.includes("positions")) data = { data: [], companies: [] };
  else if (p.includes("smart-suggestions")) data = { suggestions: [], latestSuggestions: [], summary: {} };
  else if (p.includes("conversations") || p.includes("messages")) data = { data: [], conversations: [], messages: [], unreadCount: 0 };
  else if (p.includes("password-reset")) data = { requests: [], data: [] };
  res.end(JSON.stringify(data));
});

async function waitUrl(url) {
  for (let i = 0; i < 100; i++) {
    try { const res = await fetch(url); if (res.ok) return res; } catch {}
    await delay(200);
  }
  throw new Error(`Local server did not start: ${url}`);
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(String(data));
    if (!pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result || {});
  });
  return { close: () => socket.close(), send(method, params = {}) { const next = ++id; socket.send(JSON.stringify({ id: next, method, params })); return new Promise((resolve, reject) => pending.set(next, { resolve, reject })); } };
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve) => api.listen(5058, "127.0.0.1", resolve));
  const vite = spawn(process.execPath, [path.join(root, "frontend/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4176", "--strictPort"], { cwd: path.join(root, "frontend"), env: { ...process.env, VITE_API_BASE_URL: apiOrigin }, stdio: "ignore", windowsHide: true });
  const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=9336", `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "welljob-revisions-"))}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let cdp;
  let scriptId;
  const results = [];
  try {
    await waitUrl(origin);
    const pages = await (await waitUrl(`${browserOrigin}/json/list`)).json();
    cdp = await connect(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    // The fixture frontend uses only the two loopback origins. Block remote
    // application requests as an extra guard against accidental configuration drift.
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["https://*"] });
    const evaluate = async (expression) => {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ": " + r.exceptionDetails.exception?.description);
      return r.result?.value;
    };
    const wait = async (expression) => {
      for (let i = 0; i < 225; i++) { if (await evaluate(expression)) return; await delay(200); }
      throw new Error(`Browser assertion timed out: ${expression}\n${String(await evaluate("document.body.innerText")).slice(-5000)}`);
    };
    const boot = async (kind, role = "HR_MANAGER", width = 1440, page = "/notifications") => {
      console.log("Browser scenario:", kind, role, width);
      scenario = kind; requests = [];
      if (scriptId) await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
      const user = { id: 3, userId: 3, username: "fixture-manager", fullName: "Fixture Reviewer", role, assignedCompany: employee.company, assigned_company: employee.company, mustChangePassword: false };
      const script = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.clear();sessionStorage.clear();localStorage.setItem('token','fictional-local-test-token');localStorage.setItem('user',${JSON.stringify(JSON.stringify(user))});` });
      scriptId = script.identifier;
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      await cdp.send("Page.navigate", { url: origin + page });
      await wait("document.readyState === 'complete'");
      if (page === "/notifications") await wait("document.body.innerText.includes('Fixture ')");
    };
    const screenshot = async (name) => {
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(output, name), Buffer.from(data, "base64"));
    };
    const clickCenter = async () => { await wait("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='View' && b.offsetParent)"); await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='View' && b.offsetParent).click()"); };
    const clickNavbar = async (title) => {
      await evaluate("document.querySelector('button[title=Notifications]').click()");
      await wait(`Array.from(document.querySelectorAll('[aria-label=Notifications] button')).some(b=>b.textContent.includes(${JSON.stringify(title)}))`);
      await evaluate(`Array.from(document.querySelectorAll('[aria-label=Notifications] button')).find(b=>b.textContent.includes(${JSON.stringify(title)})).click()`);
    };
    for (const entry of ["center", "navbar"]) {
      await boot("no-show", "HR_STAFF");
      if (entry === "center") await clickCenter(); else await clickNavbar("Fixture No Show");
      await wait("location.pathname==='/employees' && !!document.querySelector('[data-employee-workforce].notification-focus')");
      assert.match(await evaluate("document.querySelector('[role=dialog]').innerText"), /Fictional Employee Abad/);
      assert.match(await evaluate("document.querySelector('[data-employee-workforce]').innerText"), /Floating \/ Standby/);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.notification-focus'),'::after').width"), "8px");
      results.push(`${entry}: exact No Show employee outside first page, workforce highlight and dot`);
      if (entry === "center") {
        await screenshot("01-no-show-workforce.png");
        await delay(5300);
        assert.equal(await evaluate("!!document.querySelector('[data-employee-workforce].notification-focus')"), false);
        results.push("temporary highlight/dot clears after five seconds");
      }
    }
    for (const entry of ["center", "navbar"]) {
      await boot("pending", "HR_COORDINATOR");
      if (entry === "center") await clickCenter(); else await clickNavbar("Fixture Pending Arrival");
      await wait("!!document.querySelector('[data-arrival-id=\"999\"].notification-focus')");
      assert.ok(requests.some((url) => url.includes("deployment-attempts") && url.includes("employeeId=1665")));
      assert.match(await evaluate("document.querySelector('[data-arrival-id=\"999\"]').innerText"), /Confirm Arrival/);
      results.push(`${entry}: coordinator exact pending arrival beyond 100-row default list`);
      if (entry === "center") await screenshot("02-pending-arrival.png");
    }
    for (const entry of ["center", "navbar"]) {
      await boot("incident");
      if (entry === "center") await clickCenter(); else await clickNavbar("Fixture Incident");
      await wait("!!document.querySelector('[role=dialog].notification-focus')");
      assert.match(await evaluate("document.querySelector('[role=dialog]').innerText"), /Days Open\s+3 days/);
      results.push(`${entry}: exact closed incident and duration stops at 2025 closure`);
      if (entry === "center") await screenshot("03-closed-incident.png");
    }
    for (const role of ["HR_MANAGER", "HR_STAFF"]) {
      for (const entry of ["center", "navbar"]) {
      await boot("compliance", role);
      if (entry === "center") await clickCenter(); else await clickNavbar("Fixture Compliance");
      await wait("!!document.querySelector('.notification-focus')");
      assert.match(await evaluate("document.querySelector('.notification-focus').innerText"), /NBI(?:\/Police)? Clearance/);
      results.push(`${entry}, ${role}: exact compliance document preserved with temporary dot`);
      await screenshot(`04-compliance-${role.toLowerCase()}.png`);
      }
    }
    for (const entry of ["center", "navbar"]) {
    await boot("kpi");
    if (entry === "center") await clickCenter(); else await clickNavbar("Fixture KPI");
    await wait("location.pathname==='/kpi' && !!document.querySelector('[role=dialog].notification-focus')");
    assert.match(await evaluate("document.querySelector('[role=dialog]').innerText"), /Fictional Employee Abad/);
    results.push(`${entry}: KPI alert opens exact authorized employee assessment`);
    }
    await boot("missing"); await clickCenter();
    await wait("document.body.innerText.includes('This record is no longer available')");
    results.push("missing employee shows friendly unavailable message");
    await boot("unauthorized", "HR_STAFF"); await clickCenter();
    await wait("document.body.innerText.includes('This record is no longer available')");
    assert.equal(await evaluate("location.pathname"), "/notifications");
    results.push("unauthorized incident destination remains on Notifications with friendly access message");
    await boot("stale-incident"); await clickCenter();
    await wait("document.body.innerText.includes('This action is no longer available for this case.')");
    assert.match(await evaluate("document.querySelector('[role=dialog]').innerText"), /Case Details/);
    results.push("resolved incident workflow alert shows friendly unavailable-action notice and reference details");
    for (const role of ["HR_STAFF", "HR_MANAGER"]) {
      await boot("missing-document", role); await clickCenter();
      await wait("document.body.innerText.includes('This compliance document is no longer available.')");
      assert.equal(await evaluate("!!document.querySelector('[role=dialog]')"), false);
      results.push(`${role}: removed compliance document shows friendly unavailable message instead of highlighting a different record`);
    }
    await boot("no-show", "HR_STAFF", 390); await clickCenter();
    await wait("!!document.querySelector('[data-employee-workforce].notification-focus')");
    assert.ok(await evaluate("document.querySelector('[role=dialog]').getBoundingClientRect().width <= innerWidth"));
    await screenshot("05-mobile-workforce.png");
    results.push("390px mobile notification opens exact employee without dialog width overflow");
    await boot("error", "HR_MANAGER", 1440, "/kpi");
    await wait("document.body.innerText.includes('The information could not be loaded. Please try again.')");
    assert.doesNotMatch(await evaluate("document.body.innerText"), /Request failed with status 500/);
    results.push("empty HTTP 500 shows friendly KPI message");
    await boot("phone", "HR_STAFF", 390, "/mobile-handoff#invalid");
    await wait("document.body.innerText.includes('This phone link is invalid.')");
    assert.match(await evaluate("document.body.innerText"), /Continue on this phone/);
    results.push("invalid phone link uses revised session terminology");
    for (const kind of ["history", "legacy-history"]) {
      await boot(kind, "HR_MANAGER", 1440, "/kpi");
      await wait("!!document.querySelector('[aria-controls=\"kpi-panel-review\"]:not([disabled])')");
      await evaluate("document.querySelector('[aria-controls=\"kpi-panel-review\"]').click()");
      await wait("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Decision History')");
      await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Decision History').click()");
      await wait("document.body.innerText.includes('Maria Santos')");
      const content = await evaluate("document.body.innerText");
      assert.match(content, /HR Manager/);
      assert.doesNotMatch(content, /hm01|legacy-only-username|HR_MANAGER|record\(s\)/);
      assert.match(content, kind === "history" ? /1 record\b/ : /2 records\b/);
      assert.match(content, /Suggested HR Workflow Action/);
      assert.match(content, /Corrective Intervention/);
      assert.match(content, /Final HR Decision/);
      if (kind === "legacy-history") {
        assert.match(content, /Reviewer name unavailable/);
        assert.match(content, /Role unavailable/);
        assert.match(content, /Employee name unavailable/);
      }
      results.push(`${kind}: real reviewer name, readable role, safe legacy fallbacks and singular/plural record wording`);
      await screenshot(`06-${kind}.png`);
    }
    const failurePath = path.join(output, "failure.png");
    if (fs.existsSync(failurePath)) fs.unlinkSync(failurePath);
    fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify({ fixtureOnly: true, results, count: results.length }, null, 2));
    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
  } catch (error) {
    if (cdp) {
      const capture = await cdp.send("Page.captureScreenshot", { format: "png" }).catch(() => null);
      if (capture?.data) fs.writeFileSync(path.join(output, "failure.png"), Buffer.from(capture.data, "base64"));
    }
    throw error;
  } finally {
    cdp?.close(); browser.kill(); vite.kill(); api.closeAllConnections(); api.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
