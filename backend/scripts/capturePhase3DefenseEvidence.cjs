"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const jwt = require("jsonwebtoken");

const expectedDatabase = "welljob_phase3_test";
const backendPort = 5055;
const frontendPort = 4173;
const browserPort = 9333;
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;

if (!process.argv.includes("--confirm-read")) {
  throw new Error("Refusing to capture Phase 3 evidence without --confirm-read.");
}

if (
  process.env.DB_NAME !== expectedDatabase ||
  process.env.DB_EXPECTED_NAME !== expectedDatabase
) {
  throw new Error(`Evidence capture is restricted to ${expectedDatabase}.`);
}

process.env.FRONTEND_ORIGIN = frontendOrigin;
process.env.NODE_ENV = "test";

const db = require("../config/db");
const app = require("../app");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(repositoryRoot, "frontend");
const outputDirectory = path.join(
  repositoryRoot,
  "artifacts",
  "phase3-defense"
);
const browserExecutable =
  process.env.PHASE3_BROWSER_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
  });
  child.kill();
  await Promise.race([exited, delay(5000)]);
}

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "not ready"}`);
}

async function openCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result || {});
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function latestManager() {
  const [rows] = await db.promise().query(
    `SELECT id, username, full_name, role, assigned_company,
            must_change_password, token_version
       FROM users
      WHERE role = 'HR_MANAGER'
        AND status = 'Active'
        AND username LIKE 'phase3_hr_manager_%'
      ORDER BY id DESC
      LIMIT 1`
  );

  if (!rows[0]) {
    throw new Error("No fictional Phase 3 HR Manager fixture is available.");
  }

  return rows[0];
}

async function main() {
  if (!fs.existsSync(browserExecutable)) {
    throw new Error(`Browser executable was not found: ${browserExecutable}`);
  }

  fs.mkdirSync(outputDirectory, { recursive: true });

  const manager = await latestManager();
  const token = jwt.sign(
    {
      id: manager.id,
      username: manager.username,
      tokenVersion: Number(manager.token_version || 1),
    },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "20m" }
  );
  const browserUser = {
    id: manager.id,
    username: manager.username,
    fullName: manager.full_name,
    full_name: manager.full_name,
    role: manager.role,
    assignedCompany: manager.assigned_company,
    assigned_company: manager.assigned_company,
    mustChangePassword: Boolean(manager.must_change_password),
  };

  const backendServer = app.listen(backendPort, "127.0.0.1");
  const viteExecutable = path.join(
    frontendRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js"
  );
  const vite = spawn(
    process.execPath,
    [viteExecutable, "--host", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const browserProfile = fs.mkdtempSync(
    path.join(os.tmpdir(), "welljob-phase3-browser-")
  );
  const browser = spawn(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${browserPort}`,
      `--user-data-dir=${browserProfile}`,
      "--window-size=1440,1000",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp;

  try {
    await waitForUrl(`${frontendOrigin}/login`);
    await waitForUrl(`http://127.0.0.1:${browserPort}/json/version`);
    const pagesResponse = await waitForUrl(
      `http://127.0.0.1:${browserPort}/json/list`
    );
    const pages = await pagesResponse.json();
    const page = pages.find((entry) => entry.type === "page");
    if (!page?.webSocketDebuggerUrl) {
      throw new Error("Headless browser page was not available through CDP.");
    }

    cdp = await openCdp(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: `${frontendOrigin}/login` });
    await delay(2000);
    await cdp.send("Runtime.evaluate", {
      expression: `localStorage.setItem("token", ${JSON.stringify(
        token
      )}); localStorage.setItem("user", ${JSON.stringify(
        JSON.stringify(browserUser)
      )});`,
    });

    const captures = [
      ["01-dashboard.png", "/"],
      ["02-employees.png", "/employees"],
      ["03-incidents.png", "/incidents"],
      ["04-kpi-decision-support.png", "/kpi"],
    ];

    for (const [filename, route] of captures) {
      await cdp.send("Page.navigate", { url: `${frontendOrigin}${route}` });
      await delay(5000);
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: true,
      });
      fs.writeFileSync(
        path.join(outputDirectory, filename),
        Buffer.from(data, "base64")
      );
    }

    fs.writeFileSync(
      path.join(outputDirectory, "README.md"),
      [
        "# Phase 3 final-defense UI evidence",
        "",
        "Captured from a local frontend/backend session connected only to `welljob_phase3_test`.",
        "The authenticated account and all visible records are fictional Phase 3 fixtures.",
        "No token, password, database credential, or Supabase secret is stored in these artifacts.",
        "",
      ].join("\n")
    );

    console.log(
      JSON.stringify(
        {
          database: expectedDatabase,
          role: manager.role,
          screenshots: captures.map(([filename]) => filename),
          outputDirectory: path.relative(repositoryRoot, outputDirectory),
        },
        null,
        2
      )
    );
  } finally {
    cdp?.close();
    await stopChild(browser);
    await stopChild(vite);
    await new Promise((resolve) => backendServer.close(resolve));
    await db.promise().end();

    const resolvedProfile = path.resolve(browserProfile);
    const resolvedTemp = path.resolve(os.tmpdir());
    if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
      fs.rmSync(resolvedProfile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250,
      });
    }
  }
}

main().catch((error) => {
  console.error("Phase 3 defense-evidence capture failed:", error.message);
  process.exitCode = 1;
});
