CREATE TABLE IF NOT EXISTS `course_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_course_translation_locale` (`entity_id`, `locale`),
  KEY `idx_course_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_stage_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_course_stage_translation_locale` (`entity_id`, `locale`),
  KEY `idx_course_stage_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_lesson_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_course_lesson_translation_locale` (`entity_id`, `locale`),
  KEY `idx_course_lesson_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lesson_material_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `file_url` VARCHAR(512) NOT NULL DEFAULT '',
  `file_name` VARCHAR(256) NOT NULL DEFAULT '',
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_lesson_material_translation_locale` (`entity_id`, `locale`),
  KEY `idx_lesson_material_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `subtitle` VARCHAR(255) NOT NULL DEFAULT '',
  `description` MEDIUMTEXT NULL,
  `learning_goals` JSON NULL,
  `prerequisites` JSON NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_project_translation_locale` (`entity_id`, `locale`),
  KEY `idx_project_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_unit_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(128) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_project_unit_translation_locale` (`entity_id`, `locale`),
  KEY `idx_project_unit_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_manual_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `description` TEXT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_agent_manual_translation_locale` (`entity_id`, `locale`),
  KEY `idx_agent_manual_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_step_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `content_json` JSON NULL,
  `quick_questions_json` JSON NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `version` INT NOT NULL DEFAULT 1,
  `source_hash` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_agent_step_translation_locale` (`entity_id`, `locale`),
  KEY `idx_agent_step_translations_locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `course_translations` (`entity_id`, `locale`, `title`, `description`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `description`, 1, 1, SHA2(CONCAT_WS('|', `title`, `description`), 256)
FROM `courses`;

INSERT IGNORE INTO `course_stage_translations` (`entity_id`, `locale`, `title`, `description`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `description`, 1, 1, SHA2(CONCAT_WS('|', `title`, `description`), 256)
FROM `course_stages`;

INSERT IGNORE INTO `course_lesson_translations` (`entity_id`, `locale`, `title`, `description`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, '', 1, 1, SHA2(`title`, 256)
FROM `course_lessons`;

INSERT IGNORE INTO `lesson_material_translations` (`entity_id`, `locale`, `title`, `description`, `file_url`, `file_name`, `file_size`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, '', `file_url`, `file_name`, `file_size`, 1, 1, SHA2(CONCAT_WS('|', `title`, `file_url`, `file_name`, `file_size`), 256)
FROM `lesson_materials`;

INSERT IGNORE INTO `project_translations` (`entity_id`, `locale`, `title`, `subtitle`, `description`, `learning_goals`, `prerequisites`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `subtitle`, `description`, `learning_goals`, `prerequisites`, 1, 1,
  SHA2(CONCAT_WS('|', `title`, `subtitle`, COALESCE(`description`, ''), CAST(COALESCE(`learning_goals`, JSON_ARRAY()) AS CHAR), CAST(COALESCE(`prerequisites`, JSON_ARRAY()) AS CHAR)), 256)
FROM `projects`;

INSERT IGNORE INTO `project_unit_translations` (`entity_id`, `locale`, `title`, `description`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `description`, 1, 1, SHA2(CONCAT_WS('|', `title`, `description`), 256)
FROM `project_units`;

INSERT IGNORE INTO `agent_manual_translations` (`entity_id`, `locale`, `title`, `description`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `description`, 1, 1, SHA2(CONCAT_WS('|', `title`, COALESCE(`description`, '')), 256)
FROM `agent_manuals`;

INSERT IGNORE INTO `agent_step_translations` (`entity_id`, `locale`, `title`, `content_json`, `quick_questions_json`, `status`, `version`, `source_hash`)
SELECT `id`, 'en-US', `title`, `content`, `quick_questions`, 1, 1,
  SHA2(CONCAT_WS('|', `title`, CAST(COALESCE(`content`, JSON_ARRAY()) AS CHAR), CAST(COALESCE(`quick_questions`, JSON_ARRAY()) AS CHAR)), 256)
FROM `agent_steps`;
