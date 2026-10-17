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
  createIncidentPhoneCaptureSession,
  getIncidentPhoneCapturePublicStatus,
  createIncidentPhoneCaptureUploadAuthorization,
  completeIncidentPhoneCaptureUpload,
  getIncidentPhoneCaptureSession,
  consumeIncidentPhoneCaptureSession,
  cancelIncidentPhoneCaptureSession,
} = require("../controllers/incidentPhoneCaptureController");

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
 * INCIDENT PHONE CAMERA — DESKTOP SESSION CREATE
 * ==================================================
 *
 * Authenticated desktop-only endpoint.
 *
 * HR Manager and HR Coordinator may create a short-lived
 * phone-camera capture session for either:
 *
 * - INCIDENT_CREATE
 *   employee-bound Add Incident evidence
 *
 * - INCIDENT_WORKFLOW
 *   incident/workflow-bound investigation or resolution
 *   proof
 *
 * The controller remains authoritative for:
 *
 * - actor eligibility
 * - employee/company deployment scope
 * - incident workflow ownership/scope
 * - supported workflow action
 *
 * The response contains:
 * - opaque session ID
 * - one-time high-entropy capture token
 * - expiry
 *
 * The WELLJOB login JWT is never placed in the QR.
 */
router.post(
  "/incident-evidence/phone-capture-sessions",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  createIncidentPhoneCaptureSession
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — DESKTOP POLLING
 * ==================================================
 *
 * Returns only sessions created by the current
 * authenticated HR Manager / HR Coordinator.
 *
 * When the phone photo has completed upload, this
 * endpoint returns:
 *
 * - temporary signed private preview URL
 * - fresh WELLJOB direct-upload descriptor
 *
 * The descriptor is regenerated for the session's
 * canonical purpose/context:
 *
 * - employee context for INCIDENT_CREATE
 * - incident ID + workflow action for INCIDENT_WORKFLOW
 *
 * The descriptor remains bound to the current desktop
 * WELLJOB actor/token version.
 */
router.get(
  "/incident-evidence/phone-capture-sessions/:sessionId",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  getIncidentPhoneCaptureSession
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — MARK USED
 * ==================================================
 *
 * Call only after the desktop Incident save succeeds.
 *
 * This does not delete the Storage object because the
 * successfully saved Incident now owns that evidence.
 */
router.post(
  "/incident-evidence/phone-capture-sessions/:sessionId/consume",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  consumeIncidentPhoneCaptureSession
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — CANCEL / CLEAN STAGED PHOTO
 * ==================================================
 *
 * Intended when:
 * - the unsaved Incident form is cancelled/closed
 * - the phone-captured photo is removed before save
 * - the user starts a new phone-capture session
 *
 * The controller refuses to delete a capture that has
 * already been consumed by a successfully saved Incident.
 */
router.delete(
  "/incident-evidence/phone-capture-sessions/:sessionId",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_COORDINATOR"
  ),
  cancelIncidentPhoneCaptureSession
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — PUBLIC CAPTURE STATUS
 * ==================================================
 *
 * CAPTURE-TOKEN ONLY.
 *
 * Deliberately does NOT use verifyToken because the
 * phone is a capture-only companion and may not be
 * logged in.
 *
 * SECURITY:
 *
 * The raw capture token is NOT placed in the backend
 * URL path or query string.
 *
 * Required JSON body:
 *
 * {
 *   "captureToken": "<opaque-token>"
 * }
 *
 * Keeping the token in the request body prevents the
 * normal backend request path/access log from recording
 * the credential.
 *
 * The controller returns no employee, company, incident,
 * user, or workflow data.
 */
router.post(
  "/incident-evidence/phone-capture/status",
  getIncidentPhoneCapturePublicStatus
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — PUBLIC UPLOAD AUTHORIZATION
 * ==================================================
 *
 * CAPTURE-TOKEN ONLY.
 *
 * Required JSON body:
 *
 * {
 *   "captureToken": "<opaque-token>",
 *   "file": {
 *     "name": "...",
 *     "type": "image/jpeg",
 *     "size": 12345
 *   }
 * }
 *
 * The phone submits metadata for exactly one JPEG/PNG
 * image. The backend validates the temporary capture
 * session and creates a signed PUT URL for a
 * server-generated private Supabase object path.
 *
 * The raw capture token remains outside the URL.
 */
router.post(
  "/incident-evidence/phone-capture/upload-authorization",
  createIncidentPhoneCaptureUploadAuthorization
);

/*
 * ==================================================
 * INCIDENT PHONE CAMERA — PUBLIC UPLOAD COMPLETE
 * ==================================================
 *
 * CAPTURE-TOKEN ONLY.
 *
 * Required JSON body:
 *
 * {
 *   "captureToken": "<opaque-token>"
 * }
 *
 * After the phone PUTs the image directly to Supabase,
 * this endpoint verifies the stored object's size and
 * magic bytes before the desktop may receive it.
 *
 * The raw capture token remains outside the URL.
 */
router.post(
  "/incident-evidence/phone-capture/complete",
  completeIncidentPhoneCaptureUpload
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