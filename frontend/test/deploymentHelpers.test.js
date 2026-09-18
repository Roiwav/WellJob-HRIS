import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeploymentStatusPayload,
  buildLegacySeparationPayload,
  formatDateForInput,
  normalizeDeploymentStatus,
  normalizeSeparationReason,
} from "../src/utils/deployments/deploymentHelpers.js";

test(
  "normalizeDeploymentStatus normalizes supported lifecycle statuses",
  () => {
    assert.equal(
      normalizeDeploymentStatus(
        " active "
      ),
      "Active"
    );

    assert.equal(
      normalizeDeploymentStatus(
        "canceled"
      ),
      "Cancelled"
    );

    assert.equal(
      normalizeDeploymentStatus(""),
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
  "buildDeploymentStatusPayload preserves normal completed assignments",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationReason:
          "Completed Contract",
        separationRemarks:
          "Contract finished normally.",
      }),
      {
        status: "Completed",
        endReason:
          "Completed Contract",
        endRemarks:
          "Contract finished normally.",
      }
    );
  }
);

test(
  "buildDeploymentStatusPayload maps resignation to the backend cancelled lifecycle",
  () => {
    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationReason:
          "Resignation",
        separationRemarks:
          "Voluntary resignation.",
      }),
      {
        status: "Cancelled",
        endReason: "Resigned",
        endRemarks:
          "Voluntary resignation.",
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
          separationReason:
            "Other Separation",
          separationRemarks: "",
        }),
      /provide details/i
    );

    assert.deepEqual(
      buildDeploymentStatusPayload({
        separationReason:
          "Other Separation",
        separationRemarks:
          "Client requested reassignment.",
      }),
      {
        status: "Cancelled",
        endReason: "Terminated",
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
      formatDateForInput("-"),
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