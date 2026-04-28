const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
} = require("../controllers/incidentController");

router.get("/incidents", getIncidents);
router.get("/incidents/:id", getIncidentById);
router.post("/incidents", upload.any(), createIncident);
router.put("/incidents/:id", upload.any(), updateIncident);
router.patch("/incidents/:id/status", updateIncidentStatus);
router.delete("/incidents/:id", deleteIncident);

module.exports = router;