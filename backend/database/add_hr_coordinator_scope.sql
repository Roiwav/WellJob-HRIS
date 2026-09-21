/*
 * ================================================================
 * WELLJOB HRIS
 * Add HR Coordinator role and company scope
 * ================================================================
 *
 * Purpose:
 *   - Adds HR_COORDINATOR to the users.role ENUM.
 *   - Adds users.assigned_company for server-authoritative
 *     client/company scoping.
 *   - Adds an index for role/company account lookups.
 *
 * Security model:
 *   - assigned_company is only authoritative when the account role
 *     is HR_COORDINATOR.
 *   - Only Super Admin account-management endpoints will be allowed
 *     to assign or change this value.
 *   - HR Coordinator requests will never be allowed to choose their
 *     company scope through request body or query parameters.
 * ================================================================
 */

ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'SUPER_ADMIN',
    'HR_MANAGER',
    'HR_STAFF',
    'HR_COORDINATOR',
    'IT_SUPPORT'
  ) NOT NULL,
  ADD COLUMN assigned_company VARCHAR(255) DEFAULT NULL AFTER role,
  ADD KEY idx_users_role_assigned_company (
    role,
    assigned_company
  );
