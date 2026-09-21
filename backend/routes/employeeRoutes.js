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
 * ==================================================
 * EMPLOYEE RECORD LIST
 * ==================================================
 *
 * HR_COORDINATOR:
 * - may view employee records
 * - backend controller will restrict results to the
 *   coordinator's assigned company
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
 * HR Coordinator is intentionally excluded.
 *
 * The coordinator cannot create or edit employees,
 * so employee-management form metadata is not part
 * of their access scope.
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
 * ==================================================
 * SINGLE EMPLOYEE DETAIL
 * ==================================================
 *
 * HR Coordinator may open employee profiles, but
 * controller-level company scoping will verify that
 * the employee belongs to the coordinator's assigned
 * client/company.
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
 * HR Coordinator may view/download documents only
 * for employees under their assigned company.
 *
 * employeeDocumentController will enforce the
 * company relationship before serving the file.
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
 * CREATE EMPLOYEE
 * ==================================================
 *
 * HR Coordinator intentionally excluded.
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
 * ==================================================
 * UPDATE EMPLOYEE
 * ==================================================
 *
 * HR Coordinator intentionally excluded.
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
 * ==================================================
 * ARCHIVE EMPLOYEE
 * ==================================================
 *
 * HR Manager only.
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
 * This mutates employee/deployment state.
 * HR Coordinator is intentionally excluded.
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