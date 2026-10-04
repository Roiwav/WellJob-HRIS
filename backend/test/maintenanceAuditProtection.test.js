"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const http =
  require("node:http");

const path =
  require("node:path");

const Module =
  require("node:module");

const express =
  require("express");


const settingsRoutePath =
  path.resolve(
    __dirname,
    "../routes/settingsRoutes.js"
  );


const auditRoutePath =
  path.resolve(
    __dirname,
    "../routes/auditLogRoutes.js"
  );


const auditControllerPath =
  path.resolve(
    __dirname,
    "../controllers/auditLogController.js"
  );


const AUDIT_CATEGORY = {
  TECHNICAL:
    "TECHNICAL",

  OPERATIONAL:
    "OPERATIONAL",
};


/*
 * ==================================================
 * GENERIC HTTP TEST SERVER
 * ==================================================
 */

async function withServer(
  app,
  callback
) {
  const server =
    http.createServer(
      app
    );


  await new Promise(
    (
      resolve,
      reject
    ) => {
      server.once(
        "error",
        reject
      );

      server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );


  try {
    const address =
      server.address();


    assert.ok(
      address &&
      typeof address !==
        "string"
    );


    return await callback(
      `http://127.0.0.1:${address.port}`
    );
  }
  finally {
    await new Promise(
      (
        resolve,
        reject
      ) => {
        server.close(
          (error) => {
            if (error) {
              reject(
                error
              );
            }
            else {
              resolve();
            }
          }
        );
      }
    );
  }
}


/*
 * ==================================================
 * SETTINGS ROUTER MOCKS
 * ==================================================
 */

function createMaintenanceDatabase() {
  const state = {
    persisted:
      false,

    pending:
      false,

    beginCount:
      0,

    commitCount:
      0,

    rollbackCount:
      0,

    releaseCount:
      0,

    getConnectionCount:
      0,
  };


  const connection = {
    async beginTransaction() {
      state.beginCount +=
        1;

      state.pending =
        state.persisted;
    },


    async query(
      sql,
      params = []
    ) {
      const normalized =
        String(
          sql
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim()
          .toUpperCase();


      if (
        normalized.startsWith(
          "SELECT SETTING_VALUE FROM SYSTEM_SETTINGS"
        )
      ) {
        return [
          [
            {
              setting_value:
                state.pending
                  ? 1
                  : 0,
            },
          ],
        ];
      }


      if (
        normalized.startsWith(
          "UPDATE SYSTEM_SETTINGS"
        )
      ) {
        state.pending =
          Number(
            params[0]
          ) ===
          1;

        return [
          {
            affectedRows:
              1,
          },
        ];
      }


      throw new Error(
        `Unexpected test SQL: ${normalized}`
      );
    },


    async commit() {
      state.commitCount +=
        1;

      state.persisted =
        state.pending;
    },


    async rollback() {
      state.rollbackCount +=
        1;

      state.pending =
        state.persisted;
    },


    release() {
      state.releaseCount +=
        1;
    },
  };


  const pool = {
    promise() {
      return {
        async getConnection() {
          state.getConnectionCount +=
            1;

          return connection;
        },


        async query() {
          throw new Error(
            "Maintenance mutation unexpectedly used a non-transactional pool query."
          );
        },
      };
    },
  };


  return {
    pool,
    connection,
    state,
  };
}


function loadSettingsRouter({
  database,
  failAudit = false,
  auditCalls,
}) {
  delete require.cache[
    settingsRoutePath
  ];


  const mocks =
    new Map([
      [
        "../config/db",
        database.pool,
      ],

      [
        "../utils/auditLogger",
        {
          AUDIT_CATEGORY,

          async logAudit(
            data,
            options
          ) {
            auditCalls.push({
              data,
              options,
            });


            assert.equal(
              options
                ?.connection,
              database
                .connection
            );


            assert.equal(
              options
                ?.throwOnError,
              true
            );


            if (
              failAudit
            ) {
              throw new Error(
                "Simulated audit failure"
              );
            }


            return true;
          },
        },
      ],

      [
        "../utils/violationPolicyService",
        {
          VIOLATION_RULES_SETTING_NAME:
            "violation_rules",

          normalizeViolationRules(
            value
          ) {
            return value;
          },

          async getViolationRulesConfiguration() {
            return null;
          },

          countViolationRules() {
            return 0;
          },
        },
      ],

      [
        "../utils/performanceEvaluationService",
        {
          PERFORMANCE_EVALUATION_SETTING_NAME:
            "performance_evaluation",

          getDefaultPerformanceEvaluationConfiguration() {
            return {};
          },

          normalizePerformanceEvaluationConfiguration(
            value
          ) {
            return value;
          },

          async getPerformanceEvaluationConfiguration() {
            return null;
          },
        },
      ],

      [
        "../middleware/authMiddleware",
        {
          verifyToken(
            req,
            res,
            next
          ) {
            req.user = {
              id:
                10,

              userId:
                10,

              username:
                "it02",

              full_name:
                "IT Support Test",

              role:
                String(
                  req.headers[
                    "x-test-role"
                  ] ||
                  "IT_SUPPORT"
                )
                  .trim()
                  .toUpperCase(),
            };


            return next();
          },
        },
      ],

      [
        "../middleware/roleMiddleware",
        {
          authorizeRoles(
            ...allowedRoles
          ) {
            return (
              req,
              res,
              next
            ) => {
              const role =
                String(
                  req.user
                    ?.role ||
                    ""
                )
                  .trim()
                  .toUpperCase();


              if (
                !allowedRoles.includes(
                  role
                )
              ) {
                return res
                  .status(403)
                  .json({
                    success:
                      false,

                    error:
                      "Forbidden",
                  });
              }


              return next();
            };
          },
        },
      ],
    ]);


  const originalLoad =
    Module._load;


  try {
    Module._load =
      function patchedLoad(
        request,
        parent,
        isMain
      ) {
        if (
          parent?.filename ===
            settingsRoutePath &&
          mocks.has(
            request
          )
        ) {
          return mocks.get(
            request
          );
        }


        return originalLoad.call(
          this,
          request,
          parent,
          isMain
        );
      };


    return require(
      settingsRoutePath
    );
  }
  finally {
    Module._load =
      originalLoad;
  }
}


function createSettingsApplication(
  options
) {
  const app =
    express();


  app.use(
    express.json()
  );


  app.use(
    "/api",
    loadSettingsRouter(
      options
    )
  );


  return app;
}


/*
 * ==================================================
 * MAINTENANCE TESTS
 * ==================================================
 */

test(
  "Non-IT roles cannot toggle maintenance mode",
  async () => {
    const database =
      createMaintenanceDatabase();

    const auditCalls =
      [];


    const app =
      createSettingsApplication({
        database,
        auditCalls,
      });


    await withServer(
      app,
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/settings/toggle-maintenance`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-test-role":
                  "SUPER_ADMIN",
              },

              body:
                JSON.stringify({
                  status:
                    true,
                }),
            }
          );


        assert.equal(
          response.status,
          403
        );


        assert.equal(
          database
            .state
            .getConnectionCount,
          0
        );


        assert.equal(
          auditCalls.length,
          0
        );
      }
    );


    delete require.cache[
      settingsRoutePath
    ];
  }
);


test(
  "Maintenance status requires a strict boolean",
  async () => {
    const database =
      createMaintenanceDatabase();

    const auditCalls =
      [];


    const app =
      createSettingsApplication({
        database,
        auditCalls,
      });


    await withServer(
      app,
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/settings/toggle-maintenance`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-test-role":
                  "IT_SUPPORT",
              },

              body:
                JSON.stringify({
                  status:
                    "true",
                }),
            }
          );


        assert.equal(
          response.status,
          400
        );


        assert.equal(
          database
            .state
            .getConnectionCount,
          0
        );
      }
    );


    delete require.cache[
      settingsRoutePath
    ];
  }
);


test(
  "IT Support maintenance change commits with canonical technical audit",
  async () => {
    const database =
      createMaintenanceDatabase();

    const auditCalls =
      [];


    const app =
      createSettingsApplication({
        database,
        auditCalls,
      });


    await withServer(
      app,
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/settings/toggle-maintenance`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-test-role":
                  "IT_SUPPORT",
              },

              body:
                JSON.stringify({
                  status:
                    true,
                }),
            }
          );


        const body =
          await response.json();


        assert.equal(
          response.status,
          200
        );


        assert.equal(
          body
            .isMaintenanceOn,
          true
        );


        assert.equal(
          database
            .state
            .beginCount,
          1
        );


        assert.equal(
          database
            .state
            .commitCount,
          1
        );


        assert.equal(
          database
            .state
            .rollbackCount,
          0
        );


        assert.equal(
          database
            .state
            .releaseCount,
          1
        );


        assert.equal(
          database
            .state
            .persisted,
          true
        );


        assert.equal(
          auditCalls.length,
          1
        );


        assert.equal(
          auditCalls[0]
            .data
            .userId,
          10
        );


        assert.equal(
          auditCalls[0]
            .data
            .role,
          "IT_SUPPORT"
        );


        assert.equal(
          auditCalls[0]
            .data
            .category,
          "TECHNICAL"
        );


        assert.equal(
          auditCalls[0]
            .data
            .action,
          "TOGGLE_MAINTENANCE_MODE"
        );
      }
    );


    delete require.cache[
      settingsRoutePath
    ];
  }
);


test(
  "Maintenance state rolls back when technical audit persistence fails",
  async () => {
    const database =
      createMaintenanceDatabase();

    const auditCalls =
      [];


    const app =
      createSettingsApplication({
        database,
        auditCalls,
        failAudit:
          true,
      });


    await withServer(
      app,
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/settings/toggle-maintenance`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-test-role":
                  "IT_SUPPORT",
              },

              body:
                JSON.stringify({
                  status:
                    true,
                }),
            }
          );


        assert.equal(
          response.status,
          500
        );


        assert.equal(
          auditCalls.length,
          1
        );


        assert.equal(
          database
            .state
            .commitCount,
          0
        );


        assert.equal(
          database
            .state
            .rollbackCount,
          1
        );


        assert.equal(
          database
            .state
            .persisted,
          false
        );


        assert.equal(
          database
            .state
            .releaseCount,
          1
        );
      }
    );


    delete require.cache[
      settingsRoutePath
    ];
  }
);


/*
 * ==================================================
 * AUDIT ROUTE RBAC TESTS
 * ==================================================
 */

function loadAuditRouter() {
  delete require.cache[
    auditRoutePath
  ];


  const mocks =
    new Map([
      [
        "../middleware/authMiddleware",
        {
          verifyToken(
            req,
            res,
            next
          ) {
            req.user = {
              id:
                1,

              role:
                String(
                  req.headers[
                    "x-test-role"
                  ] ||
                  ""
                )
                  .trim()
                  .toUpperCase(),
            };


            return next();
          },
        },
      ],

      [
        "../controllers/auditLogController",
        {
          getLogsByCategory(
            req,
            res
          ) {
            return res
              .status(200)
              .json({
                success:
                  true,

                category:
                  req.params
                    .category,
              });
          },
        },
      ],
    ]);


  const originalLoad =
    Module._load;


  try {
    Module._load =
      function patchedLoad(
        request,
        parent,
        isMain
      ) {
        if (
          parent?.filename ===
            auditRoutePath &&
          mocks.has(
            request
          )
        ) {
          return mocks.get(
            request
          );
        }


        return originalLoad.call(
          this,
          request,
          parent,
          isMain
        );
      };


    return require(
      auditRoutePath
    );
  }
  finally {
    Module._load =
      originalLoad;
  }
}


function createAuditRouteApplication() {
  const app =
    express();


  app.use(
    "/api",
    loadAuditRouter()
  );


  return app;
}


for (
  const scenario of
  [
    {
      name:
        "IT Support may read TECHNICAL audit logs",

      role:
        "IT_SUPPORT",

      category:
        "TECHNICAL",

      expected:
        200,
    },

    {
      name:
        "Super Admin cannot read TECHNICAL audit logs",

      role:
        "SUPER_ADMIN",

      category:
        "TECHNICAL",

      expected:
        403,
    },

    {
      name:
        "Super Admin may read OPERATIONAL audit logs",

      role:
        "SUPER_ADMIN",

      category:
        "OPERATIONAL",

      expected:
        200,
    },

    {
      name:
        "IT Support cannot read OPERATIONAL audit logs",

      role:
        "IT_SUPPORT",

      category:
        "OPERATIONAL",

      expected:
        403,
    },

    {
      name:
        "Unknown audit categories fail closed",

      role:
        "SUPER_ADMIN",

      category:
        "UNKNOWN",

      expected:
        400,
    },
  ]
) {
  test(
    scenario.name,
    async () => {
      const app =
        createAuditRouteApplication();


      await withServer(
        app,
        async (
          baseUrl
        ) => {
          const response =
            await fetch(
              `${baseUrl}/api/audit-logs/${scenario.category}`,
              {
                headers: {
                  "x-test-role":
                    scenario.role,
                },
              }
            );


          assert.equal(
            response.status,
            scenario.expected
          );
        }
      );


      delete require.cache[
        auditRoutePath
      ];
    }
  );
}


/*
 * ==================================================
 * HR COORDINATOR AUDIT FILTER / SUMMARY
 * ==================================================
 */

function loadAuditController(
  queryCalls
) {
  delete require.cache[
    auditControllerPath
  ];


  const fakeDatabase = {
    promise() {
      return {
        async query(
          sql,
          params
        ) {
          const normalized =
            String(
              sql
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim();


          queryCalls.push({
            sql:
              normalized,

            params:
              Array.isArray(
                params
              )
                ? [
                    ...params,
                  ]
                : params,
          });


          if (
            normalized.includes(
              "SUM(role = 'HR_COORDINATOR') AS hr_coordinator"
            )
          ) {
            return [
              [
                {
                  total:
                    2,

                  super_admin:
                    0,

                  hr_manager:
                    0,

                  hr_staff:
                    0,

                  hr_coordinator:
                    2,

                  it_support:
                    0,
                },
              ],
            ];
          }


          if (
            normalized.includes(
              "COUNT(*) AS total"
            )
          ) {
            return [
              [
                {
                  total:
                    2,
                },
              ],
            ];
          }


          return [
            [
              {
                id:
                  101,

                user_id:
                  "8",

                username:
                  "hc-test",

                role:
                  "HR_COORDINATOR",

                category:
                  "OPERATIONAL",

                action:
                  "TEST",

                description:
                  "Test record",

                full_name:
                  "Coordinator Test",
              },
            ],
          ];
        },
      };
    },
  };


  const mocks =
    new Map([
      [
        "../config/db",
        fakeDatabase,
      ],

      [
        "../utils/auditLogger",
        {
          AUDIT_CATEGORY,
        },
      ],
    ]);


  const originalLoad =
    Module._load;


  try {
    Module._load =
      function patchedLoad(
        request,
        parent,
        isMain
      ) {
        if (
          parent?.filename ===
            auditControllerPath &&
          mocks.has(
            request
          )
        ) {
          return mocks.get(
            request
          );
        }


        return originalLoad.call(
          this,
          request,
          parent,
          isMain
        );
      };


    return require(
      auditControllerPath
    );
  }
  finally {
    Module._load =
      originalLoad;
  }
}


test(
  "Audit API accepts HR_COORDINATOR role filtering and reports its summary count",
  async () => {
    const queryCalls =
      [];


    const controller =
      loadAuditController(
        queryCalls
      );


    const req = {
      params: {
        category:
          "OPERATIONAL",
      },

      query: {
        view:
          "summary",

        page:
          "1",

        pageSize:
          "25",

        role:
          "HR_COORDINATOR",

        search:
          "",
      },
    };


    let statusCode =
      null;

    let responseBody =
      null;


    const res = {
      status(
        value
      ) {
        statusCode =
          value;

        return this;
      },

      json(
        value
      ) {
        responseBody =
          value;

        return this;
      },
    };


    await controller
      .getLogsByCategory(
        req,
        res
      );


    assert.equal(
      statusCode,
      200
    );


    assert.equal(
      responseBody
        ?.filters
        ?.role,
      "HR_COORDINATOR"
    );


    assert.equal(
      responseBody
        ?.summary
        ?.hrCoordinator,
      2
    );


    assert.ok(
      queryCalls.some(
        (
          call
        ) =>
          Array.isArray(
            call.params
          ) &&
          call.params.includes(
            "HR_COORDINATOR"
          )
      )
    );


    delete require.cache[
      auditControllerPath
    ];
  }
);
