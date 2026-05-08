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

router.get("/incidents", getIncidents);

/*
  IMPORTANT:
  This route must be placed BEFORE /incidents/:id.
  If this is below /incidents/:id, Express will treat "employee" as an incident ID.
*/
router.get("/incidents/employee/:employeeId", getIncidentsByEmployee);

router.get("/incidents/:id", getIncidentById);
router.post("/incidents", upload.any(), createIncident);
router.put("/incidents/:id", upload.any(), updateIncident);
router.patch("/incidents/:id/status", updateIncidentStatus);
router.delete("/incidents/:id", deleteIncident);

module.exports = router;