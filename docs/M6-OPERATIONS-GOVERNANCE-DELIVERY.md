# M6 管理与运维闭环首版主链路交付记录

最后更新：2026-04-24

## 当前结论

- `M6` 已完成首版主链路，不应表述为“模块已完成”
- 当前已打通：
  - 管理员可在 `/admin/dashboard` 查看 K8S / Classic Lab 运行会话、健康状态、配额与审计
  - Classic Lab 创建前会强制解析资源配额，超过并发限制时阻断创建并写入事件
  - 管理员可创建、编辑、启停 global / class / user 资源配额
  - 管理员可打开会话详情，查看 Pod / Service / Events / Logs 与 M6 运行事件流
  - 管理员停止会话接口幂等，重复停止和 NotFound 均返回 200
  - 停止、配额变更、模板启停、Janitor 回收等系统域动作进入 `audit_logs`
  - 教师端 `/teacher/dashboard` 新增“班级 Lab 异常”只读区块
  - 学生端 Lab 创建被配额阻断时复用后端中文错误提示

## 已完成范围

### 数据模型

- 已新增生产 SQL 迁移：
  - [20260424_m6_operations.sql](../EDU_Backend_Go/deployments/sql/20260424_m6_operations.sql)
  - 生产 `auto_migrate=false` 时必须先执行该迁移，再启用 M6 管理与运维接口
- 新增 `resource_quotas`
  - 支持 `scope_type / scope_id / name / max_concurrent_sessions / max_session_minutes / enabled`
  - `(scope_type, scope_id)` 唯一，global 配额固定 `scope_id = 0`
  - 首次迁移自动创建启用的 global 默认配额：并发 1、单次 120 分钟
- 新增 `runtime_session_events`
  - 只追加运行事件流，不反向覆盖 `user_lab_sessions.status`
  - 覆盖创建请求、配额阻断、创建成功、ready、停止、错误、回收等事件
- 新增 `audit_logs`
  - 记录系统域操作：配额变更、会话停止、模板启停、异常回收等
  - 不与 M5 `teacher_action_logs` 互写

### 配额语义

- 服务层统一定义 `DefaultSessionMinutes = 120`
- 解析顺序：
  1. 命中启用的 user 配额则使用
  2. 否则查学生所有活跃班级的启用 class 配额，取并发最小；并发相同取时长最小
  3. 否则使用启用的 global 配额
  4. 都不存在则不限制并发，但仍用默认 120 分钟写入 `expires_at`
- `enabled=false` 表示跳过该配额；禁用 global 后等价于无启用配额，并发不拦截
- 并发计数统计全部当前 `user_lab_sessions`
  - `status IN creating/running`
  - 课程和项目统一适用同一 Classic Lab 配额
- 配额只影响后续新建会话，不追改已有会话 `expires_at`
- Janitor 继续只读 `expires_at` 回收，不新增独立 TTL 分支

### 后端接口

- 已新增 / 补齐管理接口：
  - `GET /api/admin/runtime-sessions`
  - `GET /api/admin/runtime-sessions/:id`
  - `GET /api/admin/runtime-sessions/:id/logs`
  - `GET /api/admin/runtime-sessions/:id/events`
  - `POST /api/admin/runtime-sessions/:id/stop`
  - `GET /api/admin/resource-quotas`
  - `POST /api/admin/resource-quotas`
  - `PUT /api/admin/resource-quotas/:id`
  - `PATCH /api/admin/resource-quotas/:id/status`
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/integrations/health`
- 管理停止会话统一返回 HTTP 200：
  - `{stopped:true, reason:"stopped"}`
  - `{stopped:false, reason:"already_stopped"}`
  - `{stopped:false, reason:"not_found"}`
- 非 admin 访问 M6 管理接口返回 403
- `/api/admin/integrations/health` 保留旧健康检查接口并新增 M6 聚合格式，不泄露敏感配置

### 前端

- `/admin/dashboard` 已作为 M6 运维工作台增强：
  - 会话 KPI、状态筛选、来源筛选、时间筛选、搜索、分页、刷新
  - 会话详情抽屉支持概览、K8S Events、运行事件流、Logs
  - 停止会话支持确认弹窗、重复停止 Toast 和列表刷新
  - 资源配额区块支持创建、编辑、启停、刷新和错误态
  - 审计日志区块支持结果筛选、分页式读取和空态
  - 集成健康区块展示 K8S / Config 中文状态
- `/teacher/dashboard` 在作业进度下方新增“班级 Lab 异常”只读区块，不提供治理按钮
- 学生端 Lab 创建失败继续展示后端返回的中文阻断原因

## 验证结果

- `cd EDU_Backend_Go && go test ./internal/router -run TestM6 -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./internal/domain/lab -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 明确未完成项

- M6 尚未沉淀浏览器级真实冒烟截图 / 录屏附件
- M6 首版不做 CPU / 内存按用户或班级覆盖，仍由 Lab 模板控制
- M6 首版不做成本账单、预算消耗、费用归因或配额推荐
- 不做 AI 自动诊断、邮件告警或自动运维策略
- 运行事件流只追加记录，不作为会话状态 source of truth

## 结论措辞

当前只能表述为：

- `M6 已完成首版主链路`
- `已打通配置配额 → 创建前校验 → 阻断或创建会话 → 事件追踪 → 管理端治理 → 审计可查 → 三端状态反馈首版闭环`

当前不能表述为：

- `M6 已完成`
- `管理与运维模块已 100% 完成`
- `已完成生产级成本治理或 AI 运维`
