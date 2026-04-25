-- Agent Teaching V2: server-side chat, reflection, observatory, FAQ, interventions, terminal events
-- Apply this file AFTER 20260425_agent_teaching_v1.sql
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- 1. Chat sessions (server-authoritative per user × manual × step)
CREATE TABLE IF NOT EXISTS agent_chat_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  manual_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  step_order INT NOT NULL DEFAULT 0,
  last_active_at DATETIME(3) NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_chat_session_key (user_id, manual_id, step_order),
  KEY idx_agent_chat_sessions_user (user_id),
  KEY idx_agent_chat_sessions_manual (manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Chat messages
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

-- 3. Reflection cards (one per user × manual, idempotent AI generate)
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
  UNIQUE KEY idx_reflection_user_manual (user_id, manual_id),
  KEY idx_agent_reflection_user (user_id),
  KEY idx_agent_reflection_manual (manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Step skill tags (maintained by teachers, drives weakness dashboard)
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

-- 5. FAQ items (teacher-confirmed, class-scoped)
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

-- 6. Intervention records (teacher → student/class, pull-based delivery)
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

-- 7. Lab terminal events (written async from /api/lab/execute, redacted)
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

-- 8. Existing-table upgrades. CREATE TABLE IF NOT EXISTS does not add indexes
-- when V1 already created these tables, so keep these index repairs explicit.
SET @agent_v2_idx_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_agent_chat_sessions_user` ON `agent_chat_sessions` (`user_id`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_chat_sessions'
    AND INDEX_NAME = 'idx_agent_chat_sessions_user'
);
PREPARE agent_v2_idx_stmt FROM @agent_v2_idx_sql;
EXECUTE agent_v2_idx_stmt;
DEALLOCATE PREPARE agent_v2_idx_stmt;

SET @agent_v2_idx_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_agent_chat_sessions_manual` ON `agent_chat_sessions` (`manual_id`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_chat_sessions'
    AND INDEX_NAME = 'idx_agent_chat_sessions_manual'
);
PREPARE agent_v2_idx_stmt FROM @agent_v2_idx_sql;
EXECUTE agent_v2_idx_stmt;
DEALLOCATE PREPARE agent_v2_idx_stmt;

SET @agent_v2_idx_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_agent_reflection_user` ON `agent_reflection_cards` (`user_id`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_reflection_cards'
    AND INDEX_NAME = 'idx_agent_reflection_user'
);
PREPARE agent_v2_idx_stmt FROM @agent_v2_idx_sql;
EXECUTE agent_v2_idx_stmt;
DEALLOCATE PREPARE agent_v2_idx_stmt;

SET @agent_v2_idx_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_agent_reflection_manual` ON `agent_reflection_cards` (`manual_id`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_reflection_cards'
    AND INDEX_NAME = 'idx_agent_reflection_manual'
);
PREPARE agent_v2_idx_stmt FROM @agent_v2_idx_sql;
EXECUTE agent_v2_idx_stmt;
DEALLOCATE PREPARE agent_v2_idx_stmt;
