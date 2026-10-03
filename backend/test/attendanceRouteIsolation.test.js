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


const attendanceRoutePath =
  path.resolve(
    __dirname,
    "../routes/attendanceRoutes.js"
  );


function loadAttendanceRouter() {
  const mockModules =
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
                999,

              username:
                "route-isolation-test",

              role:
                String(
                  req.headers[
                    "x-test-role"
                  ] ||
                  ""
                ),
            };

            return next();
          },
        },
      ],

      [
        "../controllers/attendanceController",
        {
          getAttendanceByDate(
            req,
            res
          ) {
            return res.json({
              success:
                true,

              source:
                "attendance",
            });
          },

          saveAttendance(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },

          getAttendanceHistory(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },

          getAttendanceHistoryDetail(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },

          getAttendancePerformance(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },

          getAttendanceEvidence(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },

          getEmployeeAttendanceHistory(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },
        },
      ],

      [
        "../controllers/storageUploadController",
        {
          createAttendanceEvidenceUploadAuthorizations(
            req,
            res
          ) {
            return res.json({
              success:
                true,
            });
          },
        },
      ],

      [
        "../middleware/directUploadFinalizeMiddleware",
        {
          finalizeAttendanceEvidenceDirectUpload(
            req,
            res,
            next
          ) {
            return next();
          },
        },
      ],
    ]);


  delete require.cache[
    attendanceRoutePath
  ];


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
            attendanceRoutePath &&
          mockModules.has(
            request
          )
        ) {
          return mockModules.get(
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
      attendanceRoutePath
    );
  }
  finally {
    Module._load =
      originalLoad;
  }
}


function createApplication() {
  const app =
    express();


  app.use(
    express.json()
  );


  app.use(
    "/api",
    loadAttendanceRouter()
  );


  /*
   * Simulates the Messenger router mounted after
   * attendanceRoutes in app.js.
   */
  app.get(
    "/api/chat/users",
    (
      req,
      res
    ) => {
      return res
        .status(200)
        .json({
          success:
            true,

          source:
            "messenger",
        });
    }
  );


  return app;
}


async function withServer(
  callback
) {
  const server =
    http.createServer(
      createApplication()
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
    delete require.cache[
      attendanceRoutePath
    ];


    if (
      server.listening
    ) {
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
}


test(
  "Attendance middleware does not intercept Messenger for Super Admin",
  async () => {
    await withServer(
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/chat/users`,
            {
              headers: {
                "x-test-role":
                  "SUPER_ADMIN",
              },
            }
          );


        const body =
          await response.json();


        assert.equal(
          response.status,
          200
        );


        assert.equal(
          body.source,
          "messenger"
        );
      }
    );
  }
);


test(
  "Attendance endpoint still rejects non-HR-Coordinator roles",
  async () => {
    await withServer(
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/attendance`,
            {
              headers: {
                "x-test-role":
                  "SUPER_ADMIN",
              },
            }
          );


        const body =
          await response.json();


        assert.equal(
          response.status,
          403
        );


        assert.match(
          String(
            body.error ||
            ""
          ),
          /Attendance is restricted to HR Coordinators/i
        );
      }
    );
  }
);


test(
  "Attendance endpoint still allows HR Coordinator",
  async () => {
    await withServer(
      async (
        baseUrl
      ) => {
        const response =
          await fetch(
            `${baseUrl}/api/attendance`,
            {
              headers: {
                "x-test-role":
                  "HR_COORDINATOR",
              },
            }
          );


        const body =
          await response.json();


        assert.equal(
          response.status,
          200
        );


        assert.equal(
          body.source,
          "attendance"
        );
      }
    );
  }
);
