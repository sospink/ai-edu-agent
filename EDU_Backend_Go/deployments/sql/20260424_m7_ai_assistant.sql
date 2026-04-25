CREATE TABLE IF NOT EXISTS ai_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  action VARCHAR(64) NOT NULL DEFAULT '',
  source_type VARCHAR(32) NOT NULL DEFAULT '',
  source_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  model VARCHAR(128) NOT NULL DEFAULT '',
  prompt_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  latency_ms BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  error TEXT,
  created_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_ai_requests_actor_id (actor_id),
  KEY idx_ai_requests_action (action),
  KEY idx_ai_requests_source (source_type, source_id),
  KEY idx_ai_requests_status (status),
  KEY idx_ai_requests_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  suggestion_type VARCHAR(64) NOT NULL DEFAULT '',
  source_type VARCHAR(32) NOT NULL DEFAULT '',
  source_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT,
  evidence_json JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  confirmed_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  confirmed_at DATETIME(3) NULL,
  adopted_content TEXT,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_ai_suggestions_request_id (request_id),
  KEY idx_ai_suggestions_source_status (source_type, source_id, suggestion_type, status),
  KEY idx_ai_suggestions_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_feature_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ai_feature_settings (id, enabled, updated_by, updated_at)
VALUES (1, 1, 0, NOW(3))
ON DUPLICATE KEY UPDATE id = id;
