const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  createEmployee,
  getEmployees,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  deleteEmployee,
  updateContractEnd // Ito yung in-import nating bagong controller function
} = require("../controllers/employeeController");

// Mga Standard Employee Routes
router.post("/employees", upload.any(), createEmployee);
router.get("/employees", getEmployees);
router.put("/employees/:id", upload.any(), updateEmployee);
router.put("/employees/archive/:id", archiveEmployee);
router.put("/employees/restore/:id", restoreEmployee);
router.delete("/employees/:id", deleteEmployee);

// Bagong Route para sa Inline Editing ng Contract End Date
router.put("/employees/:id/contract-end", updateContractEnd);

module.exports = router;