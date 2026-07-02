-- Seed zh-CN content translations for the overseas bilingual content model.
-- This script is idempotent and only writes translation tables. Main entities,
-- progress, Lab configuration, assignments, and runtime bindings are untouched.

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_course_zh (
  entity_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_course_zh (entity_id, title, description) VALUES
(35, 'MCP Server 开发', '学习开放的模型上下文协议 MCP，掌握 MCP Server 的构建方式，并完成工具、资源和提示词能力开发。'),
(36, 'ADE 智能体开发', '深入理解智能体开发环境 ADE，掌握基于 Skill 的开发模型，了解 ADE 与传统应用开发的差异。'),
(37, '智能体框架与开发', '学习单智能体完整架构，包括 PRA 循环、工具调用、记忆系统和角色提示词设计。'),
(39, 'AI 安全与合规', '深入学习 AI 安全的重要性与挑战，掌握 Guardrails 护栏框架的设计与实现。'),
(42, 'MCP Server 开发', '学习开放的模型上下文协议 MCP，掌握 MCP Server 的构建方式，并完成工具、资源和提示词能力开发。'),
(43, 'ADE 智能体开发', '深入理解智能体开发环境 ADE，掌握基于 Skill 的开发模型，了解 ADE 与传统应用开发的差异。'),
(44, '智能体框架与开发', '学习单智能体完整架构，包括 PRA 循环、工具调用、记忆系统和角色提示词设计。'),
(45, 'AI 安全与合规', '深入学习 AI 安全的重要性与挑战，掌握 Guardrails 护栏框架的设计与实现。');

INSERT INTO course_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT c.id, 'zh-CN', COALESCE(z.title, c.title), COALESCE(z.description, c.description), 1, 1,
       SHA2(CONCAT_WS('|', COALESCE(z.title, c.title), COALESCE(z.description, c.description)), 256)
FROM courses c
LEFT JOIN tmp_course_zh z ON z.entity_id = c.id
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_stage_zh (
  course_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_stage_zh (course_id, title, description) VALUES
(35, '入门基础', '学习 MCP Server 开发的核心概念与实战技能'),
(36, '入门基础', '学习 ADE 智能体开发的核心概念与实战技能'),
(37, '入门基础', '学习单智能体开发与 Gordon 案例的核心概念与实战技能'),
(39, '入门基础', '学习 AI 安全与合规的核心概念与实战技能'),
(42, '入门基础', '学习 MCP Server 开发的核心概念与实战技能'),
(43, '入门基础', '学习 ADE 智能体开发的核心概念与实战技能'),
(44, '入门基础', '学习单智能体开发与 Gordon 案例的核心概念与实战技能'),
(45, '入门基础', '学习 AI 安全与合规的核心概念与实战技能');

INSERT INTO course_stage_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT s.id, 'zh-CN', COALESCE(z.title, s.title), COALESCE(z.description, s.description), 1, 1,
       SHA2(CONCAT_WS('|', COALESCE(z.title, s.title), COALESCE(z.description, s.description)), 256)
FROM course_stages s
LEFT JOIN tmp_stage_zh z ON z.course_id = s.course_id
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_lesson_zh (
  entity_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(128) NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_lesson_zh (entity_id, title) VALUES
(352, 'MCP Server 开发 - 知识手册'),
(353, 'MCP Server 开发 - 实践实验'),
(354, 'ADE 智能体开发 - 知识手册'),
(355, 'ADE 智能体开发 - 实践实验'),
(356, '智能体框架与开发 - 知识手册'),
(357, '毒舌 Gordon - 单智能体开发'),
(360, 'AI 安全与合规 - 知识手册'),
(361, 'AI 安全与合规 - 实践实验'),
(362, '创意风暴 - 多智能体协作'),
(363, 'MCP Server 开发 - 知识手册'),
(364, 'MCP Server 开发 - 实践实验'),
(366, 'ADE 智能体开发 - 知识手册'),
(367, 'ADE 智能体开发 - 实践实验'),
(369, '智能体框架与开发 - 知识手册'),
(370, '毒舌 Gordon - 单智能体开发'),
(371, '创意风暴 - 多智能体协作'),
(372, 'AI 安全与合规 - 知识手册'),
(373, 'AI 安全与合规 - 实践实验');

INSERT INTO course_lesson_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT l.id, 'zh-CN', COALESCE(z.title, l.title), '', 1, 1,
       SHA2(COALESCE(z.title, l.title), 256)
FROM course_lessons l
LEFT JOIN tmp_lesson_zh z ON z.entity_id = l.id
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO lesson_material_translations (entity_id, locale, title, description, file_url, file_name, file_size, status, version, source_hash)
SELECT m.id, 'zh-CN', m.title, '', m.file_url, m.file_name, m.file_size, 1, 1,
       SHA2(CONCAT_WS('|', m.title, m.file_url, m.file_name, m.file_size), 256)
FROM lesson_materials m
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  file_url = VALUES(file_url),
  file_name = VALUES(file_name),
  file_size = VALUES(file_size),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_project_zh (
  entity_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  description MEDIUMTEXT NULL,
  learning_goals JSON NULL,
  prerequisites JSON NULL
) ENGINE=InnoDB;

INSERT INTO tmp_project_zh (entity_id, title, subtitle, description, learning_goals, prerequisites) VALUES
(4, 'React 聊天室实战', '使用 React 和 WebSocket 构建实时聊天室', NULL, NULL, NULL),
(8, 'OpenClaw 项目实战', '基于 OpenClaw 课堂场景完成完整 Web 项目开发与调试。', '在 OpenClaw 实训场景中完成 Web 项目开发、调试、提交与复盘，适合用于独立项目实践与课堂演示。',
 JSON_ARRAY('理解 OpenClaw CLI 与网关工作流', '观察智能体如何规划、执行并交付项目产物', '在智能体驱动的项目场景中练习调试与迭代'),
 JSON_ARRAY('具备基础 Linux 操作经验', '具备基础 Web 开发经验'));

INSERT INTO project_translations (entity_id, locale, title, subtitle, description, learning_goals, prerequisites, status, version, source_hash)
SELECT p.id, 'zh-CN',
       COALESCE(z.title, p.title),
       COALESCE(z.subtitle, p.subtitle),
       COALESCE(z.description, p.description),
       COALESCE(z.learning_goals, p.learning_goals),
       COALESCE(z.prerequisites, p.prerequisites),
       1,
       1,
       SHA2(CONCAT_WS('|', COALESCE(z.title, p.title), COALESCE(z.subtitle, p.subtitle), COALESCE(z.description, p.description, '')), 256)
FROM projects p
LEFT JOIN tmp_project_zh z ON z.entity_id = p.id
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  description = VALUES(description),
  learning_goals = VALUES(learning_goals),
  prerequisites = VALUES(prerequisites),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_project_unit_zh (
  entity_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_project_unit_zh (entity_id, title, description) VALUES
(17, 'OpenClaw Web 项目实战', '在 OpenClaw 课堂场景中完成完整 Web 项目开发与调试。');

INSERT INTO project_unit_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT u.id, 'zh-CN',
       COALESCE(z.title, u.title),
       COALESCE(z.description, u.description),
       1,
       1,
       SHA2(CONCAT_WS('|', COALESCE(z.title, u.title), COALESCE(z.description, u.description)), 256)
FROM project_units u
LEFT JOIN tmp_project_unit_zh z ON z.entity_id = u.id
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_manual_title_zh (
  source_id BIGINT UNSIGNED PRIMARY KEY,
  title VARCHAR(255) NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_manual_title_zh (source_id, title) VALUES
(364, 'MCP Server 开发实训手册'),
(367, 'ADE 配置与智能体开发 - 代码翻译官 Skill 实训手册'),
(370, '毒舌 Gordon - 单智能体开发实训手册'),
(371, '创意风暴 - 多智能体协作开发实训手册'),
(373, 'AI 酒吧调酒师 - 安全护栏实训手册');

INSERT INTO agent_manual_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT m.id, 'zh-CN',
       COALESCE(NULLIF(m.title, ''), CONCAT('实训手册 ', m.id)),
       m.description,
       1,
       1,
       SHA2(CONCAT_WS('|', COALESCE(NULLIF(m.title, ''), CONCAT('实训手册 ', m.id)), COALESCE(m.description, '')), 256)
FROM agent_manuals m
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO agent_manual_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT m_en.id, 'zh-CN',
       COALESCE(t.title, NULLIF(m_zh.title, ''), m_en.title),
       m_zh.description,
       1,
       1,
       SHA2(CONCAT_WS('|', COALESCE(t.title, NULLIF(m_zh.title, ''), m_en.title), COALESCE(m_zh.description, '')), 256)
FROM agent_manuals m_en
JOIN agent_manuals m_zh ON m_zh.source_type = 0 AND m_zh.source_id = m_en.source_id
LEFT JOIN tmp_manual_title_zh t ON t.source_id = m_en.source_id
WHERE m_en.source_type = 1
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO agent_step_translations (entity_id, locale, title, content_json, quick_questions_json, status, version, source_hash)
SELECT s.id, 'zh-CN', s.title, s.content, s.quick_questions, 1, 1,
       SHA2(CONCAT_WS('|', s.title, CAST(COALESCE(s.content, JSON_ARRAY()) AS CHAR), CAST(COALESCE(s.quick_questions, JSON_ARRAY()) AS CHAR)), 256)
FROM agent_steps s
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  content_json = VALUES(content_json),
  quick_questions_json = VALUES(quick_questions_json),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO agent_step_translations (entity_id, locale, title, content_json, quick_questions_json, status, version, source_hash)
SELECT s_en.id, 'zh-CN', s_zh.title, s_zh.content, s_zh.quick_questions, 1, 1,
       SHA2(CONCAT_WS('|', s_zh.title, CAST(COALESCE(s_zh.content, JSON_ARRAY()) AS CHAR), CAST(COALESCE(s_zh.quick_questions, JSON_ARRAY()) AS CHAR)), 256)
FROM agent_manuals m_en
JOIN agent_manuals m_zh ON m_zh.source_type = 0 AND m_zh.source_id = m_en.source_id
JOIN agent_steps s_en ON s_en.manual_id = m_en.id
JOIN agent_steps s_zh ON s_zh.manual_id = m_zh.id AND s_zh.step_order = s_en.step_order
WHERE m_en.source_type = 1
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  content_json = VALUES(content_json),
  quick_questions_json = VALUES(quick_questions_json),
  status = VALUES(status),
  version = version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
