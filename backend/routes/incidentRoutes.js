
const express = require("express");

const {
  getIncidents,
  getIncidentsByEmployee,
  getIncidentById,
  getIncidentFormMeta,
  createIncident,
  updateIncidentStatus,
  deleteIncident,
} = require("../controllers/incidentController");

const {
  getIncidentEvidenceFile,
} = require("../controllers/incidentEvidenceController");

const {
  getEmployeeIncidentSummary,
} = require("../controllers/employeeIncidentSummaryController");

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
 * HR_COORDINATOR:
 * - assigned-company incident view access
 * - company scope enforced by controller
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
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getIncidents
);

/*
 * ==================================================
 * INCIDENT FORM EMPLOYEE SEARCH
 * ==================================================
 *
 * HR Coordinator may search deployed employees
 * under their assigned company for incident creation.
 *
 * Must remain above /incidents/:id.
 */
router.get(
  "/incidents/form-meta",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getIncidentFormMeta
);

/*
 * ==================================================
 * HISTORICAL EMPLOYEE INCIDENT SUMMARY
 * ==================================================
 *
 * HR_COORDINATOR ONLY.
 *
 * Provides aggregate incident statistics for an
 * employee CURRENTLY deployed at the coordinator's
 * assigned company.
 *
 * The summary may include historical incidents from
 * previous companies, but never returns:
 *
 * - incident IDs
 * - violation descriptions
 * - disciplinary actions
 * - evidence files
 * - previous-company incident details
 *
 * The controller independently verifies current
 * employee-company assignment.
 *
 * Keep this route above the general incident-by-ID
 * route and the existing employee-history route.
 */
router.get(
  "/incidents/employee/:employeeId/summary",
  verifyToken,
  authorizeRoles(
    "HR_COORDINATOR"
  ),
  getEmployeeIncidentSummary
);

/*
 * ==================================================
 * EMPLOYEE INCIDENT HISTORY
 * ==================================================
 *
 * HR Coordinator receives detailed incidents only
 * within their authorized company scope.
 *
 * Historical summary access does not grant access
 * to confidential cross-company incident details.
 */
router.get(
  "/incidents/employee/:employeeId",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
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
 * HR Coordinator evidence access remains restricted
 * to authorized incident records.
 *
 * IT Support is excluded.
 */
router.get(
  "/incidents/:incidentId/evidence/:evidenceId/file",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getIncidentEvidenceFile
);

/*
 * ==================================================
 * VIEW ONE INCIDENT
 * ==================================================
 *
 * The controller performs record-level authorization
 * before returning incident details.
 */
router.get(
  "/incidents/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getIncidentById
);

/*
 * ==================================================
 * CREATE INCIDENT
 * ==================================================
 *
 * HR Coordinator may create an incident only for
 * employees under their assigned company.
 *
 * The controller validates the active deployment
 * before inserting the incident.
 *
 * Authentication and RBAC execute before Multer.
 */
router.post(
  "/incidents",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  upload.incidentEvidence,
  createIncident
);

/*
 * ==================================================
 * INCIDENT WORKFLOW
 * ==================================================
 *
 * HR Coordinator is intentionally excluded from:
 *
 * - START_INVESTIGATION
 * - SUBMIT_RESOLUTION
 * - SUBMIT_INVESTIGATION
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
 *
 * Existing workflow rules:
 *
 * HR_MANAGER / HR_STAFF:
 * - START_INVESTIGATION
 * - SUBMIT_RESOLUTION
 * - SUBMIT_INVESTIGATION
 *
 * HR_MANAGER / SUPER_ADMIN:
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
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
 * Restricted to HR Manager.
 *
 * HR Coordinator cannot delete incidents.
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