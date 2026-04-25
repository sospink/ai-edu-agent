CREATE TABLE IF NOT EXISTS resource_quotas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scope_type VARCHAR(32) NOT NULL DEFAULT 'global',
  scope_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  name VARCHAR(128) NOT NULL DEFAULT '',
  max_concurrent_sessions INT NOT NULL DEFAULT 1,
  max_session_minutes INT NOT NULL DEFAULT 120,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_resource_quotas_scope (scope_type, scope_id),
  KEY idx_resource_quotas_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS runtime_session_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  event_type VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT '',
  message VARCHAR(512) NOT NULL DEFAULT '',
  metadata_json JSON NULL,
  operator_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_runtime_session_events_session (session_id),
  KEY idx_runtime_session_events_user (user_id),
  KEY idx_runtime_session_events_type (event_type),
  KEY idx_runtime_session_events_operator (operator_id),
  KEY idx_runtime_session_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actor_role INT NOT NULL DEFAULT 0,
  action VARCHAR(64) NOT NULL DEFAULT '',
  target_type VARCHAR(64) NOT NULL DEFAULT '',
  target_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  result VARCHAR(32) NOT NULL DEFAULT '',
  message VARCHAR(512) NOT NULL DEFAULT '',
  metadata_json JSON NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_logs_actor (actor_id),
  KEY idx_audit_logs_actor_role (actor_role),
  KEY idx_audit_logs_action (action),
  KEY idx_audit_logs_target (target_type, target_id),
  KEY idx_audit_logs_result (result),
  KEY idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO resource_quotas (
  scope_type,
  scope_id,
  name,
  max_concurrent_sessions,
  max_session_minutes,
  enabled
) VALUES (
  'global',
  0,
  '全局默认配额',
  1,
  120,
  1
);
