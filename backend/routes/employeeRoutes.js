const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  createEmployee,
  getEmployees,
  updateEmployee,
} = require("../controllers/employeeController");

router.post("/employees", upload.any(), createEmployee);
router.get("/employees", getEmployees);
router.put("/employees/:id", upload.any(), updateEmployee);

module.exports = router;