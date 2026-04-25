# EDU_Backend_Go

`EDU_Backend_Go` 是 Agent EDU 当前主后端。旧 `EDU_Backend/` TS 后端只作为历史契约、配置迁移和 OpenClaw / Feishu 细节参考，不再承接新主链路。

## 当前定位

- Web 框架：Gin
- ORM：GORM
- 数据库：MySQL
- 权限：JWT + Casbin + Redis token blacklist
- 运行时：K8S Classic Lab，包含 Pod / Service / noVNC proxy / K8S exec / terminal bridge / janitor
- 外部集成：OpenClaw Gateway、Feishu、Qwen / DashScope
- 业务闭环：认证、课程、项目、学习中心、Agent、Lab、OpenClaw、班级、作业、提交评分、教学工作台、运维治理、AI 助教

## 快速开始

```bash
cd EDU_Backend_Go
go run ./cmd/server
```

本地开发约定地址：

- API: `http://localhost:4000/api`
- Health: `http://localhost:4000/api/health`
- Version: `http://localhost:4000/api/version`
- WebSocket: `ws://localhost:4000/ws/terminal`

说明：

- 当前仓库本地 `.env` 通常覆盖 `PORT=4000`。
- `configs/app.yaml` 仍保留脚手架样板端口 `4002`；如果没有加载 `.env`，实际监听端口以配置加载结果为准。
- 不要提交真实 `.env`、OpenClaw device identity、Feishu / Qwen / DashScope 凭证。

## 常用检查

```bash
go test ./...
```

```bash
curl -s http://localhost:4000/api/health
```

```bash
curl -s http://localhost:4000/api/version
```

## 主要接口分组

| 分组 | 说明 |
| --- | --- |
| `/api/auth/*` | 登录、登出、当前用户、refresh |
| `/api/users/*` | 用户资料与管理员用户管理 |
| `/api/courses/*` | 学生课程主链路与兼容管理入口 |
| `/api/projects/*` | 学生项目主链路与兼容管理入口 |
| `/api/learning/*` | 学习中心聚合、继续学习、学习成果 overview |
| `/api/student/*` | 学生班级、作业、提交、成绩、通知 |
| `/api/teacher/*` | 教师端班级、内容、作业、批改、成绩簿、Agent 观察台 |
| `/api/admin/*` | 管理端用户、班级、作业观测、内容治理、运维、设置、RBAC |
| `/api/lab/*` | K8S Classic Lab 创建、查询、执行、停止、代理 |
| `/ws/terminal` | K8S exec WebSocket 终端桥接 |
| `/api/agent/*` | Agent 手册、步骤验证、问答、进度、FAQ、干预 |
| `/api/openclaw-view/*` | OpenClaw 四态视图、消息发送、文件下载 |
| `/api/integrations/*` | K8S / OpenClaw / Feishu / config / dashboard 兼容观测入口 |

完整路由以 [internal/router/router.go](internal/router/router.go) 为准。

## 领域模块

| 目录 | 职责 |
| --- | --- |
| `internal/domain/auth` | 认证与登录态 |
| `internal/domain/user` | 用户与学习者榜单 |
| `internal/domain/course` | 课程、阶段、课时、素材、技能 |
| `internal/domain/project` | 项目、项目单元、标签、OpenClaw 标签识别 |
| `internal/domain/learning` | 学习中心与学习成果概览 |
| `internal/domain/agent` | Agent 手册、步骤、AI 问答、验证、FAQ、复盘、学生干预读取 |
| `internal/domain/lab` | K8S Lab session、noVNC proxy、exec、stop、janitor |
| `internal/domain/openclawview` | OpenClaw Gateway / Feishu 视图适配 |
| `internal/domain/classroom` | 学期、班级、成员、任课教师 |
| `internal/domain/publishing` | 发布检查、Lab 模板、发布审计 |
| `internal/domain/assignment` | 作业、提交、评分、成绩、通知、教师工作台、AI 建议、Agent 观察台 |
| `internal/domain/operations` | 资源配额、运行事件、审计日志 |

## 数据迁移

生产默认以显式 SQL 迁移为准。关键迁移位于 `deployments/sql/`，包括：

- M1 班级与教学组织
- M2 内容生产与发布
- M3 作业发布
- M4 提交评分
- M5 教学过程工作台
- M6 管理与运维
- M7 AI 助教辅助
- Agent 教学观察台 V1 / V2

本地开发可使用 `DATABASE_AUTO_MIGRATE=true` 辅助调试；生产环境不应依赖自动改表。

## 配置加载

配置来源优先级：

1. 进程环境变量
2. `EDU_Backend_Go/.env`
3. `EDU_Backend/.env` 兼容兜底
4. `configs/app.yaml`

主要配置类别：

- `PORT` / `SERVER_*`
- `MYSQL_*` / `DATABASE_*`
- `JWT_*`
- `K8S_*`
- `OPENCLAW_*`
- `FEISHU_*`
- `QWEN_*` / `DASHSCOPE_API_KEY`

样例见 [.env.example](.env.example)，只提交脱敏样例。

## 运行时边界

- Classic Lab 当前以 K8S 为准，不回退到 Docker 旧管理面。
- OpenClaw 项目不创建 K8S Lab session；由 `openclaw-view` 根据项目 / 单元派生受控 session key。
- `/api/docker/*` 不属于 Go 主链路替代目标。
- 删除、停止、清理类接口应保持幂等，`NotFound` 类资源缺失通常应视为可接受清理状态。

## 参考文档

- [docs/development-progress.md](docs/development-progress.md)
- [docs/ts-go-parity-matrix.md](docs/ts-go-parity-matrix.md)
- [docs/teacher-admin-portal-rbac.md](docs/teacher-admin-portal-rbac.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/PROJECT-STATUS.md](../docs/PROJECT-STATUS.md)
