-- Refine bilingual course-content metadata for the overseas deployment.
-- Scope: courses, stages, lessons, and lesson material display metadata only.
-- This script deliberately does NOT touch Agent manual / Agent step tables.

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_course_content_i18n (
  entity_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(16) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL,
  PRIMARY KEY (entity_id, locale)
) ENGINE=Memory;

INSERT INTO tmp_course_content_i18n (entity_id, locale, title, description) VALUES
(35, 'en-US', 'MCP Server Development', 'Learn the open Model Context Protocol (MCP), build MCP Servers, and implement Tools, Resources, and Prompts for agent applications.'),
(35, 'zh-CN', 'MCP Server 开发', '学习开放的模型上下文协议 MCP，掌握 MCP Server 构建方式，并完成 Tools、Resources、Prompts 三类能力开发。'),
(36, 'en-US', 'ADE Agent Development', 'Dive into the Agent Development Environment (ADE), master the Skill-based development model, and build reusable AI agent capabilities.'),
(36, 'zh-CN', 'ADE 智能体开发', '深入理解智能体开发环境 ADE，掌握基于 Skill 的开发模型，并构建可复用的 AI 智能体能力。'),
(37, 'en-US', 'Agent Framework Development', 'Study single-agent architecture through practical projects covering PRA loops, tool calling, memory, role prompts, and multi-agent collaboration.'),
(37, 'zh-CN', '智能体框架与开发', '通过实战项目学习单智能体架构，覆盖 PRA 循环、工具调用、记忆系统、角色提示词和多智能体协作。'),
(39, 'en-US', 'AI Safety and Compliance', 'Understand AI safety risks and implement guardrail systems with input rails, dialog rails, output rails, and retrieval rails.'),
(39, 'zh-CN', 'AI 安全与合规', '理解 AI 安全风险，使用输入护栏、对话护栏、输出护栏和检索护栏构建完整安全体系。'),
(42, 'en-US', 'MCP Server Development', 'Learn the open Model Context Protocol (MCP), build MCP Servers, and implement Tools, Resources, and Prompts for agent applications.'),
(42, 'zh-CN', 'MCP Server 开发', '学习开放的模型上下文协议 MCP，掌握 MCP Server 构建方式，并完成 Tools、Resources、Prompts 三类能力开发。'),
(43, 'en-US', 'ADE Agent Development', 'Dive into the Agent Development Environment (ADE), master the Skill-based development model, and build reusable AI agent capabilities.'),
(43, 'zh-CN', 'ADE 智能体开发', '深入理解智能体开发环境 ADE，掌握基于 Skill 的开发模型，并构建可复用的 AI 智能体能力。'),
(44, 'en-US', 'Agent Framework Development', 'Study single-agent architecture through practical projects covering PRA loops, tool calling, memory, role prompts, and multi-agent collaboration.'),
(44, 'zh-CN', '智能体框架与开发', '通过实战项目学习单智能体架构，覆盖 PRA 循环、工具调用、记忆系统、角色提示词和多智能体协作。'),
(45, 'en-US', 'AI Safety and Compliance', 'Understand AI safety risks and implement guardrail systems with input rails, dialog rails, output rails, and retrieval rails.'),
(45, 'zh-CN', 'AI 安全与合规', '理解 AI 安全风险，使用输入护栏、对话护栏、输出护栏和检索护栏构建完整安全体系。');

INSERT INTO course_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT entity_id, locale, title, description, 1, 1, SHA2(CONCAT_WS('|', title, description), 256)
FROM tmp_course_content_i18n
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = course_translations.version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_stage_content_i18n (
  entity_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(16) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL,
  PRIMARY KEY (entity_id, locale)
) ENGINE=Memory;

INSERT INTO tmp_stage_content_i18n (entity_id, locale, title, description)
SELECT s.id, 'en-US', 'Foundations', CONCAT('Core concepts and hands-on skills for ', en.title)
FROM course_stages s
JOIN course_translations en ON en.entity_id = s.course_id AND en.locale = 'en-US'
UNION ALL
SELECT s.id, 'zh-CN', '入门基础',
       CASE s.course_id
         WHEN 35 THEN '学习 MCP Server 开发的核心概念与实战技能'
         WHEN 42 THEN '学习 MCP Server 开发的核心概念与实战技能'
         WHEN 36 THEN '学习 ADE 智能体开发的核心概念与实战技能'
         WHEN 43 THEN '学习 ADE 智能体开发的核心概念与实战技能'
         WHEN 37 THEN '学习智能体框架与开发的核心概念与实战技能'
         WHEN 44 THEN '学习智能体框架与开发的核心概念与实战技能'
         WHEN 39 THEN '学习 AI 安全与合规的核心概念与实战技能'
         WHEN 45 THEN '学习 AI 安全与合规的核心概念与实战技能'
         ELSE CONCAT('学习', zh.title, '的核心概念与实战技能')
       END
FROM course_stages s
JOIN course_translations zh ON zh.entity_id = s.course_id AND zh.locale = 'zh-CN';

INSERT INTO course_stage_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT entity_id, locale, title, description, 1, 1, SHA2(CONCAT_WS('|', title, description), 256)
FROM tmp_stage_content_i18n
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = course_stage_translations.version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_lesson_content_i18n (
  entity_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(16) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL,
  PRIMARY KEY (entity_id, locale)
) ENGINE=Memory;

INSERT INTO tmp_lesson_content_i18n (entity_id, locale, title, description) VALUES
(352, 'en-US', 'MCP Server Development - Knowledge Manual', 'Theory materials for MCP Server concepts, protocol structure, and agent integration.'),
(352, 'zh-CN', 'MCP Server 开发 - 知识手册', '学习 MCP Server 的协议概念、结构设计和智能体集成方式。'),
(353, 'en-US', 'MCP Server Development - Practice Lab', 'Build and verify an MCP Server with Tools, Resources, and Prompts.'),
(353, 'zh-CN', 'MCP Server 开发 - 实践实验', '构建并验证包含 Tools、Resources、Prompts 的 MCP Server。'),
(354, 'en-US', 'ADE Agent Development - Knowledge Manual', 'Theory materials for ADE configuration, Skills, and agent development workflow.'),
(354, 'zh-CN', 'ADE 智能体开发 - 知识手册', '学习 ADE 配置、Skills 机制和智能体开发工作流。'),
(355, 'en-US', 'ADE Agent Development - Practice Lab', 'Create a Code Translator Skill and validate the DAE development loop.'),
(355, 'zh-CN', 'ADE 智能体开发 - 实践实验', '创建代码翻译官 Skill，并验证 DAE 开发闭环。'),
(356, 'en-US', 'Agent Framework Development - Knowledge Manual', 'Theory materials for agent architecture, PRA loops, and framework concepts.'),
(356, 'zh-CN', '智能体框架与开发 - 知识手册', '学习智能体架构、PRA 循环和框架核心概念。'),
(357, 'en-US', 'Snarky Gordon - Single-Agent Development', 'Build a Gordon-style food review agent with persona prompts, tools, and memory.'),
(357, 'zh-CN', '毒舌 Gordon - 单智能体开发', '构建 Gordon 风格美食评论智能体，练习角色提示词、工具调用和记忆系统。'),
(362, 'en-US', 'Creative Storm - Multi-Agent Collaboration', 'Build a multi-agent brainstorming workflow with role-based agents and orchestration.'),
(362, 'zh-CN', '创意风暴 - 多智能体协作', '构建多智能体创意风暴工作流，练习角色化智能体和协作编排。'),
(360, 'en-US', 'AI Safety and Compliance - Knowledge Manual', 'Theory materials for LLM safety risks, guardrail design, and compliance practices.'),
(360, 'zh-CN', 'AI 安全与合规 - 知识手册', '学习大模型安全风险、护栏体系设计和合规实践。'),
(361, 'en-US', 'AI Safety and Compliance - Practice Lab', 'Build an AI bartender with safety guardrails using NeMo Guardrails and Colang.'),
(361, 'zh-CN', 'AI 安全与合规 - 实践实验', '使用 NeMo Guardrails 与 Colang 构建带安全护栏的 AI 调酒师。'),
(363, 'en-US', 'MCP Server Development - Knowledge Manual', 'Theory materials for MCP Server concepts, protocol structure, and agent integration.'),
(363, 'zh-CN', 'MCP Server 开发 - 知识手册', '学习 MCP Server 的协议概念、结构设计和智能体集成方式。'),
(364, 'en-US', 'MCP Server Development - Practice Lab', 'Build and verify an MCP Server with Tools, Resources, and Prompts.'),
(364, 'zh-CN', 'MCP Server 开发 - 实践实验', '构建并验证包含 Tools、Resources、Prompts 的 MCP Server。'),
(366, 'en-US', 'ADE Agent Development - Knowledge Manual', 'Theory materials for ADE configuration, Skills, and agent development workflow.'),
(366, 'zh-CN', 'ADE 智能体开发 - 知识手册', '学习 ADE 配置、Skills 机制和智能体开发工作流。'),
(367, 'en-US', 'ADE Agent Development - Practice Lab', 'Create a Code Translator Skill and validate the DAE development loop.'),
(367, 'zh-CN', 'ADE 智能体开发 - 实践实验', '创建代码翻译官 Skill，并验证 DAE 开发闭环。'),
(369, 'en-US', 'Agent Framework Development - Knowledge Manual', 'Theory materials for agent architecture, PRA loops, and framework concepts.'),
(369, 'zh-CN', '智能体框架与开发 - 知识手册', '学习智能体架构、PRA 循环和框架核心概念。'),
(370, 'en-US', 'Snarky Gordon - Single-Agent Development', 'Build a Gordon-style food review agent with persona prompts, tools, and memory.'),
(370, 'zh-CN', '毒舌 Gordon - 单智能体开发', '构建 Gordon 风格美食评论智能体，练习角色提示词、工具调用和记忆系统。'),
(371, 'en-US', 'Creative Storm - Multi-Agent Collaboration', 'Build a multi-agent brainstorming workflow with role-based agents and orchestration.'),
(371, 'zh-CN', '创意风暴 - 多智能体协作', '构建多智能体创意风暴工作流，练习角色化智能体和协作编排。'),
(372, 'en-US', 'AI Safety and Compliance - Knowledge Manual', 'Theory materials for LLM safety risks, guardrail design, and compliance practices.'),
(372, 'zh-CN', 'AI 安全与合规 - 知识手册', '学习大模型安全风险、护栏体系设计和合规实践。'),
(373, 'en-US', 'AI Safety and Compliance - Practice Lab', 'Build an AI bartender with safety guardrails using NeMo Guardrails and Colang.'),
(373, 'zh-CN', 'AI 安全与合规 - 实践实验', '使用 NeMo Guardrails 与 Colang 构建带安全护栏的 AI 调酒师。');

INSERT INTO course_lesson_translations (entity_id, locale, title, description, status, version, source_hash)
SELECT entity_id, locale, title, description, 1, 1, SHA2(CONCAT_WS('|', title, description), 256)
FROM tmp_lesson_content_i18n
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  status = VALUES(status),
  version = course_lesson_translations.version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

CREATE TEMPORARY TABLE tmp_material_content_i18n (
  entity_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(16) NOT NULL,
  title VARCHAR(128) NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  PRIMARY KEY (entity_id, locale)
) ENGINE=Memory;

INSERT INTO tmp_material_content_i18n (entity_id, locale, title, file_name) VALUES
(26, 'en-US', 'MCP Server Development - Theory Lesson 1', 'MCP Server Development - Theory Lesson 1.docx'),
(26, 'zh-CN', 'MCP Server 开发 - 理论课第一节', 'MCP_Server开发_理论课_第一节.docx'),
(27, 'en-US', 'MCP Server Development - Theory Lesson 1', 'MCP Server Development - Theory Lesson 1.pdf'),
(27, 'zh-CN', 'MCP Server 开发 - 理论课第一节', 'MCP_Server开发_理论课_第一节.pdf'),
(28, 'en-US', 'ADE Configuration and Agent Development - Theory Lesson 1', 'ADE Configuration and Agent Development - Theory Lesson 1.docx'),
(28, 'zh-CN', 'ADE 配置与智能体开发 - 理论课第一节', 'ADE配置与智能体开发_第一节_理论课程.docx'),
(29, 'en-US', 'ADE Configuration and Agent Development - Theory Lesson 1', 'ADE Configuration and Agent Development - Theory Lesson 1.pdf'),
(29, 'zh-CN', 'ADE 配置与智能体开发 - 理论课第一节', 'ADE配置与智能体开发_第一节_理论课程.pdf'),
(32, 'en-US', 'Agent Framework Development - Theory Knowledge Lesson 1', 'Agent Framework Development - Theory Knowledge Lesson 1.docx'),
(32, 'zh-CN', '智能体框架与开发 - 理论知识第一节', '智能体框架与开发_理论知识篇_第一节.docx'),
(33, 'en-US', 'Agent Framework Development - Theory Knowledge Lesson 1', 'Agent Framework Development - Theory Knowledge Lesson 1.pdf'),
(33, 'zh-CN', '智能体框架与开发 - 理论知识第一节', '智能体框架与开发_理论知识篇_第一节.pdf'),
(30, 'en-US', 'AI Safety and Compliance - Theory Lesson 1: LLM Safety Risks and Guardrails', 'AI Safety and Compliance - Theory Lesson 1 - LLM Safety Risks and Guardrails.md'),
(30, 'zh-CN', 'AI 安全与合规 - 理论课第一节：大模型安全风险与护栏体系', '安全与合规_第一节_理论课程_大模型安全风险与护栏体系.md'),
(31, 'en-US', 'AI Safety and Compliance - Theory Lesson 1: LLM Safety Risks and Guardrails', 'AI Safety and Compliance - Theory Lesson 1 - LLM Safety Risks and Guardrails.pdf'),
(31, 'zh-CN', 'AI 安全与合规 - 理论课第一节：大模型安全风险与护栏体系', '安全与合规_第一节_理论课程_大模型安全风险与护栏体系.pdf'),
(49, 'en-US', 'MCP Server Development - Theory Lesson 1', 'MCP Server Development - Theory Lesson 1.pdf'),
(49, 'zh-CN', 'MCP Server 开发 - 理论课第一节', 'MCP_Server开发_理论课_第一节.pdf'),
(50, 'en-US', 'MCP Server Development - Theory Lesson 1', 'MCP Server Development - Theory Lesson 1.docx'),
(50, 'zh-CN', 'MCP Server 开发 - 理论课第一节', 'MCP_Server开发_理论课_第一节.docx'),
(48, 'en-US', 'ADE Configuration and Agent Development - Theory Lesson 1', 'ADE Configuration and Agent Development - Theory Lesson 1.pdf'),
(48, 'zh-CN', 'ADE 配置与智能体开发 - 理论课第一节', 'ADE配置与智能体开发_第一节_理论课程.pdf'),
(52, 'en-US', 'ADE Configuration and Agent Development - Theory Lesson 1', 'ADE Configuration and Agent Development - Theory Lesson 1.docx'),
(52, 'zh-CN', 'ADE 配置与智能体开发 - 理论课第一节', 'ADE配置与智能体开发_第一节_理论课程.docx'),
(47, 'en-US', 'Agent Framework Development - Theory Knowledge Lesson 1', 'Agent Framework Development - Theory Knowledge Lesson 1.pdf'),
(47, 'zh-CN', '智能体框架与开发 - 理论知识第一节', '智能体框架与开发_理论知识篇_第一节.pdf'),
(51, 'en-US', 'Agent Framework Development - Theory Knowledge Lesson 1', 'Agent Framework Development - Theory Knowledge Lesson 1.docx'),
(51, 'zh-CN', '智能体框架与开发 - 理论知识第一节', '智能体框架与开发_理论知识篇_第一节.docx'),
(43, 'en-US', 'AI Safety and Compliance - Theory Lesson 1: LLM Safety Risks and Guardrails', 'AI Safety and Compliance - Theory Lesson 1 - LLM Safety Risks and Guardrails.md'),
(43, 'zh-CN', 'AI 安全与合规 - 理论课第一节：大模型安全风险与护栏体系', '安全与合规_第一节_理论课程_大模型安全风险与护栏体系.md'),
(46, 'en-US', 'AI Safety and Compliance - Theory Lesson 1: LLM Safety Risks and Guardrails', 'AI Safety and Compliance - Theory Lesson 1 - LLM Safety Risks and Guardrails.pdf'),
(46, 'zh-CN', 'AI 安全与合规 - 理论课第一节：大模型安全风险与护栏体系', '安全与合规_第一节_理论课程_大模型安全风险与护栏体系.pdf');

INSERT INTO lesson_material_translations (entity_id, locale, title, description, file_url, file_name, file_size, status, version, source_hash)
SELECT m.id, i.locale, i.title, COALESCE(t.description, ''), m.file_url, i.file_name, m.file_size, 1, 1,
       SHA2(CONCAT_WS('|', i.title, m.file_url, i.file_name, m.file_size), 256)
FROM tmp_material_content_i18n i
JOIN lesson_materials m ON m.id = i.entity_id
LEFT JOIN lesson_material_translations t ON t.entity_id = i.entity_id AND t.locale = i.locale
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  file_url = VALUES(file_url),
  file_name = VALUES(file_name),
  file_size = VALUES(file_size),
  status = VALUES(status),
  version = lesson_material_translations.version + 1,
  source_hash = VALUES(source_hash),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
