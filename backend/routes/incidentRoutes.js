const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload");

const {
  getIncidents,
  getIncidentsByEmployee,
  getIncidentById,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
} = require("../controllers/incidentController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * ==================================================
 * INCIDENT UPLOAD ERROR HANDLING
 * ==================================================
 *
 * Only explicitly approved validation messages
 * may be returned to the client.
 *
 * Unknown/internal upload errors are logged on
 * the backend and replaced with a generic response.
 *
 * Existing upload requirements remain unchanged:
 *
 * - PNG
 * - JPEG
 * - PDF
 * - maximum 5 MB per file
 * - evidenceFiles field
 * - maximum 10 files
 */
const SAFE_UPLOAD_ERROR_MESSAGES =
  new Set([
    "Only PNG, JPEG, and PDF files are allowed.",
  ]);

function handleUploadError(
  error,
  req,
  res,
  next
) {
  if (!error) {
    return next();
  }

  /*
   * Multer file-size limit.
   *
   * Preserve the existing user-facing
   * validation message.
   */
  if (
    error.code ===
    "LIMIT_FILE_SIZE"
  ) {
    return res
      .status(400)
      .json({
        error:
          "Each uploaded file must not exceed 5 MB.",
      });
  }

  /*
   * Multer unexpected-field validation.
   *
   * Preserve the existing field requirement.
   */
  if (
    error.code ===
    "LIMIT_UNEXPECTED_FILE"
  ) {
    return res
      .status(400)
      .json({
        error:
          "Unexpected upload field. Use evidenceFiles for incident proof.",
      });
  }

  /*
   * Allow only known validation messages
   * intentionally created by our own upload
   * middleware.
   *
   * Never expose arbitrary error.message values.
   */
  if (
    SAFE_UPLOAD_ERROR_MESSAGES.has(
      error.message
    )
  ) {
    return res
      .status(400)
      .json({
        error:
          error.message,
      });
  }

  /*
   * Preserve the full technical error on the
   * server for diagnostics, but do not expose
   * internal implementation details to clients.
   */
  console.error(
    "INCIDENT EVIDENCE UPLOAD ERROR:",
    error
  );

  return res
    .status(400)
    .json({
      error:
        "Unable to upload incident evidence.",
    });
}

function uploadIncidentFiles(
  req,
  res,
  next
) {
  upload.array(
    "evidenceFiles",
    10
  )(
    req,
    res,
    (error) => {
      if (error) {
        return handleUploadError(
          error,
          req,
          res,
          next
        );
      }

      return next();
    }
  );
}

/*
 * INCIDENT LIST
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
 * - no HR incident-record access
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
 * This route must remain above /incidents/:id.
 * Otherwise Express may treat "employee"
 * as an incident ID.
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
 * VIEW ONE INCIDENT
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
 * CREATE INCIDENT
 *
 * Existing frontend CAN_ADD_INCIDENT:
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Authentication and RBAC intentionally run
 * before Multer processes uploaded files.
 */
router.post(
  "/incidents",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  uploadIncidentFiles,
  createIncident
);

/*
 * EDIT INCIDENT DETAILS
 *
 * Existing frontend CAN_EDIT_INCIDENT:
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Workflow status transitions must use
 * PATCH /incidents/:id/status.
 */
router.put(
  "/incidents/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  uploadIncidentFiles,
  updateIncident
);

/*
 * INCIDENT WORKFLOW
 *
 * Route-level access:
 * - SUPER_ADMIN
 * - HR_MANAGER
 * - HR_STAFF
 *
 * IMPORTANT:
 * Existing updateIncidentStatus controller
 * remains responsible for action-specific rules:
 *
 * HR_MANAGER / HR_STAFF:
 * - START_INVESTIGATION
 * - SUBMIT_RESOLUTION
 *
 * HR_MANAGER / SUPER_ADMIN:
 * - CLOSE_INCIDENT
 * - RETURN_INCIDENT
 *
 * Do not duplicate or redesign those rules here.
 */
router.patch(
  "/incidents/:id/status",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  uploadIncidentFiles,
  updateIncidentStatus
);

/*
 * PERMANENT INCIDENT DELETE
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