/*
 * Adds a durable purpose discriminator for private Incident evidence.
 * Existing rows retain their historical Resolution Proof meaning through
 * the column default; no UPDATE or historical NTE inference is performed.
 */
SET @current_database = DATABASE();

SET @purpose_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @current_database
    AND TABLE_NAME = 'incident_evidence'
    AND COLUMN_NAME = 'evidence_purpose'
);

SET @migration_sql = IF(
  @purpose_column_exists = 0,
  'ALTER TABLE incident_evidence
     ADD COLUMN evidence_purpose ENUM(''INITIAL_NTE'', ''RESOLUTION_PROOF'')
       NOT NULL DEFAULT ''RESOLUTION_PROOF'' AFTER file_path',
  'SELECT ''evidence_purpose already exists; no column change required.'' AS migration_status'
);
PREPARE incident_evidence_purpose_migration FROM @migration_sql;
EXECUTE incident_evidence_purpose_migration;
DEALLOCATE PREPARE incident_evidence_purpose_migration;

SET @purpose_index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @current_database
    AND TABLE_NAME = 'incident_evidence'
    AND INDEX_NAME = 'idx_incident_evidence_incident_purpose'
);

SET @index_sql = IF(
  @purpose_index_exists = 0,
  'ALTER TABLE incident_evidence
     ADD INDEX idx_incident_evidence_incident_purpose
       (incident_id, evidence_purpose)',
  'SELECT ''incident evidence purpose index already exists.'' AS migration_status'
);
PREPARE incident_evidence_purpose_index_migration FROM @index_sql;
EXECUTE incident_evidence_purpose_index_migration;
DEALLOCATE PREPARE incident_evidence_purpose_index_migration;