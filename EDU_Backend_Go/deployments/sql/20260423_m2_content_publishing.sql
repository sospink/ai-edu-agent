-- M2 内容生产与发布闭环
-- 执行前请先确认数据库已备份。

ALTER TABLE `courses`
  ADD COLUMN `lab_template_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `ide_image`;

CREATE INDEX `idx_courses_lab_template_id` ON `courses` (`lab_template_id`);

ALTER TABLE `projects`
  ADD COLUMN `lab_template_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `ide_image`;

CREATE INDEX `idx_projects_lab_template_id` ON `projects` (`lab_template_id`);

CREATE TABLE `lab_templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL DEFAULT '',
  `code` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `runtime_mode` VARCHAR(32) NOT NULL DEFAULT 'classic',
  `env_image` VARCHAR(256) NOT NULL DEFAULT '',
  `ide_image` VARCHAR(256) NOT NULL DEFAULT '',
  `main_cpu_request` VARCHAR(32) NOT NULL DEFAULT '250m',
  `main_memory_request` VARCHAR(32) NOT NULL DEFAULT '512Mi',
  `main_cpu_limit` VARCHAR(32) NOT NULL DEFAULT '2',
  `main_memory_limit` VARCHAR(32) NOT NULL DEFAULT '2Gi',
  `ide_cpu_request` VARCHAR(32) NOT NULL DEFAULT '100m',
  `ide_memory_request` VARCHAR(32) NOT NULL DEFAULT '256Mi',
  `ide_cpu_limit` VARCHAR(32) NOT NULL DEFAULT '1',
  `ide_memory_limit` VARCHAR(32) NOT NULL DEFAULT '1Gi',
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_lab_templates_code` (`code`),
  KEY `idx_lab_templates_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `content_publish_checks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content_type` VARCHAR(32) NOT NULL DEFAULT '',
  `content_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `actor_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `can_publish` BOOLEAN NOT NULL DEFAULT FALSE,
  `errors` JSON NULL,
  `warnings` JSON NULL,
  `summary` JSON NULL,
  `snapshot` JSON NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_content_publish_checks_content_type` (`content_type`),
  KEY `idx_content_publish_checks_content_id` (`content_id`),
  KEY `idx_content_publish_checks_actor_id` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `publish_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content_type` VARCHAR(32) NOT NULL DEFAULT '',
  `content_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `content_title` VARCHAR(255) NOT NULL DEFAULT '',
  `action` VARCHAR(32) NOT NULL DEFAULT '',
  `actor_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `result` VARCHAR(32) NOT NULL DEFAULT '',
  `message` VARCHAR(512) NOT NULL DEFAULT '',
  `check_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `errors` JSON NULL,
  `warnings` JSON NULL,
  `snapshot` JSON NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_publish_audit_logs_content_type` (`content_type`),
  KEY `idx_publish_audit_logs_content_id` (`content_id`),
  KEY `idx_publish_audit_logs_action` (`action`),
  KEY `idx_publish_audit_logs_actor_id` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
