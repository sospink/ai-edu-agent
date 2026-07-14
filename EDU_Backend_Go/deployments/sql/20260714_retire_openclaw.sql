-- 下架历史 OpenClaw 产品模块。
-- 本迁移可重复执行：只更新仍未达到目标状态的记录，不删除标签、资源、提交或检查证据。

START TRANSACTION;

-- 历史 OpenClaw 项目保持原始内容与关联关系，但从学生可见项目中下架。
UPDATE `projects` AS p
INNER JOIN `project_tags` AS pt ON pt.`project_id` = p.`id`
INNER JOIN `tags` AS t ON t.`id` = pt.`tag_id`
SET
  p.`status` = 2,
  p.`updated_at` = CURRENT_TIMESTAMP
WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(t.`name`), ' ', ''), '-', ''), '_', '')) = 'openclaw'
  AND p.`status` <> 2;

-- 归档显式使用旧资源类型，或仍引用历史 OpenClaw 项目/单元的作业。
UPDATE `teaching_assignments` AS ta
INNER JOIN (
  SELECT DISTINCT ar.`assignment_id`
  FROM `assignment_resources` AS ar
  LEFT JOIN `projects` AS p
    ON LOWER(TRIM(ar.`resource_type`)) = 'project'
   AND p.`id` = ar.`resource_id`
  LEFT JOIN `project_units` AS pu
    ON LOWER(TRIM(ar.`resource_type`)) = 'project_unit'
   AND pu.`id` = CASE WHEN ar.`unit_id` > 0 THEN ar.`unit_id` ELSE ar.`resource_id` END
  LEFT JOIN `project_tags` AS pt
    ON pt.`project_id` = COALESCE(p.`id`, pu.`project_id`)
  LEFT JOIN `tags` AS t ON t.`id` = pt.`tag_id`
  WHERE LOWER(TRIM(ar.`resource_type`)) = 'openclaw_project'
     OR LOWER(REPLACE(REPLACE(REPLACE(TRIM(t.`name`), ' ', ''), '-', ''), '_', '')) = 'openclaw'
) AS retired ON retired.`assignment_id` = ta.`id`
SET
  ta.`status` = 3,
  ta.`updated_at` = CURRENT_TIMESTAMP
WHERE ta.`status` <> 3;

-- 非 Classic 模板不再是受支持的运行时模板，保留原配置供审计但停止继续绑定。
UPDATE `lab_templates`
SET
  `status` = 2,
  `updated_at` = CURRENT_TIMESTAMP
WHERE LOWER(TRIM(CAST(`runtime_mode` AS CHAR))) NOT IN ('classic', '1')
  AND `status` <> 2;

-- 旧类型会话交给 Lab janitor 回收：先标记立即过期，再由 janitor 删除 Pod/Service 并置为 stopped。
UPDATE `user_lab_sessions`
SET
  `expires_at` = CURRENT_TIMESTAMP,
  `updated_at` = CURRENT_TIMESTAMP
WHERE COALESCE(`runtime_mode`, 1) <> 1
  AND `status` IN (0, 1)
  AND (`expires_at` IS NULL OR `expires_at` > CURRENT_TIMESTAMP);

COMMIT;
