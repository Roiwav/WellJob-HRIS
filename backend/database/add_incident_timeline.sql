-- Ensure the incident timeline schema exists outside request-time controller logic.
CREATE TABLE IF NOT EXISTS incident_timeline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_by_id VARCHAR(50) NULL,
  created_by_username VARCHAR(100) NULL,
  created_by_name VARCHAR(150) NULL,
  created_by_role VARCHAR(80) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_incident_timeline_incident_id (incident_id),
  CONSTRAINT fk_incident_timeline_incident
    FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);