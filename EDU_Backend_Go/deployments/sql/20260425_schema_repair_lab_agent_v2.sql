-- Schema repair: Lab app port fields + Agent Teaching V2 indexes
-- 所有语句均为幂等写法，可重复执行。
-- 执行前请先确认数据库已备份。

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `lab_templates` ADD COLUMN `desktop_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `ide_memory_limit`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lab_templates'
    AND COLUMN_NAME = 'desktop_enabled'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `lab_templates` ADD COLUMN `app_ports` JSON NULL AFTER `desktop_enabled`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lab_templates'
    AND COLUMN_NAME = 'app_ports'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `lab_templates` ADD COLUMN `default_app_port_name` VARCHAR(32) NOT NULL DEFAULT '''' AFTER `app_ports`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lab_templates'
    AND COLUMN_NAME = 'default_app_port_name'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `lab_templates` ADD COLUMN `exposed_ports` JSON NULL AFTER `default_app_port_name`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lab_templates'
    AND COLUMN_NAME = 'exposed_ports'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `user_lab_sessions` ADD COLUMN `desktop_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `gateway_token`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_lab_sessions'
    AND COLUMN_NAME = 'desktop_enabled'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `user_lab_sessions` ADD COLUMN `app_ports` JSON NULL AFTER `desktop_enabled`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_lab_sessions'
    AND COLUMN_NAME = 'app_ports'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `user_lab_sessions` ADD COLUMN `default_app_port_name` VARCHAR(32) NOT NULL DEFAULT '''' AFTER `app_ports`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_lab_sessions'
    AND COLUMN_NAME = 'default_app_port_name'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_lab_templates_status` ON `lab_templates` (`status`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lab_templates'
    AND INDEX_NAME = 'idx_lab_templates_status'
);
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
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
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
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
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
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
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;

SET @repair_sql = (
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
PREPARE repair_stmt FROM @repair_sql;
EXECUTE repair_stmt;
DEALLOCATE PREPARE repair_stmt;
