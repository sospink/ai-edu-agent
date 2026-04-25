-- Restore OpenClaw project practice seed data.
-- 一次性数据修复脚本：只修复 openclaw-project-practice，不作为常规 schema 迁移反复覆盖业务数据。
-- 执行前请先备份目标数据库。

START TRANSACTION;

INSERT INTO `tags` (`name`, `style_color`, `created_at`)
SELECT 'OpenClaw', '#10B981', NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `tags` WHERE LOWER(`name`) = 'openclaw'
);

SET @openclaw_tag_id := (
  SELECT `id`
  FROM `tags`
  WHERE LOWER(`name`) = 'openclaw'
  ORDER BY `id`
  LIMIT 1
);

INSERT INTO `projects` (
  `title`,
  `slug`,
  `subtitle`,
  `cover_url`,
  `difficulty`,
  `status`,
  `description`,
  `learning_goals`,
  `prerequisites`,
  `labs_count`,
  `challenges_count`,
  `students_count`,
  `env_image`,
  `ide_image`,
  `lab_template_id`,
  `created_by`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
SELECT
  'OpenClaw 项目实训',
  'openclaw-project-practice',
  '基于 OpenClaw 的 Web 项目综合实战',
  '/images/projects/openclaw-web.png',
  2,
  1,
  'OpenClaw 项目模块实训',
  JSON_ARRAY('掌握 OpenClaw CLI 与 Gateway 协同开发流程'),
  JSON_ARRAY('基础 Linux 与 Web 开发知识'),
  1,
  0,
  0,
  'openclaw:ubuntu-classroom',
  '',
  0,
  1,
  '2026-03-03 16:27:50.000000',
  NOW(6),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `projects` WHERE `slug` = 'openclaw-project-practice'
);

UPDATE `projects`
SET
  `title` = 'OpenClaw 项目实训',
  `subtitle` = '基于 OpenClaw 的 Web 项目综合实战',
  `cover_url` = IF(TRIM(COALESCE(`cover_url`, '')) = '', '/images/projects/openclaw-web.png', `cover_url`),
  `difficulty` = 2,
  `status` = 1,
  `description` = 'OpenClaw 项目模块实训',
  `learning_goals` = IF(`learning_goals` IS NULL OR JSON_LENGTH(`learning_goals`) = 0, JSON_ARRAY('掌握 OpenClaw CLI 与 Gateway 协同开发流程'), `learning_goals`),
  `prerequisites` = IF(`prerequisites` IS NULL OR JSON_LENGTH(`prerequisites`) = 0, JSON_ARRAY('基础 Linux 与 Web 开发知识'), `prerequisites`),
  `labs_count` = 1,
  `env_image` = IF(TRIM(COALESCE(`env_image`, '')) = '', 'openclaw:ubuntu-classroom', `env_image`),
  `deleted_at` = NULL,
  `updated_at` = NOW(6)
WHERE `slug` = 'openclaw-project-practice';

SET @openclaw_project_id := (
  SELECT `id`
  FROM `projects`
  WHERE `slug` = 'openclaw-project-practice'
  LIMIT 1
);

INSERT INTO `project_tags` (`project_id`, `tag_id`)
SELECT @openclaw_project_id, @openclaw_tag_id
WHERE @openclaw_project_id IS NOT NULL
  AND @openclaw_tag_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `project_tags`
    WHERE `project_id` = @openclaw_project_id
      AND `tag_id` = @openclaw_tag_id
  );

INSERT INTO `project_units` (
  `project_id`,
  `title`,
  `description`,
  `type`,
  `mode_group`,
  `env_id`,
  `time_limit`,
  `points`,
  `sort_order`,
  `is_hidden`,
  `created_at`,
  `updated_at`
)
SELECT
  @openclaw_project_id,
  'OpenClaw的Web项目实战',
  '在 OpenClaw classroom 环境下完成 Web 项目实战开发与调试。',
  1,
  1,
  'openclaw-web-env',
  120,
  100,
  0,
  0,
  '2026-03-03 16:27:50.000000',
  NOW(6)
WHERE @openclaw_project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `project_units`
    WHERE `project_id` = @openclaw_project_id
      AND `title` = 'OpenClaw的Web项目实战'
  );

UPDATE `project_units`
SET
  `description` = '在 OpenClaw classroom 环境下完成 Web 项目实战开发与调试。',
  `type` = 1,
  `mode_group` = 1,
  `env_id` = 'openclaw-web-env',
  `time_limit` = 120,
  `points` = 100,
  `sort_order` = 0,
  `is_hidden` = 0,
  `updated_at` = NOW(6)
WHERE `project_id` = @openclaw_project_id
  AND `title` = 'OpenClaw的Web项目实战';

COMMIT;
