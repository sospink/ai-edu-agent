# EDU_Backend 升级改造 Plan v2.0

> 项目：EDU 实训平台后端
> 当前后端：`EDU_Backend/`（TypeScript + Express + TypeORM + Dockerode）
> 新后端：`EDU_Backend_Go/`（Go 1.22+，当前本地以 Go 1.26 toolchain 验证）
> 目标技术栈：Gin + GORM v2 + MySQL + Redis + K8S（client-go v0.30）
> 文档版本：v2.0
> 最后更新：2026-04-20

---

## Summary

- 本次不是在 `EDU_Backend/` 内原地迁移，而是保留现有 TS 服务作为参考实现与兜底，新建 `EDU_Backend_Go/`，以 **Go + K8S** 完整重构新后端。
- 开发阶段采用 **双目录并行重构**，不是模块级长期双栈。`EDU_Backend` 负责保持现状可用，`EDU_Backend_Go` 独立开发、独立部署、独立测试。
- 切换策略采用 **先全量验收后整体切换**。在 Go 后端完成核心功能、接口兼容、K8S Lab 跑通之前，前端默认继续连 TS。
- 单节点 K8S 的定位是 **开发测试与功能验收环境**，本计划不把生产容量、高可用、多节点容灾纳入首轮范围。
- 第一优先级不是“重构得更漂亮”，而是 **完整复刻现有产品能力与前端契约**，然后再在 Go 侧补齐架构治理能力。

---

## 目标架构

### 工程边界

- 保留 `EDU_Backend/`
  - 作为现网参考实现、接口行为基线、问题排查对照。
  - 不承接新架构能力演进，只做必要维护和缺陷修复。
- 新建 `EDU_Backend_Go/`
  - 独立 `go.mod`、独立配置、独立 Dockerfile、独立 CI、独立 K8S manifests/Helm Chart。
  - 不与 TS 共用代码、不共享构建流程、不混编部署。
  - 与现有前端对接时，以兼容现有接口行为为前提。

### 建议目录结构

```text
EDU_Backend_Go/
├── cmd/server/main.go
├── configs/
├── deployments/
│   ├── docker/
│   └── k8s/
├── docs/
├── internal/
│   ├── app/
│   ├── config/
│   ├── domain/
│   │   ├── agent/
│   │   ├── auth/
│   │   ├── course/
│   │   ├── lab/
│   │   ├── learning/
│   │   ├── openclawview/
│   │   ├── project/
│   │   ├── upload/
│   │   └── user/
│   ├── infra/
│   │   ├── authz/
│   │   ├── cache/
│   │   ├── database/
│   │   ├── k8s/
│   │   └── logger/
│   ├── middleware/
│   ├── router/
│   └── transport/
│       ├── http/
│       └── websocket/
├── pkg/
│   ├── errors/
│   ├── jwt/
│   ├── pagination/
│   └── response/
├── public/uploads/
└── test/
```

### 技术选型

- Web：Gin
- ORM：GORM v2
- DB：MySQL 8
- Cache：Redis
- K8S：client-go v0.30
- WS：Gorilla WebSocket
- 日志：Zap
- 配置：Viper
- 鉴权：JWT + Casbin
- AI：OpenAI SDK 兼容调用 DashScope/Qwen
- 第三方：飞书 SDK / OpenClaw Gateway RPC

---

## 契约与兼容基线

### 必须保留的外部契约

- 前端 API 前缀继续使用 `/api`。
- JWT payload 继续保持 `{ userId, username, roleType }`。
- `/ws/terminal` 继续保留当前 query 参数：
  - `token`
  - `sessionId`
  - `terminalId`
  - `mode`
  - `command`
  - `sessionPolicy`
  - `transport`
  - `initialCommand`
- `POST /api/agent/chat/stream` 继续使用当前 SSE 约定：
  - 事件体为 `data: {"content":"..."}`
  - 结束标记为 `data: [DONE]`
- `Lab` 接口返回结构继续兼容：
  - `session`
  - `urls.vncUrl`
  - `urls.ideUrl`
  - `urls.sshInfo`
  - `urls.gatewayUrl`
  - `urls.gatewayToken`
  - `runtimeMode`
- `/api/lab/gateway/:sessionId/*` 继续支持 iframe 同源代理语义。
- 对现有“部分接口统一响应、部分接口裸 JSON”的行为逐接口兼容，不在首版强制统一。

### 数据兼容原则

- 现有 MySQL 表结构是唯一真相，Go 首版按现表 1:1 映射。
- 禁止在双栈阶段启用 GORM 自动改表。
- 如 K8S Lab 运行时需要扩展，只允许新增非破坏性字段，例如：
  - `runtime_provider`
  - `runtime_ref`
  - `namespace`
  - `pod_name`
  - `service_name`
- 保留现有业务枚举语义：
  - `roleType`：1 学生 / 2 教师 / 10 管理员
  - `runtimeMode`：1 classic / 2 openclaw
  - 各类状态字段不做前端可见语义调整

---

## 实施阶段

### Phase 0：基线冻结与可实施化准备

**目标**：把“技术愿景文档”补成“可执行重构方案”。

**任务**

- 导出现有 MySQL 全量 DDL，形成 Go 建模基线。
- 盘点现有 19 个模型、14 个路由模块、117 个路由入口。
- 导出当前接口兼容矩阵，覆盖 REST、SSE、WebSocket、Gateway 代理。
- 梳理现有环境变量与第三方依赖，拆分成 App Config、Secret、外部服务接入配置。
- 确认 K8S 开发测试集群接入方式：kubeconfig、namespace 规划、镜像仓库、Ingress / NodePort 方案。

**输出物**

- 接口兼容清单
- 数据库映射文档
- 环境变量清单
- K8S 接入说明
- `EDU_Backend_Go` 初始化脚手架

**验收**

- 团队可基于输出物直接开始 Go 实现，无需再靠阅读 TS 代码猜行为。

### Phase 1：Go 工程基础设施搭建

**目标**：完成新后端可运行的基础骨架。

**任务**

- 初始化 `go.mod` 与工程目录。
- 接入 Gin、GORM、Zap、Viper、JWT、Redis、Casbin、client-go。
- 建立统一中间件：Recovery、请求日志、错误处理、CORS、认证。
- 建立基础能力：配置加载、MySQL 连接池、Redis 连接、JWT 工具、文件上传、静态文件服务。
- 提供基础健康检查与版本信息接口。
- 建立 Docker 构建、Makefile、golangci-lint、基础 CI。

**输出物**

- 可启动的 Go 服务
- 基础配置模板
- 可部署镜像
- K8S Deployment/Service 初版

**验收**

- `make run`、`make test`、`make lint` 可执行。
- 服务在本地和 K8S 开发环境均可启动。
- `/api/health` 可正常访问。

### Phase 2：用户与权限系统重构

**目标**：完成认证、用户、权限基础能力。

**任务**

- 重构模块：`auth`、`user`
- 对齐现有表：`sys_users`
- 实现接口：
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/me`
  - `/api/auth/refresh`
  - `/api/users/*`
- 实现 JWT 兼容签发与验证。
- 引入 Casbin，但仅作为内部授权实现，不改变前端判权依赖。

**验收**

- 前端登录、退出、获取当前用户、管理员用户管理在 Go 环境可用。
- JWT 被前端无感接入。
- 与 TS 行为差异被显式记录并控制在可接受范围。

### Phase 3：课程、项目、学习与资源管理重构

**目标**：完成纯业务 CRUD 与学习进度核心能力。

**任务**

- 重构模块：`tag`、`skill`、`course`、`project`、`learning`、`upload`
- 对齐现有实体与关系：
  - Course / Stage / Lesson / Material / Skill
  - Project / Unit / Tag
  - Enrollment / LessonRecord / ProjectProgress
- 重建上传能力：图片、文件、学习资料
- 保持现有分页、筛选、状态流转、排序能力兼容

**验收**

- 学习中心、项目中心、管理后台课程/项目管理在 Go 环境可完整联调。
- 上传文件与静态资源访问路径保持兼容。
- 所有核心 CRUD 在真实数据库上通过集成测试。

### Phase 4：Agent、AI 与 OpenClaw 聚合能力重构

**目标**：完成 AI 教学能力和 OpenClaw 聚合接口。

**任务**

- 重构模块：
  - `agent`
  - `openclawview`
  - `qwen client`
  - `feishu client`
  - `openclaw gateway client`
- 对齐现有数据模型：
  - `agent_manuals`
  - `agent_steps`
  - `user_agent_progress`
- 保持现有能力兼容：
  - 手册读取
  - 进度更新
  - AI 问答
  - SSE 流式返回
  - 提示词增强
  - OpenClaw thinking/executing/completed/phase
  - 飞书文件下载
  - OpenClaw chat send

**验收**

- Agent 小组件、课时 AI 助教、OpenClaw 页面在 Go 环境可读可用。
- 流式响应与前端现有解析逻辑完全兼容。
- 飞书与 OpenClaw 健康检查可通过。

### Phase 5：Lab 运行时从 Docker 设计切换为 K8S 原生设计

**目标**：完成最复杂的运行时重构。

**K8S 设计默认值**

- 使用单一运行时命名空间，例如 `edu-runtime-dev`
- 每个 Lab 会话对应一个 Pod
- `envImage` 作为主容器
- `ideImage` 存在时作为 sidecar
- `emptyDir` 作为会话级共享工作目录
- 后端维护会话记录与 K8S 资源映射关系

**任务**

- 重构模块：`lab`、`terminal websocket`、`gateway proxy`
- 重建能力：
  - 创建会话
  - 停止会话
  - 查询当前会话
  - 会话状态同步
  - 命令执行
  - 终端连接
  - Gateway 代理
- 终端实现从 Docker exec 改为 K8S exec bridge。
- `vncUrl`、`ideUrl`、`gatewayUrl` 改为代理路径或 Ingress 路径，不暴露节点裸端口。
- `sshInfo` 保留兼容字段，若首轮不提供真实 SSH，不阻塞整体验收，但必须在文档中标注阶段能力差异。
- 明确资源回收：主动停止、TTL 到期、异常会话清理、僵尸 Pod 清理

**验收**

- 课程/项目创建 Lab 会话成功。
- 前端终端可连接并执行命令。
- Gateway 页面可在 iframe 中访问。
- OpenClaw 项目链路可跑通。
- 停止会话后 Pod 与数据库状态一致。

### Phase 6：部署体系与开发测试环境完善

**目标**：让 `EDU_Backend_Go` 在开发测试 K8S 中稳定交付。

**任务**

- 完善 K8S 资源：Deployment、Service、ConfigMap、Secret、Ingress、RBAC
- 明确 Go 服务所需 K8S 权限边界，仅允许管理约定命名空间内资源。
- 完善镜像构建与发布流程。
- 处理本地开发与 K8S 开发环境配置差异。
- 明确日志、事件、错误追踪输出结构。

**验收**

- 新后端可一键部署到开发测试 K8S。
- 配置变更与密钥注入流程清晰。
- K8S 资源权限不过度放大。

### Phase 7：全量联调、回归与整体验收

**目标**：确认 Go 后端具备整站替换能力。

**任务**

- 建立契约测试：核心 REST、SSE、WS、Gateway 代理
- 建立前端冒烟场景：登录、学习中心、项目详情、管理后台、Agent、OpenClaw、Lab
- 对照 TS 输出行为差异清单，逐项消除或明确接受。
- 完成切换前检查表：配置完整、Secret 完整、数据库兼容、第三方连通、K8S 权限正确

**验收**

- 前端切到 Go 后核心用户流无阻塞问题。
- 关键页面与功能通过完整回归。
- Go 后端在开发测试环境连续稳定运行。

### Phase 8：整体切换与旧服务退场准备

**目标**：完成从 TS 到 Go 的整体验收切换准备。

**任务**

- 明确切换动作：API Base URL、WS 入口、Gateway 入口、Nginx / Ingress 路由
- 设计回滚策略：前端快速切回 TS、Go 故障时的回退路径
- 完成切换 Runbook。
- 切换后进入观察期，再决定 TS 的下线节奏。

**验收**

- 具备一键切换与一键回滚能力。
- 切换方案和值班手册齐备。
- TS 是否下线由观察期结果决定，不在首轮切换当天执行硬下线。

---

## 测试与验收场景

### 必测场景

- 认证：登录成功、Token 过期、管理员权限校验
- 课程：课程列表、课时详情、上传资料、学习进度记录
- 项目：项目列表、单元管理、标签筛选
- Agent：手册读取、进度保存、非流式问答、SSE 流式问答
- OpenClaw：thinking / executing / completed / phase、chat send、文件下载
- Lab：创建会话、打开终端、执行命令、Gateway 打开、停止会话、TTL 清理
- 部署：配置加载、Secret 注入、K8S 资源权限、镜像升级回滚

### 验收标准

- Go 后端可独立运行全部核心业务。
- 前端接入 Go 后无需大规模修改。
- K8S 开发测试环境下，Lab 核心流程稳定可用。
- 切换与回滚脚本可演练通过。
- TS 仅在 Go 达标后进入退场阶段。

---

## 重要默认项与约束

- 默认使用 `EDU_Backend_Go/` 作为新后端目录名。
- 默认前端零或极小改动，不以“顺手改前端适配”作为主策略。
- 默认单节点 K8S 仅用于开发测试，不做生产性能承诺。
- 默认不在首版引入 RabbitMQ、Prometheus、Jaeger 等高级基础设施。
- 默认 Redis 仅承接必要能力：
  - 登录限流
  - Token 黑名单可选
  - Lab TTL/状态辅助
- 默认首版优先复刻现有行为，不优先做协议重构、接口美化、字段清洗。
- 默认 `EDU_Backend` 在重构期保留，但不作为长期双主架构的一部分。

---

## 里程碑建议

- 第 1 周：Phase 0 完成
- 第 2-3 周：Phase 1-2 完成
- 第 4-6 周：Phase 3 完成
- 第 7-8 周：Phase 4 完成
- 第 9-10 周：Phase 5 完成
- 第 11 周：Phase 6-7 完成
- 第 12 周：Phase 8 切换准备完成

---

## 风险与处理

- Lab K8S 化复杂度最高
  - 处理方式：单列为独立阶段，优先保证核心链路，不把它揉进普通业务模块开发。
- TS 与 Go 行为细节不一致
  - 处理方式：先冻结契约，再逐接口校验，不靠人工记忆。
- 第三方依赖不稳定
  - 处理方式：所有外部集成都提供 mock 测试与健康检查。
- 切换时前端隐性耦合暴露
  - 处理方式：整体验收前做完整冒烟与回滚演练。

---

## 实施完成后的状态定义

- `EDU_Backend_Go` 成为新的主后端。
- `EDU_Backend` 进入只读维护或下线候选状态。
- 前端、网关、K8S 运行时统一面向 Go 服务。
- 后续优化工作再进入第二阶段：
  - 接口治理
  - 表结构治理
  - 生产容量规划
  - 多节点与高可用
  - 监控告警补强
