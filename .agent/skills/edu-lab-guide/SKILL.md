---
name: edu-lab-guide
description: Agent EDU Lab 平台导航与功能引导。当用户询问如何使用平台、某个功能在哪里、如何启动实训环境、如何查看课程进度、学生/教师工作流是什么时触发。帮助开发者快速理解平台架构、路由结构和核心模块。
---

# Agent EDU Lab — 平台导航与功能引导

## 目标

帮助开发者和用户快速理解 Agent EDU Lab 的平台架构，解释功能模块位置，以及指导完成常见操作流程。

## 平台架构概述

Agent EDU Lab 是一个 AI 智能体教育实训平台，由以下三端组成：

- **EDU_Frontend**：React + TypeScript + Vite，使用 TailwindCSS + Lucide Icons
- **EDU_Backend**：Node.js + Express + TypeORM + MySQL
- **云端实训环境**：基于 Docker 的容器化工作区

## 路由结构（前端）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 Landing Page | 平台介绍，三类用户价值展示 |
| `/study` | 学习中心 | 课程列表与技能路径 |
| `/lesson/:id` | 理论课页面 | 多格式资料渲染 + Dify AI 助教 |
| `/lab` | 实训环境页面 | 云端工作区（Desktop/Terminal/IDE/CLI） |
| `/projects` | 项目实战 | 项目列表与详情 |
| `/projects/:id` | 项目详情 | 按单元推进，直达实训环境 |
| `/ai-square` | AI 广场 | 主流 AI 工具与模型展示 |
| `/openclaw/*` | OpenClaw 实训 | Agent 工作流四态可视化 |
| `/openclaw/idle` | 场景选择 | 浏览和选择工作场景 |
| `/openclaw/thinking` | 思考中 | AI 对话 + 提示词引擎 |
| `/openclaw/executing` | 执行中 | 执行日志 + 监控面板 |
| `/openclaw/completed` | 完成态 | 产出物展示 + 流程回顾 |
| `/profile` | 个人中心 | 学习档案与进度 |
| `/admin` | 管理后台 | 课程管理与数据看板（需权限） |

## 关键全局组件

- `Navbar`：顶部导航栏
- `GuideHub`：左下角浮动向导，帮助新用户 3 分钟上手
- `AgentWidget`：全局 AI 对话 Widget（懒加载，基于 Qwen）
- `BackToTop`：返回顶部按钮

## OpenClaw 实训模块

### 组件结构

```
src/components/openclaw/
├── OpenClawPage.tsx         # 主页面（四态路由 + 状态管理）
├── OpenClawViews.tsx        # 四态视图组件（IdleDesktop, RunningDesktop, ApprovalObservabilityWorkspace, CompletedWorkspace）
├── OpenClawPanels.tsx       # 右侧面板（IdleProcessPanel, RunningProcessPanel, MetricBlock, MetricLite）
├── PromptEnginePanel.tsx    # 提示词增强引擎
├── OpenClawGuide.tsx        # 四步使用向导
├── constants.ts             # 场景配置、会话元数据
├── types.ts                 # SessionState 等类型
└── chat/                    # 聊天交互子组件
    ├── AnimatedOrb.tsx      # 流光 AI 头像
    ├── AnalysisWordSpan.tsx # 逐字模糊浮现动画
    ├── ChatMarkdownRenderer.tsx  # 流式 Markdown 渲染
    └── AudioWaveform.tsx    # 语音波形可视化
```

### 后端服务

| 服务 | 文件 | 职责 |
|------|------|------|
| OpenclawViewService | `services/OpenclawViewService.ts` | 三态数据聚合（思考/执行/完成） |
| OpenClawClient | `services/OpenClawClient.ts` | OpenClaw Agent HTTP 通信 |
| FeishuClient | `services/FeishuClient.ts` | 飞书消息收发 + 事件回调 |
| OpenclawViewController | `controllers/OpenclawViewController.ts` | REST API 端点 |

### API 路由

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/openclaw-view/thinking` | GET | 获取思考态数据（飞书消息） |
| `/api/openclaw-view/executing` | GET | 获取执行态数据（事件日志） |
| `/api/openclaw-view/completed` | GET | 获取完成态数据（产出物） |
| `/api/openclaw-view/chat` | POST | 发送消息到 Agent |
| `/api/integration/feishu/event` | POST | 飞书事件回调 |

### 数据轮询策略

- `thinking`: 每 8 秒轮询飞书消息
- `executing`: 每 6 秒轮询执行事件
- `completed`: 每 12 秒轮询产出物

## 学生标准使用流程

1. 登录 → 进入学习中心 `/study`
2. 选择技能方向（如 Dify 实战）
3. 进入理论课 `/lesson/:id`，与 AI 助教互动
4. 进入实训课 `/lab`，AI 教师逐步引导操作
5. 完成课时 → 进入项目实战 `/projects`
6. OpenClaw 实训 → 场景选择 → 思考 → 执行 → 完成

## 常见问题处理步骤

**问题：实训环境无法启动**
1. 检查用户是否已登录
2. 检查后端 Docker 服务是否正常运行：`docker ps`
3. 查看后端日志：`cd EDU_Backend && npm run dev`
4. 确认环境变量 `.env` 已正确配置

**问题：Dify 助教不响应**
1. 检查 `EDU_Frontend/.env` 中 `VITE_DIFY_BASE_URL` 和 `VITE_DIFY_CHATBOT_TOKEN`
2. 测试 Dify 服务连通性
3. 查看浏览器控制台是否有 CORS 错误

**问题：课程数据不显示**
1. 运行种子脚本：`cd EDU_Backend && npm run seed:courses`
2. 确认数据库连接正常
3. 检查 API 路由 `/api/courses` 响应

**问题：OpenClaw 对话无回复**
1. 检查 `EDU_Backend/.env` 中飞书配置：`FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_CHAT_ID`, `FEISHU_BOT_OPEN_ID`
2. 验证飞书 App 的 Bot 权限是否已开启（消息收发权限）
3. 检查 OpenClaw Agent 服务是否可达：`OPENCLAW_BASE_URL`
4. 查看后端日志中 `FeishuClient` 或 `OpenclawViewService` 的错误信息

**问题：OpenClaw 执行态无数据**
1. 确认 Agent 已处于执行阶段（需先从思考态进入）
2. 检查 `OpenClawClient` 连接状态
3. 查看轮询接口 `/api/openclaw-view/executing` 的响应

## 开发环境启动

```bash
# 后端
cd EDU_Backend
npm install
npm run dev

# 前端
cd EDU_Frontend
npm install
npm run dev
```

## 环境变量

### 后端 `.env`
```
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=***
DB_DATABASE=edu_lab
FEISHU_APP_ID=***
FEISHU_APP_SECRET=***
FEISHU_CHAT_ID=***
FEISHU_BOT_OPEN_ID=***
OPENCLAW_BASE_URL=***
QWEN_API_KEY=***
```

### 前端 `.env`
```
VITE_API_BASE_URL=http://localhost:3001
VITE_DIFY_BASE_URL=***
VITE_DIFY_CHATBOT_TOKEN=***
VITE_OPENCLAW_SESSION_ID=***
```

## 注意事项

- 实训环境需要 Docker 已安装并运行
- Dify 需要独立部署或使用云端服务
- 管理后台需要 Admin 权限账号
- OpenClaw 功能需要飞书 App 和 OpenClaw Agent 服务都可用
- 后端新增依赖：`@larksuiteoapi/node-sdk`（飞书 SDK）、`tweetnacl`（签名验证）

