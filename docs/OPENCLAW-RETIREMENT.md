# OpenClaw 模块下架计划与验收清单

最后更新：2026-07-14

## 1. 目标与结论

本次工作按 `L3 大模块 / 业务子系统` 下架处理，目标是从当前产品和运行时中完整移除 OpenClaw，不再保留 OpenClaw 项目类型、学生入口、后端网关、作业资源类型或管理端观测面。

下架后的唯一项目实训模型为：

```text
学生项目列表 /projects
  -> 项目详情 /projects/:slug
  -> 项目单元
  -> Classic Lab /lab
  -> K8S Pod / Service / noVNC / terminal / execute / stop
```

不将历史 OpenClaw 项目悄然转换成 Classic Lab，因为它们的环境、手册与验收规则不一定兼容。历史 OpenClaw 项目和关联作业通过增量 SQL 迁移下架，历史提交证据则保留用于审计。

## 2. 回滚与历史保留

- 保留分支：`codex/archive-openclaw-20260714`
- 保留提交：`8218d10 chore: archive OpenClaw implementation before retirement`
- 分支已推送到 `origin/codex/archive-openclaw-20260714`
- 已执行的旧 SQL 迁移保持不变，它们是历史记录；当前状态由新的下架迁移覆盖
- TS 旧后端仍作为历史契约参考，但 `main` 不再保留可运行的 OpenClaw / Feishu 路由、服务和 Lab 分流；完整实现只在归档分支中保留

## 3. 难度与任务量评估

- 难度：中高
- 主要原因：OpenClaw 已穿透学生端、教师端、管理端、Go 领域服务、运行时配置、作业与提交证据、发布门禁以及文档
- 代码与文档触点：约 30-50 个活跃文件，另有历史迁移和归档资料
- 主要风险：删除类型分流后，普通项目的发布、作业、提交和 Lab 启动不能被一起破坏
- 预计工作量：一次跨前后端、数据和文档的完整收口，需要专项测试与浏览器冒烟，不适合拆成“先隐藏菜单”这类伪下架

## 4. 下架边界

### 必须移除

- React `/openclaw/*` 路由、页面、组件、Hook 和 API Service
- 项目列表中的 OpenClaw / Classic 类型 Tab 和过滤语义
- 项目详情、学生作业、教师作业中的 OpenClaw 启动和资源类型
- Go `openclawview` 领域、`/api/openclaw-view/*` 路由与 RBAC 权限
- OpenClaw / Feishu 当前产品集成配置、健康检查、Dashboard KPI 和运行时状态
- 项目 OpenClaw 标签识别、`labRuntimeMode=openclaw` 分流和发布门禁
- 作业资源 `openclaw_project` 和自动检查 `openclaw_phase`
- 当前帮助中心的 OpenClaw 文档入口与产品说明
- 当前主分支中追踪的 OpenClaw 环境 gitlink

### 必须保留

- 学生端 `/projects` 列表、项目详情、单元和学习进度
- Classic Lab `/lab` 和 `/api/lab/*`
- K8S Pod / Service / noVNC / terminal / execute / stop / TTL janitor
- 教师端普通项目创建、编辑、发布、下架和手册管理
- 普通项目、项目单元、Classic Lab 作业资源及提交证据
- 管理端 K8S 会话、配额、审计、健康观测和其他独立集成
- 数据库中既有 OpenClaw 提交证据列，用于历史审计，不在本次迁移中破坏性删列

### 历史保留，但不得继续作为当前产品事实

- 以前已执行的 SQL 迁移
- `docs/archive/` 中明确标记为历史的材料
- TS 旧后端中的非 OpenClaw 历史契约
- 归档分支上的 OpenClaw 环境与完整实现

## 5. 数据下架策略

新增可审计、可重复执行的增量 SQL 迁移，不修改历史迁移：

1. 查找名称归一化后为 `openclaw` 的标签及其关联项目。
2. 将这些项目状态设为 `archived (2)`，不改写为 Classic Lab 项目。
3. 将包含 `openclaw_project` 资源的作业设为 `archived (3)`，阻止新的学生提交。
4. 保留历史 `assignment_resources`、`submissions`、`submission_checks` 与 `openclaw_session_id` 数据供审计，不破坏性删除。
5. 不删除标签行，避免破坏历史外键和报表；当前 API 不再给学生暴露下架项目。

## 6. 实施 TODO

### 归档与计划

- [x] 从完整 OpenClaw 状态创建归档分支
- [x] 提交并推送归档分支
- [x] 回到干净 `main` 工作树
- [x] 评估难度、触点、数据策略与验收边界

### 前端

- [x] 删除 `/openclaw/*` 路由与 OpenClaw 页面树
- [x] 删除 `openclawView` API service 与专用类型
- [x] 项目列表改为统一项目视图，去掉 OpenClaw / Classic 分类
- [x] 项目详情及单元统一进入 `/lab`
- [x] 学生作业去掉 OpenClaw session 和启动逻辑
- [x] 教师作业去掉 `openclaw_project` 资源选项
- [x] Dashboard、系统设置和前端契约去掉 OpenClaw / Feishu 观测与配置
- [x] 帮助中心移除 OpenClaw 文档入口和当前产品说明
- [x] 前端类型检查与构建通过

### Go 后端

- [x] 删除 `internal/domain/openclawview`
- [x] 删除 OpenClaw 路由、RBAC 权限和 handler 注入
- [x] 删除 OpenClaw / Feishu 配置结构、健康检查和设置输出
- [x] 项目运行时固定为 Classic Lab，删除标签分流
- [x] 项目发布门禁不再检查 OpenClaw 网关或专用标签
- [x] 作业资源只接受普通项目、单元和 Classic Lab
- [x] 新提交不再生成 `openclaw_phase` 检查，但保留历史字段可读
- [x] Dashboard 与集成健康聚合去掉 OpenClaw / Feishu
- [x] 移除 Lab / terminal 中仅为 OpenClaw 保留的兼容分支
- [x] `gofmt` 和 `go test ./...` 通过

### 数据、资产与文档

- [x] 新增 OpenClaw 项目 / 作业幂等下架迁移
- [x] 从 `main` 移除 OpenClaw 环境 gitlink
- [x] 更新 `AGENTS.md`、`START-HERE`、`ARCHITECTURE`、`PROJECT-STATUS`、`REPO-MAP`
- [x] 更新 README、Go 开发进度、前端帮助与 M2/M3/M4/M6 当前事实
- [x] 将无需改写的历史资料明确标记为历史，不再用作当前事实来源
- [x] 删除 TS 旧后端仍可运行的 OpenClaw / Feishu 路由、服务、Lab 分流和专用依赖

### 验证与收尾

- [x] `rg` 证明活跃前后端不再存在 OpenClaw 产品能力
- [x] `/openclaw/*` 不再是可用产品路由
- [x] 学生项目列表不再展示 OpenClaw 分类或标签项目
- [x] 普通项目详情能进入 `/lab`
- [x] Lab 创建、active、noVNC、terminal、execute、stop 契约未被破坏
- [x] 教师普通项目编辑 / 发布及作业资源选择仍可用
- [x] 普通项目作业提交、检查、批改与发布成绩契约未被破坏
- [x] 管理端 Dashboard / 设置不再出现 OpenClaw，K8S 运维链路仍可用
- [x] 数据迁移可重复执行，不删除历史提交证据
- [x] 无与本次目标无关的回归修改
- [x] 完成需求逐项审计、提交并推送 `main`

## 7. 验收标准

只有同时满足以下条件，才能将本次 `L3` 下架任务标记为完成：

1. 归档分支在远程存在，能找回下架前的 OpenClaw 实现。
2. 当前 React 和 Go 产品运行时无 OpenClaw 路由、页面、API、类型分流和健康卡片。
3. 历史 OpenClaw 项目和作业已有幂等下架迁移，新数据无法再创建 OpenClaw 业务类型。
4. 普通项目实训的学生端、教师端、作业和 K8S Lab 主链路经测试与页面冒烟证明可用。
5. 权威文档只描述 Go + K8S Classic Lab 当前架构，OpenClaw 只能以历史下架背景出现。
6. 前端类型检查、构建、Go 全量测试和专项回归均通过，无已知阻断项。

## 8. 验证记录

2026-07-14 本地验收结果：

- `go test ./...`：通过
- `EDU_Backend npm run build`：通过
- `EDU_Frontend npm run build`：通过
- `git diff --check`：通过
- 活跃运行时代码检索：仅保留退役标签防回流、历史审计列和 404 / 非法资源专项测试
- 浏览器冒烟：学生项目详情进入 `/lab`；旧 `/openclaw/*` 回落首页；教师作业资源、Dashboard 和系统设置均无旧入口
- MySQL 8 迁移演练：连续执行两次结果一致，普通项目 / 作业 / Classic 模板 / Classic 会话不变，历史提交与检查证据保留
- `npm run i18n:check:strict`：中英文资源键数量一致；仍报告 17 处既有可见中文债务，本次未新增且不属于下架范围

生产部署时仍需先做数据库备份，再执行 `20260714_retire_openclaw.sql`，并在回滚窗口内保留归档分支。
