import test from "node:test";
import assert from "node:assert/strict";

import {
  canUserStartInvestigation,
  canUserSubmitInvestigationProof,
} from "../src/utils/incidents/investigationEligibility.js";

const onsiteIncident = {
  status: "Open",
  company: "Company A",
  reportingPath: "ONSITE",
  reportCreatorId: 10,
};

test("frontend exposes Start Investigation only to assigned-company coordinators", () => {
  assert.equal(
    canUserStartInvestigation(
      onsiteIncident,
      {
        id: 11,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    true
  );

  assert.equal(
    canUserStartInvestigation(
      onsiteIncident,
      {
        id: 12,
        role: "HR_COORDINATOR",
        assignedCompany: "Company B",
      }
    ),
    false
  );
});

test("frontend enforces manager/coordinator office investigation matrix", () => {
  const legacyStaffIncident = {
    status: "Open",
    company: "Company A",
    reportingPath: "MAIN_OFFICE",
    reportCreatorId: 20,
    reportCreatorRole: "HR_STAFF",
  };

  assert.equal(
    canUserStartInvestigation(
      legacyStaffIncident,
      {
        id: 20,
        role: "HR_STAFF",
      }
    ),
    false
  );

  assert.equal(
    canUserStartInvestigation(
      legacyStaffIncident,
      {
        id: 21,
        role: "HR_MANAGER",
      }
    ),
    true
  );

  assert.equal(
    canUserStartInvestigation(
      legacyStaffIncident,
      {
        id: 30,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    true
  );

  assert.equal(
    canUserStartInvestigation(
      legacyStaffIncident,
      {
        id: 31,
        role: "HR_COORDINATOR",
        assignedCompany: "Company B",
      }
    ),
    false
  );

  const managerIncident = {
    ...legacyStaffIncident,
    reportCreatorId: 40,
    reportCreatorRole: "HR_MANAGER",
  };

  assert.equal(
    canUserStartInvestigation(
      managerIncident,
      { id: 40, role: "HR_MANAGER" }
    ),
    true
  );
  assert.equal(
    canUserStartInvestigation(
      managerIncident,
      { id: 41, role: "HR_MANAGER" }
    ),
    false
  );
});

test("frontend fails closed when canonical creator metadata is missing", () => {
  assert.equal(
    canUserStartInvestigation(
      {
        status: "Open",
        company: "Company A",
        reportingPath: "UNKNOWN",
      },
      {
        id: 30,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    false
  );
});

test("frontend removes stale starts and duplicate proof submission from non-owners", () => {
  const incident = {
    status: "Investigating",
    company: "Company A",
    reportingPath: "ONSITE",
    reportCreatorId: 10,
    investigationStartedAt:
      "2026-10-14T08:00:00.000Z",
    investigationStartedById: 11,
  };

  assert.equal(
    canUserStartInvestigation(
      incident,
      {
        id: 12,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    false
  );

  assert.equal(
    canUserSubmitInvestigationProof(
      incident,
      {
        id: 11,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    true
  );

  assert.equal(
    canUserSubmitInvestigationProof(
      incident,
      {
        id: 12,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    ),
    false
  );

  assert.equal(
    canUserSubmitInvestigationProof(
      {
        ...incident,
        investigationStartedById: 20,
      },
      { id: 20, role: "HR_STAFF" }
    ),
    false
  );
});