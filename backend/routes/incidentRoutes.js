const express = require("express");

const {
  getIncidents,
  getIncidentReport,
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
  createIncidentEvidenceUploadAuthorizations,
  createIncidentWorkflowEvidenceUploadAuthorizations,
} = require("../controllers/storageUploadController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const {
  authorizeIncidentWorkflowScope,
} = require("../middleware/incidentWorkflowScopeMiddleware");

const upload = require("../middleware/upload");

const {
  finalizeIncidentCreateDirectUploads,
  finalizeIncidentWorkflowDirectUploads,
} = require("../middleware/directUploadFinalizeMiddleware");

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
 * HR_COORDINATOR:
 * - assigned-company incident view access
 * - company scope enforced by controller
 *
 * HR_STAFF:
 * - no Incident operational page/list access
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
    "HR_COORDINATOR"
  ),
  getIncidents
);

/*
 * Complete filtered data for client-side PDF generation.
 * HR Staff is intentionally excluded from report export.
 * Coordinator company scope is enforced by the controller.
 */
router.get(
  "/incidents/report",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  getIncidentReport
);

/*
 * ==================================================
 * INCIDENT FORM EMPLOYEE SEARCH
 * ==================================================
 *
 * HR Coordinator may search deployed employees
 * under their assigned company for incident creation.
 *
 * HR Staff is intentionally excluded because HR Staff
 * cannot create Incident Reports.
 *
 * Must remain above /incidents/:id.
 */
router.get(
  "/incidents/form-meta",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
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
 * This route is also consumed by the Employee module.
 *
 * HR Staff keeps READ-ONLY textual Incident history
 * inside Employee records, but this does NOT grant:
 *
 * - Incident operational page access
 * - Start Investigation authority
 * - Resolution Proof upload/submission
 * - Approve/Return authority
 * - protected Incident evidence/NTE/proof file access
 *
 * HR Coordinator receives detailed incidents only
 * within their authorized company scope.
 *
 * Historical summary access does not grant access
 * to confidential cross-company incident details.
 *
 * IMPORTANT:
 * Any HR Staff-specific response sanitization must
 * remain enforced by the controller/serializer so
 * protected file metadata/actions are not exposed.
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
 * HR Staff and IT Support are intentionally excluded.
 */
router.get(
  "/incidents/:incidentId/evidence/:evidenceId/file",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
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
 *
 * HR Staff is intentionally excluded from the
 * operational Incident detail route.
 */
router.get(
  "/incidents/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  getIncidentById
);

/*
 * ==================================================
 * INCIDENT CREATE-EVIDENCE DIRECT-UPLOAD AUTHORIZATION
 * ==================================================
 *
 * Mirrors the existing create-incident role access.
 *
 * HR Staff, Super Admin, and IT Support cannot create
 * Incident Reports or Initial NTE uploads.
 */
router.post(
  "/incident-evidence/upload-authorizations/create",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  createIncidentEvidenceUploadAuthorizations
);

/*
 * ==================================================
 * INCIDENT WORKFLOW-EVIDENCE DIRECT-UPLOAD AUTHORIZATION
 * ==================================================
 *
 * Investigation/resolution evidence submission is
 * restricted by the controller to the canonical
 * responsible investigator. Eligible investigator roles
 * are HR Manager and HR Coordinator.
 */
router.post(
  "/incident-evidence/upload-authorizations/workflow",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  authorizeIncidentWorkflowScope,
  createIncidentWorkflowEvidenceUploadAuthorizations
);

/*
 * ==================================================
 * CREATE INCIDENT
 * ==================================================
 *
 * HR Manager and HR Coordinator may create Incidents.
 *
 * HR Coordinator may create an Incident only for
 * employees under their assigned company.
 *
 * The controller validates the active deployment
 * before inserting the Incident.
 *
 * HR Staff, Super Admin, and IT Support are excluded.
 *
 * Authentication and RBAC execute before Multer.
 */
router.post(
  "/incidents",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  upload.incidentEvidence,
  finalizeIncidentCreateDirectUploads,
  createIncident
);

/*
 * ==================================================
 * INCIDENT WORKFLOW
 * ==================================================
 *
 * Workflow rules:
 *
 * HR_MANAGER / HR_COORDINATOR:
 * - START_INVESTIGATION when eligible under the Incident
 *   ownership policy
 * - SUBMIT_RESOLUTION / SUBMIT_INVESTIGATION only when the
 *   user is the canonical responsible investigator
 *
 * HR_MANAGER / SUPER_ADMIN:
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
 *
 * HR Staff has no Incident workflow authority.
 */
router.patch(
  "/incidents/:id/status",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  authorizeIncidentWorkflowScope,
  upload.incidentEvidence,
  finalizeIncidentWorkflowDirectUploads,
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
 * HR Coordinator cannot delete Incidents.
 * HR Staff, Super Admin, and IT Support cannot delete.
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