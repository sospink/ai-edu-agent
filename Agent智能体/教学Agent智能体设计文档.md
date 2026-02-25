# 教学Agent智能体设计文档

## 项目概述

基于交互式对话的教学智能体，将实验手册拆解为步骤化引导，支持环境验证、AI问答、代码执行等功能。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React + TypeScript + Vite | 基于现有 hero-agent-tutor 组件 |
| UI | Tailwind CSS + Lucide Icons | 轻量级，已集成 |
| 后端 | Node.js + TypeScript | TS全栈统一 |
| 框架 | Express / Fastify | 轻量API服务 |
| AI | 通义千问 API | 问答能力 |
| 数据库 | MySQL | 存储实验手册、用户进度 |
| 实验环境 | Docker API / SSH | 命令执行与验证 |

---

## 现有前端组件评估

### 组件结构 (hero-agent-tutor)

```
hero-agent-tutor/
├── components/
│   ├── Agent/
│   │   ├── AgentWidget.tsx    # 主容器组件 ✅
│   │   ├── StepProgress.tsx   # 步骤进度条 ✅
│   │   └── CodeBlock.tsx      # 代码块组件 ✅
│   └── ui/
│       ├── Button.tsx         # 按钮组件 ✅
│       └── Chip.tsx           # 标签组件 ✅
├── types.ts                   # 类型定义 ✅
└── App.tsx                    # 演示页面
```

### 已实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 步骤进度条 | ✅ 完成 | 支持多步骤可视化 |
| 对话气泡渲染 | ✅ 完成 | Agent/User 双向对话 |
| 结构化内容渲染 | ✅ 完成 | 支持 text/heading/code/image |
| 代码块 | ✅ 完成 | 复制、语法高亮、Explain按钮 |
| 快捷问题 | ✅ 完成 | Chip 标签点击提问 |
| 输入框 | ✅ 完成 | 自由提问 |
| Continue/Next 按钮 | ✅ 完成 | 步骤切换 |
| 验证动画 | ✅ 完成 | "Checking environment..." |
| 目录导航 | ✅ 完成 | 左侧 ToC 菜单 |

### 待完善功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 真实环境验证 | P0 | 对接后端API |
| AI问答集成 | P0 | 对接通义千问 |
| 动态加载实验 | P0 | 从后端获取步骤数据 |
| 代码执行 | P1 | 发送命令到实验环境 |
| 用户进度持久化 | P1 | 保存学习进度 |
| 验证失败提示 | P1 | 显示具体错误信息 |

---

## 数据结构设计

### 实验手册 (Lab)

```typescript
interface Lab {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // 分钟
  tags: string[];
  steps: Step[];
}
```

### 步骤 (Step)

```typescript
interface Step {
  id: number;
  title: string;
  content: ContentBlock[];
  quickQuestions: string[];
  verification?: Verification;
}

interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean; // 代码是否可执行
}
```

### 验证规则 (Verification)

```typescript
interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  // file_exists
  path?: string;
  // command_output
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  // service_running
  port?: number;
  // custom
  script?: string;
}
```

### 用户进度 (UserProgress)

```typescript
interface UserProgress {
  oderId: string
  labId: string;
  currentStep: number;
  completedSteps: number[];
  startedAt: Date;
  lastActiveAt: Date;
  chatHistory: ChatMessage[];
}
```

---

## API 接口设计

### 实验手册

```
GET  /api/labs                    # 获取实验列表
GET  /api/labs/:labId             # 获取实验详情(含所有步骤)
GET  /api/labs/:labId/steps/:stepId  # 获取单个步骤
```

### 步骤验证

```
POST /api/labs/:labId/verify
Body: { stepId: number, environmentId: string }
Response: { 
  success: boolean, 
  message: string,
  details?: string 
}
```

### 命令执行

```
POST /api/environment/execute
Body: { environmentId: string, command: string }
Response: { 
  output: string, 
  exitCode: number,
  error?: string 
}
```

### AI问答

```
POST /api/ai/chat
Body: { 
  labId: string,
  stepId: number,
  question: string,
  context?: string 
}
Response: { 
  answer: string,
  suggestions?: string[] 
}
```

### 用户进度

```
GET  /api/progress/:labId         # 获取进度
POST /api/progress/:labId         # 更新进度
```

---

## 核心交互流程

```
┌─────────────────────────────────────────────────────────────┐
│                      用户进入实验                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GET /api/labs/:labId                                       │
│  返回实验手册全部步骤数据                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  前端渲染第1步内容                                           │
│  - 显示说明文字、代码块、图片                                 │
│  - 显示快捷问题标签                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  用户操作                                                    │
│  - 执行代码 → POST /api/environment/execute                 │
│  - 提问 → POST /api/ai/chat                                 │
│  - 点击 Continue → POST /api/labs/:labId/verify             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  验证结果                                                    │
│  - 通过 → 解锁下一步，更新进度                               │
│  - 失败 → 显示错误提示，AI辅助排查                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 前端组件改造计划

### AgentWidget.tsx 改造

```typescript
// 新增 Props
interface AgentWidgetProps {
  labId: string;
  environmentId: string;
  onComplete?: () => void;
}

// 新增状态
const [lab, setLab] = useState<Lab | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

// 新增方法
const fetchLab = async (labId: string) => { ... }
const verifyStep = async (stepId: number) => { ... }
const executeCommand = async (command: string) => { ... }
const askQuestion = async (question: string) => { ... }
```

### CodeBlock.tsx 改造

```typescript
// 新增 Props
interface CodeBlockProps {
  // ... 现有
  executable?: boolean;
  onExecute?: (code: string) => Promise<ExecuteResult>;
}

// 新增执行结果显示
{executeResult && (
  <div className="terminal-output">
    <pre>{executeResult.output}</pre>
  </div>
)}
```

---

## 后端项目结构

```
lab-agent-server/
├── src/
│   ├── controllers/
│   │   ├── labController.ts
│   │   ├── verifyController.ts
│   │   ├── executeController.ts
│   │   └── aiController.ts
│   ├── services/
│   │   ├── labService.ts
│   │   ├── verificationService.ts
│   │   ├── dockerService.ts      # Docker API 交互
│   │   └── qwenService.ts        # 通义千问 API
│   ├── models/
│   │   ├── lab.ts
│   │   ├── step.ts
│   │   └── userProgress.ts
│   ├── routes/
│   │   └── index.ts
│   └── app.ts
├── labs/                         # 实验手册 YAML/JSON 文件
│   ├── linux-basics.yaml
│   └── docker-intro.yaml
├── package.json
└── tsconfig.json
```

---

## 开发计划

### 第一阶段: MVP - 前端基础 (3-5天)

| 功能 | 状态 | 说明 |
|------|------|------|
| 前端对话渲染组件 | ✅ 已完成 | StructuredContentRenderer |
| 步骤进度条 | ✅ 已完成 | StepProgress.tsx |
| 静态实验手册加载 | ✅ 已完成 | STEPS 常量 |
| 代码块复制功能 | ✅ 已完成 | CodeBlock.tsx |
| 快捷问题标签 | ✅ 已完成 | Chip 组件 |
| 目录导航 | ✅ 已完成 | ToC 菜单 |

**第一阶段结论：前端组件已基本完成，可直接进入第二阶段**

---

### 第二阶段: 后端核心 (1-2周)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 后端框架搭建 | P0 | Express/Fastify + TypeScript |
| MySQL 数据库设计 | P0 | 实验手册表、用户进度表 |
| 实验手册 YAML 解析 | P0 | 读取 YAML 转 JSON |
| SSH 命令执行 | P0 | 连接实验环境执行命令 |
| Continue 验证逻辑 | P0 | 文件检查、命令输出验证 |
| AI 问答集成 | P0 | 通义千问 API 对接 |
| 前端 API 对接 | P1 | 动态加载实验数据 |
| 验证结果 UI | P1 | 成功/失败提示优化 |

---

### 第三阶段: 完善扩展 (1-2周)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Docker 环境自动分配 | P0 | 用户进入时创建容器 |
| 用户进度持久化 | P0 | 保存/恢复学习进度 |
| 实验手册管理后台 | P1 | CRUD 实验手册 |
| 环境回收机制 | P1 | 超时自动销毁容器 |
| 多用户并发 | P2 | 环境隔离 |
| 部署文档 | P2 | Docker Compose 部署 |

---

## 已确认事项

| 事项 | 方案 |
|------|------|
| 实验环境 | 已有 Docker 集成 |
| 用户认证 | 复用现有项目认证 |

---

## LabEx Labby AI 助手特性分析

基于截图，Labby 的核心交互特性：

### 1. 顶部步骤进度条

```
┌─────────────────────────────────────────────────────┐
│  ●━━━━━━━○━━━━━━━○━━━━━━━○━━━━━━━○━━━━━━━○━━━━━━━○  │
│  Step 1   2       3       4       5       6       7  │
└─────────────────────────────────────────────────────┘
```

- 7个步骤的分段进度条
- 当前步骤高亮（蓝色实心）
- 已完成步骤显示完成状态
- 点击可跳转已完成步骤

### 2. 内嵌终端截图

- 对话中直接嵌入 WebIDE 终端截图
- 截图带有完整的 IDE 界面（标签栏、终端输出）
- 帮助用户理解当前环境状态

### 3. 代码块交互

```
┌─────────────────────────────────────────┐
│ bash                            [>] [⧉] │
├─────────────────────────────────────────┤
│ ls                                      │
├─────────────────────────────────────────┤
│ [✨ Explain Code]                       │
└─────────────────────────────────────────┘
```

- 语言标签（bash/python等）
- 右上角：执行按钮 [>]、复制按钮 [⧉]
- 底部：Explain Code 按钮（AI解释代码）

### 4. Continue 验证按钮

- 蓝色主按钮，位于消息底部右侧
- 点击后触发环境验证
- 验证通过才能进入下一步
- 验证失败显示错误提示

### 5. 快捷问题标签

```
[Tell me more]  [What are the key parts of the WebIDE interface?]
```

- 预设问题标签，点击直接提问
- 根据当前步骤动态生成
- 帮助用户快速获取相关信息

### 6. 底部工具栏

```
┌─────────────────────────────────────────┐
│ [? ask]  [💬 feedback]  [⚙ settings]   │
└─────────────────────────────────────────┘
```

- ask: 自由提问入口
- feedback: 反馈按钮
- settings: 设置按钮

### 7. 左上角目录菜单

- 汉堡菜单图标
- 点击展开课程大纲
- 显示所有步骤标题和完成状态

---

## 需要补充的前端功能

对比你现有组件和 Labby，还需要：

| 功能 | 现有状态 | 需要补充 |
|------|----------|----------|
| 终端截图嵌入 | ❌ 缺失 | 支持 image 类型渲染 |
| 代码执行按钮 | ❌ 缺失 | CodeBlock 添加执行功能 |
| 执行结果显示 | ❌ 缺失 | 终端输出区域 |
| 底部工具栏 | ❌ 缺失 | ask/feedback/settings |
| 验证失败提示 | ⚠️ 简单 | 详细错误信息+AI建议 |
| 步骤跳转 | ✅ 有 | 已完成步骤可点击 |

---

## 高还原度实现方案

### CodeBlock 增强

```typescript
interface CodeBlockProps {
  language: string;
  code: string;
  executable?: boolean;      // 是否可执行
  onExecute?: () => void;    // 执行回调
  onExplain?: () => void;    // AI解释回调
  onCopy?: () => void;       // 复制回调
  executeResult?: {          // 执行结果
    output: string;
    exitCode: number;
    error?: string;
  };
}
```

### 验证结果组件

```typescript
interface VerificationResultProps {
  status: 'pending' | 'checking' | 'success' | 'failed';
  message?: string;
  suggestion?: string;  // AI 建议
  onRetry?: () => void;
}
```

### 底部工具栏

```typescript
interface ToolbarProps {
  onAsk: () => void;
  onFeedback: () => void;
  onSettings: () => void;
}
```

---

## 实验手册示例

```yaml
# labs/linux-basics.yaml
id: linux-basics-101
title: Linux 基础入门
description: 学习 Linux 终端基本操作
difficulty: beginner
estimatedTime: 30
tags:
  - linux
  - bash
  - terminal

steps:
  - id: 1
    title: 认识终端
    content:
      - type: text
        text: 欢迎来到 Linux 基础课程！让我们从终端开始。
      - type: text
        text: 终端是与 Linux 系统交互的主要方式。试试输入 `ls` 命令查看当前目录。
      - type: code
        language: bash
        code: ls
        executable: true
    quickQuestions:
      - 什么是终端？
      - ls 命令有什么作用？
    verification:
      type: command_output
      command: ls
      expect: not_empty

  - id: 2
    title: 创建文件
    content:
      - type: text
        text: 使用 `touch` 命令创建一个新文件。
      - type: code
        language: bash
        code: touch hello.txt
        executable: true
      - type: text
        text: 创建完成后，再次运行 `ls` 确认文件已创建。
    quickQuestions:
      - touch 还能做什么？
      - 如何创建多个文件？
    verification:
      type: file_exists
      path: /home/user/hello.txt
```

---

## 总结

现有前端组件 `hero-agent-tutor` 已经具备了良好的 UI 基础，主要工作是：

1. **后端开发** - TS 全栈，实现实验手册解析、环境验证、AI问答
2. **前端对接** - 将静态数据改为动态 API 调用
3. **环境集成** - Docker API 或 SSH 连接实验环境

技术栈确认：**TypeScript 全栈 + 通义千问**

---

## MySQL 数据库表结构

### labs 实验手册表

```sql
CREATE TABLE labs (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  estimated_time INT DEFAULT 30 COMMENT '预计时长(分钟)',
  tags JSON COMMENT '标签数组',
  cover_image VARCHAR(500) COMMENT '封面图',
  is_published TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### lab_steps 实验步骤表

```sql
CREATE TABLE lab_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lab_id VARCHAR(64) NOT NULL,
  step_order INT NOT NULL COMMENT '步骤顺序',
  title VARCHAR(255) NOT NULL,
  content JSON NOT NULL COMMENT 'ContentBlock数组',
  quick_questions JSON COMMENT '快捷问题数组',
  verification JSON COMMENT '验证规则',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  UNIQUE KEY uk_lab_step (lab_id, step_order)
);
```

### user_progress 用户进度表

```sql
CREATE TABLE user_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lab_id VARCHAR(64) NOT NULL,
  environment_id VARCHAR(64) COMMENT 'Docker容器ID',
  current_step INT DEFAULT 1,
  completed_steps JSON DEFAULT '[]' COMMENT '已完成步骤ID数组',
  chat_history JSON DEFAULT '[]' COMMENT '对话历史',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (lab_id) REFERENCES labs(id),
  UNIQUE KEY uk_user_lab (user_id, lab_id)
);
```

---

## 通义千问 API 集成

> 基于阿里云百炼平台最新 API 文档（2025年1月更新）

### API 概述

通义千问支持两种调用协议：
1. **OpenAI 兼容协议** - 推荐，可直接使用 OpenAI SDK
2. **DashScope 原生协议** - 阿里云原生 SDK

本项目采用 **OpenAI 兼容协议**，便于后续切换其他模型。

### 环境变量

```env
# 通义千问 API 配置
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 可用模型列表

| 模型名称 | 说明 | 推荐场景 |
|---------|------|---------|
| qwen-plus | 商业版，效果好 | 复杂问答、代码解释 |
| qwen-turbo | 商业版，速度快 | 简单问答、实时交互 |
| qwen-max | 商业版，最强 | 复杂推理 |
| qwen-long | 长文本处理 | 文档理解 |

### 安装依赖

```bash
npm install openai
```

### qwenService.ts 完整实现

```typescript
import OpenAI from 'openai';

// 初始化 OpenAI 客户端（兼容通义千问）
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

// ============ 类型定义 ============

interface ChatRequest {
  labId: string;
  stepId: number;
  question: string;
  context?: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ChatResponse {
  answer: string;
  suggestions?: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChatOptions {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

// ============ 非流式问答 ============

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(req.labId, req.stepId, req.context);
  
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  
  // 添加历史对话（多轮对话支持）
  if (req.chatHistory) {
    messages.push(...req.chatHistory);
  }
  
  messages.push({ role: 'user', content: req.question });

  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen-plus',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  const answer = completion.choices[0]?.message?.content || '抱歉，我无法回答这个问题。';

  return {
    answer,
    suggestions: generateSuggestions(req.question),
    usage: completion.usage ? {
      prompt_tokens: completion.usage.prompt_tokens,
      completion_tokens: completion.usage.completion_tokens,
      total_tokens: completion.usage.total_tokens,
    } : undefined,
  };
}

// ============ 流式问答（推荐） ============

export async function chatStream(
  req: ChatRequest,
  options: StreamChatOptions
): Promise<void> {
  const systemPrompt = buildSystemPrompt(req.labId, req.stepId, req.context);
  
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  
  if (req.chatHistory) {
    messages.push(...req.chatHistory);
  }
  
  messages.push({ role: 'user', content: req.question });

  try {
    const stream = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || 'qwen-plus',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        options.onChunk(content);
      }
    }
    
    options.onComplete(fullText);
  } catch (error) {
    options.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============ 代码解释功能 ============

export async function explainCode(code: string, language: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen-plus',
    messages: [
      {
        role: 'system',
        content: '你是一个代码解释助手，请用简洁易懂的中文解释以下代码的作用。分点说明代码的功能和关键步骤。'
      },
      {
        role: 'user',
        content: `请解释这段 ${language} 代码：\n\`\`\`${language}\n${code}\n\`\`\``
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content || '无法解释此代码。';
}

// ============ 流式代码解释 ============

export async function explainCodeStream(
  code: string,
  language: string,
  options: StreamChatOptions
): Promise<void> {
  try {
    const stream = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是一个代码解释助手，请用简洁易懂的中文解释以下代码的作用。分点说明代码的功能和关键步骤。'
        },
        {
          role: 'user',
          content: `请解释这段 ${language} 代码：\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
    });

    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        options.onChunk(content);
      }
    }
    
    options.onComplete(fullText);
  } catch (error) {
    options.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============ 验证失败时的 AI 辅助建议 ============

export async function getVerificationHelp(
  verification: { type: string; details?: string },
  errorMessage: string,
  stepContext: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen-plus',
    messages: [
      {
        role: 'system',
        content: `你是一个编程教学助手，用户在完成实验步骤时遇到了验证失败的问题。
请根据错误信息，给出简洁明了的解决建议。
当前步骤内容：${stepContext}`
      },
      {
        role: 'user',
        content: `验证类型：${verification.type}
错误信息：${errorMessage}
${verification.details ? `详细信息：${verification.details}` : ''}

请告诉我可能的原因和解决方法。`
      }
    ],
    temperature: 0.5,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content || '请检查您的操作是否正确，或联系助教获取帮助。';
}

// ============ 辅助函数 ============

function buildSystemPrompt(labId: string, stepId: number, context?: string): string {
  return `你是一个编程教学助手，正在帮助用户完成实验课程。
当前实验ID: ${labId}
当前步骤: ${stepId}
${context ? `上下文信息: ${context}` : ''}

请用简洁友好的语言回答用户问题。如果涉及代码，请给出示例并解释。
如果用户的问题与当前实验步骤相关，请结合步骤内容给出针对性的回答。`;
}

function generateSuggestions(question: string): string[] {
  // 根据问题类型生成相关建议问题
  const suggestions: string[] = [];
  
  if (question.includes('命令') || question.includes('command')) {
    suggestions.push('这个命令还有什么常用参数？');
    suggestions.push('有没有类似功能的其他命令？');
  } else if (question.includes('错误') || question.includes('error')) {
    suggestions.push('如何避免这个错误？');
    suggestions.push('还有其他可能的原因吗？');
  } else {
    suggestions.push('能详细解释一下吗？');
    suggestions.push('有没有其他方法？');
    suggestions.push('能给个具体例子吗？');
  }
  
  return suggestions.slice(0, 3);
}
```

### Express 路由集成示例

```typescript
// routes/ai.ts
import { Router, Request, Response } from 'express';
import { chat, chatStream, explainCode, explainCodeStream, getVerificationHelp } from '../services/qwenService';

const router = Router();

// 非流式问答
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { labId, stepId, question, context, chatHistory } = req.body;
    const result = await chat({ labId, stepId, question, context, chatHistory });
    res.json(result);
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: '问答服务暂时不可用，请稍后重试' });
  }
});

// 流式问答（SSE）
router.post('/chat/stream', async (req: Request, res: Response) => {
  const { labId, stepId, question, context, chatHistory } = req.body;
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  await chatStream(
    { labId, stepId, question, context, chatHistory },
    {
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onComplete: (fullText) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', content: fullText })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
      },
    }
  );
});

// 代码解释
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { code, language } = req.body;
    const explanation = await explainCode(code, language);
    res.json({ explanation });
  } catch (error) {
    console.error('Code explain error:', error);
    res.status(500).json({ error: '代码解释服务暂时不可用' });
  }
});

// 流式代码解释（SSE）
router.post('/explain/stream', async (req: Request, res: Response) => {
  const { code, language } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  await explainCodeStream(code, language, {
    onChunk: (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    },
    onComplete: (fullText) => {
      res.write(`data: ${JSON.stringify({ type: 'complete', content: fullText })}\n\n`);
      res.end();
    },
    onError: (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    },
  });
});

// 验证失败帮助
router.post('/verification-help', async (req: Request, res: Response) => {
  try {
    const { verification, errorMessage, stepContext } = req.body;
    const help = await getVerificationHelp(verification, errorMessage, stepContext);
    res.json({ suggestion: help });
  } catch (error) {
    console.error('Verification help error:', error);
    res.status(500).json({ error: '无法获取帮助建议' });
  }
});

export default router;
```

### 前端流式调用示例

```typescript
// 前端调用流式 API
async function askQuestionStream(
  question: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void
) {
  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      labId: currentLabId,
      stepId: currentStepId,
      question,
      chatHistory,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'chunk') {
            fullText += data.content;
            onChunk(data.content);
          } else if (data.type === 'complete') {
            onComplete(fullText);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}
```

### API 参数说明

| 参数 | 类型 | 必选 | 说明 |
|-----|------|-----|------|
| model | string | 是 | 模型名称，如 qwen-plus |
| messages | array | 是 | 对话消息数组 |
| temperature | float | 否 | 采样温度 0-2，默认 0.7 |
| max_tokens | integer | 否 | 最大输出 token 数 |
| stream | boolean | 否 | 是否流式输出，默认 false |
| stream_options | object | 否 | 流式配置，如 include_usage |
| top_p | float | 否 | 核采样阈值 0-1 |
| presence_penalty | float | 否 | 重复惩罚 -2 到 2 |

### 错误处理

```typescript
// 常见错误码处理
function handleApiError(error: any): string {
  const code = error?.code || error?.status;
  
  switch (code) {
    case 'InvalidApiKey':
      return 'API Key 无效，请检查配置';
    case 'Throttling':
      return '请求过于频繁，请稍后重试';
    case 'QuotaExhausted':
      return 'API 配额已用完';
    case 'ModelNotFound':
      return '模型不存在，请检查模型名称';
    default:
      return '服务暂时不可用，请稍后重试';
  }
}
```

---

## 验证服务实现

### verificationService.ts

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  path?: string;
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  port?: number;
  script?: string;
}

interface VerifyResult {
  success: boolean;
  message: string;
  details?: string;
}

export async function verify(
  containerId: string,
  verification: Verification
): Promise<VerifyResult> {
  try {
    switch (verification.type) {
      case 'file_exists':
        return await verifyFileExists(containerId, verification.path!);
      
      case 'command_output':
        return await verifyCommandOutput(
          containerId,
          verification.command!,
          verification.expect!,
          verification.value
        );
      
      case 'service_running':
        return await verifyServiceRunning(containerId, verification.port!);
      
      case 'custom':
        return await verifyCustomScript(containerId, verification.script!);
      
      default:
        return { success: false, message: '未知的验证类型' };
    }
  } catch (error) {
    return {
      success: false,
      message: '验证执行失败',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyFileExists(containerId: string, path: string): Promise<VerifyResult> {
  const { stdout } = await execAsync(
    `docker exec ${containerId} test -f ${path} && echo "exists" || echo "not_found"`
  );
  
  const exists = stdout.trim() === 'exists';
  return {
    success: exists,
    message: exists ? '文件已创建' : `文件 ${path} 不存在`,
  };
}

async function verifyCommandOutput(
  containerId: string,
  command: string,
  expect: string,
  value?: string
): Promise<VerifyResult> {
  const { stdout } = await execAsync(`docker exec ${containerId} ${command}`);
  const output = stdout.trim();
  
  let success = false;
  switch (expect) {
    case 'not_empty':
      success = output.length > 0;
      break;
    case 'contains':
      success = output.includes(value || '');
      break;
    case 'equals':
      success = output === value;
      break;
    case 'regex':
      success = new RegExp(value || '').test(output);
      break;
  }
  
  return {
    success,
    message: success ? '验证通过' : '命令输出不符合预期',
    details: output,
  };
}

async function verifyServiceRunning(containerId: string, port: number): Promise<VerifyResult> {
  const { stdout } = await execAsync(
    `docker exec ${containerId} netstat -tlnp 2>/dev/null | grep :${port} || echo "not_running"`
  );
  
  const running = !stdout.includes('not_running');
  return {
    success: running,
    message: running ? `服务已在端口 ${port} 运行` : `端口 ${port} 没有服务运行`,
  };
}

async function verifyCustomScript(containerId: string, script: string): Promise<VerifyResult> {
  const { stdout, stderr } = await execAsync(`docker exec ${containerId} bash -c "${script}"`);
  
  return {
    success: !stderr,
    message: stderr ? '脚本执行失败' : '验证通过',
    details: stdout || stderr,
  };
}
```

---

## 开发检查清单

### 第二阶段开发任务

- [ ] 初始化 Node.js + TypeScript 项目
- [ ] 配置 MySQL 连接 (mysql2/promise)
- [ ] 创建数据库表结构
- [ ] 实现 labService (CRUD)
- [ ] 实现 verificationService
- [ ] 实现 qwenService
- [ ] 实现 dockerService (exec命令)
- [ ] 编写 API 路由
- [ ] 前端对接 API
- [ ] 测试完整流程

### 前端改造任务

- [ ] AgentWidget 添加 API 调用
- [ ] CodeBlock 添加执行按钮
- [ ] 添加执行结果显示区域
- [ ] 添加验证失败详细提示
- [ ] 添加底部工具栏
