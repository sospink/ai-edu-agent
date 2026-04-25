-- 三端权限体系 + Teacher Portal 一次性迁移
-- 执行前请先确认数据库已备份。

ALTER TABLE `courses`
  ADD COLUMN `creator_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `ide_image`;

-- 兼容旧数据：历史课程没有真实创建者时，统一回填到首个 admin 账号。
-- 该值仅用于权限兜底，不代表真实历史创建人；后续若需精确追溯，应单独做数据治理。
UPDATE `courses`
SET `creator_id` = COALESCE(
  (SELECT `id` FROM `sys_users` WHERE `role_type` = 10 ORDER BY `id` ASC LIMIT 1),
  0
)
WHERE `creator_id` = 0;

CREATE INDEX `idx_courses_creator_id` ON `courses` (`creator_id`);

ALTER TABLE `agent_manuals`
  ADD COLUMN `creator_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `is_published`;

-- 兼容旧数据：历史手册没有真实创建者时，统一回填到首个 admin 账号。
-- 该值仅用于权限兜底，不代表真实历史创建人；后续若需精确追溯，应单独做数据治理。
UPDATE `agent_manuals`
SET `creator_id` = COALESCE(
  (SELECT `id` FROM `sys_users` WHERE `role_type` = 10 ORDER BY `id` ASC LIMIT 1),
  0
)
WHERE `creator_id` = 0;

CREATE INDEX `idx_agent_manuals_creator_id` ON `agent_manuals` (`creator_id`);
