SET @m5_allow_return_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE assignment_rules ADD COLUMN allow_return TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_late',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assignment_rules'
    AND COLUMN_NAME = 'allow_return'
);
PREPARE m5_allow_return_stmt FROM @m5_allow_return_sql;
EXECUTE m5_allow_return_stmt;
DEALLOCATE PREPARE m5_allow_return_stmt;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  type VARCHAR(64) NOT NULL DEFAULT '',
  title VARCHAR(128) NOT NULL DEFAULT '',
  content TEXT,
  source_type VARCHAR(32) NOT NULL DEFAULT '',
  source_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user_id (user_id),
  KEY idx_notifications_type (type),
  KEY idx_notifications_source (source_type, source_id),
  KEY idx_notifications_read_at (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_action_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  action_type VARCHAR(64) NOT NULL DEFAULT '',
  target_type VARCHAR(32) NOT NULL DEFAULT '',
  target_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_teacher_action_logs_teacher_id (teacher_id),
  KEY idx_teacher_action_logs_action_type (action_type),
  KEY idx_teacher_action_logs_target (target_type, target_id),
  KEY idx_teacher_action_logs_assignment_id (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS submission_reopens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  student_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  granted_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  extra_attempts INT NOT NULL DEFAULT 1,
  used_attempts INT NOT NULL DEFAULT 0,
  reason TEXT,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_submission_reopens_assignment_student (assignment_id, student_id),
  KEY idx_submission_reopens_granted_by (granted_by),
  KEY idx_submission_reopens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
