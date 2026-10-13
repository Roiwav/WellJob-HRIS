/*
 * Persist both historical and active KPI incident snapshots.
 * Existing legacy columns remain as active-value compatibility aliases.
 */

ALTER TABLE kpi_decision_history
  MODIFY COLUMN severity_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN historical_violation_count INT NOT NULL DEFAULT 0
    AFTER critical_incident_count,
  ADD COLUMN active_violation_count INT NOT NULL DEFAULT 0
    AFTER historical_violation_count,
  ADD COLUMN historical_severity_score DECIMAL(10,2) NOT NULL DEFAULT 0
    AFTER active_violation_count,
  ADD COLUMN active_severity_score DECIMAL(10,2) NOT NULL DEFAULT 0
    AFTER historical_severity_score,
  ADD COLUMN historical_critical_incident_count INT NOT NULL DEFAULT 0
    AFTER active_severity_score,
  ADD COLUMN active_critical_incident_count INT NOT NULL DEFAULT 0
    AFTER historical_critical_incident_count,
  ADD COLUMN behavior_trend VARCHAR(50) DEFAULT NULL
    AFTER active_critical_incident_count,
  ADD COLUMN months_without_new_incident INT DEFAULT NULL
    AFTER behavior_trend,
  ADD COLUMN latest_incident_date DATETIME DEFAULT NULL
    AFTER months_without_new_incident,
  ADD COLUMN scoring_policy_version VARCHAR(80) DEFAULT NULL
    AFTER latest_incident_date,
  ADD COLUMN evaluation_as_of DATETIME DEFAULT NULL
    AFTER scoring_policy_version;

UPDATE kpi_decision_history
SET
  historical_violation_count = violation_count,
  active_violation_count = violation_count,
  historical_severity_score = severity_score,
  active_severity_score = severity_score,
  historical_critical_incident_count = critical_incident_count,
  active_critical_incident_count = critical_incident_count,
  scoring_policy_version = COALESCE(
    scoring_policy_version,
    'LEGACY_PRE_DECAY'
  ),
  evaluation_as_of = COALESCE(
    evaluation_as_of,
    decided_at
  );