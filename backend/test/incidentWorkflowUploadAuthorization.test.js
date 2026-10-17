"use strict";

process.env.JWT_SECRET ||=
  "incident-upload-authorization-test-secret";

const test = require("node:test");
const assert = require("node:assert/strict");

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

function loadController(incident) {
  const databasePath = require.resolve(
    "../config/db"
  );
  const storagePath = require.resolve(
    "../services/storageService"
  );
  const controllerPath = require.resolve(
    "../controllers/storageUploadController"
  );

  const previousDatabase =
    require.cache[databasePath];
  const previousStorage =
    require.cache[storagePath];
  const previousController =
    require.cache[controllerPath];

  let signedUploadCalls = 0;

  try {
    require.cache[databasePath] = {
      id: databasePath,
      filename: databasePath,
      loaded: true,
      exports: {
        promise() {
          return {
            async query() {
              return [[incident]];
            },
          };
        },
      },
    };

    require.cache[storagePath] = {
      id: storagePath,
      filename: storagePath,
      loaded: true,
      exports: {
        normalizeObjectPath(value) {
          return String(value || "")
            .trim()
            .replace(/\\\\/g, "/")
            .replace(/^\/+/, "");
        },
        async createSignedUploadUrl(
          objectPath
        ) {
          signedUploadCalls += 1;
          return {
            path: objectPath,
            token: "signed-test-token",
            signedUrl:
              "https://storage.invalid/upload",
          };
        },
      },
    };

    delete require.cache[controllerPath];

    const controller = require(
      "../controllers/storageUploadController"
    );

    return {
      authorizeCreate:
        controller
          .createIncidentEvidenceUploadAuthorizations,
      authorize:
        controller
          .createIncidentWorkflowEvidenceUploadAuthorizations,
      getSignedUploadCalls() {
        return signedUploadCalls;
      },
      restore() {
        if (previousDatabase) {
          require.cache[databasePath] =
            previousDatabase;
        } else {
          delete require.cache[databasePath];
        }

        if (previousStorage) {
          require.cache[storagePath] =
            previousStorage;
        } else {
          delete require.cache[storagePath];
        }

        if (previousController) {
          require.cache[controllerPath] =
            previousController;
        } else {
          delete require.cache[controllerPath];
        }
      },
    };
  } catch (error) {
    if (previousDatabase) {
      require.cache[databasePath] =
        previousDatabase;
    } else {
      delete require.cache[databasePath];
    }

    if (previousStorage) {
      require.cache[storagePath] =
        previousStorage;
    } else {
      delete require.cache[storagePath];
    }

    if (previousController) {
      require.cache[controllerPath] =
        previousController;
    } else {
      delete require.cache[controllerPath];
    }

    throw error;
  }
}

function requestFor(userId) {
  return {
    params: {
      incidentId: "100",
    },
    user: {
      id: userId,
      userId,
      tokenVersion: 1,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    },
    body: {
      incidentId: 100,
      workflowAction:
        "SUBMIT_INVESTIGATION",
      files: [
        {
          name: "proof.pdf",
          type: "application/pdf",
          size: 1024,
        },
      ],
    },
  };
}

const ownedIncident = {
  id: 100,
  company: "Company A",
  status: "Investigating",
  report_creator_id: 20,
  report_creator_role: "HR_MANAGER",
  investigation_started_by_id: 11,
  investigation_started_at:
    "2026-10-14T08:00:00.000Z",
};

test(
  "unauthorized user is rejected before a signed evidence upload URL is generated",
  async () => {
    const harness = loadController(
      ownedIncident
    );

    try {
      const response = createResponse();

      await harness.authorize(
        requestFor(12),
        response
      );

      assert.equal(response.statusCode, 403);
      assert.equal(
        response.body.code,
        "ASSIGNED_INVESTIGATOR_REQUIRED"
      );
      assert.equal(
        harness.getSignedUploadCalls(),
        0
      );
    } finally {
      harness.restore();
    }
  }
);

test(
  "Initial NTE authorization binds one file to the target employee",
  async () => {
    const harness = loadController(
      ownedIncident
    );

    try {
      const response = createResponse();

      await harness.authorizeCreate(
        {
          user: {
            id: 11,
            userId: 11,
            tokenVersion: 1,
            role: "HR_MANAGER",
          },
          body: {
            employeeId: 1500,
            files: [
              {
                name: "initial-nte.pdf",
                type: "application/pdf",
                size: 1024,
              },
            ],
          },
        },
        response
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.deepEqual(
        response.body.context,
        {
          employeeId: 1500,
        }
      );
      assert.equal(response.body.uploads.length, 1);
      assert.equal(
        harness.getSignedUploadCalls(),
        1
      );
    } finally {
      harness.restore();
    }
  }
);

test(
  "Initial Incident authorization accepts ten files and rejects an eleventh before signing URLs",
  async () => {
    const acceptedHarness = loadController(
      ownedIncident
    );

    try {
      const acceptedResponse = createResponse();

      await acceptedHarness.authorizeCreate(
        {
          user: {
            id: 11,
            userId: 11,
            tokenVersion: 1,
            role: "HR_MANAGER",
          },
          body: {
            employeeId: 1500,
            files: Array.from(
              { length: 10 },
              (_, index) => ({
                name: `incident-evidence-${index + 1}.pdf`,
                type: "application/pdf",
                size: 1024,
              })
            ),
          },
        },
        acceptedResponse
      );

      assert.equal(acceptedResponse.statusCode, 200);
      assert.equal(acceptedResponse.body.uploads.length, 10);
      assert.equal(
        acceptedHarness.getSignedUploadCalls(),
        10
      );
    } finally {
      acceptedHarness.restore();
    }

    const rejectedHarness = loadController(
      ownedIncident
    );

    try {
      const rejectedResponse = createResponse();

      await rejectedHarness.authorizeCreate(
        {
          user: {
            id: 11,
            userId: 11,
            tokenVersion: 1,
            role: "HR_MANAGER",
          },
          body: {
            employeeId: 1500,
            files: Array.from(
              { length: 11 },
              (_, index) => ({
                name: `incident-evidence-${index + 1}.pdf`,
                type: "application/pdf",
                size: 1024,
              })
            ),
          },
        },
        rejectedResponse
      );

      assert.equal(rejectedResponse.statusCode, 400);
      assert.equal(
        rejectedResponse.body.code,
        "TOO_MANY_FILES"
      );
      assert.equal(
        rejectedHarness.getSignedUploadCalls(),
        0
      );
    } finally {
      rejectedHarness.restore();
    }
  }
);

test(
  "canonical investigator may obtain workflow evidence upload authorization",
  async () => {
    const harness = loadController(
      ownedIncident
    );

    try {
      const response = createResponse();

      await harness.authorize(
        requestFor(11),
        response
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.uploads.length, 1);
      assert.equal(
        harness.getSignedUploadCalls(),
        1
      );
    } finally {
      harness.restore();
    }
  }
);