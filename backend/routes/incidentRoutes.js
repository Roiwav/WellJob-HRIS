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

function handleUploadError(error, req, res, next) {
  if (!error) {
    return next();
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Each uploaded file must not exceed 5 MB.",
    });
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      error: "Unexpected upload field. Use evidenceFiles for incident proof.",
    });
  }

  return res.status(400).json({
    error: error.message || "Unable to upload incident evidence.",
  });
}

function uploadIncidentFiles(req, res, next) {
  upload.array("evidenceFiles", 10)(req, res, (error) => {
    if (error) {
      return handleUploadError(error, req, res, next);
    }

    return next();
  });
}

router.get("/incidents", getIncidents);

/*
  This route must remain above /incidents/:id.
  Otherwise Express may treat "employee" as an incident ID.
*/
router.get(
  "/incidents/employee/:employeeId",
  getIncidentsByEmployee
);

router.get(
  "/incidents/:id",
  getIncidentById
);

router.post(
  "/incidents",
  uploadIncidentFiles,
  createIncident
);

router.put(
  "/incidents/:id",
  uploadIncidentFiles,
  updateIncident
);

router.patch(
  "/incidents/:id/status",
  uploadIncidentFiles,
  updateIncidentStatus
);

router.delete(
  "/incidents/:id",
  deleteIncident
);

module.exports = router;