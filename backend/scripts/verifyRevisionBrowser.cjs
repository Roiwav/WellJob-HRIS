"use strict";
// The real UI, real Express API, isolated MySQL database and private test
// Supabase bucket. Only fictional users/documents from the runtime verifier.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const session = JSON.parse(fs.readFileSync(path.join(root, "backend/.env.revision-session.local"), "utf8"));
assert.equal(session.baseUrl, "http://127.0.0.1:5064");
const origin = "http://127.0.0.1:4178";
const output = path.join(root, "artifacts/revision-guide");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const pass = (name) => { checks.push({ name, status: "PASS" }); console.log(`PASS: ${name}`); };
let intercept = null;
let paused = null;
let cdp;
async function api(route, { role = "staff", method = "GET", body } = {}) {
  const response = await fetch(`${session.baseUrl}/api${route}`, { method,
    headers: { Authorization: `Bearer ${session.users[role].token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const pending = new Map(); let sequence = 0;
  socket.addEventListener("message", async ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.method === "Fetch.requestPaused") {
      const event = message.params;
      const target = new URL(event.request.url);
      const match = intercept && target.pathname === intercept.path && event.request.method === intercept.method;
      if (match) { paused = event; intercept = null; }
      else await cdp.send("Fetch.continueRequest", { requestId: event.requestId }).catch(() => {});
    }
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result || {});
  });
  return { close: () => socket.close(), send(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); } };
}
async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function wait(predicate, label) {
  for (let i = 0; i < 250; i++) { if (await predicate()) return; await delay(200); }
  throw new Error(`Timed out: ${label}\n${String(await evaluate("document.body.innerText")).slice(-4000)}`);
}
const domWait = (expression) => wait(() => evaluate(expression), expression);
async function clickText(text) {
  await domWait(`Array.from(document.querySelectorAll('button')).some(b=>b.offsetParent && b.textContent.trim()===${JSON.stringify(text)} && !b.disabled)`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.offsetParent && b.textContent.trim()===${JSON.stringify(text)} && !b.disabled).click()`);
}
async function setField(selector, value) {
  await domWait(`!!document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  await delay(120);
}
async function screenshot(name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name), Buffer.from(data, "base64"));
}
async function navigate(route) { await cdp.send("Page.navigate", { url: origin + route }); await domWait("document.readyState==='complete'"); }
async function fillAdd(name) {
  await clickText("Add Employee");
  await domWait("!!document.querySelector('input[name=name]')");
  await setField("input[name=name]", name);
  await setField("input[name=birthday]", "2000-01-01");
  await setField("input[name=dateHired]", "2025-01-01");
  await domWait(`Array.from(document.querySelector('select[name=company]').options).some(o=>o.value===${JSON.stringify(session.companyA)})`);
  await setField("select[name=company]", session.companyA);
  await domWait(`Array.from(document.querySelector('select[name=position]').options).some(o=>o.value===${JSON.stringify(session.position)})`);
  await setField("select[name=position]", session.position);
  await evaluate("(()=>{const b=document.querySelector('[aria-controls=employee-compliance-documents]');if(b.getAttribute('aria-expanded')!=='true')b.click()})()");
  const documents = [["SSS (ID or E1 form)", "0012345678"], ["Pag-IBIG (ID or MDRF Form)", "000123456789"], ["PhilHealth (ID or MDF Form)", "001234567890"]];
  for (const [name, number] of documents) {
    await domWait(`!!document.getElementById(${JSON.stringify(`employee-document-${name}`)})`);
    await evaluate(`document.getElementById(${JSON.stringify(`employee-document-${name}`)}).click()`);
    await setField(`input[id=${JSON.stringify(`employee-document-number-${name}`)}]`, number);
    await evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(`employee-document-upload-${name}`)});const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4\\n% Fictional revision proof\\n%%EOF\\n'],'revision-proof.pdf',{type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await delay(150);
  }
  await clickText("Review Details");
  await domWait("document.body.innerText.includes('Review Employee Details')");
  await acknowledge();
}
async function acknowledge() {
  await evaluate("(()=>{const checkbox=document.querySelector('[role=dialog] input[type=checkbox]');if(checkbox&&!checkbox.checked)checkbox.click()})()");
}
async function continuePaused(fail = false) {
  assert.ok(paused);
  const event = paused; paused = null;
  const params = { requestId: event.requestId };
  if (fail) {
    const body = event.request.postData;
    assert.ok(body, "Expected a request body for server-side rejection");
    if (body.trim().startsWith("{")) params.postData = Buffer.from(JSON.stringify({ ...JSON.parse(body), birthday: "2999-01-01" })).toString("base64");
    else {
      assert.ok(body.includes("2000-01-01"));
      params.postData = Buffer.from(body.replace("2000-01-01", "2999-01-01")).toString("base64");
    }
  }
  await cdp.send("Fetch.continueRequest", params);
}
async function startSave(method, route, button) {
  intercept = { method, path: route }; paused = null;
  await clickText(button);
  await wait(() => Boolean(paused), "Request paused before server save");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('h2')).some(h=>h.textContent.includes('Successfully'))"), false);
  pass(`${method}: no success toast before the real server confirms its save`);
}
async function findEmployee(name) {
  const result = await api(`/employees?view=summary&scope=active&pageSize=100&search=${encodeURIComponent(name)}`);
  assert.equal(result.status, 200);
  return result.data.employees.find((row) => row.name.toLowerCase() === name.toLowerCase());
}
async function openEdit(name) {
  await navigate("/employees");
  await domWait("!!document.querySelector('input[placeholder^=\"Search by name\"]:not([disabled])')");
  await setField('input[placeholder^="Search by name"]', name);
  await domWait(`!!document.querySelector('button[aria-label=${JSON.stringify(`Edit ${name}`)}]')`);
  await evaluate(`document.querySelector('button[aria-label=${JSON.stringify(`Edit ${name}`)}]').click()`);
  await domWait("!!document.querySelector('input[name=name]')");
}
async function main() {
  const vite = spawn(process.execPath, [path.join(root, "frontend/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4178", "--strictPort"], { cwd: path.join(root, "frontend"), env: { ...process.env, VITE_API_BASE_URL: session.baseUrl }, stdio: "ignore", windowsHide: true });
  const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=9338", `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "welljob-real-browser-"))}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let browserUser = "staff";
  let scriptId;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await delay(200); }
    let pages;
    for (let i = 0; i < 100; i++) { try { pages = await (await fetch("http://127.0.0.1:9338/json/list")).json(); break; } catch {} await delay(200); }
    cdp = await connect(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*127.0.0.1:5064/api/employees*", requestStage: "Request" }] });
    const useUser = async (key) => {
      browserUser = key;
      if (scriptId) await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
      const { token, ...user } = session.users[key];
      const script = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.clear();sessionStorage.clear();localStorage.setItem('token',${JSON.stringify(token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify({ ...user, mustChangePassword: false }))});` });
      scriptId = script.identifier;
    };
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await useUser("staff"); await navigate("/employees");
    const suffix = `${Date.now()}-${process.pid}`.replace(/[0-9-]/g, (char) => char === "-" ? "z" : String.fromCharCode(97 + Number(char)));
    const added = `Revision Browser Added ${suffix[0].toUpperCase() + suffix.slice(1)}`;
    await fillAdd(added);
    await startSave("POST", "/api/employees", "Proceed and Save");
    assert.equal(await findEmployee(added), undefined);
    await continuePaused();
    await domWait("Array.from(document.querySelectorAll('h2')).some(h=>h.textContent==='Employee Added Successfully')");
    const saved = await findEmployee(added); assert.ok(saved);
    const detail = await api(`/employees/${saved.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.birthday, "2000-01-01");
    assert.equal(detail.data.date_hired, "2025-01-01");
    assert.equal(detail.data.documents.length, 3);
    assert.ok(detail.data.documents.every((doc) => doc.filePath || doc.file_path));
    await screenshot("07-real-add-success.png");
    pass("Real browser Add Employee saves three protected proof files and displays the Add success title");
    await navigate("/employees");
    const failedName = added.replace("Added", "Failed");
    await fillAdd(failedName);
    await startSave("POST", "/api/employees", "Proceed and Save");
    await continuePaused(true);
    await domWait("document.body.innerText.includes('Birthday cannot be in the future') || document.body.innerText.includes('birthday cannot be in the future')");
    assert.equal(await findEmployee(failedName), undefined);
    assert.equal(await evaluate("document.body.innerText.includes('Employee Added Successfully')"), false);
    await screenshot("08-real-add-rejected.png");
    pass("Real server rejected Add: error visible, no employee persisted and no success toast");
    await openEdit(added);
    assert.equal(await evaluate("document.querySelector('input[name=birthday]').value"), "2000-01-01");
    assert.equal(await evaluate("document.querySelector('input[name=dateHired]').value"), "2025-01-01");
    const edited = added.replace("Added", "Edited");
    await setField("input[name=name]", edited);
    await clickText("Review Changes");
    await domWait("document.body.innerText.includes('Review Employee Update')"); await acknowledge();
    await startSave("PUT", `/api/employees/${saved.id}`, "Proceed and Update");
    assert.equal((await api(`/employees/${saved.id}`)).data.name, added);
    await continuePaused();
    await domWait("Array.from(document.querySelectorAll('h2')).some(h=>h.textContent==='Employee Information Updated Successfully')");
    const afterEdit = (await api(`/employees/${saved.id}`)).data;
    assert.equal(afterEdit.name, edited);
    assert.equal(afterEdit.birthday, "2000-01-01");
    assert.equal(afterEdit.date_hired, "2025-01-01");
    await screenshot("09-real-edit-success.png");
    pass("Real browser Edit persists the update, preserves calendar dates and displays the Edit success title");
    await openEdit(edited);
    await setField("input[name=name]", edited.replace("Edited", "Rejected"));
    await clickText("Review Changes");
    await domWait("document.body.innerText.includes('Review Employee Update')"); await acknowledge();
    await startSave("PUT", `/api/employees/${saved.id}`, "Proceed and Update");
    await continuePaused(true);
    await domWait("document.body.innerText.includes('Birthday cannot be in the future') || document.body.innerText.includes('birthday cannot be in the future')");
    assert.equal((await api(`/employees/${saved.id}`)).data.name, edited);
    assert.equal(await evaluate("document.body.innerText.includes('Employee Information Updated Successfully')"), false);
    await screenshot("10-real-edit-rejected.png");
    pass("Real server rejected Edit: original employee preserved, visible error and no success toast");

    const link = await api(`/employees/${saved.id}/mobile-handoff`, { method: "POST", body: {} });
    assert.equal(link.status, 201);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(`/mobile-handoff#${link.data.token}`);
    await clickText("Continue on this phone");
    await domWait("location.pathname==='/employees' && document.body.innerText.includes('Edit Employee') && !!document.querySelector('[aria-controls=employee-compliance-documents][aria-expanded=true]')");
    assert.equal(await evaluate("document.querySelector('input[name=name]').value"), edited);
    await screenshot("11-real-phone-session.png");
    pass("390px real one-time phone link resolves to the exact employee's expanded document form");
    await navigate(`/mobile-handoff#${link.data.token}`);
    await clickText("Continue on this phone");
    await domWait("document.body.innerText.includes('This phone link is no longer available')");
    pass("Real consumed phone link shows the friendly unavailable message");

    await useUser("manager"); await navigate("/employees");
    await domWait("document.body.innerText.includes('Employee Management')");
    assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Add Employee')"), false);
    pass("Real HR Manager view does not expose HR Staff Add controls");
    fs.writeFileSync(path.join(output, "real-browser-results.json"), JSON.stringify({ database: "welljob_phase3_test", bucket: "welljob-phase3-test", fixtureOnly: true, count: checks.length, checks }, null, 2));
    console.log(`Completed ${checks.length} real-service browser checks`);
  } catch (error) {
    if (cdp) await screenshot("real-browser-failure.png").catch(() => {});
    throw new Error(`${error.message}\nActive fictional role: ${browserUser}`);
  } finally { cdp?.close(); browser.kill(); vite.kill(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
