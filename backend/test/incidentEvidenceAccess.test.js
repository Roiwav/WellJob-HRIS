"use strict";

process.env.SUPABASE_URL ||=
  "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||=
  "test-secret-key";
process.env.SUPABASE_STORAGE_BUCKET ||=
  "test-bucket";

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
 * - HR Staff is denied protected Incident evidence access.
 * - IT Support is denied protected Incident evidence access.
 * - Other authorized Incident roles are not given the
 *   coordinator-specific company restriction.
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

    const {
      sql,
      parameters,
    } = queryCalls[0];

    const normalizedSql =
      sql.replace(/\s+/g, " ");

    assert.deepEqual(
      parameters,
      [
        7,
        104,
        "Shopee",
        "Shopee",
      ]
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
  "HR Staff is rejected before database query",
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
  "IT Support is rejected before database query",
  async () => {
    queryCalls.length = 0;

    const request = {
      params: {
        incidentId: "104",
        evidenceId: "7",
      },

      user: {
        role: "IT_SUPPORT",
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
  "HR Manager reaches evidence lookup without coordinator company restriction",
  async () => {
    queryCalls.length = 0;

    const response = createResponse();

    await getIncidentEvidenceFile(
      {
        params: {
          incidentId: "104",
          evidenceId: "7",
        },

        user: {
          role: "HR_MANAGER",
        },
      },
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

    const {
      sql,
      parameters,
    } = queryCalls[0];

    const normalizedSql =
      sql.replace(/\s+/g, " ");

    assert.deepEqual(
      parameters,
      [7, 104]
    );

    assert.doesNotMatch(
      normalizedSql,
      /deployment_assignments AS da_current/i
    );
  }
);

test(
  "Super Admin reaches evidence lookup without coordinator company restriction",
  async () => {
    queryCalls.length = 0;

    const response = createResponse();

    await getIncidentEvidenceFile(
      {
        params: {
          incidentId: "104",
          evidenceId: "7",
        },

        user: {
          role: "SUPER_ADMIN",
        },
      },
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

    const {
      sql,
      parameters,
    } = queryCalls[0];

    const normalizedSql =
      sql.replace(/\s+/g, " ");

    assert.deepEqual(
      parameters,
      [7, 104]
    );

    assert.doesNotMatch(
      normalizedSql,
      /deployment_assignments AS da_current/i
    );
  }
);