-- M1 班级与教学组织生产迁移
-- 执行前请先确认数据库已备份。

CREATE TABLE IF NOT EXISTS `terms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL DEFAULT '',
  `code` VARCHAR(64) NOT NULL DEFAULT '',
  `start_at` DATETIME(3) NULL,
  `end_at` DATETIME(3) NULL,
  `status` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_terms_code` (`code`),
  KEY `idx_terms_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `classes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `term_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `name` VARCHAR(128) NOT NULL DEFAULT '',
  `code` VARCHAR(64) NOT NULL DEFAULT '',
  `description` VARCHAR(512) NOT NULL DEFAULT '',
  `owner_teacher_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `status` INT NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_classes_code` (`code`),
  KEY `idx_classes_term_id` (`term_id`),
  KEY `idx_classes_owner_teacher_id` (`owner_teacher_id`),
  KEY `idx_classes_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `class_members` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `class_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `status` INT NOT NULL DEFAULT 1,
  `joined_at` DATETIME(3) NULL,
  `removed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_class_members_class_user` (`class_id`, `user_id`),
  KEY `idx_class_members_class_id` (`class_id`),
  KEY `idx_class_members_user_id` (`user_id`),
  KEY `idx_class_members_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `class_teachers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `class_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `teacher_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `role` VARCHAR(32) NOT NULL DEFAULT 'owner',
  `status` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_class_teachers_class_id` (`class_id`),
  KEY `idx_class_teachers_teacher_id` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
