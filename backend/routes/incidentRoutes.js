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

function handleUploadError(
  error,
  req,
  res,
  next
) {
  if (!error) {
    return next();
  }

  if (
    error.code ===
    "LIMIT_FILE_SIZE"
  ) {
    return res.status(400).json({
      error:
        "Each uploaded file must not exceed 5 MB.",
    });
  }

  if (
    error.code ===
    "LIMIT_UNEXPECTED_FILE"
  ) {
    return res.status(400).json({
      error:
        "Unexpected upload field. Use evidenceFiles for incident proof.",
    });
  }

  return res.status(400).json({
    error:
      error.message ||
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