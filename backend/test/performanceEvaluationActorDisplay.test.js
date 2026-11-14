"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const express = require("express");

const dbModulePath =
  require.resolve("../config/db");

require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: {
    promise() {
      throw new Error(
        "Unit test attempted to access the live database."
      );
    },
  },
};

const {
  getDefaultPerformanceEvaluationConfiguration,
  resolvePerformanceEvaluationActorDisplay,
} = require(
  "../utils/performanceEvaluationService"
);

function buildConfiguration(metadata) {
  return {
    ...getDefaultPerformanceEvaluationConfiguration(),
    metadata,
  };
}

function connectionReturning(users, assertions = () => {}) {
  return {
    async query(sql, params) {
      assertions(sql, params);
      return [users];
    },
  };
}

async function withServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function loadPerformanceEvaluationSettingsRouter({
  authenticatedUser,
  persistedConfigurations,
  auditCalls,
  queryCalls,
  resolutionCalls,
}) {
  const settingsRoutePath = path.resolve(
    __dirname,
    "../routes/settingsRoutes.js"
  );
  delete require.cache[settingsRoutePath];

  const mocks = new Map([
    ["../config/db", {
      promise() {
        return {
          async query(sql, params) {
            queryCalls.push({ sql, params });
            return [{ affectedRows: 1 }];
          },
        };
      },
    }],
    ["../utils/auditLogger", {
      AUDIT_CATEGORY: {
        TECHNICAL: "TECHNICAL",
        OPERATIONAL: "OPERATIONAL",
      },
      async logAudit(data) {
        auditCalls.push(data);
        return true;
      },
    }],
    ["../utils/violationPolicyService", {
      VIOLATION_RULES_SETTING_NAME: "violation_rules",
      normalizeViolationRules: (value) => value,
      getViolationRulesConfiguration: async () => null,
      countViolationRules: () => 0,
    }],
    ["../utils/performanceEvaluationService", {
      PERFORMANCE_EVALUATION_SETTING_NAME:
        "performance_evaluation_framework",
      getDefaultPerformanceEvaluationConfiguration:
        getDefaultPerformanceEvaluationConfiguration,
      normalizePerformanceEvaluationConfiguration(value) {
        return {
          valid: true,
          error: null,
          configuration: {
            schemaVersion: 2,
            ratingScale: value.ratingScale,
            kpiFactors: value.kpiFactors,
          },
        };
      },
      async getPerformanceEvaluationConfiguration() {
        return persistedConfigurations.shift() || null;
      },
      async resolvePerformanceEvaluationActorDisplay(configuration) {
        resolutionCalls.push(configuration);
        return configuration;
      },
    }],
    ["../middleware/authMiddleware", {
      verifyToken(req, res, next) {
        req.user = {
          ...authenticatedUser,
          role: String(
            req.headers["x-test-role"] ||
              authenticatedUser.role
          ).toUpperCase(),
        };
        return next();
      },
    }],
    ["../middleware/roleMiddleware", {
      authorizeRoles(...allowedRoles) {
        return (req, res, next) => {
          if (!allowedRoles.includes(req.user?.role)) {
            return res.status(403).json({
              success: false,
              error: "Forbidden",
            });
          }
          return next();
        };
      },
    }],
  ]);

  const originalLoad = Module._load;
  try {
    Module._load = function patchedLoad(request, parent, isMain) {
      if (
        parent?.filename === settingsRoutePath &&
        mocks.has(request)
      ) {
        return mocks.get(request);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    return require(settingsRoutePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createSettingsApplication(options) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    loadPerformanceEvaluationSettingsRouter(options)
  );
  return app;
}

test("legacy username metadata resolves a unique verified full name without mutating audit metadata", async () => {
  const configuration = buildConfiguration({
    updatedAt: "2026-09-07T13:04:00.000Z",
    updatedBy: "hm02",
    updatedByRole: "HR_MANAGER",
  });
  const before = structuredClone(configuration);
  const resolved = await resolvePerformanceEvaluationActorDisplay(
    configuration,
    {
      connection: connectionReturning(
        [{ id: 22, username: "hm02", full_name: "Maria Santos" }],
        (sql, params) => {
          assert.match(sql, /WHERE username = \?/);
          assert.deepEqual(params, ["hm02"]);
        }
      ),
    }
  );

  assert.deepEqual(configuration, before);
  assert.equal(resolved.metadata.updatedByDisplayName, "Maria Santos");
  assert.equal(resolved.metadata.updatedBy, "hm02");
  assert.equal(resolved.metadata.updatedByRole, "HR_MANAGER");
  assert.equal(resolved.metadata.updatedAt, "2026-09-07T13:04:00.000Z");
});

test("actor ID takes precedence for future metadata while preserving username and role", async () => {
  const resolved = await resolvePerformanceEvaluationActorDisplay(
    buildConfiguration({
      updatedAt: "2026-11-14T01:00:00.000Z",
      updatedBy: "Maria Santos",
      updatedByRole: "HR_MANAGER",
      updatedByUserId: 22,
      updatedByUsername: "hm02",
      updatedByDisplayName: "Maria Santos",
    }),
    {
      connection: connectionReturning(
        [{ id: 22, username: "hm02", full_name: "Maria Santos" }],
        (sql, params) => {
          assert.match(sql, /WHERE id = \?/);
          assert.deepEqual(params, [22]);
        }
      ),
    }
  );

  assert.equal(resolved.metadata.updatedByUserId, 22);
  assert.equal(resolved.metadata.updatedByUsername, "hm02");
  assert.equal(resolved.metadata.updatedByDisplayName, "Maria Santos");
  assert.equal(resolved.metadata.updatedByRole, "HR_MANAGER");
});

test("missing, deleted, or non-unique accounts use only an existing full-name snapshot", async () => {
  const missing = await resolvePerformanceEvaluationActorDisplay(
    buildConfiguration({ updatedBy: "hm02", updatedByRole: "HR_MANAGER" }),
    { connection: connectionReturning([]) }
  );
  const nonUnique = await resolvePerformanceEvaluationActorDisplay(
    buildConfiguration({ updatedBy: "hm02", updatedByRole: "HR_MANAGER" }),
    { connection: connectionReturning([
      { id: 1, username: "hm02", full_name: "First Match" },
      { id: 2, username: "hm02", full_name: "Second Match" },
    ]) }
  );
  const snapshot = await resolvePerformanceEvaluationActorDisplay(
    buildConfiguration({
      updatedBy: "Maria Santos",
      updatedByRole: "HR_MANAGER",
      updatedByDisplayName: "Maria Santos",
    }),
    { connection: connectionReturning([]) }
  );

  assert.equal(missing.metadata.updatedByDisplayName, null);
  assert.equal(nonUnique.metadata.updatedByDisplayName, null);
  assert.equal(snapshot.metadata.updatedByDisplayName, "Maria Santos");
});

test("settings route keeps existing authorization and audit identity fields", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../routes/settingsRoutes.js"),
    "utf8"
  );

  assert.match(source, /PERFORMANCE_EVALUATION_READ_ROLES\s*=\s*\[\s*\.\.\.SYSTEM_CONFIGURATION_ROLES/);
  assert.match(source, /PERFORMANCE_EVALUATION_WRITE_ROLES\s*=\s*\[\s*\.\.\.SYSTEM_CONFIGURATION_ROLES/);
  assert.match(source, /authorizeRoles\(\.\.\.PERFORMANCE_EVALUATION_READ_ROLES\)/);
  assert.match(source, /authorizeRoles\(\.\.\.PERFORMANCE_EVALUATION_WRITE_ROLES\)/);
  assert.match(source, /userId:\s*req\.user\?\.userId \?\? req\.user\?\.id/);
  assert.match(source, /username:\s*req\.user\?\.username/);
  assert.match(source, /role:\s*req\.user\?\.role/);
});

test("performance evaluation PUT saves trusted actor metadata, audits, and avoids display resolution", async () => {
  const auditCalls = [];
  const queryCalls = [];
  const resolutionCalls = [];
  const previousConfiguration = buildConfiguration({
    updatedAt: "2026-11-13T00:00:00.000Z",
    updatedBy: "Previous Manager",
    updatedByRole: "HR_MANAGER",
  });
  const persistedConfiguration = buildConfiguration({
    updatedAt: "2026-11-14T01:00:00.000Z",
    updatedBy: "Maria Santos",
    updatedByRole: "HR_MANAGER",
    updatedByUserId: 22,
    updatedByUsername: "hm02",
    updatedByDisplayName: "Maria Santos",
  });

  const app = createSettingsApplication({
    authenticatedUser: {
      id: 22,
      userId: 22,
      username: "hm02",
      fullName: "Maria Santos",
      role: "HR_MANAGER",
    },
    persistedConfigurations: [
      previousConfiguration,
      persistedConfiguration,
    ],
    auditCalls,
    queryCalls,
    resolutionCalls,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/settings/performance-evaluation`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingScale: persistedConfiguration.ratingScale,
          kpiFactors: persistedConfiguration.kpiFactors,
        }),
      }
    );
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.deepEqual(data.metadata, persistedConfiguration.metadata);
  });

  assert.equal(queryCalls.length, 1);
  const savedConfiguration = JSON.parse(queryCalls[0].params[1]);
  assert.equal(savedConfiguration.metadata.updatedBy, "Maria Santos");
  assert.equal(savedConfiguration.metadata.updatedByUserId, 22);
  assert.equal(savedConfiguration.metadata.updatedByUsername, "hm02");
  assert.equal(savedConfiguration.metadata.updatedByDisplayName, "Maria Santos");
  assert.equal(savedConfiguration.metadata.updatedByRole, "HR_MANAGER");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].userId, 22);
  assert.equal(auditCalls[0].username, "hm02");
  assert.equal(auditCalls[0].role, "HR_MANAGER");
  assert.equal(auditCalls[0].action, "UPDATE_PERFORMANCE_EVALUATION");
  assert.equal(resolutionCalls.length, 0);
});

test("performance evaluation PUT preserves username fallback when trusted full name is missing", async () => {
  const auditCalls = [];
  const queryCalls = [];
  const resolutionCalls = [];
  const persistedConfiguration = buildConfiguration({
    updatedAt: "2026-11-14T01:00:00.000Z",
    updatedBy: "hm02",
    updatedByRole: "HR_MANAGER",
    updatedByUserId: 22,
    updatedByUsername: "hm02",
    updatedByDisplayName: null,
  });
  const app = createSettingsApplication({
    authenticatedUser: {
      id: 22,
      userId: 22,
      username: "hm02",
      fullName: "",
      role: "HR_MANAGER",
    },
    persistedConfigurations: [null, persistedConfiguration],
    auditCalls,
    queryCalls,
    resolutionCalls,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/settings/performance-evaluation`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingScale: persistedConfiguration.ratingScale,
          kpiFactors: persistedConfiguration.kpiFactors,
        }),
      }
    );
    assert.equal(response.status, 200);
  });

  const savedConfiguration = JSON.parse(queryCalls[0].params[1]);
  assert.equal(savedConfiguration.metadata.updatedBy, "hm02");
  assert.equal(savedConfiguration.metadata.updatedByUsername, "hm02");
  assert.equal(savedConfiguration.metadata.updatedByDisplayName, null);
  assert.equal(auditCalls.length, 1);
  assert.equal(resolutionCalls.length, 0);
});

test("performance evaluation PUT keeps existing role authorization", async () => {
  const app = createSettingsApplication({
    authenticatedUser: {
      id: 30,
      userId: 30,
      username: "staff01",
      fullName: "HR Staff Test",
      role: "HR_STAFF",
    },
    persistedConfigurations: [],
    auditCalls: [],
    queryCalls: [],
    resolutionCalls: [],
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/settings/performance-evaluation`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingScale: [],
          kpiFactors: [],
        }),
      }
    );
    assert.equal(response.status, 403);
  });
});

test("settings route resolves legacy actors only on GET and audits before PUT success response", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../routes/settingsRoutes.js"),
    "utf8"
  );
  const routePath = '"/settings/performance-evaluation"';
  const getPathStart = source.indexOf(routePath);
  const getStart = source.lastIndexOf("router.get(", getPathStart);
  const putPathStart = source.indexOf(routePath, getPathStart + 1);
  const putStart = source.lastIndexOf("router.put(", putPathStart);
  const nextSection = source.indexOf(
    "/*\n * ==================================================",
    putStart + 1
  );
  const getSection = source.slice(getStart, putStart);
  const putSection = source.slice(putStart, nextSection);

  assert.ok(getStart >= 0);
  assert.ok(putStart > getStart);
  assert.match(getSection, /resolvePerformanceEvaluationActorDisplay/);
  assert.doesNotMatch(putSection, /resolvePerformanceEvaluationActorDisplay/);
  assert.ok(
    putSection.indexOf("await logAudit") <
      putSection.indexOf("return res.status(200).json")
  );
});