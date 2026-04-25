CREATE TABLE IF NOT EXISTS agent_learning_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  event_type VARCHAR(64) NOT NULL DEFAULT '',
  meta_json JSON,
  created_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_learning_events_user (user_id),
  KEY idx_agent_learning_events_manual (manual_id),
  KEY idx_agent_learning_events_type (event_type),
  KEY idx_agent_learning_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_step_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  lab_session_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  attempt_type VARCHAR(32) NOT NULL DEFAULT 'verify',
  success TINYINT(1) NOT NULL DEFAULT 0,
  failure_reason VARCHAR(512) NOT NULL DEFAULT '',
  evidence_json JSON,
  created_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_step_attempts_user_step (user_id, step_id),
  KEY idx_agent_step_attempts_manual (manual_id),
  KEY idx_agent_step_attempts_step (step_id),
  KEY idx_agent_step_attempts_lab_session (lab_session_id),
  KEY idx_agent_step_attempts_type (attempt_type),
  KEY idx_agent_step_attempts_success (success),
  KEY idx_agent_step_attempts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_chat_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  last_active_at DATETIME(3) NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_chat_session_key (user_id, manual_id, step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  role VARCHAR(16) NOT NULL DEFAULT '',
  content TEXT,
  created_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_chat_messages_session (session_id),
  KEY idx_agent_chat_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_reflection_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  summary TEXT,
  strengths JSON,
  stuck_points JSON,
  review_suggestions JSON,
  evidence_json JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_reflection_user_manual (user_id, manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_step_skill_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  skill_tag VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_step_skill_tags_manual (manual_id),
  KEY idx_agent_step_skill_tags_step (step_id),
  KEY idx_agent_step_skill_tags_tag (skill_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_faq_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  class_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  question VARCHAR(512) NOT NULL DEFAULT '',
  answer TEXT,
  source_suggestion_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_faq_items_manual (manual_id),
  KEY idx_agent_faq_items_class (class_id),
  KEY idx_agent_faq_items_step (step_id),
  KEY idx_agent_faq_items_suggestion (source_suggestion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_intervention_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  class_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  student_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  teacher_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  action_type VARCHAR(32) NOT NULL DEFAULT '',
  title VARCHAR(128) NOT NULL DEFAULT '',
  content TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_agent_interventions_manual (manual_id),
  KEY idx_agent_interventions_class (class_id),
  KEY idx_agent_interventions_step (step_id),
  KEY idx_agent_interventions_student (student_id),
  KEY idx_agent_interventions_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_terminal_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  lab_session_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  command TEXT,
  output_summary TEXT,
  exit_code INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_lab_terminal_events_user (user_id),
  KEY idx_lab_terminal_events_session (lab_session_id),
  KEY idx_lab_terminal_events_manual (manual_id),
  KEY idx_lab_terminal_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
