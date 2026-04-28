const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  createEmployee,
  getEmployees,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  deleteEmployee
} = require("../controllers/employeeController");

router.post("/employees", upload.any(), createEmployee);
router.get("/employees", getEmployees);
router.put("/employees/:id", upload.any(), updateEmployee);
router.put("/employees/archive/:id", archiveEmployee);
router.put("/employees/restore/:id", restoreEmployee);
router.delete("/employees/:id", deleteEmployee);

module.exports = router;