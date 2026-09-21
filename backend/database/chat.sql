-- Run once in the SAME MySQL database as the existing WELLJOB application.
-- IDs in chat_conversations are normal signed INTs to match a typical users.id INT.
-- If users.id uses BIGINT or UUID, adapt the two participant columns accordingly.
CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user1_id INT NOT NULL,
  user2_id INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_pair (user1_id, user2_id),
  KEY idx_chat_user1_updated (user1_id, updated_at),
  KEY idx_chat_user2_updated (user2_id, updated_at),
  CONSTRAINT chk_chat_distinct CHECK (user1_id < user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id INT NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_chat_messages_history (conversation_id, id),
  KEY idx_chat_messages_unread (conversation_id, read_at, sender_id),
  CONSTRAINT fk_chat_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
