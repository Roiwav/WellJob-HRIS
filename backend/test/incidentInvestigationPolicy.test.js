"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateProofSubmission,
  evaluateStartInvestigation,
  getReportingPath,
} = require("../utils/incidentInvestigationPolicy");

function onsiteIncident(overrides = {}) {
  return {
    id: 100,
    company: "Company A",
    status: "Open",
    report_creator_id: 10,
    report_creator_role: "HR_COORDINATOR",
    ...overrides,
  };
}

function officeIncident(overrides = {}) {
  return {
    id: 200,
    company: "Company A",
    status: "Open",
    report_creator_id: 20,
    report_creator_role: "HR_STAFF",
    ...overrides,
  };
}

test("reporting path uses the canonical CREATE_INCIDENT creator role", () => {
  assert.equal(
    getReportingPath(onsiteIncident()),
    "ONSITE"
  );
  assert.equal(
    getReportingPath(officeIncident()),
    "MAIN_OFFICE"
  );
  assert.equal(
    getReportingPath({}),
    "UNKNOWN"
  );
});

test("all assigned-company coordinators may claim regardless of creator role", () => {
  for (const candidateIncident of [
    onsiteIncident(),
    officeIncident(),
    officeIncident({
      report_creator_id: 30,
      report_creator_role: "HR_MANAGER",
    }),
  ]) {
    for (const userId of [11, 12, 13]) {
      const result = evaluateStartInvestigation({
        actor: {
          userId,
          role: "HR_COORDINATOR",
          assignedCompany: "Company A",
        },
        incident: candidateIncident,
      });

      assert.equal(result.allowed, true);
      assert.equal(
        result.code,
        "ASSIGNED_COMPANY_COORDINATOR_ELIGIBLE"
      );
    }
  }
});

test("coordinator company restriction rejects other-company investigation attempts", () => {
  const result = evaluateStartInvestigation({
    actor: {
      userId: 14,
      role: "HR_COORDINATOR",
      assignedCompany: "Company B",
    },
    incident: onsiteIncident(),
  });

  assert.equal(result.allowed, false);
  assert.equal(
    result.code,
    "INCIDENT_COMPANY_SCOPE_REQUIRED"
  );
});

test("HR Staff cannot start investigations, including reliable legacy reports they created", () => {
  const creator = evaluateStartInvestigation({
    actor: {
      userId: 20,
      role: "HR_STAFF",
    },
    incident: officeIncident(),
  });

  assert.equal(creator.allowed, false);
  assert.equal(creator.code, "INVESTIGATOR_ROLE_REQUIRED");
});

test("HR Manager start matrix follows canonical creator role and identity", () => {
  const originalManager = evaluateStartInvestigation({
    actor: { userId: 30, role: "HR_MANAGER" },
    incident: officeIncident({
      report_creator_id: 30,
      report_creator_role: "HR_MANAGER",
    }),
  });
  const unrelatedManager = evaluateStartInvestigation({
    actor: { userId: 31, role: "HR_MANAGER" },
    incident: officeIncident({
      report_creator_id: 30,
      report_creator_role: "HR_MANAGER",
    }),
  });
  const managerOnCoordinatorReport = evaluateStartInvestigation({
    actor: { userId: 31, role: "HR_MANAGER" },
    incident: onsiteIncident(),
  });
  const managerOnLegacyStaffReport = evaluateStartInvestigation({
    actor: { userId: 31, role: "HR_MANAGER" },
    incident: officeIncident(),
  });

  assert.equal(originalManager.allowed, true);
  assert.equal(unrelatedManager.allowed, false);
  assert.equal(
    unrelatedManager.code,
    "ORIGINAL_MANAGER_CREATOR_REQUIRED"
  );
  assert.equal(managerOnCoordinatorReport.allowed, true);
  assert.equal(managerOnLegacyStaffReport.allowed, true);
});

test("office-created incidents remain unavailable to other-company coordinators", () => {
  const result = evaluateStartInvestigation({
    actor: {
      userId: 11,
      role: "HR_COORDINATOR",
      assignedCompany: "Company B",
    },
    incident: officeIncident(),
  });

  assert.equal(result.allowed, false);
  assert.equal(
    result.code,
    "INCIDENT_COMPANY_SCOPE_REQUIRED"
  );
});

test("legacy incidents without canonical creator identity fail closed", () => {
  const result = evaluateStartInvestigation({
    actor: {
      userId: 11,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    },
    incident: {
      status: "Open",
      company: "Company A",
      reported_by: "Legacy Name",
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(
    result.code,
    "REPORT_CREATOR_UNVERIFIABLE"
  );
});

test("duplicate start attempts receive the confirmed already-started conflict", () => {
  const result = evaluateStartInvestigation({
    actor: {
      userId: 12,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    },
    incident: onsiteIncident({
      status: "Investigating",
      investigation_started_by_id: 11,
      investigation_started_at:
        "2026-10-14T08:00:00.000Z",
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 409);
  assert.match(
    result.message,
    /another authorized investigator/i
  );
});

test("only the canonical assigned investigator may submit proof", () => {
  const incident = onsiteIncident({
    status: "Investigating",
    investigation_started_by_id: 12,
    investigation_started_at:
      "2026-10-14T08:00:00.000Z",
  });

  const owner = evaluateProofSubmission({
    actor: {
      userId: 12,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    },
    incident,
  });

  const otherCoordinator = evaluateProofSubmission({
    actor: {
      userId: 13,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    },
    incident,
  });

  assert.equal(owner.allowed, true);
  assert.equal(otherCoordinator.allowed, false);
  assert.equal(
    otherCoordinator.code,
    "ASSIGNED_INVESTIGATOR_REQUIRED"
  );
});

test("the responsible investigator may correct and resubmit a returned case", () => {
  const returnedIncident = officeIncident({
    status: "Investigating",
    investigation_started_by_id: 30,
    investigation_started_at:
      "2026-10-14T08:00:00.000Z",
    review_decision: "Returned",
  });

  const owner = evaluateProofSubmission({
    actor: {
      userId: 30,
      role: "HR_MANAGER",
    },
    incident: returnedIncident,
  });

  const originalCoordinatorCreator =
    evaluateProofSubmission({
      actor: {
        userId: 10,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      },
      incident: returnedIncident,
    });

  assert.equal(owner.allowed, true);
  assert.equal(
    originalCoordinatorCreator.allowed,
    false
  );
});

test("HR Staff cannot submit or resubmit resolution proof", () => {
  const result = evaluateProofSubmission({
    actor: { userId: 20, role: "HR_STAFF" },
    incident: officeIncident({
      status: "Investigating",
      investigation_started_by_id: 20,
      investigation_started_at: "2026-10-14T08:00:00.000Z",
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "INVESTIGATOR_ROLE_REQUIRED");
});