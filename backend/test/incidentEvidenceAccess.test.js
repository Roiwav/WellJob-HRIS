
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * WELLJOB — INCIDENT EVIDENCE ACCESS REGRESSION TEST
 *
 * No real database connection.
 * No employee evidence file is opened.
 * No production controller is modified.
 *
 * This test checks:
 * - The coordinator's company and current-deployment
 *   restrictions are present in the evidence query.
 * - Both coordinator-company query parameters are bound.
 * - An unauthorized or missing evidence row returns 404.
 * - An unassigned coordinator is rejected before DB access.
 * - Other authorized HR roles do not receive the
 *   coordinator-specific SQL restriction.
 */

function loadControllerWithMockDatabase() {
  const databaseModulePath = require.resolve(
    "../config/db"
  );

  const controllerModulePath = require.resolve(
    "../controllers/incidentEvidenceController"
  );

  const previousDatabaseModule =
    require.cache[databaseModulePath];

  const previousControllerModule =
    require.cache[controllerModulePath];

  const queryCalls = [];

  const mockDatabase = {
    promise() {
      return {
        async query(sql, parameters = []) {
          queryCalls.push({
            sql,
            parameters,
          });

          /*
           * Simulate a database query that finds no
           * evidence row accessible to this request.
           *
           * No physical evidence file will be opened.
           */
          return [[]];
        },
      };
    },
  };

  try {
    require.cache[databaseModulePath] = {
      id: databaseModulePath,
      filename: databaseModulePath,
      loaded: true,
      exports: mockDatabase,
    };

    delete require.cache[controllerModulePath];

    const controller = require(
      "../controllers/incidentEvidenceController"
    );

    return {
      getIncidentEvidenceFile:
        controller.getIncidentEvidenceFile,

      queryCalls,
    };
  } finally {
    /*
     * Restore the module cache so this test does not
     * leave a mocked database module installed.
     */
    if (previousDatabaseModule) {
      require.cache[databaseModulePath] =
        previousDatabaseModule;
    } else {
      delete require.cache[databaseModulePath];
    }

    if (previousControllerModule) {
      require.cache[controllerModulePath] =
        previousControllerModule;
    } else {
      delete require.cache[controllerModulePath];
    }
  }
}

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

    sendFile() {
      throw new Error(
        "Evidence file must not be opened in this test."
      );
    },
  };
}

const {
  getIncidentEvidenceFile,
  queryCalls,
} = loadControllerWithMockDatabase();

test(
  "Coordinator evidence query requires incident company AND current exclusive deployment",
  async () => {
    queryCalls.length = 0;

    const request = {
      params: {
        incidentId: "104",
        evidenceId: "7",
      },

      user: {
        role: "HR_COORDINATOR",
        assignedCompany: "Shopee",
      },
    };

    const response = createResponse();

    await getIncidentEvidenceFile(
      request,
      response
    );

    assert.equal(
      response.statusCode,
      404
    );

    assert.equal(
      queryCalls.length,
      1
    );

    const { sql, parameters } =
      queryCalls[0];

    const normalizedSql =
      sql.replace(/\s+/g, " ");

    assert.deepEqual(
      parameters,
      [7, 104, "Shopee", "Shopee"]
    );

    assert.match(
      normalizedSql,
      /INNER JOIN incidents AS i/i
    );

    assert.match(
      normalizedSql,
      /LEFT JOIN employees AS e/i
    );

    assert.match(
      normalizedSql,
      /ie\.id\s*=\s*\?/i
    );

    assert.match(
      normalizedSql,
      /ie\.incident_id\s*=\s*\?/i
    );

    assert.match(
      normalizedSql,
      /COALESCE\(i\.company,\s*''\)/i
    );

    assert.match(
      normalizedSql,
      /e\.id IS NOT NULL/i
    );

    assert.match(
      normalizedSql,
      /COALESCE\(e\.archived,\s*0\)\s*=\s*0/i
    );

    assert.match(
      normalizedSql,
      /COALESCE\(e\.status,\s*''\)/i
    );

    assert.match(
      normalizedSql,
      /deployment_assignments AS da_current/i
    );

    assert.match(
      normalizedSql,
      /da_current\.employee_id\s*=\s*e\.id/i
    );

    assert.match(
      normalizedSql,
      /da_current\.status\s*=\s*'Active'/i
    );

    assert.match(
      normalizedSql,
      /COALESCE\(\s*da_current\.company,\s*''\s*\)/i
    );

    assert.match(
      normalizedSql,
      /NOT EXISTS/i
    );

    assert.match(
      normalizedSql,
      /deployment_assignments AS da_conflict/i
    );

    assert.match(
      normalizedSql,
      /da_conflict\.id\s*<>\s*da_current\.id/i
    );
  }
);

test(
  "Unassigned coordinator is rejected before database query",
  async () => {
    queryCalls.length = 0;

    const request = {
      params: {
        incidentId: "104",
        evidenceId: "7",
      },

      user: {
        role: "HR_COORDINATOR",
        assignedCompany: null,
      },
    };

    const response = createResponse();

    await getIncidentEvidenceFile(
      request,
      response
    );

    assert.equal(
      response.statusCode,
      403
    );

    assert.equal(
      queryCalls.length,
      0
    );
  }
);

test(
  "HR Staff retains the existing non-coordinator evidence query",
  async () => {
    queryCalls.length = 0;

    const request = {
      params: {
        incidentId: "104",
        evidenceId: "7",
      },

      user: {
        role: "HR_STAFF",
      },
    };

    const response = createResponse();

    await getIncidentEvidenceFile(
      request,
      response
    );

    /*
     * The mocked database contains no evidence row,
     * so 404 is expected even for HR Staff.
     *
     * This test checks query scope, NOT successful
     * retrieval of an existing file.
     */
    assert.equal(
      response.statusCode,
      404
    );

    assert.equal(
      queryCalls.length,
      1
    );

    assert.deepEqual(
      queryCalls[0].parameters,
      [7, 104]
    );

    assert.doesNotMatch(
      queryCalls[0].sql,
      /deployment_assignments/i
    );
  }
);