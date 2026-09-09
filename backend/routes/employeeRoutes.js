const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload");

const {
  createEmployee,
  getEmployees,
  getEmployeeFormMeta,
  getEmployeeById,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  deleteEmployee,
  updateContractEnd,
} = require("../controllers/employeeController");

const {
  getEmployeeDocumentFile,
} = require("../controllers/employeeDocumentController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * EMPLOYEE RECORD LIST
 */
router.get(
  "/employees",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getEmployees
);

/*
 * EMPLOYEE FORM META
 */
router.get(
  "/employees/form-meta",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getEmployeeFormMeta
);

/*
 * SINGLE EMPLOYEE DETAIL
 */
router.get(
  "/employees/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getEmployeeById
);

/*
 * PROTECTED EMPLOYEE DOCUMENT FILE
 */
router.get(
  "/employee-documents/:documentId/file",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF"
  ),
  getEmployeeDocumentFile
);

/*
 * CREATE EMPLOYEE
 */
router.post(
  "/employees",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  upload.employeeDocuments,
  createEmployee
);

/*
 * UPDATE EMPLOYEE
 */
router.put(
  "/employees/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  upload.employeeDocuments,
  updateEmployee
);

/*
 * ARCHIVE EMPLOYEE
 */
router.put(
  "/employees/archive/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  archiveEmployee
);

/*
 * RESTORE ARCHIVED EMPLOYEE
 */
router.put(
  "/employees/restore/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  restoreEmployee
);

/*
 * PERMANENTLY DELETE EMPLOYEE
 */
router.delete(
  "/employees/:id",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER"
  ),
  deleteEmployee
);

/*
 * END EMPLOYEE DEPLOYMENT CONTRACT
 */
router.put(
  "/employees/:id/contract-end",
  verifyToken,
  authorizeRoles(
    "HR_MANAGER",
    "HR_STAFF"
  ),
  updateContractEnd
);

module.exports = router;
