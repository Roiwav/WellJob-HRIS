import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeploymentStatusPayload,
  buildLegacySeparationPayload,
  formatDateForInput,
  getDeploymentDisplayStatus,
  getDeploymentEndReasonDisplay,
  getDeploymentTimelineInfo,
  normalizeDeploymentStatus,
  normalizeSeparationReason,
} from "../src/utils/deployments/deploymentHelpers.js";

test("deployment end reason presentation preserves raw meanings and maps the legacy label", () => {
  assert.equal(
    getDeploymentEndReasonDisplay("Completed Contract"),
    "Deployment Ended"
  );
  assert.equal(
    getDeploymentEndReasonDisplay("Transferred / Reassigned"),
    "Transferred / Reassigned"
  );
  assert.equal(
    getDeploymentEndReasonDisplay("Legacy Client Pullout"),
    "Legacy Client Pullout"
  );
  assert.equal(getDeploymentEndReasonDisplay("", "Deployment ended"), "Deployment ended");
});

test("deployment timeline distinguishes completion from employment separation", () => {
  assert.match(
    getDeploymentTimelineInfo(
      "2026-01-01",
      "2026-09-18",
      "Completed",
      "Transferred / Reassigned"
    ),
    /^Deployment ended on /
  );
  assert.match(
    getDeploymentTimelineInfo(
      "2026-01-01",
      "2026-09-18",
      "Cancelled",
      "Resigned"
    ),
    /^Employment separation recorded on /
  );
});

const TEST_ASSIGNMENT_END_DATE =
  "2026-09-18";

test(
  "normalizeDeploymentStatus preserves supported internal lifecycle values",
  () => {
    assert.equal(
      normalizeDeploymentStatus(
        " active "
      ),
      "Active"
    );

    assert.equal(
      normalizeDeploymentStatus(
        "completed"
      ),
      "Completed"
    );

    /*
     * IMPORTANT:
     * "Cancelled" is retained only as the legacy/internal
     * deployment lifecycle value used by the current backend
     * and production database.
     */
    assert.equal(
      normalizeDeploymentStatus(
        "canceled"
      ),
      "Cancelled"
    );

    assert.equal(
      normalizeDeploymentStatus(
        "cancelled"
      ),
      "Cancelled"
    );

    assert.equal(
      normalizeDeploymentStatus(
        ""
      ),
      "Pending"
    );

    assert.equal(
      normalizeDeploymentStatus(
        "Custom Status"
      ),
      "Custom Status"
    );
  }
);

test(
  "getDeploymentDisplayStatus keeps normal lifecycle statuses unchanged",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Active"
      ),
      "Active"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "Completed"
      ),
      "Completed"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "Pending"
      ),
      "Pending"
    );
  }
);

test(
  "getDeploymentDisplayStatus converts legacy cancelled resignation to Resigned",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Resigned"
      ),
      "Resigned"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "canceled",
        "Resignation"
      ),
      "Resigned"
    );
  }
);

test(
  "getDeploymentDisplayStatus converts legacy cancelled termination to Terminated",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Terminated"
      ),
      "Terminated"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Termination"
      ),
      "Terminated"
    );
  }
);

test(
  "getDeploymentDisplayStatus converts legacy cancelled AWOL to AWOL",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "AWOL"
      ),
      "AWOL"
    );
  }
);

test(
  "getDeploymentDisplayStatus restores Other Separation from compatibility remarks",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Terminated",
        "[Other Separation] Client requested reassignment."
      ),
      "Other Separation"
    );
  }
);

test(
  "getDeploymentDisplayStatus uses Ended for incomplete legacy cancelled records",
  () => {
    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled"
      ),
      "Ended"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Unknown Reason"
      ),
      "Ended"
    );
  }
);

test(
  "buildDeploymentStatusPayload preserves normal completed assignments",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Completed Contract",
        separationRemarks:
          "Contract finished normally.",
      }),
      {
        status:
          "Completed",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Completed Contract",
        endRemarks:
          "Contract finished normally.",
      }
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "End of Assignment / Pulled Out by Client",
        separationRemarks:
          "Client ended the assignment.",
      }),
      {
        status:
          "Completed",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "End of Assignment / Pulled Out by Client",
        endRemarks:
          "Client ended the assignment.",
      }
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Transferred / Reassigned",
        separationRemarks:
          "Moved to another assignment.",
      }),
      {
        status:
          "Completed",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Transferred / Reassigned",
        endRemarks:
          "Moved to another assignment.",
      }
    );
  }
);

test(
  "buildDeploymentStatusPayload maps resignation to the legacy backend separation lifecycle",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Resignation",
        separationRemarks:
          "Voluntary resignation.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Resigned",
        endRemarks:
          "Voluntary resignation.",
      }
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Resigned",
        separationRemarks:
          "Employee submitted a resignation.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Resigned",
        endRemarks:
          "Employee submitted a resignation.",
      }
    );
  }
);

test(
  "buildDeploymentStatusPayload maps termination to the legacy backend separation lifecycle",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Termination",
        separationRemarks:
          "Employment terminated.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Terminated",
        endRemarks:
          "Employment terminated.",
      }
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Terminated",
        separationRemarks:
          "Final HR decision.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Terminated",
        endRemarks:
          "Final HR decision.",
      }
    );
  }
);

test(
  "buildDeploymentStatusPayload maps AWOL to the legacy backend separation lifecycle",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "AWOL",
        separationRemarks:
          "Employee failed to report for duty.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "AWOL",
        endRemarks:
          "Employee failed to report for duty.",
      }
    );
  }
);

test(
  "Other Separation requires remarks and preserves compatibility encoding",
  () => {
    assert.throws(
      () =>
        buildDeploymentStatusPayload({
          separationDate:
            TEST_ASSIGNMENT_END_DATE,
          separationReason:
            "Other Separation",
          separationRemarks:
            "",
        }),
      /provide details/i
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationDate:
          TEST_ASSIGNMENT_END_DATE,
        separationReason:
          "Other Separation",
        separationRemarks:
          "Client requested reassignment.",
      }),
      {
        status:
          "Cancelled",
        endDate:
          TEST_ASSIGNMENT_END_DATE,
        endReason:
          "Terminated",
        endRemarks:
          "[Other Separation] Client requested reassignment.",
      }
    );

    assert.equal(
      normalizeSeparationReason(
        "Terminated",
        "[Other Separation] Client requested reassignment."
      ),
      "Other Separation"
    );

    assert.equal(
      getDeploymentDisplayStatus(
        "Cancelled",
        "Terminated",
        "[Other Separation] Client requested reassignment."
      ),
      "Other Separation"
    );
  }
);

test(
  "normalizeSeparationReason returns HR-facing form reasons",
  () => {
    assert.equal(
      normalizeSeparationReason(
        "Resigned"
      ),
      "Resignation"
    );

    assert.equal(
      normalizeSeparationReason(
        "Resignation"
      ),
      "Resignation"
    );

    assert.equal(
      normalizeSeparationReason(
        "Terminated"
      ),
      "Termination"
    );

    assert.equal(
      normalizeSeparationReason(
        "Termination"
      ),
      "Termination"
    );

    assert.equal(
      normalizeSeparationReason(
        "AWOL"
      ),
      "AWOL"
    );
  }
);

test(
  "buildDeploymentStatusPayload rejects unsupported deployment end reasons",
  () => {
    assert.throws(
      () =>
        buildDeploymentStatusPayload({
          separationDate:
            TEST_ASSIGNMENT_END_DATE,
          separationReason:
            "Cancelled",
          separationRemarks:
            "Invalid user-facing reason.",
        }),
      /valid deployment end reason/i
    );

    assert.throws(
      () =>
        buildDeploymentStatusPayload({
          separationDate:
            TEST_ASSIGNMENT_END_DATE,
          separationReason:
            "",
          separationRemarks:
            "",
        }),
      /valid deployment end reason/i
    );
  }
);

test(
  "buildDeploymentStatusPayload requires a deployment end date",
  () => {
    assert.throws(
      () =>
        buildDeploymentStatusPayload({
          separationDate:
            "",
          separationReason:
            "Transferred / Reassigned",
          separationRemarks:
            "Moving to another client.",
        }),
      /valid deployment end date/i
    );
  }
);

test(
  "formatDateForInput preserves date-only values from ISO timestamps",
  () => {
    assert.equal(
      formatDateForInput(
        "2026-09-18T10:30:00.000Z"
      ),
      "2026-09-18"
    );

    assert.equal(
      formatDateForInput(
        "2026-09-18"
      ),
      "2026-09-18"
    );

    assert.equal(
      formatDateForInput(
        "-"
      ),
      ""
    );

    assert.equal(
      formatDateForInput(
        ""
      ),
      ""
    );
  }
);

test(
  "buildLegacySeparationPayload keeps legacy backend mapping stable",
  () => {
    assert.deepEqual(
      buildLegacySeparationPayload({
        separationDate:
          "2026-09-18",
        separationReason:
          "Resignation",
        separationRemarks:
          "Personal reasons",
      }),
      {
        contractEnd:
          "2026-09-18",
        endReason:
          "Resigned",
        endRemarks:
          "Personal reasons",
      }
    );

    assert.deepEqual(
      buildLegacySeparationPayload({
        separationDate:
          "2026-09-18",
        separationReason:
          "Other Separation",
        separationRemarks:
          "Moved to another client",
      }),
      {
        contractEnd:
          "2026-09-18",
        endReason:
          "Terminated",
        endRemarks:
          "[Other Separation] Moved to another client",
      }
    );
  }
);