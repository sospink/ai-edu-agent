# START HERE

这份文档用于帮助新会话在最短时间内进入项目当前真实状态。

## 30 秒结论
- 当前主后端：`EDU_Backend_Go/`
- 当前主前端：`EDU_Frontend/`
- TS 后端 `EDU_Backend/` 是历史参考，不是当前默认开发主线
- Classic Lab 当前运行时是 **K8S**
- OpenClaw 当前走 **独立项目链路**，不是普通 `/lab` 中转
- 项目已从 Demo 过渡为三端实训教学平台，二阶段 M0-M7 均已有首版主链路

## 新会话推荐阅读顺序
1. [../AGENTS.md](../AGENTS.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [PROJECT-STATUS.md](PROJECT-STATUS.md)
4. [REPO-MAP.md](REPO-MAP.md)
5. 视需求补读：
   - [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
   - [../EDU_Frontend/DESIGN.md](../EDU_Frontend/DESIGN.md)
   - [../EDU_Backend_Go/docs/development-progress.md](../EDU_Backend_Go/docs/development-progress.md)
   - [../EDU_Backend_Go/docs/ts-go-parity-matrix.md](../EDU_Backend_Go/docs/ts-go-parity-matrix.md)
   - [../EDU_Backend_Go/internal/router/router.go](../EDU_Backend_Go/internal/router/router.go)
   - [../EDU_Frontend/src/App.tsx](../EDU_Frontend/src/App.tsx)

## 本地启动
### Frontend
```bash
cd EDU_Frontend
npm run dev -- --host 0.0.0.0
```

### Go Backend
```bash
cd EDU_Backend_Go
go run ./cmd/server
```

### 常用检查
```bash
curl -s http://localhost:4000/api/health
```

如果本地没有加载 `EDU_Backend_Go/.env`，Go 样板配置可能监听 `4002`。当前项目默认开发约定仍按本地 `.env` 的 `4000` 对齐前端代理。

## 当前主链路事实
### Classic Lab
- 入口：`/lab`
- 后端：`/api/lab/*`
- 终端：`/ws/terminal`
- 运行时：K8S Pod / Service / exec / proxy

### OpenClaw
- 入口：`/openclaw/*`
- 项目识别：必须带 `OpenClaw` 标签
- 后端：`/api/openclaw-view/*`
- 健康检查：`/api/integrations/openclaw/health`、`/api/integrations/feishu/health`

### Admin Dashboard
- 当前定位：K8S 运行概览工作台
- 不再按 Docker 运维台方式理解

### Teaching Platform
- 教师端：`/teacher/classes`、`/teacher/assignments`、`/teacher/submissions`、`/teacher/grades`、`/teacher/agent-observatory`
- 学生端：`/study` 中的班级、作业、通知、学习成果概览和提交反馈
- 管理端：`/admin/dashboard`、`/admin/classes`、`/admin/assignments`、`/admin/content-governance`
- AI 辅助：教师确认后才进入反馈、FAQ 或学生可见内容，不自动替代教师评分

## 每次实现前必须记住
- 先判断需求属于 L1 / L2 / L3 哪一层
- 先列最小闭环，再开始改代码
- 未覆盖最小闭环时，不能在最终回复里说“已完成”
- 默认参考 [feature-delivery-checklist.md](feature-delivery-checklist.md)
- 二阶段业务模块默认参考 [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)，按教师端 / 学生端 / 管理端 / 后端 / 权限 / 状态 / 验收闭环交付
- 涉及前端页面 / 组件时必须参考 [../EDU_Frontend/DESIGN.md](../EDU_Frontend/DESIGN.md)，保持 HeroUI / Tailwind / Framer Motion / Lucide 与三端视觉边界

## 常见误区
- 不要默认去 `EDU_Backend/` 改新功能
- 不要默认把 Docker 管理面当成当前主目标
- 不要把“数据能展示出来”当成页面完成
- 不要把“接口能返回数据”当成模块完成
- 不要把 `.env`、device identity、前端 token 或本地浏览器调试产物带进 GitHub
