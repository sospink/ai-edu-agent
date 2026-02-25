# AI 课程实训 - 课程索引

欢迎来到 AI 课程实训环境！这里包含 6 门精心设计的 AI 课程。

## 📚 课程列表

### 1. 提示词工程 - 万能文案生成器 ✍️
**目录**: `prompt-engineering/`  
**时长**: 45 分钟  
**难度**: ⭐⭐ 入门

**学习内容**:
- 模块化 (Modularity)
- 参数化 (Parameterization)
- 版本化 (Versioning)
- 可测试 (Testability)
- 可观测 (Observability)

**快速开始**:
```bash
cd /workspace/courses/prompt-engineering
python3 example.py
```

---

### 2. MCP Server 开发 - 今日运势 🧠
**目录**: `mcp-server/`  
**时长**: 45 分钟  
**难度**: ⭐⭐⭐ 中级

**学习内容**:
- Tools (工具)
- Resources (资源)
- Prompts (提示词)
- MCP 协议规范

**快速开始**:
```bash
cd /workspace/courses/mcp-server
node example.js
```

---

### 3. ADE 配置与智能体开发 - 代码翻译官 🔁
**目录**: `ade-skill/`  
**时长**: 30 分钟  
**难度**: ⭐⭐ 入门

**学习内容**:
- Discovery (发现)
- Activation (激活)
- Execution (执行)
- Skills.md 规范
- 渐进式披露

**快速开始**:
```bash
cd /workspace/courses/ade-skill
# 查看 README.md 了解详情
```

---

### 4. 智能体框架与开发 - 毒舌 Gordon 🔎
**目录**: `agent-gordon/`  
**时长**: 40 分钟  
**难度**: ⭐⭐⭐ 中级

**学习内容**:
- PRA Loop (感知-推理-行动)
- ReAct (推理与行动)
- 工具调用机制
- 记忆系统设计
- LangChain 框架

**快速开始**:
```bash
cd /workspace/courses/agent-gordon
python3 example.py
```

---

### 5. 智能体框架与开发 - 创意风暴 💬
**目录**: `multi-agent/`  
**时长**: 50 分钟  
**难度**: ⭐⭐⭐⭐ 高级

**学习内容**:
- 多 Agent 系统 (MAS)
- 多 Agent 协作模式
- LangGraph 状态机
- Python + FastAPI
- 工作流编排

**快速开始**:
```bash
cd /workspace/courses/multi-agent
python3 example.py
```

---

### 6. 安全与合规 - AI 酒吧调酒师 🍸
**目录**: `guardrails/`  
**时长**: 40 分钟  
**难度**: ⭐⭐⭐ 中级

**学习内容**:
- Colang 语言
- 大模型安全风险分类
- 护栏 (Guardrails)
- Nemo Guardrails 框架
- 输入/输出/对话护栏

**快速开始**:
```bash
cd /workspace/courses/guardrails
python3 example.py
```

---

## 🚀 开始学习

### 1. 配置 API Keys

首先复制环境变量模板：
```bash
cd /workspace
cp .env.template .env
vim .env  # 或使用 mousepad .env
```

填入你的 API Keys：
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxx
```

### 2. 选择课程

根据你的兴趣和水平选择课程：
- **初学者**: 从课程 1 或 3 开始
- **有基础**: 从课程 2 或 4 开始
- **进阶学习**: 尝试课程 5 或 6

### 3. 运行示例

每个课程目录都包含：
- `README.md` - 课程详细说明
- `example.py` 或 `example.js` - 可运行的示例代码
- 其他辅助文件

### 4. 动手实践

- 阅读示例代码
- 运行并观察输出
- 修改参数尝试不同效果
- 完成课程练习

---

## 📖 学习路径建议

### 路径 A: 提示词工程师
```
课程1 (提示词工程) → 课程2 (MCP Server) → 课程3 (ADE Skill)
```

### 路径 B: Agent 开发者
```
课程1 (提示词工程) → 课程4 (单Agent) → 课程5 (多Agent)
```

### 路径 C: AI 安全工程师
```
课程1 (提示词工程) → 课程4 (单Agent) → 课程6 (Guardrails)
```

### 路径 D: 全栈 AI 工程师
```
按顺序学习所有 6 门课程
```

---

## 🛠️ 开发工具

环境中预装了以下工具：

### 编辑器
- **Vim** - 终端编辑器
- **Mousepad** - 图形界面文本编辑器
- **Gedit** - 功能丰富的文本编辑器

### 终端
- **XFCE Terminal** - 桌面终端
- **Tmux** - 终端复用器

### 浏览器
- **Firefox** - 查看文档和测试 Web 应用

---

## 💡 学习技巧

1. **边学边做**: 不要只看代码，要动手修改和运行
2. **理解原理**: 理解每个概念背后的原理，而不是死记硬背
3. **举一反三**: 尝试将学到的知识应用到其他场景
4. **记录笔记**: 在代码中添加注释，记录你的理解
5. **提出问题**: 遇到不懂的地方，记录下来并寻求答案

---

## 🆘 获取帮助

### 查看课程文档
```bash
cd /workspace/courses/<course-name>
cat README.md
```

### 检查环境
```bash
verify-env
```

### 测试 Python 包
```bash
python3 -c "import langchain; print('LangChain OK')"
```

### 测试 Node.js 包
```bash
node -e "console.log('Node.js OK')"
```

---

## 📊 学习进度追踪

创建一个学习日志：
```bash
cd /workspace
touch learning-log.md
```

记录你的学习进度：
```markdown
# 我的学习日志

## 2024-01-15
- ✅ 完成课程1: 提示词工程
- 📝 学到了模块化和参数化的重要性
- 🤔 问题: 如何更好地测试提示词？

## 2024-01-16
- 🔄 正在学习课程2: MCP Server
- ...
```

---

## 🎯 下一步

1. 选择一门课程开始学习
2. 配置好 API Keys
3. 运行示例代码
4. 完成课程练习
5. 尝试自己的项目

**祝学习愉快！🎉**

---

*最后更新: 2024-01-15*
