---
name: course-content-generator
description: 为 Agent EDU Lab 生成标准格式的课程内容，包括理论课 Markdown 文档、实训步骤配置、课程手册和知识库文档。当需要创建新课时内容、编写实训步骤、生成符合平台规范的课程资料时触发。遵循 /knowledge-base-docs/ 和 /课程手册/ 中的内容规范。
---

# 课程内容生成技能

## 目标

按照 Agent EDU Lab 平台规范，生成可直接使用的课程内容，包括理论课文档、实训步骤和课程手册。

## 内容规范参考

读取模板了解格式要求：
→ `resources/lesson-template.md` — 理论课文档模板
→ `resources/lab-steps-template.json` — 实训步骤数据结构模板

查看示例学习具体写法：
→ `examples/theory-lesson/` — 完整理论课示例
→ `examples/lab-lesson/` — 完整实训课示例

## 生成流程

### Step 1：确认课程信息

收集以下必要信息：
- 课程方向（如：Dify 实战 / Prompt Engineering / Agent 开发）
- 课时主题（如：Dify 工作流节点介绍）
- 目标学员（入门 / 进阶 / 实战）
- 预计时长（分钟）
- 是理论课还是实训课

### Step 2：生成理论课内容

理论课 Markdown 文档结构：

```markdown
# [课时标题]

## 学习目标

完成本课时后，你将能够：
- [目标1]
- [目标2]
- [目标3]

## 概念讲解

### [核心概念1]
...

### [核心概念2]
...

## 实践要点

...

## 知识检验

1. [问题1]
2. [问题2]

## 延伸资源

- [资源名称](链接)
```

### Step 3：生成实训步骤

实训步骤 JSON 格式（用于后端数据库导入）：

```json
{
  "lesson_id": "lesson-xxx",
  "steps": [
    {
      "step_number": 1,
      "title": "步骤标题",
      "instruction": "向学生展示的操作说明（支持 Markdown）",
      "validation_script": "validate_step1.sh",
      "hints": ["提示1", "提示2"],
      "expected_output": "预期执行结果描述"
    }
  ]
}
```

### Step 4：生成课程手册

课程手册放置在 `/课程手册/` 目录，文件命名规则：
`[课程方向]-[课时序号]-[主题简称].md`

例如：`dify-03-workflow-nodes.md`

### Step 5：知识库文档

知识库文档放置在 `/knowledge-base-docs/` 目录，供 AI 教师检索使用：
- 每个概念独立成文档
- 包含定义、示例、常见问题
- 格式遵循 `/knowledge-base-docs/` 现有规范

## 内容质量检查清单

生成内容后，逐项确认：

- [ ] 标题层级正确（H1 → H2 → H3）
- [ ] 学习目标具体可衡量（避免"了解"，使用"能够配置/实现/分析"）
- [ ] 实训步骤操作粒度合适（每步骤 2-5 分钟可完成）
- [ ] 每个实训步骤有对应验证方法
- [ ] 代码示例有完整注释
- [ ] 延伸资源链接有效
- [ ] 文档内无占位符 `[TODO]` 或 `[待填写]`

## 特殊规范

**Dify 相关课程**：引用实际 Dify 界面截图路径格式：`/assets/screenshots/dify-xxx.png`

**MCP 相关课程**：代码示例使用 TypeScript，遵循项目现有 ESLint 配置

**多 Agent 课程**：架构图使用 Mermaid 格式嵌入 Markdown

## 文件输出位置

| 内容类型 | 输出路径 |
|---------|---------|
| 理论课文档 | `/knowledge-base-docs/[方向]/[文件名].md` |
| 实训步骤配置 | `/知识库/lab-configs/[lesson-id].json` |
| 课程手册 | `/课程手册/[方向]/[文件名].md` |
| 课程种子数据 | `/EDU_Backend/src/scripts/` |
