-- Add employee document lookup index for employee-scoped document queries.
CREATE INDEX idx_employee_documents_employee_id
ON employee_documents (employee_id);
