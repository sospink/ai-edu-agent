# Agent EDU 课程体系介绍

## 平台简介

Agent EDU 是一个专注于 AI Agent 智能体开发的在线教育平台，提供从提示词工程到生产级智能体开发的完整课程体系。当前课程共五门，覆盖提示词工程、智能体开发框架、MCP 协议开发、ADE 开发环境、以及 AI 安全与合规。

---

## 课程体系（五门核心课程）

### 第一门：提示词工程

**核心理念：** 从"写提示词"升级到"构建提示词系统"

**课程内容：**
五大工程化原则：
- **模块化（Modularity）**：将提示词拆分为独立功能模块，实现职责单一
- **参数化（Parameterization）**：抽象变化部分为参数，固定不变部分为模板
- **版本化（Versioning）**：像管理代码一样管理提示词，记录每次迭代
- **可测试性（Testability）**：设计测试用例，量化评估提示词质量
- **可观测性（Observability）**：记录执行过程，方便调试和持续优化

**实战项目：** 万能文案生成器
- 支持多平台（小红书、微博、微信公众号、抖音、LinkedIn）
- 支持多风格（活泼可爱、专业权威、走心感人、幽默搞笑、极简高冷）
- 综合运用五大工程化原则

**学习成果：**
- 掌握提示词工程化思维
- 能够构建可维护、可测试的提示词系统
- 独立完成万能文案生成器项目

---

### 第二门：智能体框架与开发

**核心技术栈：** LangChain / LangGraph + GLM-4（智谱 AI）

**课程内容：**

Agent 基础理论：
- **PRA 循环**：感知（Perception）→ 推理（Reasoning）→ 行动（Action）
- **ReAct 模式**：推理与行动交替，思考过程透明可见
- **工具调用（Tool Calling）**：Agent 与外部世界交互的机制

记忆系统：
- 短期记忆（对话上下文）
- 长期记忆（持久化存储）
- 工作记忆（任务中间状态）
- 语义记忆（向量数据库检索）

框架对比：
- LangChain：适合线性、固定流程的任务
- LangGraph：适合复杂、需要条件分支和循环的 Agent

Agent 架构：
- 单 Agent：独立完成任务
- 多 Agent 系统（MAS）：多个专业化 Agent 协同工作

**实战项目：**
- **毒舌 Gordon**（单 Agent）：脾气暴躁但专业的美食点评 Agent
- **创意风暴**（多 Agent）：主持人+乐观派+批判派+创意派协同头脑风暴

**学习成果：**
- 理解 Agent 运作原理
- 能够使用 LangChain/LangGraph 开发 Agent
- 掌握单/多 Agent 架构设计

---

### 第三门：MCP Server 开发

**核心概念：** MCP（Model Context Protocol）= AI 世界的 USB 接口

**课程内容：**

MCP 三大核心能力（记忆口诀：**Tools动手干，Resources用眼看，Prompts是快捷键**）：

- **Tools（工具）**
  - AI 主动触发
  - 可以有副作用（修改数据、调用 API）
  - 适用于：搜索、发消息、执行操作

- **Resources（资源）**
  - 应用程序控制
  - 只读，无副作用
  - 通过 URI 标识
  - 适用于：读文件、获取数据

- **Prompts（提示模板）**
  - 用户主动选择
  - 参数化模板
  - 适用于：预设最佳实践的快捷方式

MCP 架构与工作原理：
- MCP 客户端（Claude Desktop / Cursor 等）
- MCP Server（自定义开发）
- 传输协议：stdio 或 HTTP+SSE

**实战项目：** 今日运势 MCP Server
- Tools：获取今日运势、幸运色、幸运数字
- Resources：读取星座信息、黄历数据
- Prompts：运势解读标准模板

**学习成果：**
- 理解 MCP 协议规范
- 能够开发自定义 MCP Server
- 掌握 Tools/Resources/Prompts 三种能力的适用场景

---

### 第四门：ADE 配置与智能体开发

**核心工具：** OpenCode（终端 AI Agent）+ GLM-4.7（智谱 AI）

**课程内容：**

ADE 体系：
- ADE（Agent Development Environment）：智能体开发环境
- OpenCode：自然语言驱动的终端 AI 编程 Agent

Skills.md 能力配置文件：
- **元数据（Metadata）**：技能标识、版本、描述
- **触发条件（Triggers）**：何时激活该技能
- **能力说明（Capabilities）**：技能能做什么
- **执行指令（Instructions）**：具体执行步骤
- **输出规范（Output Specification）**：预期输出格式

DAE 工作流（三阶段）：
1. **发现（Discovery）**：扫描并注册所有技能
2. **激活（Activation）**：意图匹配，选择合适技能
3. **执行（Execution）**：按 Instructions 完成任务

渐进式披露设计：
- L1 Basic：简单自然语言描述
- L2 Advanced：带参数的精确描述
- L3 Expert：专业级精细控制

**实战内容：** 配置自定义 Skill，构建专属 AI 开发助手

**学习成果：**
- 掌握 ADE 环境配置
- 能够编写高质量的 Skills.md 文件
- 理解 DAE 工作流运作机制

---

### 第五门：安全与合规

**核心主题：** 大模型安全风险与 NeMo Guardrails 护栏体系

**课程内容：**

六大安全风险：
1. **越狱攻击（Jailbreak）**：绕过 AI 安全限制的攻击方式
2. **提示词注入（Prompt Injection）**：通过恶意输入劫持 AI 行为
3. **幻觉问题（Hallucination）**：AI 生成虚假但听起来合理的内容
4. **有毒内容（Toxic Content）**：生成有害、歧视性或不当内容
5. **隐私泄露（Privacy Leakage）**：泄露训练数据中的私人信息
6. **偏见与歧视（Bias & Discrimination）**：输出带有系统性偏见的内容

NeMo Guardrails 护栏体系（NVIDIA 开源）：
- **Input Rails**：过滤恶意输入，在处理前拦截有害请求
- **Dialog Rails**：控制对话流程，确保交互符合预期
- **Retrieval Rails**：过滤检索内容，防止有害知识进入上下文
- **Output Rails**：审查生成内容，在输出前过滤不当内容
- **Execution Rails**：监控工具调用，防止危险操作执行

Colang DSL 语法：
- Colang 1.0：基于 flow/message 的对话流定义
- Colang 2.0：事件驱动的状态机模型，更强大灵活

**实战项目：** AI 酒吧调酒师
- 场景：AI 扮演调酒师，需要拒绝不适当请求
- 目标：配置 Guardrails 实现安全过滤
- 技术：使用 NeMo Guardrails + Colang DSL

**学习成果：**
- 了解大模型主要安全风险
- 能够使用 NeMo Guardrails 构建安全护栏
- 掌握 Colang DSL 基本语法

---

## 课程特色

**项目驱动：** 每门课程均有配套实战项目，学完即可动手。

**技术前沿：** 覆盖 2024 年最新技术标准（MCP 协议 2024 年 11 月发布）。

**完整体系：** 从提示词到框架开发，从工具协议到安全合规，构成完整的 AI Agent 开发知识图谱。

**真实项目：** 万能文案生成器、毒舌 Gordon、创意风暴、今日运势 MCP、AI 酒吧调酒师，均为可落地的真实项目。

---

## 常见问题

**Q: 学这五门课需要什么基础？**
A: 第一门（提示词工程）零基础可学；第二~四门需要基础 Python 编程能力；第五门（安全与合规）建议在了解基础 Agent 开发后学习。

**Q: 这五门课的学习顺序是什么？**
A: 推荐顺序：提示词工程 → 智能体框架与开发 → MCP Server 开发 → ADE 配置与开发 → 安全与合规。详见学习路线文档。

**Q: 使用哪些模型？**
A: 主要使用智谱 AI 的 GLM-4 / GLM-4.7，部分内容涉及 Claude（MCP 协议由 Anthropic 制定）。

**Q: 课程内容会更新吗？**
A: 会，AI 技术发展迅速，课程内容会持续跟进最新进展。
