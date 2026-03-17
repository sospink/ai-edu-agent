# Agent EDU Lab

> AI 智能体教育实训平台 — 让 AI 教育从「讲知识」升级为「练能力」

---

## 📌 项目简介

Agent EDU Lab 是面向 AI 智能体开发方向的教育实训平台，将课程学习、云端实验环境、AI 教师辅助和项目实战整合为统一闭环，帮助学生从「看懂理论」到「独立完成工程任务」。

## ✨ 核心能力

- **云端实训环境**：Desktop / Terminal / CLI Agent / WebIDE 四环境一键拉起，零配置
- **AI 教师引导**：课时感知、步骤引导、结果验证、进度推进
- **OpenClaw Agent 实训**：四阶段全流程 Agent 工作流可视化（Markdown 富文本渲染 + 企业级监控面板）
- **课程 + 项目双引擎**：体系化知识 + 工程级实战
- **多格式内容支持**：Markdown / PDF / Word 统一渲染
- **提示词增强引擎**：内置多种 Prompt 优化策略

---

## 📦 功能模块与开发进度

| 模块 | 状态 | 说明 |
|:-----|:----:|:-----|
| 首页 Landing | ✅ 完成 | 产品展示、价值传达、CTA 入口 |
| 用户系统 | ✅ 完成 | 注册 / 登录 / 角色权限 |
| 学习中心 | ✅ 完成 | 技能列表 → 课程详情 → 阶段/课时浏览 |
| 理论课 | ✅ 完成 | 多格式资料阅读 + Dify AI 助教（课时上下文驱动） |
| 实训环境 | ✅ 完成 | 云端 Docker 四环境（Desktop/Terminal/CLI/WebIDE）+ AI 步骤引导验证 |
| 项目实战 | ✅ 完成 | 标签筛选 → 项目详情 → 单元实训直达 |
| AI 广场 | ✅ 完成 | 主流 AI 模型/工具生态展示 |
| 个人中心 | ✅ 完成 | 学习档案、进度记录 |
| 管理后台 | ✅ 完成 | 课程管理、用户管理、学情数据 |
| 向导系统 | ✅ 完成 | 首页向导 + OpenClaw 四步向导 |
| OpenClaw 实训 | ✅ 完成 | 场景选择 → 思考中 → 执行中 → 完成态 |
| 文档站 | ✅ 完成 | 核心概念 + 学习中心/OpenClaw 使用教程 |

---

## 🛠 技术栈

**前端**
- React 18 + TypeScript + Vite
- TailwindCSS + Framer Motion
- react-markdown + remark-gfm（Markdown 富文本渲染）
- Three.js（粒子波纹背景）
- Lucide Icons

**后端**
- Express + TypeScript + TypeORM
- MySQL 8
- Docker API（容器管理）
- WebSocket（终端会话）

**AI 集成**
- Dify 工作流引擎（课时感知 AI 教师）
- 通义千问 Qwen（全局 AI 对话 + 提示词引擎）
- 飞书 Bot SDK（OpenClaw Agent 通信）

---

## 📂 项目结构

```
ai-edu-agent/
├── EDU_Frontend/                # 前端 (React + Vite)
│   ├── src/components/         # 14 个组件目录
│   │   ├── openclaw/           #   OpenClaw 实训（核心模块）
│   │   ├── study/              #   学习中心 + 实训环境
│   │   ├── project/            #   项目实战
│   │   ├── agent/              #   AI 助手组件
│   │   ├── ai-square/          #   AI 广场
│   │   ├── docs/               #   文档站渲染
│   │   ├── guide/              #   向导系统
│   │   ├── home/               #   首页
│   │   ├── auth/               #   认证
│   │   ├── admin/              #   管理后台
│   │   ├── profile/            #   个人中心
│   │   ├── layout/             #   布局组件
│   │   ├── common/             #   通用组件
│   │   └── ui/                 #   UI 基础组件
│   ├── src/services/           # API 服务层
│   └── src/styles/             # CSS + 动画
├── EDU_Backend/                 # 后端 (Express + TypeORM)
│   ├── src/routes/             # 14 个路由模块
│   ├── src/controllers/        # 10 个控制器
│   ├── src/services/           # 11 个服务（含 LabService 容器管理）
│   └── src/models/             # 19 个数据模型
├── Agent/                       # 五门课程理论教材与实训材料
│   ├── ADE配置与智能体开发/
│   ├── MCPServer开发/
│   ├── 提示词工程/
│   ├── 智能体框架与开发/
│   └── 安全与合规/
├── deploy/                      # 部署配置（Nginx + 构建脚本）
├── scripts/                     # 脚本工具（一键构建部署包等）
├── knowledge-base-docs/         # AI 知识库文档（Dify 助教知识源）
├── 课程手册/                    # 课程内容模板与规范
├── 项目手册/                    # 项目实训手册
├── 项目课程的环境开发/           # OpenClaw 实训 Docker 环境开发
└── 环境开发/                    # 云端实训环境（Dockerfile + 脚本）
```

---

## 🚀 本地开发

### 环境要求
- Node.js >= 18
- MySQL 8.x
- Docker（实训环境）

### 启动前端
```bash
cd EDU_Frontend
npm install
npm run dev
```

### 启动后端
```bash
cd EDU_Backend
npm install
npm run dev
```

### 环境变量

后端 `.env`：
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

前端 `.env`：
```
VITE_API_BASE_URL=http://localhost:3001
VITE_DIFY_BASE_URL=***
VITE_DIFY_CHATBOT_TOKEN=***
VITE_OPENCLAW_SESSION_ID=***
```

---

## 🚢 部署

### 一键构建部署包
```bash
node scripts/build-deploy.js
```

### 部署步骤
1. 编辑 `dist-deploy/backend/.env.example` → `.env`
2. 放入 Docker 证书到 `dist-deploy/backend/conf/`
3. 上传 `dist-deploy` 到服务器
4. 运行: `sudo ./deploy.sh`

> 更新部署时，只需替换前后端打包文件并重启服务，无需安装额外依赖。

---

## 📋 更新日志

### v2.2（2026-03-17）

**🐛 Bug 修复**
- **修复 WebIDE 不显示**：学习中心实训页面 WebIDE Tab 缺失，根因是 IDE 独立容器（`gitpod/openvscode-server`）创建失败后 `idePort` 被静默置 0，导致前端无法渲染 WebIDE Tab
- **修复 Docker 端口冲突**：端口分配仅查询 RUNNING 状态会话，遗漏 CREATING 状态导致端口重复分配（`port already allocated`）。改为统一端口池 + Docker API 双重校验
- **修复 iframe 加载逻辑**：优化 IframeContent 组件的 `onLoad`/`onError` 处理，移除误判正常页面为错误页面的快速加载检测逻辑

**🔧 架构优化**
- 实训环境端口分配重构：统一 Set 查重 + Docker 层面实际占用检测，彻底避免端口冲突
- 停止会话时同步清理独立 IDE 容器，防止容器泄漏
- 清理冗余目录和文件，精简项目结构

### v2.1（2026-03-17）

- ✅ OpenClaw 执行日志企业产品化重构（去除边框线，白色卡片 + 微阴影）
- ✅ 实时决策分析卡片重构
- ✅ 文档站集成使用教程（学习中心 + OpenClaw）
- ✅ 提示词引擎增强（Markdown 预览/编辑切换 + 复制反馈）

### v2.0（2026-03-16）

- ✅ OpenClaw 实训案例全栈开发完成（后端飞书对接 + Agent 通信 + 前端四态页面）
- ✅ 思考中对话界面 Premium 级 UI（AnimatedOrb + 流式文字 + 语音 + Markdown 渲染）
- ✅ 执行日志 Agent 回复折叠式展开
- ✅ 产品文档体系建设

---

*Agent EDU Lab — 让教学从「讲内容」升级为「可执行、可验证、可复盘」的实训闭环。*
