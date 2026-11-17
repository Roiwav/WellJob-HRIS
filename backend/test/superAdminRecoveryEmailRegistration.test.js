"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const express = require("express");
const jwt = require("jsonwebtoken");

const controllerPath = path.resolve(
  __dirname,
  "../controllers/userController.js"
);

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createAccount(overrides = {}) {
  return {
    id: 7,
    user_id: "SA-0007",
    full_name: "Test Super Admin",
    username: "superadmin.test",
    role: "SUPER_ADMIN",
    status: "Active",
    password: "stored-password-hash",
    email: null,
    email_verified_at: null,
    email_verification_token_hash: "old-verification-hash",
    email_verification_expires_at: "2026-11-18 00:00:00",
    email_verification_requested_at: "2026-11-17 00:00:00",
    password_reset_token_hash: "old-reset-hash",
    password_reset_expires_at: "2026-11-18 00:00:00",
    password_reset_requested_at: "2026-11-17 00:00:00",
    token_version: 3,
    ...overrides,
  };
}

function loadController({
  account = createAccount(),
  passwordMatches = true,
  duplicateEmail = false,
  updateAffectedRows,
} = {}) {
  const state = {
    account: { ...account },
    queries: [],
    audits: [],
    commits: 0,
    rollbacks: 0,
    releases: 0,
  };

  const connection = {
    async beginTransaction() {},
    async commit() {
      state.commits += 1;
    },
    async rollback() {
      state.rollbacks += 1;
    },
    release() {
      state.releases += 1;
    },
    async query(sql, parameters = []) {
      state.queries.push({ sql, parameters });

      if (/SELECT[\s\S]+FROM users/i.test(sql)) {
        return [[{ ...state.account }]];
      }

      if (/UPDATE users/i.test(sql)) {
        if (duplicateEmail) {
          const error = new Error("Duplicate entry");
          error.code = "ER_DUP_ENTRY";
          error.errno = 1062;
          throw error;
        }

        const affectedRows =
          updateAffectedRows === undefined
            ? state.account.email === null &&
              state.account.id === parameters[1] &&
              state.account.role === "SUPER_ADMIN" &&
              String(state.account.status).toUpperCase() === "ACTIVE" &&
              state.account.token_version === parameters[2]
              ? 1
              : 0
            : updateAffectedRows;

        if (affectedRows === 1) {
          state.account.email = parameters[0];
          state.account.email_verified_at = null;
          state.account.email_verification_token_hash = null;
          state.account.email_verification_expires_at = null;
          state.account.email_verification_requested_at = null;
          state.account.password_reset_token_hash = null;
          state.account.password_reset_expires_at = null;
          state.account.password_reset_requested_at = null;
          state.account.token_version += 1;
        }

        return [{ affectedRows }];
      }

      throw new Error("Unexpected isolated database query.");
    },
  };

  const mockDb = {
    promise() {
      return {
        async getConnection() {
          return connection;
        },
      };
    },
  };

  const mockAudit = {
    async logAudit(data, options) {
      state.audits.push({ data, options });
      return true;
    },
  };

  const mockBcrypt = {
    async compare(password, hash) {
      assert.equal(hash, "stored-password-hash");
      return passwordMatches && password === "CorrectPassword!1";
    },
    async hash() {
      throw new Error("Password hashing is not expected in this test.");
    },
  };

  const dependencyMocks = new Map([
    [require.resolve("bcrypt"), mockBcrypt],
    [require.resolve("../config/db"), mockDb],
    [require.resolve("../utils/auditLogger"), mockAudit],
    [
      require.resolve("../utils/accountCredentialsMailer"),
      { async sendAccountCredentials() {} },
    ],
  ]);
  const previousModules = new Map([
    [controllerPath, require.cache[controllerPath]],
    ...Array.from(
      dependencyMocks.keys(),
      (modulePath) => [modulePath, require.cache[modulePath]]
    ),
  ]);

  try {
    for (const [modulePath, exports] of dependencyMocks) {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
      };
    }

    delete require.cache[controllerPath];
    const controller = require(controllerPath);

    return {
      registerOwnRecoveryEmail:
        controller.registerOwnRecoveryEmail,
      updateRecoveryEmail:
        controller.updateRecoveryEmail,
      state,
    };
  } finally {
    for (const [modulePath, previousModule] of previousModules) {
      if (previousModule) {
        require.cache[modulePath] = previousModule;
      } else {
        delete require.cache[modulePath];
      }
    }
  }
}

async function invoke(registerOwnRecoveryEmail, {
  user = { id: 7, role: "SUPER_ADMIN" },
  body = {
    email: " Recovery.Email@Example.COM ",
    currentPassword: "CorrectPassword!1",
  },
} = {}) {
  const req = { user, body };
  const res = createResponse();
  await registerOwnRecoveryEmail(req, res);
  return res;
}

test("active Super Admin can register a normalized initial recovery email", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();
  const res = await invoke(registerOwnRecoveryEmail);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    registered: true,
    verified: false,
    sessionInvalidated: true,
    message:
      "Recovery email registered but not yet verified. Please sign in again, then send a verification email from Profile & Account Settings.",
  });
  assert.equal(state.account.email, "recovery.email@example.com");
  assert.equal(state.account.email_verified_at, null);
  assert.equal(state.account.token_version, 4);
  assert.equal(state.commits, 1);
  assert.equal(state.releases, 1);
});

test("current password and string request fields are required", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();

  for (const body of [
    { email: "user@example.com" },
    { email: "user@example.com", currentPassword: "" },
    { email: "user@example.com", currentPassword: "x".repeat(129) },
    { email: 42, currentPassword: "CorrectPassword!1" },
    { email: "user@example.com", currentPassword: 42 },
  ]) {
    const res = await invoke(registerOwnRecoveryEmail, { body });
    assert.equal(res.statusCode, 400);
  }

  assert.equal(state.queries.length, 0);
  assert.equal(state.account.email, null);
});

test("incorrect current password changes no account data", async () => {
  const { registerOwnRecoveryEmail, state } = loadController({
    passwordMatches: false,
  });
  const res = await invoke(registerOwnRecoveryEmail);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Current password is incorrect.");
  assert.equal(state.account.email, null);
  assert.equal(state.account.token_version, 3);
  assert.equal(state.commits, 0);
  assert.equal(state.audits.length, 0);
});

test("blank, invalid, and overlong emails are rejected before database access", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();
  const values = [
    "   ",
    "not-an-email",
    "user@localhost",
    `${"a".repeat(245)}@example.com`,
  ];

  for (const email of values) {
    const res = await invoke(registerOwnRecoveryEmail, {
      body: {
        email,
        currentPassword: "CorrectPassword!1",
      },
    });
    assert.equal(res.statusCode, 400);
  }

  assert.equal(state.queries.length, 0);
});

test("duplicate email returns 409 without exposing another account", async () => {
  const { registerOwnRecoveryEmail } = loadController({
    duplicateEmail: true,
  });
  const res = await invoke(registerOwnRecoveryEmail);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /different email address/i);
  assert.doesNotMatch(res.body.message, /user|account id|username/i);
});

test("existing unverified or verified recovery email cannot be replaced", async () => {
  for (const emailVerifiedAt of [null, "2026-11-16 12:00:00"]) {
    const { registerOwnRecoveryEmail, state } = loadController({
      account: createAccount({
        email: "existing@example.com",
        email_verified_at: emailVerifiedAt,
      }),
    });
    const res = await invoke(registerOwnRecoveryEmail);

    assert.equal(res.statusCode, 409);
    assert.equal(state.account.email, "existing@example.com");
    assert.equal(state.account.token_version, 3);
    assert.equal(state.audits.length, 0);
  }
});

test("inactive Super Admin and non-Super-Admin roles are rejected", async () => {
  const cases = [
    { role: "SUPER_ADMIN", status: "Inactive" },
    { role: "HR_MANAGER", status: "Active" },
    { role: "HR_STAFF", status: "Active" },
    { role: "HR_COORDINATOR", status: "Active" },
    { role: "IT_SUPPORT", status: "Active" },
  ];

  for (const entry of cases) {
    const { registerOwnRecoveryEmail, state } = loadController({
      account: createAccount(entry),
    });
    const res = await invoke(registerOwnRecoveryEmail, {
      user: { id: 7, role: "SUPER_ADMIN" },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(state.account.email, null);
    assert.equal(state.audits.length, 0);
  }
});

test("missing or invalid authenticated identity is rejected", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();

  for (const user of [null, {}, { id: "not-a-number" }]) {
    const res = await invoke(registerOwnRecoveryEmail, { user });
    assert.equal(res.statusCode, 401);
  }

  assert.equal(state.queries.length, 0);
});

test("request-body user ID and role cannot change the authenticated target", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();
  const res = await invoke(registerOwnRecoveryEmail, {
    user: { id: 7, role: "HR_STAFF" },
    body: {
      email: "owner@example.com",
      currentPassword: "CorrectPassword!1",
      userId: 999,
      id: 999,
      role: "SUPER_ADMIN",
    },
  });

  assert.equal(res.statusCode, 200);
  const update = state.queries.find(({ sql }) => /UPDATE users/i.test(sql));
  assert.deepEqual(update.parameters, ["owner@example.com", 7, 3]);
});

test("success clears stale verification/reset state and preserves account identity", async () => {
  const original = createAccount();
  const { registerOwnRecoveryEmail, state } = loadController({ account: original });
  await invoke(registerOwnRecoveryEmail);

  assert.equal(state.account.email_verification_token_hash, null);
  assert.equal(state.account.email_verification_expires_at, null);
  assert.equal(state.account.email_verification_requested_at, null);
  assert.equal(state.account.password_reset_token_hash, null);
  assert.equal(state.account.password_reset_expires_at, null);
  assert.equal(state.account.password_reset_requested_at, null);
  assert.equal(state.account.username, original.username);
  assert.equal(state.account.full_name, original.full_name);
  assert.equal(state.account.user_id, original.user_id);
  assert.equal(state.account.role, original.role);
  assert.equal(state.account.status, original.status);
});

test("audit event is transactional and contains no sensitive values", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();
  await invoke(registerOwnRecoveryEmail);

  assert.equal(state.audits.length, 1);
  const audit = state.audits[0];
  assert.equal(audit.data.action, "REGISTER_OWN_RECOVERY_EMAIL");
  assert.equal(audit.data.userId, 7);
  assert.equal(audit.options.connection !== undefined, true);
  assert.equal(audit.options.throwOnError, true);

  const serialized = JSON.stringify(audit.data);
  assert.doesNotMatch(serialized, /CorrectPassword!1/);
  assert.doesNotMatch(serialized, /stored-password-hash/);
  assert.doesNotMatch(serialized, /recovery\.email@example\.com/i);
  assert.doesNotMatch(serialized, /old-verification-hash|old-reset-hash/);
});

test("guarded update prevents a concurrent request from overwriting registration", async () => {
  const { registerOwnRecoveryEmail, state } = loadController();

  const first = invoke(registerOwnRecoveryEmail, {
    body: {
      email: "first@example.com",
      currentPassword: "CorrectPassword!1",
    },
  });
  const second = invoke(registerOwnRecoveryEmail, {
    body: {
      email: "second@example.com",
      currentPassword: "CorrectPassword!1",
    },
  });

  const responses = await Promise.all([first, second]);
  const statuses = responses.map((response) => response.statusCode).sort();

  assert.deepEqual(statuses, [200, 409]);
  assert.ok([
    "first@example.com",
    "second@example.com",
  ].includes(state.account.email));
  assert.equal(state.account.token_version, 4);
});

test("administrative endpoint still rejects self and all Super Admin targets", async () => {
  const source = require("node:fs").readFileSync(controllerPath, "utf8");

  assert.match(
    source,
    /target\.id === requester\.id \|\| normalizeRole\(target\.role\) === "SUPER_ADMIN"/
  );
  assert.match(
    source,
    /Super Admin recovery email cannot be changed through this endpoint\./
  );
});

test("route requires verifyToken, applies a limiter, and precedes dynamic recovery route", () => {
  const routeSource = require("node:fs").readFileSync(
    path.resolve(__dirname, "../routes/userRoutes.js"),
    "utf8"
  );
  const ownerRoute = routeSource.indexOf('"/users/me/recovery-email"');
  const adminRoute = routeSource.indexOf('"/users/:id/recovery-email"');

  assert.ok(ownerRoute >= 0);
  assert.ok(ownerRoute < adminRoute);
  assert.match(
    routeSource,
    /"\/users\/me\/recovery-email",\s*verifyToken,\s*sensitiveSelfServiceLimiter,\s*registerOwnRecoveryEmail/s
  );
});

test("owner route rejects missing/invalid sessions and trusts middleware identity only", async () => {
  const routePath = path.resolve(
    __dirname,
    "../routes/userRoutes.js"
  );
  const dependencyMocks = new Map([
    [
      require.resolve("../controllers/userController"),
      {
        getUsers(req, res) { res.json({}); },
        getCompanyOptions(req, res) { res.json({}); },
        createUser(req, res) { res.json({}); },
        resendAccountCredentials(req, res) { res.json({}); },
        updateAssignedCompany(req, res) { res.json({}); },
        updateRecoveryEmail(req, res) { res.json({}); },
        toggleStatus(req, res) { res.json({}); },
        changePassword(req, res) { res.json({}); },
        registerOwnRecoveryEmail(req, res) {
          res.json({
            authenticatedId: req.user.id,
            authenticatedRole: req.user.role,
            submittedId: req.body.id,
            submittedRole: req.body.role,
          });
        },
      },
    ],
    [
      require.resolve("../controllers/avatarController"),
      {
        uploadMyAvatar(req, res) { res.json({}); },
        getAvatar(req, res) { res.json({}); },
        removeMyAvatar(req, res) { res.json({}); },
      },
    ],
    [
      require.resolve("../middleware/avatarUpload"),
      (req, res, next) => next(),
    ],
    [
      require.resolve("../middleware/authMiddleware"),
      {
        verifyToken(req, res, next) {
          const authorization = String(
            req.headers.authorization || ""
          );

          if (authorization !== "Bearer valid-session") {
            return res.status(401).json({
              message: "Authentication required.",
            });
          }

          req.user = {
            id: 7,
            role: "SUPER_ADMIN",
          };
          next();
        },
      },
    ],
    [
      require.resolve("../middleware/roleMiddleware"),
      {
        authorizeRoles() {
          return (req, res, next) => next();
        },
      },
    ],
  ]);
  const previousModules = new Map([
    [routePath, require.cache[routePath]],
    ...Array.from(
      dependencyMocks.keys(),
      (modulePath) => [modulePath, require.cache[modulePath]]
    ),
  ]);
  let server;

  try {
    for (const [modulePath, exports] of dependencyMocks) {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
      };
    }

    delete require.cache[routePath];
    const router = require(routePath);
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const url =
      `http://127.0.0.1:${server.address().port}` +
      "/api/users/me/recovery-email";

    const missing = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 401);

    const invalid = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-session",
      },
      body: JSON.stringify({}),
    });
    assert.equal(invalid.status, 401);

    const valid = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-session",
      },
      body: JSON.stringify({
        id: 999,
        role: "HR_STAFF",
      }),
    });
    const body = await valid.json();

    assert.equal(valid.status, 200);
    assert.equal(body.authenticatedId, 7);
    assert.equal(body.authenticatedRole, "SUPER_ADMIN");
    assert.equal(body.submittedId, 999);
    assert.equal(body.submittedRole, "HR_STAFF");
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    for (const [modulePath, previousModule] of previousModules) {
      if (previousModule) {
        require.cache[modulePath] = previousModule;
      } else {
        delete require.cache[modulePath];
      }
    }
  }
});

test("owner route uses the production verifyToken principal and does not fall through to the administrative ID route", async () => {
  const routePath = path.resolve(__dirname, "../routes/userRoutes.js");
  const authPath = require.resolve("../middleware/authMiddleware");
  const dbPath = require.resolve("../config/db");
  const controllerModulePath = require.resolve("../controllers/userController");
  const avatarControllerPath = require.resolve("../controllers/avatarController");
  const avatarUploadPath = require.resolve("../middleware/avatarUpload");
  const roleMiddlewarePath = require.resolve("../middleware/roleMiddleware");
  const previousSecret = process.env.JWT_SECRET;
  const previousModules = new Map(
    [
      routePath,
      authPath,
      dbPath,
      controllerModulePath,
      avatarControllerPath,
      avatarUploadPath,
      roleMiddlewarePath,
    ].map((modulePath) => [modulePath, require.cache[modulePath]])
  );
  let server;

  try {
    process.env.JWT_SECRET = "isolated-route-test-secret";

    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        promise() {
          return {
            async query(sql, parameters) {
              assert.match(sql, /FROM users[\s\S]*WHERE id = \?/i);
              assert.deepEqual(parameters, [7]);
              return [[{
                id: 7,
                user_id: "SA-0007",
                username: "superadmin.test",
                full_name: "Test Super Admin",
                role: "SUPER_ADMIN",
                assigned_company: null,
                status: "Active",
                token_version: 3,
              }]];
            },
          };
        },
      },
    };

    require.cache[controllerModulePath] = {
      id: controllerModulePath,
      filename: controllerModulePath,
      loaded: true,
      exports: {
        getUsers(req, res) { res.json({}); },
        getCompanyOptions(req, res) { res.json({}); },
        createUser(req, res) { res.json({}); },
        resendAccountCredentials(req, res) { res.json({}); },
        updateAssignedCompany(req, res) { res.json({}); },
        updateRecoveryEmail(req, res) {
          res.status(500).json({ message: "Administrative route was selected." });
        },
        toggleStatus(req, res) { res.json({}); },
        changePassword(req, res) { res.json({}); },
        registerOwnRecoveryEmail(req, res) {
          res.json({
            id: req.user.id,
            userId: req.user.userId,
            businessUserId: req.user.businessUserId,
            role: req.user.role,
            submittedId: req.body.id,
            submittedRole: req.body.role,
          });
        },
      },
    };
    require.cache[avatarControllerPath] = {
      id: avatarControllerPath,
      filename: avatarControllerPath,
      loaded: true,
      exports: {
        uploadMyAvatar(req, res) { res.json({}); },
        getAvatar(req, res) { res.json({}); },
        removeMyAvatar(req, res) { res.json({}); },
      },
    };
    require.cache[avatarUploadPath] = {
      id: avatarUploadPath,
      filename: avatarUploadPath,
      loaded: true,
      exports: (req, res, next) => next(),
    };
    require.cache[roleMiddlewarePath] = {
      id: roleMiddlewarePath,
      filename: roleMiddlewarePath,
      loaded: true,
      exports: { authorizeRoles: () => (req, res, next) => next() },
    };

    delete require.cache[authPath];
    delete require.cache[routePath];
    const router = require(routePath);
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const token = jwt.sign(
      { id: 7, username: "superadmin.test", role: "HR_STAFF", tokenVersion: 3 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "5m" }
    );
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/users/me/recovery-email`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: 999, role: "SUPER_ADMIN" }),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.id, 7);
    assert.equal(body.userId, 7);
    assert.equal(body.businessUserId, "SA-0007");
    assert.equal(body.role, "SUPER_ADMIN");
    assert.equal(body.submittedId, 999);
    assert.equal(body.submittedRole, "SUPER_ADMIN");
    assert.notEqual(body.message, "A valid user ID is required.");
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.env.JWT_SECRET = previousSecret;
    for (const [modulePath, previousModule] of previousModules) {
      if (previousModule) require.cache[modulePath] = previousModule;
      else delete require.cache[modulePath];
    }
  }
});

test("recovery-email status route uses authenticated identity without a browser-provided user ID", async () => {
  const authPath = require.resolve("../middleware/authMiddleware");
  const statusControllerPath = require.resolve("../controllers/recoveryEmailStatusController");
  const dbPath = require.resolve("../config/db");
  const previousSecret = process.env.JWT_SECRET;
  const previousModules = new Map(
    [authPath, statusControllerPath, dbPath].map((modulePath) => [
      modulePath,
      require.cache[modulePath],
    ])
  );
  const queries = [];
  let server;

  try {
    process.env.JWT_SECRET = "isolated-status-test-secret";
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        promise() {
          return {
            async query(sql, parameters) {
              queries.push({ sql, parameters });
              if (/token_version/i.test(sql)) {
                return [[{
                  id: 7,
                  user_id: "SA-0007",
                  username: "superadmin.test",
                  full_name: "Test Super Admin",
                  role: "SUPER_ADMIN",
                  assigned_company: null,
                  status: "Active",
                  token_version: 3,
                }]];
              }
              return [[{
                email: null,
                email_verified_at: null,
                status: "Active",
              }]];
            },
          };
        },
      },
    };

    delete require.cache[authPath];
    delete require.cache[statusControllerPath];
    const { verifyToken } = require(authPath);
    const { getRecoveryEmailStatus } = require(statusControllerPath);
    const app = express();
    app.get("/api/auth/recovery-email-status", verifyToken, getRecoveryEmailStatus);
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const token = jwt.sign(
      { id: 7, username: "superadmin.test", tokenVersion: 3 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "5m" }
    );
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/recovery-email-status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { registered: false, verified: false });
    assert.equal(queries.length, 2);
    assert.deepEqual(queries[0].parameters, [7]);
    assert.deepEqual(queries[1].parameters, [7]);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.env.JWT_SECRET = previousSecret;
    for (const [modulePath, previousModule] of previousModules) {
      if (previousModule) require.cache[modulePath] = previousModule;
      else delete require.cache[modulePath];
    }
  }
});

test("existing username login and change-password routes remain unchanged", () => {
  const authSource = require("node:fs").readFileSync(
    path.resolve(__dirname, "../routes/authRoutes.js"),
    "utf8"
  );
  const userRouteSource = require("node:fs").readFileSync(
    path.resolve(__dirname, "../routes/userRoutes.js"),
    "utf8"
  );

  assert.match(authSource, /router\.post\(\s*"\/login"/s);
  assert.match(
    userRouteSource,
    /"\/users\/change-password",\s*verifyToken,\s*changePassword/s
  );
});