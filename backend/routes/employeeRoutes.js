// employeeRoutes.js

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
 *
 * SUPER_ADMIN:
 * - view-only access
 *
 * HR_MANAGER:
 * - employee management access
 *
 * HR_STAFF:
 * - operational employee access
 *
 * IT_SUPPORT:
 * - no HR employee-record access
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
 * PROTECTED EMPLOYEE DOCUMENT FILE
 *
 * The client provides only the employee document
 * database ID.
 *
 * The controller resolves the physical file path
 * from employee_documents.file_path and verifies
 * that the file remains inside the approved
 * employee document directory.
 *
 * Allowed:
 * - SUPER_ADMIN
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Denied:
 * - IT_SUPPORT
 * - unauthenticated users
 *
 * Because this route is mounted under /api,
 * the existing application maintenance middleware
 * also applies before this route executes.
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
 *
 * Existing frontend permission:
 * CAN_ADD_EMPLOYEE
 *
 * Allowed:
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Authentication and authorization intentionally
 * run BEFORE Multer processes uploaded files.
 *
 * Employee document uploads are restricted to:
 *
 * - documents[0] through documents[19]
 * - maximum 1 file per document slot
 * - maximum 20 files total
 * - maximum 5 MB per file
 * - PNG, JPEG, and PDF only
 * - matching file extension and MIME declaration
 * - validated physical file signature
 *
 * Unexpected multipart file fields are rejected.
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
 *
 * Existing frontend permission:
 * CAN_EDIT_EMPLOYEE
 *
 * Allowed:
 * - HR_MANAGER
 * - HR_STAFF
 *
 * Uses the same hardened employee-document upload
 * rules as employee creation.
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
 *
 * Existing frontend workflow explicitly restricts
 * this operation to HR_MANAGER.
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
 *
 * Archived Employees page is restricted to
 * HR_MANAGER in the existing frontend.
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
 *
 * This is a destructive operation.
 * Existing Archived Employees workflow is
 * restricted to HR_MANAGER.
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
 *
 * Existing deployment workflow:
 *
 * - HR_MANAGER may perform operational updates
 * - HR_STAFF may perform operational updates
 * - SUPER_ADMIN is explicitly view-only
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