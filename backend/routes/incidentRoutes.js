const express = require("express");

const {
  getIncidents,
  getIncidentsByEmployee,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  deleteIncident,
} = require("../controllers/incidentController");

const {
  getIncidentEvidenceFile,
} = require("../controllers/incidentEvidenceController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const upload = require("../middleware/upload");

const router = express.Router();

const EVIDENCE_WORKFLOW_ACTIONS = new Set([
  "SUBMIT_RESOLUTION",
  "SUBMIT_INVESTIGATION",
]);

/*
 * ==================================================
 * WORKFLOW EVIDENCE POLICY
 * ==================================================
 *
 * Evidence uploaded through the workflow PATCH route
 * is valid only when an investigator submits or
 * resubmits proof for review.
 *
 * Files are intentionally rejected for:
 * - START_INVESTIGATION
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
 * - missing/unsupported workflow actions
 *
 * upload.incidentEvidence registers a request-scoped
 * cleanup boundary before this middleware runs.
 *
 * Therefore rejected files are automatically removed
 * when this response finishes.
 */
function allowWorkflowEvidenceOnlyForSubmission(
  req,
  res,
  next
) {
  const files = Array.isArray(req.files)
    ? req.files
    : [];

  if (files.length === 0) {
    return next();
  }

  const workflowAction = String(
    req.body?.workflowAction || ""
  )
    .trim()
    .toUpperCase();

  if (
    EVIDENCE_WORKFLOW_ACTIONS.has(
      workflowAction
    )
  ) {
    return next();
  }

  return res.status(400).json({
    error:
      "Evidence files may only be uploaded when submitting investigation proof for review.",
  });
}

/*
 * ==================================================
 * INCIDENT LIST
 * ==================================================
 *
 * SUPER_ADMIN:
 * - view-only incident access
 *
 * HR_MANAGER:
 * - full incident workflow access
 *
 * HR_STAFF:
 * - operational incident access
 *
 * IT_SUPPORT:
 * - no incident-record access
 */
router.get(
  "/incidents",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getIncidents
);

/*
 * Must remain above /incidents/:id so Express
 * does not interpret "employee" as an incident ID.
 */
router.get(
  "/incidents/employee/:employeeId",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getIncidentsByEmployee
);

/*
 * ==================================================
 * PROTECTED INCIDENT EVIDENCE FILE
 * ==================================================
 *
 * Evidence is retrieved exclusively through this
 * authenticated endpoint.
 *
 * Access matches incident read permissions:
 * - SUPER_ADMIN
 * - HR_MANAGER
 * - HR_STAFF
 *
 * IT_SUPPORT remains excluded.
 */
router.get(
  "/incidents/:incidentId/evidence/:evidenceId/file",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getIncidentEvidenceFile
);

/*
 * ==================================================
 * VIEW ONE INCIDENT
 * ==================================================
 */
router.get(
  "/incidents/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getIncidentById
);

/*
 * ==================================================
 * CREATE INCIDENT
 * ==================================================
 *
 * HR_MANAGER / HR_STAFF only.
 *
 * Authentication and RBAC execute before Multer,
 * preventing unauthorized requests from writing
 * files to disk.
 *
 * Incident evidence is validated by the hardened
 * upload.incidentEvidence middleware.
 *
 * Saved incident core details are intentionally
 * immutable after creation. Investigation and review
 * changes are handled exclusively by the dedicated
 * workflow endpoint below.
 */
router.post(
  "/incidents",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  upload.incidentEvidence,
  createIncident
);

/*
 * ==================================================
 * INCIDENT WORKFLOW
 * ==================================================
 *
 * Route-level access:
 * - SUPER_ADMIN
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Controller remains authoritative for workflow
 * authorization and state transitions.
 *
 * Existing rules:
 *
 * HR_MANAGER / HR_STAFF:
 * - START_INVESTIGATION
 * - SUBMIT_RESOLUTION
 * - SUBMIT_INVESTIGATION
 *
 * HR_MANAGER / SUPER_ADMIN:
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
 *
 * Evidence files are accepted only for proof
 * submission/resubmission actions.
 *
 * This route handles workflow state only. It does not
 * expose general post-save editing of incident core
 * details.
 */
router.patch(
  "/incidents/:id/status",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  upload.incidentEvidence,
  allowWorkflowEvidenceOnlyForSubmission,
  updateIncidentStatus
);

/*
 * ==================================================
 * PERMANENT INCIDENT DELETE
 * ==================================================
 *
 * Destructive administrative operation.
 * Restricted to HR_MANAGER.
 */
router.delete(
  "/incidents/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  deleteIncident
);

module.exports = router;