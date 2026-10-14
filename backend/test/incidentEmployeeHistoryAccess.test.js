"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * WELLJOB — HR STAFF EMPLOYEE INCIDENT HISTORY REGRESSION TEST
 *
 * Purpose:
 * - HR Staff may keep read-only textual Incident history
 *   inside the Employee module.
 * - HR Staff must NOT receive Initial NTE, Resolution Proof,
 *   protected evidence metadata, investigator/reviewer
 *   workflow objects, or timeline actor data.
 *
 * Test isolation:
 * - No real MySQL connection.
 * - No Supabase configuration required.
 * - No Supabase call.
 * - No production data is modified.
 *
 * The Incident controller indirectly reaches protected
 * storage code through fileReferenceService. That dependency
 * is mocked before the controller is required so this unit
 * test remains completely independent from SUPABASE_URL,
 * SUPABASE_SECRET_KEY, and SUPABASE_STORAGE_BUCKET.
 */

function loadIncidentControllerWithMocks() {
  const databaseModulePath = require.resolve(
    "../config/db"
  );

  const fileReferenceServiceModulePath = require.resolve(
    "../utils/fileReferenceService"
  );

  const controllerModulePath = require.resolve(
    "../controllers/incidentController"
  );

  const previousDatabaseModule =
    require.cache[databaseModulePath];

  const previousFileReferenceServiceModule =
    require.cache[
      fileReferenceServiceModulePath
    ];

  const previousControllerModule =
    require.cache[controllerModulePath];

  const queryCalls = [];

  const incidentRow = {
    id: 104,
    employee_id: 77,
    employee_name:
      "Sample Employee",
    company:
      "Shopee",
    violation_type:
      "Absence Without Notice",
    severity:
      "Major",
    status:
      "Investigating",
    incident_date:
      "2026-10-01",
    location:
      "Site A",
    description:
      "Employee was absent without prior notice.",
    reported_by:
      "HR Manager",
    action_taken:
      null,
    policy_sanction:
      "Written Warning",
    recommendation:
      "Monitor attendance",
    resolution_notes:
      null,

    investigation_started_by_id:
      12,
    investigation_started_by_username:
      "manager1",
    investigation_started_by_name:
      "Manager One",
    investigation_started_at:
      "2026-10-02 09:00:00",

    resolution_submitted_by_id:
      null,
    resolution_submitted_by_username:
      null,
    resolution_submitted_by_name:
      null,
    resolution_submitted_at:
      null,

    reviewed_by_id:
      null,
    reviewed_by_username:
      null,
    reviewed_by_name:
      null,
    reviewed_at:
      null,
    review_decision:
      null,
    review_comments:
      null,

    created_at:
      "2026-10-01 08:00:00",
    updated_at:
      "2026-10-02 09:00:00",

    last_action_by_id:
      12,
    last_action_by_username:
      "manager1",
    last_action_by_name:
      "Manager One",
    last_action_type:
      "START_INVESTIGATION",
    last_action_at:
      "2026-10-02 09:00:00",

    employeeNameFromEmployee:
      "Sample Employee",
    employeeCompany:
      "Shopee",
    employeeStatus:
      "Deployed",
  };

  const mockDatabase = {
    promise() {
      return {
        async query(
          sql,
          parameters = []
        ) {
          queryCalls.push({
            sql,
            parameters,
          });

          const normalizedSql =
            String(sql)
              .replace(
                /\s+/g,
                " "
              )
              .trim();

          /*
           * The HR Staff controller path should execute
           * only the textual Employee Incident query.
           *
           * It must return before incident_evidence or
           * incident_timeline is queried.
           */
          if (
            /FROM incidents i/i.test(
              normalizedSql
            ) &&
            /LEFT JOIN employees e/i.test(
              normalizedSql
            )
          ) {
            return [
              [
                incidentRow,
              ],
            ];
          }

          throw new Error(
            `Unexpected database query for HR Staff history test: ${normalizedSql}`
          );
        },
      };
    },
  };

  const mockFileReferenceService = {
    /*
     * incidentController imports this helper for
     * post-delete historical file cleanup.
     *
     * This test never deletes an Incident, so the mock
     * deliberately fails if that unrelated path is
     * unexpectedly reached.
     */
    async cleanupUnreferencedFileCandidates() {
      throw new Error(
        "Protected storage cleanup must not run during HR Staff Employee-history test."
      );
    },
  };

  try {
    require.cache[
      databaseModulePath
    ] = {
      id:
        databaseModulePath,
      filename:
        databaseModulePath,
      loaded:
        true,
      exports:
        mockDatabase,
    };

    require.cache[
      fileReferenceServiceModulePath
    ] = {
      id:
        fileReferenceServiceModulePath,
      filename:
        fileReferenceServiceModulePath,
      loaded:
        true,
      exports:
        mockFileReferenceService,
    };

    delete require.cache[
      controllerModulePath
    ];

    const controller = require(
      "../controllers/incidentController"
    );

    return {
      getIncidentsByEmployee:
        controller.getIncidentsByEmployee,

      queryCalls,
    };
  } finally {
    /*
     * Restore every mocked module so this test does not
     * leak fake dependencies into other Node tests.
     */
    if (
      previousDatabaseModule
    ) {
      require.cache[
        databaseModulePath
      ] =
        previousDatabaseModule;
    } else {
      delete require.cache[
        databaseModulePath
      ];
    }

    if (
      previousFileReferenceServiceModule
    ) {
      require.cache[
        fileReferenceServiceModulePath
      ] =
        previousFileReferenceServiceModule;
    } else {
      delete require.cache[
        fileReferenceServiceModulePath
      ];
    }

    if (
      previousControllerModule
    ) {
      require.cache[
        controllerModulePath
      ] =
        previousControllerModule;
    } else {
      delete require.cache[
        controllerModulePath
      ];
    }
  }
}

function createResponse() {
  return {
    statusCode:
      200,

    body:
      null,

    status(code) {
      this.statusCode =
        code;

      return this;
    },

    json(body) {
      this.body =
        body;

      return this;
    },
  };
}

const {
  getIncidentsByEmployee,
  queryCalls,
} =
  loadIncidentControllerWithMocks();

test(
  "HR Staff receives textual Employee incident history without protected evidence/workflow metadata",
  async () => {
    queryCalls.length = 0;

    const request = {
      params: {
        employeeId:
          "77",
      },

      query: {},

      user: {
        userId:
          25,
        username:
          "hrstaff1",
        role:
          "HR_STAFF",
      },
    };

    const response =
      createResponse();

    await getIncidentsByEmployee(
      request,
      response
    );

    assert.equal(
      response.statusCode,
      200
    );

    assert.ok(
      Array.isArray(
        response.body
      )
    );

    assert.equal(
      response.body.length,
      1
    );

    /*
     * HR Staff history must not query protected
     * Incident evidence or timeline tables.
     */
    assert.equal(
      queryCalls.length,
      1
    );

    const onlyQuery =
      String(
        queryCalls[0].sql
      ).replace(
        /\s+/g,
        " "
      );

    assert.match(
      onlyQuery,
      /FROM incidents i/i
    );

    assert.doesNotMatch(
      onlyQuery,
      /incident_evidence/i
    );

    assert.doesNotMatch(
      onlyQuery,
      /incident_timeline/i
    );

    const incident =
      response.body[0];

    /*
     * Textual Employee-history fields remain available.
     */
    assert.equal(
      incident.id,
      104
    );

    assert.equal(
      incident.employeeId,
      77
    );

    assert.equal(
      incident.employee,
      "Sample Employee"
    );

    assert.equal(
      incident.company,
      "Shopee"
    );

    assert.equal(
      incident.violation,
      "Absence Without Notice"
    );

    assert.equal(
      incident.severity,
      "Major"
    );

    assert.equal(
      incident.status,
      "Investigating"
    );

    assert.equal(
      incident.description,
      "Employee was absent without prior notice."
    );

    assert.equal(
      incident.policySanction,
      "Written Warning"
    );

    assert.equal(
      incident.sanction,
      "Written Warning"
    );

    /*
     * Protected evidence and workflow metadata are
     * deliberately unavailable to HR Staff.
     */
    assert.equal(
      incident.initialNte,
      null
    );

    assert.equal(
      incident.initial_nte,
      null
    );

    assert.deepEqual(
      incident.evidence,
      []
    );

    assert.equal(
      incident.resolution,
      null
    );

    assert.equal(
      incident.investigation,
      null
    );

    assert.equal(
      incident.review,
      null
    );

    assert.deepEqual(
      incident.timelineEvents,
      []
    );

    assert.deepEqual(
      incident.timeline_events,
      []
    );

    assert.deepEqual(
      incident.timeline,
      []
    );

    assert.equal(
      incident.protectedEvidenceAccess,
      false
    );

    assert.equal(
      incident.protected_evidence_access,
      false
    );

    /*
     * Investigator/reviewer identity fields must not
     * leak through the reduced HR Staff serializer.
     */
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        incident,
        "investigationStartedById"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        incident,
        "resolutionSubmittedById"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        incident,
        "reviewedById"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        incident,
        "lastActionById"
      ),
      false
    );
  }
);