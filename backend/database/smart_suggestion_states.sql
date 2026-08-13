CREATE TABLE IF NOT EXISTS smart_suggestion_states (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_key VARCHAR(180) NOT NULL,
  role VARCHAR(50) NOT NULL,
  suggestion_key VARCHAR(180) NOT NULL,

  action_type VARCHAR(100) NULL,
  action_notes TEXT NULL,
  action_at DATETIME NULL,

  is_dismissed TINYINT(1) NOT NULL DEFAULT 0,
  dismiss_reason TEXT NULL,
  dismissed_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_smart_suggestion_state (
    user_key,
    role,
    suggestion_key
  ),

  KEY idx_smart_suggestion_user_role (
    user_key,
    role
  ),

  KEY idx_smart_suggestion_key (
    suggestion_key
  )
);