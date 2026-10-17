"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ??= "";
process.env.DB_NAME ||= "test";

const {
  __test: {
    buildSmartAlerts,
  },
} = require(
  "../controllers/smartAlertController"
);

const employee = {
  id: 501,
  name: "Test Employee",
  archived: false,
};

function incident(
  overrides = {}
) {
  return {
    id: 100,
    employeeId: 501,
    employeeName:
      "Test Employee",
    violationType:
      "Policy violation",
    severity:
      "Major",
    company:
      "Company A",
    status:
      "Open",
    createdAt:
      "2026-10-14T08:00:00.000Z",

    /*
     * Default canonical creator:
     * HR Coordinator #10.
     */
    report_creator_id:
      10,

    report_creator_role:
      "HR_COORDINATOR",

    ...overrides,
  };
}

function alertsFor({
  role,
  userId,
  assignedCompany = "",
  incidentOverrides = {},
}) {
  return buildSmartAlerts({
    employees: [
      employee,
    ],

    incidents: [
      incident(
        incidentOverrides
      ),
    ],

    role,

    currentUserAliases:
      new Set([
        String(
          userId
        ),
      ]),

    assignedCompany,

    currentUser: {
      id:
        userId,

      userId,

      role,

      assignedCompany,
    },
  }).filter(
    (
      alert
    ) =>
      alert.sourceType ===
      "INCIDENT"
  );
}

test(
  "every non-creator assigned-company coordinator receives one actionable Open alert",
  () => {
    for (
      const incidentOverrides of
      [
        {},
        {
          report_creator_id:
            20,

          report_creator_role:
            "HR_STAFF",
        },
        {
          report_creator_id:
            30,

          report_creator_role:
            "HR_MANAGER",
        },
      ]
    ) {
      for (
        const userId of
        [
          11,
          12,
        ]
      ) {
        const alerts =
          alertsFor({
            role:
              "HR_COORDINATOR",

            userId,

            assignedCompany:
              "Company A",

            incidentOverrides,
          });

        assert.equal(
          alerts.length,
          1
        );

        assert.equal(
          alerts[0].title,
          "Start Investigation #100"
        );

        assert.equal(
          alerts[0]
            .notificationPurpose,
          "START_INVESTIGATION"
        );

        assert.equal(
          alerts[0].action,
          "start-investigation"
        );
      }
    }
  }
);

test(
  "HR Coordinator creator receives no self-notification while same-company peers remain actionable",
  () => {
    const creatorAlerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          10,

        assignedCompany:
          "Company A",
      });

    const peerAlerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          11,

        assignedCompany:
          "Company A",
      });

    assert.equal(
      creatorAlerts.length,
      0
    );

    assert.equal(
      peerAlerts.length,
      1
    );

    assert.equal(
      peerAlerts[0]
        .notificationPurpose,
      "START_INVESTIGATION"
    );

    assert.equal(
      peerAlerts[0].action,
      "start-investigation"
    );
  }
);

test(
  "other-company coordinators receive no incident alert",
  () => {
    const alerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          13,

        assignedCompany:
          "Company B",
      });

    assert.equal(
      alerts.length,
      0
    );
  }
);

test(
  "eligible manager gets Start Investigation while Super Admin receives awareness-only",
  () => {
    const managerAlerts =
      alertsFor({
        role:
          "HR_MANAGER",

        userId:
          21,
      });

    const superAdminAlerts =
      alertsFor({
        role:
          "SUPER_ADMIN",

        userId:
          30,
      });

    assert.equal(
      managerAlerts.length,
      1
    );

    assert.equal(
      managerAlerts[0]
        .title,
      "Start Investigation #100"
    );

    assert.equal(
      managerAlerts[0]
        .notificationPurpose,
      "START_INVESTIGATION"
    );

    assert.equal(
      managerAlerts[0]
        .action,
      "start-investigation"
    );

    assert.equal(
      superAdminAlerts.length,
      1
    );

    assert.equal(
      superAdminAlerts[0]
        .title,
      "Incident Report for Review #100"
    );

    assert.equal(
      superAdminAlerts[0]
        .notificationPurpose,
      "INCIDENT_REPORT_FOR_REVIEW"
    );

    assert.equal(
      superAdminAlerts[0]
        .action,
      "view"
    );
  }
);

test(
  "HR Manager creator receives no self-notification while other management remains awareness-only",
  () => {
    const officeOverrides = {
      report_creator_id:
        20,

      report_creator_role:
        "HR_MANAGER",
    };

    const creatorAlerts =
      alertsFor({
        role:
          "HR_MANAGER",

        userId:
          20,

        incidentOverrides:
          officeOverrides,
      });

    const otherManagerAlerts =
      alertsFor({
        role:
          "HR_MANAGER",

        userId:
          21,

        incidentOverrides:
          officeOverrides,
      });

    const superAdminAlerts =
      alertsFor({
        role:
          "SUPER_ADMIN",

        userId:
          30,

        incidentOverrides:
          officeOverrides,
      });

    assert.equal(
      creatorAlerts.length,
      0
    );

    assert.equal(
      otherManagerAlerts.length,
      1
    );

    assert.equal(
      otherManagerAlerts[0]
        .notificationPurpose,
      "INCIDENT_REPORT_FOR_REVIEW"
    );

    assert.equal(
      otherManagerAlerts[0]
        .action,
      "view"
    );

    assert.equal(
      superAdminAlerts.length,
      1
    );

    assert.equal(
      superAdminAlerts[0]
        .action,
      "view"
    );

    const coordinatorAlerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          11,

        assignedCompany:
          "Company A",

        incidentOverrides:
          officeOverrides,
      });

    assert.equal(
      coordinatorAlerts.length,
      1
    );

    assert.equal(
      coordinatorAlerts[0]
        .notificationPurpose,
      "START_INVESTIGATION"
    );

    assert.equal(
      coordinatorAlerts[0]
        .action,
      "start-investigation"
    );
  }
);

test(
  "creator receives zero incident alerts when creator and Start Investigation eligibility overlap",
  () => {
    const alerts =
      alertsFor({
        role:
          "HR_MANAGER",

        userId:
          20,

        incidentOverrides: {
          report_creator_id:
            20,

          report_creator_role:
            "HR_MANAGER",
        },
      });

    assert.equal(
      alerts.length,
      0
    );
  }
);

test(
  "eligible peer still receives exactly one alert after creator self-notification is excluded",
  () => {
    const alerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          11,

        assignedCompany:
          "Company A",

        incidentOverrides: {
          report_creator_id:
            10,

          report_creator_role:
            "HR_COORDINATOR",
        },
      });

    assert.equal(
      alerts.length,
      1
    );

    assert.equal(
      alerts[0]
        .notificationPurpose,
      "START_INVESTIGATION"
    );
  }
);

test(
  "claiming removes all Start Investigation notifications",
  () => {
    const investigating = {
      status:
        "Investigating",

      investigationStartedAt:
        "2026-10-14T09:00:00.000Z",

      investigation_started_by_id:
        11,

      investigationStartedByName:
        "Coordinator One",
    };

    const coordinatorAlerts =
      alertsFor({
        role:
          "HR_COORDINATOR",

        userId:
          12,

        assignedCompany:
          "Company A",

        incidentOverrides:
          investigating,
      });

    const managerAlerts =
      alertsFor({
        role:
          "HR_MANAGER",

        userId:
          20,

        incidentOverrides:
          investigating,
      });

    for (
      const alert of
      [
        ...coordinatorAlerts,
        ...managerAlerts,
      ]
    ) {
      assert.notEqual(
        alert
          .notificationPurpose,
        "START_INVESTIGATION"
      );

      assert.notEqual(
        alert.action,
        "start-investigation"
      );
    }
  }
);

test(
  "For Review routes managers and Super Admin to proof review",
  () => {
    const forReview = {
      status:
        "For Review",

      investigation_started_by_id:
        11,

      resolution_submitted_by_id:
        11,

      resolutionSubmittedAt:
        "2026-10-14T10:00:00.000Z",
    };

    for (
      const role of
      [
        "HR_MANAGER",
        "SUPER_ADMIN",
      ]
    ) {
      const alerts =
        alertsFor({
          role,

          userId:
            role ===
            "HR_MANAGER"
              ? 20
              : 30,

          incidentOverrides:
            forReview,
        });

      assert.equal(
        alerts.length,
        1
      );

      assert.equal(
        alerts[0].title,
        "Proof Submitted for Review #100"
      );

      assert.equal(
        alerts[0]
          .notificationPurpose,
        "PROOF_SUBMITTED_FOR_REVIEW"
      );
    }
  }
);