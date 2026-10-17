/*
 * ==================================================
 * EMPLOYEE COMPLIANCE DOCUMENT NUMBERS
 * ==================================================
 *
 * Adds a nullable structured reference number for
 * government compliance records such as:
 * - SSS
 * - Pag-IBIG
 * - PhilHealth
 *
 * Existing historical employee_documents rows remain
 * valid because the new column is nullable.
 *
 * Compliance completeness/KPI rules are intentionally
 * unchanged by this migration.
 */

ALTER TABLE employee_documents
  ADD COLUMN document_number VARCHAR(64) NULL
  AFTER name;
