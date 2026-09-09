CREATE INDEX idx_employee_documents_expiration_name_employee
ON employee_documents (
  expiration_date,
  name,
  employee_id
);