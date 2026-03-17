# ADE 配置与智能体开发指南

## 课程定位

本课程讲授 **ADE（Agent Development Environment，智能体开发环境）配置与智能体开发**，以 **OpenCode**（终端 AI 编程 Agent）为核心工具，通过配置 **Skills.md** 文件来定义和扩展智能体的能力。

---

## 什么是 ADE？

ADE（Agent Development Environment）是一套专为智能体开发设计的环境体系，包含：

- **工具**：OpenCode 等 AI Agent 工具
- **模型**：GLM-4.7（智谱 AI）
- **配置规范**：Skills.md 能力配置文件
- **工作流**：DAE 工作流（发现→激活→执行）

### ADE 与传统 IDE 的区别

| 维度 | 传统 IDE | ADE |
|------|---------|-----|
| 核心操作 | 手动编写代码 | 描述意图，AI 自动执行 |
| 学习重点 | 编程语法 | 意图表达和能力配置 |
| 扩展方式 | 安装插件 | 配置 Skills.md |
| 执行方式 | 开发者运行 | AI Agent 自主执行 |

---

## OpenCode：终端 AI 编程 Agent

OpenCode 是 ADE 的核心工具，是一个运行在终端中的 AI 编程 Agent。

### OpenCode 的核心能力

- **代码生成**：根据自然语言描述生成代码
- **文件操作**：读写、创建、修改项目文件
- **命令执行**：在终端执行 shell 命令
- **代码解释**：解读和分析现有代码
- **问题调试**：识别并修复代码中的 Bug
- **项目构建**：端到端完成完整项目

### OpenCode + GLM-4.7

本课程使用智谱 AI 的 **GLM-4.7** 作为后端模型，配置方式：

```yaml
# opencode.json 或配置文件
model: glm-4
provider: zhipuai
api_key: your-zhipuai-api-key
```

---

## Skills.md：能力配置文件

Skills.md 是 ADE 体系的核心概念，它是一个用 Markdown 格式编写的**技能定义文件**，告诉 AI Agent 它拥有哪些能力，以及如何使用这些能力。

### Skills.md 的本质

可以理解为：**AI 的"岗位职责说明书"**

传统软件通过代码定义功能，ADE 通过 Skills.md 定义 AI 能做什么、在什么情况下做、按什么标准做。

### Skills.md 的完整结构

```markdown
---
name: skill-name          # 技能唯一标识符
version: 1.0.0            # 版本号
description: 技能简短描述  # 一句话说明
author: 作者名
---

## 元数据（Metadata）
[技能的基本信息，供系统识别]

## 触发条件（Triggers）
[描述何时、在什么情况下激活该技能]
- 当用户说"..."时
- 当检测到...时
- 当任务涉及...时

## 能力说明（Capabilities）
[详细描述该技能能做什么]

## 执行指令（Instructions）
[具体的执行步骤和规范]

## 输出规范（Output Specification）
[期望的输出格式和质量标准]

## 示例（Examples）
[Input/Output 示例对]
```

---

## DAE 工作流

DAE 是 ADE 中 Skills 的三阶段工作流：

### 阶段一：发现（Discovery）

AI Agent 启动时扫描所有可用的 Skills.md 文件，建立技能注册表。

```
Agent 启动
    ↓
扫描 .skills/ 目录
    ↓
读取所有 Skills.md 文件
    ↓
解析元数据、触发条件、能力说明
    ↓
建立技能注册表（技能名 → 技能描述）
```

### 阶段二：激活（Activation）

当用户发出请求时，Agent 进行意图匹配，找到最合适的技能。

```
用户请求："帮我写一个登录页面"
    ↓
分析意图：代码生成 + Web 前端
    ↓
匹配触发条件：
- web-development skill: ✅ "当需要创建 Web 页面时"
- code-review skill: ❌ 不匹配
- documentation skill: ❌ 不匹配
    ↓
激活 web-development skill
```

### 阶段三：执行（Execution）

按照激活的技能中的 Instructions 执行任务。

```
加载 web-development skill 的 Instructions
    ↓
按步骤执行：
1. 分析需求，确认技术栈
2. 创建项目结构
3. 生成 HTML/CSS/JS 代码
4. 添加表单验证逻辑
5. 测试页面功能
    ↓
按 Output Specification 格式化输出
```

---

## 渐进式披露（Progressive Disclosure）

ADE 采用**渐进式披露**设计哲学，根据用户的专业程度提供不同深度的交互。

### 三个层次

**L1 基础模式（Basic）**
- 目标用户：初学者、非技术人员
- 交互方式：自然语言描述，最简单的操作
- 示例：`帮我建一个网站`

**L2 进阶模式（Advanced）**
- 目标用户：有一定经验的用户
- 交互方式：提供更多参数和选项
- 示例：`用 React + TypeScript 建一个响应式网站，包含导航栏和联系表单`

**L3 专家模式（Expert）**
- 目标用户：专业开发者
- 交互方式：精细控制每个细节
- 示例：`用 Next.js 13 + App Router + Tailwind CSS 建网站，要求 SSR、SEO 优化、Lighthouse 分数 >90`

---

## 实战：创建自定义 Skill

### 示例：创建一个代码审查 Skill

```markdown
---
name: code-reviewer
version: 1.0.0
description: 对代码进行全面的安全、性能和规范审查
author: agent-edu
---

## 触发条件

以下情况触发本技能：
- 用户说"审查这段代码"、"帮我 review 代码"
- 用户粘贴代码并询问"有什么问题"
- 用户说"这段代码安全吗"、"性能怎么样"
- 完成代码编写后自动触发审查

## 能力说明

本技能能够：
1. 识别代码中的安全漏洞（SQL 注入、XSS、认证缺陷等）
2. 分析时间复杂度和空间复杂度
3. 检查代码规范（命名、注释、结构）
4. 发现潜在的运行时错误
5. 提供具体的改进建议

## 执行指令

1. 首先确认代码语言和上下文
2. 按以下维度逐一分析：
   - 安全性：检查常见漏洞
   - 性能：分析算法复杂度和资源使用
   - 可读性：评估命名、注释质量
   - 健壮性：检查错误处理和边界条件
3. 对每个问题：标注位置、描述问题、给出修复建议
4. 最后给出整体评分（1-10）和优先修复建议

## 输出规范

使用以下格式输出：

### 审查报告

**整体评分：X/10**

**安全问题：**
- [严重/高/中/低] 问题描述（第X行）
  修复建议：...

**性能问题：**
- [问题描述]
  优化建议：...

**代码规范：**
- [建议]

**优先修复项：**
1. ...
2. ...
```

---

## Skills.md 最佳实践

### 1. 触发条件要清晰精确

好的触发条件写法：
- 当用户请求创建或修改 Python 文件时
- 当用户询问 Python 错误信息时
- 当检测到 .py 文件需要优化时

不好的触发条件写法：
- 当用户需要帮助时（太宽泛，几乎所有请求都能匹配）

### 2. Instructions 要具体可执行

好的执行指令写法：
1. 读取现有代码，理解其功能
2. 检查 PEP 8 规范合规性
3. 识别可以用列表推导式优化的循环
4. 添加类型注解
5. 生成优化后的代码

不好的执行指令写法：
1. 看一下代码（不够具体）
2. 改进它（没有标准，AI 不知道怎么做）

### 3. 输出规范要包含示例
始终在 Output Specification 中提供具体的格式示例，AI 更容易对齐预期输出。

---

## 常见问题

**Q: Skills.md 和 Prompt 有什么区别？**
A: Prompt 是单次对话的指令，Skills.md 是持久化的能力定义。Skills.md 会被系统持续加载，而不是每次都手动输入。

**Q: 一个 Agent 可以有多少个 Skills？**
A: 理论上不限，但建议每个 Skill 职责单一，不要创建过于宽泛的技能。

**Q: Skills.md 放在哪里？**
A: 通常放在项目的 `.skills/` 目录下，或者 ADE 工具指定的技能目录中。

**Q: 如何测试一个新创建的 Skill 是否有效？**
A: 使用触发条件中描述的场景进行测试，观察 AI 是否正确激活并按照 Instructions 执行。

---

## 总结

ADE 开发的核心要素：
1. **OpenCode**：终端 AI Agent，自然语言驱动的开发工具
2. **GLM-4.7**：智谱 AI 提供的基础大模型
3. **Skills.md**：能力配置文件，定义 Agent 会什么、何时用、怎么做
4. **DAE 工作流**：发现(Discovery) → 激活(Activation) → 执行(Execution)
5. **渐进式披露**：L1基础 → L2进阶 → L3专家，满足不同层次用户需求
