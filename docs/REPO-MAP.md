# REPO MAP

## 顶层目录作用
### 当前主线
- `EDU_Frontend/`
  - 当前主前端，React + TypeScript + Vite
  - 学生端、教师端、管理端、OpenClaw、Lab 页面都在这里
- `EDU_Backend_Go/`
  - 当前主后端，Go + Gin + GORM + MySQL + K8S
  - 新接口、新运行时、新业务闭环默认进入这里
- `docs/`
  - 当前会话入口文档、架构总览、闭环模板、阶段交付记录、参考资料、归档资料
- `AGENTS.md`
  - 项目约束与完成标准
- `scripts/`
  - 当前部署构建脚本，Go 后端主线后优先看 `build-deploy-go.sh` 与 `deploy-go-prod.sh`

### 参考 / 历史
- `EDU_Backend/`
  - TS 旧后端，作为参考实现
- `deploy/`
  - 部署相关配置
- `dist-deploy/`
  - 部署产物目录

### 课程 / 环境资产
- `Agent/`
  - 理论课程与课程内容资产
- `课程手册/`
  - 课程模板与课程设计规范
- `环境开发/`
  - 历史环境镜像、Docker 构建相关资料
- `项目课程的环境开发/`
  - 项目场景环境开发资产

## 常见开发入口
### 前端
- [../EDU_Frontend/src/App.tsx](../EDU_Frontend/src/App.tsx)
- [../EDU_Frontend/src/components/study](../EDU_Frontend/src/components/study)
- [../EDU_Frontend/src/components/project](../EDU_Frontend/src/components/project)
- [../EDU_Frontend/src/components/openclaw](../EDU_Frontend/src/components/openclaw)
- [../EDU_Frontend/src/components/teacher](../EDU_Frontend/src/components/teacher)
- [../EDU_Frontend/src/components/admin](../EDU_Frontend/src/components/admin)
- [../EDU_Frontend/src/services](../EDU_Frontend/src/services)

### Go 后端
- [../EDU_Backend_Go/internal/router/router.go](../EDU_Backend_Go/internal/router/router.go)
- [../EDU_Backend_Go/internal/domain](../EDU_Backend_Go/internal/domain)
- [../EDU_Backend_Go/internal/transport/http](../EDU_Backend_Go/internal/transport/http)
- [../EDU_Backend_Go/internal/transport/websocket](../EDU_Backend_Go/internal/transport/websocket)
- [../EDU_Backend_Go/configs/app.yaml](../EDU_Backend_Go/configs/app.yaml)
- [../EDU_Backend_Go/deployments/sql](../EDU_Backend_Go/deployments/sql)

## Go 后端领域目录速查

| 目录 | 当前职责 |
| --- | --- |
| `internal/domain/auth` | 登录、登出、refresh、JWT 与 token blacklist |
| `internal/domain/user` | 用户资料、用户管理、学习者榜单 |
| `internal/domain/course` | 课程、阶段、课时、素材、技能、学习记录 |
| `internal/domain/project` | 项目、单元、标签、OpenClaw 分流 |
| `internal/domain/learning` | 学习中心聚合、继续学习、学习成果概览 |
| `internal/domain/agent` | Agent 手册、步骤、问答、验证、FAQ、复盘、学生干预读取 |
| `internal/domain/lab` | K8S Lab session、noVNC proxy、exec、terminal、janitor |
| `internal/domain/openclawview` | OpenClaw 四态视图、消息、文件、Gateway / Feishu 客户端 |
| `internal/domain/classroom` | 学期、班级、成员、任课教师 |
| `internal/domain/publishing` | 发布检查、发布阻断、Lab 模板、发布审计 |
| `internal/domain/assignment` | 作业、提交、评分、通知、工作台、AI 建议、Agent 观察台 |
| `internal/domain/operations` | 资源配额、运行事件、审计日志 |

## 前端三端目录速查

| 目录 | 当前职责 |
| --- | --- |
| `components/study` | 学生学习中心、课时、Lab、作业与通知入口 |
| `components/project` | 项目列表、项目详情、OpenClaw 项目分流入口 |
| `components/openclaw` | OpenClaw 独立页面、四态视图、会话 hook |
| `components/teacher` | 教务端工作台、班级、作业、批改、成绩簿、Agent 观察台 |
| `components/admin` | 管理端仪表盘、班级、作业观测、内容治理、用户、设置、RBAC |
| `components/common` | PageDialog、PageDrawer、Toast、确认弹窗等公共交互组件 |
| `services` | 前端 API 封装，按领域拆分 |

## 什么时候看 TS 后端
只有以下情况默认才去看 `EDU_Backend/`：
- 需要对比历史 API 契约
- 需要迁移旧配置
- 需要查 OpenClaw / Feishu 历史实现细节
- Go 当前行为和前端旧依赖不一致，需要找旧逻辑参考

## 什么时候不要被旧目录带偏
- 需要实现新功能时
- 需要判断当前运行时时
- 需要判断当前页面主链路时
- 需要决定 Dashboard / Lab / OpenClaw 的架构方向时

这些场景都应优先看 `EDU_Backend_Go/` 和 `EDU_Frontend/`。

## 什么时候看 docs

- 新会话上手：先看 [START-HERE.md](START-HERE.md)
- 判断架构事实：看 [ARCHITECTURE.md](ARCHITECTURE.md)
- 判断完成度：看 [PROJECT-STATUS.md](PROJECT-STATUS.md)
- 规划大模块：看 [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
- 判断能否说“完成”：看 [feature-delivery-checklist.md](feature-delivery-checklist.md)
