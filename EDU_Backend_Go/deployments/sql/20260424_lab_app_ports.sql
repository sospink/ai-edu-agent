-- Lab 模板应用端口映射
-- 执行前请先确认数据库已备份。

ALTER TABLE `lab_templates`
  ADD COLUMN `desktop_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `ide_memory_limit`,
  ADD COLUMN `app_ports` JSON NULL AFTER `desktop_enabled`,
  ADD COLUMN `default_app_port_name` VARCHAR(32) NOT NULL DEFAULT '' AFTER `app_ports`;

ALTER TABLE `user_lab_sessions`
  ADD COLUMN `desktop_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `gateway_token`,
  ADD COLUMN `app_ports` JSON NULL AFTER `desktop_enabled`,
  ADD COLUMN `default_app_port_name` VARCHAR(32) NOT NULL DEFAULT '' AFTER `app_ports`;
