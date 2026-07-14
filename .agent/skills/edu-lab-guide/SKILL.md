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
- **EDU_Backend_Go**：Go + Gin + GORM + MySQL，当前主后端
- **EDU_Backend**：Node.js 历史后端，仅用于契约参考
- **云端实训环境**：基于 Kubernetes Classic Lab 的容器化工作区

## 路由结构（前端）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 Landing Page | 平台介绍，三类用户价值展示 |
| `/study` | 学习中心 | 课程列表与技能路径 |
| `/lesson/:id` | 理论课页面 | 多格式资料渲染 + Dify AI 助教 |
| `/lab` | 实训环境页面 | 云端工作区（Desktop/Terminal/IDE/CLI） |
| `/projects` | 项目实战 | 项目列表与详情 |
| `/projects/:slug` | 项目详情 | 按单元推进，直达 Classic Lab 实训环境 |
| `/ai-square` | AI 广场 | 主流 AI 工具与模型展示 |
| `/profile` | 个人中心 | 学习档案与进度 |
| `/admin` | 管理后台 | 课程管理与数据看板（需权限） |

## 关键全局组件

- `Navbar`：顶部导航栏
- `GuideHub`：左下角浮动向导，帮助新用户 3 分钟上手
- `AgentWidget`：全局 AI 对话 Widget（懒加载，基于 Qwen）
- `BackToTop`：返回顶部按钮

## 学生标准使用流程

1. 登录 → 进入学习中心 `/study`
2. 选择技能方向（如 Dify 实战）
3. 进入理论课 `/lesson/:id`，与 AI 助教互动
4. 进入实训课 `/lab`，AI 教师逐步引导操作
5. 完成课时 → 进入项目实战 `/projects`
6. 进入项目单元 → 启动 Classic Lab → 使用 Desktop / Terminal / IDE 完成实训

## 常见问题处理步骤

**问题：实训环境无法启动**
1. 检查用户是否已登录
2. 检查运行命名空间中的 Pod / Service：`kubectl get pod,svc -n <runtime-namespace>`
3. 查看 Go 后端日志与 `/api/health`
4. 确认 K8S kubeconfig、运行命名空间和镜像仓库配置正确

**问题：Dify 助教不响应**
1. 检查 `EDU_Frontend/.env` 中 `VITE_DIFY_BASE_URL` 和 `VITE_DIFY_CHATBOT_TOKEN`
2. 测试 Dify 服务连通性
3. 查看浏览器控制台是否有 CORS 错误

**问题：课程数据不显示**
1. 检查 `/api/courses` 和 `/api/learning/*` 响应
2. 确认数据库连接正常
3. 核对课程发布状态和当前用户权限

## 开发环境启动

```bash
# 后端
cd EDU_Backend_Go
go run ./cmd/server

# 前端
cd EDU_Frontend
npm install
npm run dev
```

## 环境变量

### 后端 `.env`
```
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=***
DATABASE_NAME=edu_lab
K8S_ENABLED=true
K8S_RUNTIME_NAMESPACE=edu-runtime-dev
K8S_KUBECONFIG=.kube/config
QWEN_API_KEY=***
```

### 前端 `.env`
```
VITE_API_BASE_URL=http://localhost:4000
VITE_DIFY_BASE_URL=***
VITE_DIFY_CHATBOT_TOKEN=***
```

## 注意事项

- 实训环境需要 Kubernetes API、运行命名空间和镜像仓库可用
- Dify 需要独立部署或使用云端服务
- 管理后台需要 Admin 权限账号
- Classic Lab 需要 Kubernetes 集群、镜像仓库和 noVNC / terminal 运行时可用
