/*
 * =====================================================================
 * WELLJOB HRIS ? COMPLETE MESSENGER DATABASE SCHEMA
 * Migration #15
 * =====================================================================
 *
 * Purpose:
 * - make Messenger schema reproducible from Git
 * - preserve all existing production Messenger records
 * - allow a complete historical production schema to be safely
 *   adopted into schema_migrations without recreating its tables
 */

CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user1_id INT NOT NULL,
  user2_id INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  UNIQUE KEY uq_chat_pair (
    user1_id,
    user2_id
  ),

  KEY idx_chat_user1_updated (
    user1_id,
    updated_at
  ),

  KEY idx_chat_user2_updated (
    user2_id,
    updated_at
  ),

  CONSTRAINT chk_chat_distinct
    CHECK (
      user1_id < user2_id
    )
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id INT NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at DATETIME(3) NULL,

  PRIMARY KEY (id),

  KEY idx_chat_messages_history (
    conversation_id,
    id
  ),

  KEY idx_chat_messages_unread (
    conversation_id,
    read_at,
    sender_id
  ),

  CONSTRAINT fk_chat_messages_conversation
    FOREIGN KEY (
      conversation_id
    )
    REFERENCES chat_conversations (
      id
    )
    ON DELETE CASCADE
    ON UPDATE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS chat_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  KEY idx_chat_group_updated (
    updated_at
  )
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,

  is_admin TINYINT(1)
    NOT NULL
    DEFAULT 0,

  joined_after_message_id BIGINT UNSIGNED
    NOT NULL
    DEFAULT 0,

  last_read_message_id BIGINT UNSIGNED
    NOT NULL
    DEFAULT 0,

  joined_at DATETIME(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (
    group_id,
    user_id
  ),

  KEY idx_chat_group_member_user (
    user_id
  ),

  CONSTRAINT fk_chat_group_members_group
    FOREIGN KEY (
      group_id
    )
    REFERENCES chat_groups (
      id
    )
    ON DELETE CASCADE
    ON UPDATE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS chat_group_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  sender_id INT NOT NULL,

  body VARCHAR(2000)
    NOT NULL
    DEFAULT '',

  system_action VARCHAR(32)
    NULL,

  created_at DATETIME(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  KEY idx_chat_group_messages_history (
    group_id,
    id
  ),

  CONSTRAINT fk_chat_group_messages_group
    FOREIGN KEY (
      group_id
    )
    REFERENCES chat_groups (
      id
    )
    ON DELETE CASCADE
    ON UPDATE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS chat_group_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  actor_id INT NOT NULL,
  target_user_id INT NULL,
  action VARCHAR(40) NOT NULL,

  created_at DATETIME(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  KEY idx_chat_group_audit_group (
    group_id,
    created_at
  ),

  CONSTRAINT fk_chat_group_audit_group
    FOREIGN KEY (
      group_id
    )
    REFERENCES chat_groups (
      id
    )
    ON DELETE CASCADE
    ON UPDATE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


/*
 * chat_attachments.message_id is intentionally polymorphic:
 *
 * direct -> chat_messages.id
 * group  -> chat_group_messages.id
 *
 * Therefore referential authorization is enforced by Messenger
 * application logic instead of a single database foreign key.
 */
CREATE TABLE IF NOT EXISTS chat_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  conversation_type ENUM(
    'direct',
    'group'
  )
    NOT NULL,

  message_id BIGINT UNSIGNED
    NOT NULL,

  storage_name CHAR(36)
    NOT NULL,

  original_name VARCHAR(255)
    NOT NULL,

  byte_size INT UNSIGNED
    NOT NULL,

  uploaded_at DATETIME(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  UNIQUE KEY uq_chat_attachment_storage (
    storage_name
  ),

  KEY idx_chat_attachment_message (
    conversation_type,
    message_id
  )
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
