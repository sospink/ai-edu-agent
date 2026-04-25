-- Repair legacy Agent course Lab runtime template bindings.
-- 旧课程仍使用 opencode-lab + Docker Hub WebIDE 镜像时，K8S 创建会因为拉取 gitpod/openvscode-server 超时失败。
-- 本脚本创建/复用 K8S 桌面模板，并把旧 Agent 课程绑定到该模板。
-- 执行前请先备份目标数据库。

START TRANSACTION;

INSERT INTO `lab_templates` (
  `name`,
  `code`,
  `description`,
  `runtime_mode`,
  `env_image`,
  `ide_image`,
  `main_cpu_request`,
  `main_memory_request`,
  `main_cpu_limit`,
  `main_memory_limit`,
  `ide_cpu_request`,
  `ide_memory_request`,
  `ide_cpu_limit`,
  `ide_memory_limit`,
  `desktop_enabled`,
  `app_ports`,
  `default_app_port_name`,
  `exposed_ports`,
  `status`,
  `created_by`,
  `created_at`,
  `updated_at`
)
SELECT
  'Agent 课程 K8S 桌面模板',
  'agent-course-k8s-desktop',
  '用于旧 Agent 课程迁移到 K8S Classic Lab，避免拉取 Docker Hub WebIDE 镜像。',
  1,
  'registry.cn-beijing.aliyuncs.com/svinsight/course:fisco_newbasicv6',
  '',
  '500m',
  '1Gi',
  '2',
  '3Gi',
  '100m',
  '256Mi',
  '1',
  '1Gi',
  1,
  JSON_ARRAY(),
  '',
  JSON_ARRAY(JSON_OBJECT('type', 'novnc', 'name', 'novnc', 'label', 'Desktop', 'containerPort', 6080, 'path', '', 'isDefault', true)),
  1,
  1,
  NOW(6),
  NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `lab_templates` WHERE `code` = 'agent-course-k8s-desktop'
);

UPDATE `lab_templates`
SET
  `name` = 'Agent 课程 K8S 桌面模板',
  `description` = '用于旧 Agent 课程迁移到 K8S Classic Lab，避免拉取 Docker Hub WebIDE 镜像。',
  `runtime_mode` = 1,
  `env_image` = 'registry.cn-beijing.aliyuncs.com/svinsight/course:fisco_newbasicv6',
  `ide_image` = '',
  `main_cpu_request` = '500m',
  `main_memory_request` = '1Gi',
  `main_cpu_limit` = '2',
  `main_memory_limit` = '3Gi',
  `desktop_enabled` = 1,
  `app_ports` = JSON_ARRAY(),
  `default_app_port_name` = '',
  `exposed_ports` = JSON_ARRAY(JSON_OBJECT('type', 'novnc', 'name', 'novnc', 'label', 'Desktop', 'containerPort', 6080, 'path', '', 'isDefault', true)),
  `status` = 1,
  `updated_at` = NOW(6)
WHERE `code` = 'agent-course-k8s-desktop';

SET @agent_course_template_id := (
  SELECT `id`
  FROM `lab_templates`
  WHERE `code` = 'agent-course-k8s-desktop'
  LIMIT 1
);

UPDATE `courses`
SET
  `lab_template_id` = @agent_course_template_id,
  `updated_at` = NOW(6)
WHERE @agent_course_template_id IS NOT NULL
  AND `env_image` = 'opencode-lab:latest'
  AND `ide_image` = 'gitpod/openvscode-server:latest'
  AND (
    `lab_template_id` = 0
    OR `lab_template_id` IS NULL
    OR `id` IN (42, 43, 44, 45)
  );

COMMIT;
