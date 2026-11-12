"use strict";
// Read-only verification of the existing production projects and public routes.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const output = path.join(root, "artifacts/revision-guide");
const checks = [];
function auth() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  for (const file of [path.join(process.env.APPDATA || "", "com.vercel.cli/Data/auth.json"), path.join(process.env.APPDATA || "", "com.vercel.cli/auth.json"), path.join(os.homedir(), ".vercel/auth.json"), path.join(process.env.LOCALAPPDATA || "", "com.vercel.cli/Data/auth.json")]) {
    if (fs.existsSync(file)) { const data = JSON.parse(fs.readFileSync(file, "utf8")); if (data.token) return data.token; }
  }
  throw new Error("Vercel authentication is required");
}
const token = auth();
async function vercel(route) {
  const response = await fetch(`https://api.vercel.com${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Vercel read failed: ${response.status}`);
  return response.json();
}
async function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
}
function pass(name, detail) { checks.push({ name, status: "PASS", ...(detail ? { detail } : {}) }); console.log(`PASS: ${name}`); }
async function main() {
  const source = JSON.parse(fs.readFileSync(path.join(output, "release-source.json"), "utf8").replace(/^\uFEFF/, ""));
  const deployments = {};
  for (const type of ["backend", "frontend"]) {
    const linked = JSON.parse(fs.readFileSync(path.join(root, type, ".vercel/project.json"), "utf8"));
    const project = await vercel(`/v9/projects/${linked.projectId}?teamId=${linked.orgId}`);
    assert.equal(project.rootDirectory, type);
    const deployment = await vercel(`/v13/deployments/${project.targets.production.id}?teamId=${linked.orgId}`);
    assert.equal(deployment.readyState, "READY");
    assert.equal(deployment.target, "production");
    assert.equal(deployment.meta.revisionGuide, "2026-11-10");
    assert.equal(deployment.meta.revisionSource, source.sourceSha256);
    const host = `${project.name}.vercel.app`;
    assert.ok(deployment.alias.includes(host), `Production alias missing: ${host}`);
    deployments[type] = { id: deployment.id, origin: `https://${host}`, deploymentUrl: `https://${deployment.url}`, readyState: deployment.readyState, revisionSource: deployment.meta.revisionSource, aliases: deployment.alias };
    pass(`${type}: correct existing project, root directory, READY production deployment and reviewed source fingerprint`);
  }
  const backend = deployments.backend.origin;
  const frontend = deployments.frontend.origin;
  const availability = await request(`${backend}/api/system/availability`);
  assert.equal(availability.status, 200);
  assert.deepEqual(await availability.json(), { available: true });
  assert.equal(availability.headers.get("x-content-type-options"), "nosniff");
  pass("Live backend availability and response security headers");
  const version = await request(`${backend}/api/system/version`);
  assert.equal(version.status, 200);
  const identity = await version.json();
  assert.equal(identity.service, "welljob-hris-backend");
  assert.equal(identity.deploymentEnvironment, "production");
  assert.equal(identity.deploymentUrl, deployments.backend.deploymentUrl);
  pass("Live backend version identifies the newly deployed production function");
  for (const [label, headers] of [["missing session", {}], ["invalid session", { Authorization: "Bearer revision-invalid-session" }]]) {
    const denied = await request(`${backend}/api/employees?scope=active&view=summary&pageSize=1`, { headers });
    assert.equal(denied.status, 401);
    pass(`Live employee API rejects ${label}`);
  }
  const cors = await request(`${backend}/api/employees`, { method: "OPTIONS", headers: { Origin: frontend, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
  assert.ok([200, 204].includes(cors.status));
  assert.equal(cors.headers.get("access-control-allow-origin"), frontend);
  pass("Live frontend origin is permitted by backend CORS");
  for (const route of ["/", "/employees", "/mobile-handoff"]) {
    const page = await request(frontend + route);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes('id="root"'));
    if (route === "/") {
      const asset = html.match(/<script[^>]+src="([^"]+)"/)[1];
      const bundle = await request(new URL(asset, frontend));
      assert.equal(bundle.status, 200);
      const javascript = await bundle.text();
      assert.ok(javascript.includes(backend), "Production frontend must use the stable production backend origin");
      assert.equal(javascript.includes("127.0.0.1:5064"), false);
      pass("Live production JavaScript loads and points to the stable production backend");
    }
    pass(`Live frontend SPA route ${route}`);
  }
  fs.writeFileSync(path.join(output, "production-deployment-results.json"), JSON.stringify({ checkedAt: new Date().toISOString(), sourceSha256: source.sourceSha256, productionWrites: false, deployments, count: checks.length, checks }, null, 2));
  console.log(`Completed ${checks.length} live production checks`);
}
main().catch((error) => { console.error(`Production verification failed: ${error.message}`); process.exitCode = 1; });
