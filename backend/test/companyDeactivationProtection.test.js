"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const Module = require("node:module");
const express = require("express");

test(
  "Reject company deactivation when an HR Coordinator is assigned",
  async () => {
    const TEST_COMPANY_ID = 900001;
    const TEST_COMPANY_NAME = "AUTOMATED TEST COMPANY";

    let databaseReadCount = 0;
    let databaseWriteCount = 0;
    let auditCallCount = 0;

    const mockCompany = {
      id: TEST_COMPANY_ID,
      company_name: TEST_COMPANY_NAME,
      is_active: 1,
      created_at: null,
      updated_at: null,
    };

    const mockDb = {
      promise() {
        return {
          async query(sql, parameters = []) {
            if (
              /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE)\b/i.test(
                sql
              )
            ) {
              databaseWriteCount += 1;

              throw new Error(
                "TEST FAILURE: A database write was attempted."
              );
            }

            databaseReadCount += 1;

            if (sql.includes("FROM client_companies")) {
              assert.deepEqual(parameters, [TEST_COMPANY_ID]);

              return [[{ ...mockCompany }]];
            }

            if (sql.includes("FROM users")) {
              assert.match(sql, /HR_COORDINATOR/);

              assert.deepEqual(
                parameters,
                [TEST_COMPANY_NAME]
              );

              return [[{ count: 1 }]];
            }

            throw new Error(
              "Unexpected database query in isolated test."
            );
          },
        };
      },
    };

    const mockModules = new Map([
      ["../config/db", mockDb],

      [
        "../utils/auditLogger",
        {
          AUDIT_CATEGORY: {
            OPERATIONAL: "OPERATIONAL",
            TECHNICAL: "TECHNICAL",
          },

          async logAudit() {
            auditCallCount += 1;
          },
        },
      ],

      ["../utils/violationPolicyService", {}],

      ["../utils/performanceEvaluationService", {}],

      [
        "../middleware/authMiddleware",
        {
          verifyToken(req, res, next) {
            req.user = {
              userId: 1,
              username: "isolated-test-super-admin",
              role: "SUPER_ADMIN",
            };

            next();
          },
        },
      ],

      [
        "../middleware/roleMiddleware",
        {
          authorizeRoles(...allowedRoles) {
            return (req, res, next) => {
              if (!allowedRoles.includes(req.user?.role)) {
                return res.status(403).json({
                  success: false,
                  error: "Forbidden",
                });
              }

              next();
            };
          },
        },
      ],
    ]);

    const settingsRoutePath = path.resolve(
      __dirname,
      "../routes/settingsRoutes.js"
    );

    const originalLoad = Module._load;
    let settingsRouter;

    try {
      Module._load = function patchedModuleLoad(
        request,
        parent,
        isMain
      ) {
        if (
          parent?.filename === settingsRoutePath &&
          mockModules.has(request)
        ) {
          return mockModules.get(request);
        }

        return originalLoad.call(
          this,
          request,
          parent,
          isMain
        );
      };

      settingsRouter = require(settingsRoutePath);
    } finally {
      Module._load = originalLoad;
    }

    const app = express();

    app.use(express.json());
    app.use("/api", settingsRouter);

    const server = http.createServer(app);

    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });

      const address = server.address();

      assert.ok(address && typeof address !== "string");

      const requestBody = JSON.stringify({
        isActive: false,
      });

      const response = await new Promise(
        (resolve, reject) => {
          const request = http.request(
            {
              hostname: "127.0.0.1",
              port: address.port,
              path:
                `/api/settings/client-companies/` +
                `${TEST_COMPANY_ID}/status`,
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Content-Length":
                  Buffer.byteLength(requestBody),
              },
            },
            (incomingResponse) => {
              let responseText = "";

              incomingResponse.setEncoding("utf8");

              incomingResponse.on("data", (chunk) => {
                responseText += chunk;
              });

              incomingResponse.on("end", () => {
                try {
                  resolve({
                    statusCode:
                      incomingResponse.statusCode,
                    body: JSON.parse(responseText),
                  });
                } catch (error) {
                  reject(error);
                }
              });

              incomingResponse.on("error", reject);
            }
          );

          request.on("error", reject);
          request.end(requestBody);
        }
      );

      assert.equal(response.statusCode, 409);
      assert.equal(response.body.success, false);

      assert.match(
        response.body.error,
        /cannot be deactivated/i
      );

      assert.equal(
        response.body.assignedHrCoordinatorCount,
        1
      );

      assert.equal(databaseReadCount, 2);
      assert.equal(databaseWriteCount, 0);
      assert.equal(auditCallCount, 0);
      assert.equal(mockCompany.is_active, 1);
    } finally {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
    }
  }
);