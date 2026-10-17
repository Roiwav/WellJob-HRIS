const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload");

const {
  finalizeEmployeeCreateDirectUploads,
  finalizeEmployeeUpdateDirectUploads,
} = require("../middleware/directUploadFinalizeMiddleware");

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
  createEmployeeDocumentUploadAuthorizations,
} = require("../controllers/storageUploadController");

const {
  createEmployeeMobileHandoff,
  resolveEmployeeMobileHandoff,
} = require("../controllers/employeeMobileHandoffController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * ==================================================
 * EMPLOYEE RECORD LIST
 * ==================================================
 *
 * SUPER_ADMIN:
 * - overall visibility / oversight
 *
 * HR_MANAGER:
 * - may view employee records for monitoring,
 *   reporting, and management purposes
 *
 * HR_STAFF:
 * - operational owner of employee encoding
 *   and employee-record maintenance
 *
 * HR_COORDINATOR:
 * - may view employees within assigned-company scope
 * - controller enforces company restriction
 *
 * IT_SUPPORT:
 * - no employee-record operational access
 */
router.get(
  "/employees",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getEmployees
);

/*
 * ==================================================
 * EMPLOYEE FORM META
 * ==================================================
 *
 * HR Staff is the operational owner of employee
 * creation and editing.
 *
 * This metadata is used for employee-management
 * forms and is therefore restricted to HR Staff.
 */
router.get(
  "/employees/form-meta",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  getEmployeeFormMeta
);

/*
 * ==================================================
 * SINGLE EMPLOYEE DETAIL
 * ==================================================
 *
 * SUPER_ADMIN:
 * - overall visibility
 *
 * HR_MANAGER:
 * - management/reporting visibility
 *
 * HR_STAFF:
 * - operational employee-record access
 *
 * HR_COORDINATOR:
 * - may view only employees within assigned company
 *
 * Controller-level company scoping remains responsible
 * for coordinator access enforcement.
 */
router.get(
  "/employees/:id",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getEmployeeById
);

/*
 * ==================================================
 * PROTECTED EMPLOYEE DOCUMENT FILE
 * ==================================================
 *
 * HR Staff uploads and maintains employee compliance
 * documents.
 *
 * Other authorized roles may VIEW protected employee
 * compliance files without receiving edit/upload
 * authority.
 *
 * HR Coordinator document access remains restricted
 * to employees under the coordinator's assigned
 * company.
 */
router.get(
  "/employee-documents/:documentId/file",
  verifyToken,
  authorizeRoles(
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR"
  ),
  getEmployeeDocumentFile
);

/*
 * ==================================================
 * EMPLOYEE DOCUMENT DIRECT-UPLOAD AUTHORIZATION
 * ==================================================
 *
 * Creates temporary authorization for direct upload
 * into private Supabase Storage.
 *
 * HR Staff only:
 * - upload employee compliance documents
 * - replace/update employee compliance documents
 *
 * SUPER_ADMIN / HR_MANAGER / HR_COORDINATOR may retain
 * authorized view access through the protected file
 * retrieval route, but cannot upload or replace files.
 */
router.post(
  "/employee-documents/upload-authorizations",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  createEmployeeDocumentUploadAuthorizations
);

/*
 * ==================================================
 * EMPLOYEE MOBILE DOCUMENT HANDOFF - CREATE
 * ==================================================
 *
 * HR Staff only.
 *
 * Creates a short-lived one-time handoff token for
 * continuing employee compliance-document capture on
 * a phone.
 *
 * Security is enforced by the controller:
 * - token is cryptographically random
 * - only the SHA-256 hash is stored
 * - token expires after a short period
 * - token is bound to the same HR Staff account
 * - generating a replacement revokes the prior live
 *   handoff for the same employee and creator
 */
router.post(
  "/employees/:id/mobile-handoff",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  createEmployeeMobileHandoff
);

/*
 * ==================================================
 * EMPLOYEE MOBILE DOCUMENT HANDOFF - RESOLVE
 * ==================================================
 *
 * HR Staff only.
 *
 * The authenticated phone session submits the raw
 * temporary token in the request body. The controller
 * hashes and validates it against the stored record,
 * confirms same-user ownership, verifies expiry and
 * revocation state, and consumes it exactly once.
 */
router.post(
  "/employee-mobile-handoffs/resolve",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  resolveEmployeeMobileHandoff
);

/*
 * ==================================================
 * CREATE EMPLOYEE
 * ==================================================
 *
 * HR Staff is responsible for encoding employees that
 * will be deployed, including:
 *
 * - employee information
 * - Date Hired
 * - company/deployment information
 * - compliance information/documents
 *
 * Other roles may view employee information according
 * to their authorized scope but do not create records.
 */
router.post(
  "/employees",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  upload.employeeDocuments,
  finalizeEmployeeCreateDirectUploads,
  createEmployee
);

/*
 * ==================================================
 * UPDATE EMPLOYEE
 * ==================================================
 *
 * HR Staff is responsible for updating and maintaining
 * employee information and compliance records.
 *
 * SUPER_ADMIN / HR_MANAGER / HR_COORDINATOR retain
 * view-only access according to their authorized scope.
 */
router.put(
  "/employees/:id",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  upload.employeeDocuments,
  finalizeEmployeeUpdateDirectUploads,
  updateEmployee
);

/*
 * ==================================================
 * ARCHIVE EMPLOYEE
 * ==================================================
 *
 * HR Manager only.
 *
 * Archiving is a management/lifecycle action and is
 * intentionally separate from ordinary employee
 * encoding and maintenance performed by HR Staff.
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
 * ==================================================
 * RESTORE ARCHIVED EMPLOYEE
 * ==================================================
 *
 * HR Manager only.
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
 * ==================================================
 * PERMANENTLY DELETE EMPLOYEE
 * ==================================================
 *
 * HR Manager only.
 *
 * Permanent deletion remains a management-level
 * employee lifecycle action.
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
 * ==================================================
 * END EMPLOYEE DEPLOYMENT CONTRACT
 * ==================================================
 *
 * HR Staff maintains employee and deployment-record
 * information, including employment/deployment data.
 *
 * This remains separate from archive, restore, and
 * permanent-delete management actions.
 */
router.put(
  "/employees/:id/contract-end",
  verifyToken,
  authorizeRoles(
    "HR_STAFF"
  ),
  updateContractEnd
);

module.exports = router;