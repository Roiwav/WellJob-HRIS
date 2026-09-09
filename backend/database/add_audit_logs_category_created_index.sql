-- Optimize category-scoped audit history pagination and ordering.
CREATE INDEX idx_audit_logs_category_created_id
ON audit_logs (
  category,
  created_at,
  id
);
