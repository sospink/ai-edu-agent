# EDU_Backend_Go 开发进度

最后更新：2026-07-14

## 当前结论

- 当前主线阶段：`Phase 5：Lab K8S 化运行时`
- 当前状态：`课程和项目统一使用 K8S Classic Lab；Agent 自动验证与 Lab janitor 已接入；历史 OpenClaw 模块已下架；M0-M7 均已完成首版主链路；学习成果概览与 Agent 教学观察台增强已完成首版读写链路`
- 当前架构总览：[ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- 二阶段主规划：[PHASE-2-TEACHING-PLATFORM-UPGRADE.md](../../docs/PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
- 当前前端对接结论：
  - 管理后台用户管理所需接口已具备
  - 普通用户个人中心资料更新与密码修改已具备
  - 登录态核心契约已兼容现有前端
  - 课程、项目、学习中心首批核心接口已具备
  - Agent 手册、AI 问答与验证接口已具备
  - Lab 创建/停止/查询/执行命令接口已具备首版 K8S 实现
  - `/ws/terminal` 已从占位握手切换为 K8S exec bridge
  - TS -> Go 主链路替代差异矩阵已落地，`/api/docker/*` 已明确标注为旧管理面遗留
  - 三端权限体系与 Teacher Portal 首版主链路已接入
  - `/api/learning/overview` 已接入学生学习成果概览，供学习中心顶部与个人中心等级共用
  - `/teacher/agent-observatory` 已接入 Agent 教学观察台，覆盖步骤热力、学生卡点、FAQ、教师干预和复盘卡

## 2026-07-14 历史 OpenClaw 模块下架

- 下架前完整实现已提交并推送到 `codex/archive-openclaw-20260714`
- 当前 React / Go 产品已移除旧页面、路由、领域、配置、项目分流、作业资源和管理观测面
- 新增 `deployments/sql/20260714_retire_openclaw.sql`，幂等归档历史项目 / 作业、停用旧模板并触发旧会话 janitor 回收
- 历史提交、检查和会话列继续保留审计，不再进入新请求或 JSON 契约
- 以下 2026-04 的记录是当时实施历史；其中 OpenClaw 相关结论已被本节替代，不能作为当前运行时事实

## 2026-04-22 二阶段规划同步

### 当前阶段定位

- Go 后端重构一阶段进入收口态，下一步不是继续按页面补半截功能，而是先做 `M0 一阶段收口基线`
- `M0` 通过后，再按二阶段主规划推进 `M1-M7` 业务模块闭环
- 二阶段所有模块默认按 `L3 业务子系统` 验收，必须同时覆盖教师端、学生端、管理端、Go 后端、权限、状态流转、异常路径和验收记录

### 二阶段模块入口

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| M0：一阶段收口基线 | 已完成（本轮范围） | 自动化、三端登录、teacher scope、blacklist、Classic Lab runtime 已完成验收；当时存在的外部模块现已下架 |
| M1：班级与教学组织闭环 | 已完成首版主链路 | 学期、班级、成员、主教师关系、学生可见、管理员治理；多教师协同与任务分配延期 |
| M2：内容生产与发布闭环 | 已完成首版主链路 | 发布检查、发布阻断、Lab 模板、发布审计、教师端学生视角预览、管理端内容治理已接通；发布门禁专项路由测试已补 |
| M3：作业发布与实训任务闭环 | 已完成首版主链路 | 作业绑定班级与已发布资源、教师发布、学生待办可见、管理端只读观测已接通；提交评分延期到 M4 |
| M4：提交、自动验证、评分反馈闭环 | 已完成首版主链路 | 学生提交、提交时证据快照、教师批改/退回/发布成绩、学生查看反馈、教师批改进度汇总已接通；通知、AI 评分、配额治理延期 |
| M5：教学过程工作台闭环 | 已完成首版主链路 | 教师工作台、综合待办、风险学生、提醒、重开提交、站内通知、成绩簿、管理端教学质量观测已接通；浏览器级真实冒烟和更深层 Lab 日志钻取延期 |
| M6：管理与运维闭环 | 已完成首版主链路 | K8S / Classic Lab 会话治理、资源配额、运行事件、健康检查、异常回收、系统审计已接通；成本账单、AI 运维和浏览器截图记录延期 |
| M7：AI 助教辅助闭环 | 已完成首版主链路 | AI 摘要、反馈草稿、薄弱点诊断，教师确认后才发布；成本账单与 AI 运维延期 |
| 学习成果概览 | 已完成首版主链路 | 学习中心顶部和个人中心等级共用真实课程、活动、作业与 Agent 进度聚合；证书 / 徽章系统延期 |
| Agent 教学观察台增强 | 已完成首版读写链路 | 服务端聊天记录、步骤验证尝试、复盘卡、技能标签、FAQ、教师干预、终端事件与教师端观察台已接入；浏览器截图和效果统计延期 |

### 执行门禁

- 禁止把 M1-M7 拆成单独页面半成品
- 未覆盖模块闭环时，只能标记为“模块首版主链路”或“展示层”
- 每个模块合入前必须补充测试结论、三端冒烟记录、已完成闭环项和未完成项

## 2026-04-25 Agent 教学观察台增强

### 本轮已完成

- 新增 Agent 教学增强迁移：
  - `deployments/sql/20260425_agent_teaching_v1.sql`
  - `deployments/sql/20260425_agent_teaching_v2.sql`
- 新增 / 接入数据表：
  - `agent_learning_events`
  - `agent_step_attempts`
  - `agent_chat_sessions`
  - `agent_chat_messages`
  - `agent_reflection_cards`
  - `agent_step_skill_tags`
  - `agent_faq_items`
  - `agent_intervention_records`
  - `lab_terminal_events`
- 教师端 `/teacher/agent-observatory` 已接入：
  - 班级 × 手册步骤热力图
  - 步骤卡点学生与失败证据
  - 近期 AI 对话与终端事件
  - 步骤技能标签维护
  - FAQ 草稿生成、发布与归档
  - 教师干预记录与学生复盘卡查看
- 学生侧已接入：
  - `GET /api/agent/faq`
  - `GET /api/agent/pending-interventions`
  - `POST /api/agent/interventions/:id/read`
  - `POST /api/agent/reflections/:id/viewed`
- 权限边界已覆盖任课教师、外班教师、管理员继承和学生班级可见性。

### 本轮验证

- `cd EDU_Backend_Go && go test ./internal/router -run TestAgentV2TeacherObservatoryFAQInterventionAndTags -count=1`
  - 通过

### 明确未完成项

- 浏览器级真实冒烟截图 / 录屏附件仍未补
- FAQ 学生侧曝光与点击效果统计未做
- 教师干预后学生响应与改进效果统计未做
- 复盘卡仍是首版汇总，不是正式学习档案或证书体系

## 2026-04-24 M5 教学过程工作台首版主链路

### 本轮已完成

- 新增 M5 数据与迁移：`notifications / teacher_action_logs / submission_reopens`，并扩展 `assignment_rules.allow_return`
- 修复 M5 后端聚合兼容：
  - `MAX(updated_at)` 兼容 SQLite 测试与 MySQL 运行
  - `todo-items` 默认返回综合待办，传 `type` 时精确筛选
  - Lab 异常匹配补充 `source_type + resource_type`，避免同 ID 误匹配
  - M5 SQL 迁移中的 `allow_return` 改为幂等添加
- 教师端 `/teacher/dashboard` 已升级为教学过程工作台：
  - KPI 钻取待办
  - 待办详情跳转
  - 提醒学生
  - 重开提交
  - 风险学生与作业进度观测
- 教师端新增 `/teacher/grades` 独立成绩簿，支持筛选、提交详情跳转、本地 CSV
- 学生端 `/study` 新增站内通知入口，支持未读数、已读、作业详情跳转与 `openAssignment` 深链
- 管理端 `/admin/assignments` 新增教学质量只读观测区块

### 本轮验证

- `cd EDU_Backend_Go && go test ./internal/router -run 'TestM5WorkbenchNotificationsReopenAndGrades|TestM4SubmissionGradeReturnAndPublishFlow|TestM3AssignmentLifecycleAndVisibility' -count=1`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

### 明确未完成项

- M5 浏览器级真实冒烟记录与截图 / 录屏附件仍未补
- 风险学生仍是固定规则，不包含 AI 预测或画像模型
- 通知只做站内通知，不包含外部 IM / 邮件 / 短信推送
- 管理端仅观测教学质量，不接管教师提醒、退回、评分、重开
- 更深层 Lab 日志钻取、资源配额治理和异常会话治理进入 M6

## 2026-04-24 M6 管理与运维首版主链路

### 本轮已完成

- 新增 M6 数据模型：
  - `resource_quotas`
  - `runtime_session_events`
  - `audit_logs`
- 已补生产 SQL 迁移 `deployments/sql/20260424_m6_operations.sql`，适配生产 `auto_migrate=false` 的部署方式
- Classic Lab 创建链路已接入资源配额解析：
  - user 配额优先
  - 多班级 class 配额取最严格
  - global 配额兜底
  - 全部禁用时不限制并发，但仍用 `DefaultSessionMinutes = 120` 写入过期时间
- 当前并发计数统计所有 `status IN creating/running` 的 Lab 会话，课程和项目共用配额
- `CreateSession` 已移除硬编码 TTL，改为按配额时长计算 `expires_at`；Janitor 继续只读 `expires_at`
- 运行事件流已覆盖创建请求、配额阻断、创建成功、ready、错误、停止、回收
- 管理端运行接口已补齐：
  - `GET /api/admin/runtime-sessions`
  - `GET /api/admin/runtime-sessions/:id`
  - `GET /api/admin/runtime-sessions/:id/logs`
  - `GET /api/admin/runtime-sessions/:id/events`
  - `POST /api/admin/runtime-sessions/:id/stop`
- 资源配额与审计接口已补齐：
  - `GET /api/admin/resource-quotas`
  - `POST /api/admin/resource-quotas`
  - `PUT /api/admin/resource-quotas/:id`
  - `PATCH /api/admin/resource-quotas/:id/status`
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/integrations/health`
- 停止会话、配额变更、模板启停、Janitor 回收已写入系统域 `audit_logs`
- `/admin/dashboard` 已升级为 M6 运维工作台，支持会话治理、资源配额、审计和集成健康观测
- `/teacher/dashboard` 已新增“班级 Lab 异常”只读区块

### 本轮验证

- `cd EDU_Backend_Go && go test ./internal/router -run TestM6 -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./internal/domain/lab -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

### 明确未完成项

- M6 浏览器级真实冒烟截图 / 录屏附件仍未补
- M6 首版不做 CPU / 内存按用户或班级覆盖，仍由 Lab 模板控制
- 成本账单、AI 自动诊断、邮件告警和自动运维策略延期

## 2026-04-24 M7 AI 助教辅助首版主链路

### 本轮已完成

- 新增 M7 数据模型：
  - `ai_requests`
  - `ai_suggestions`
  - `ai_feature_settings`
- 已补生产 SQL 迁移 `deployments/sql/20260424_m7_ai_assistant.sql`，并注册 AutoMigrate
- 教师端 AI 接口已补齐：
  - 反馈草稿
  - 作业摘要
  - 学生薄弱点诊断
  - AI 状态查询
  - suggestion confirm / dismiss
- 管理端 AI 开关已补齐，关闭后教师 AI 生成接口返回 `503 AI 辅助能力已关闭`，并写入 failed `ai_requests`
- `grade / return` 已支持可选 `aiSuggestionId`，合法 pending `feedback_draft` 被采用后写入 `adopted_content` 并置为 `confirmed`
- 重复生成同类建议时，旧 pending 自动 `dismissed`，新建议保持 `pending`
- 管理端 AI 开关变更已写入 M6 `audit_logs`
- 前端已接入：
  - `/teacher/submissions/:id` AI 反馈草稿、预览、填入评分 / 退回、忽略
  - `/teacher/dashboard` 风险学生 AI 诊断、作业进度 AI 摘要
  - `/admin/settings` AI 辅助能力开关

### 本轮验证

- `cd EDU_Backend_Go && go test ./internal/router -run TestM7 -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

### 明确未完成项

- 未做学生侧 AI 对话、AI 摘要发布给学生或流式生成
- 未做自动评分、分数建议入库、成本账单或 AI 运维面板
- M7 浏览器级真实冒烟截图 / 录屏附件仍未补
- 后续可补 prompt 版本治理、模型供应商治理、成本追踪和更细粒度 AI 使用统计

## 2026-04-24 学习成果概览首版主链路

### 本轮已完成

- 新增 `GET /api/learning/overview`
- 概览返回：
  - `level / levelName`
  - `overallProgressPercent`
  - `completedCourses / inProgressCourses`
  - `completedLessons / totalLessons`
  - `currentStreakDays / activeDaysLast7`
  - `milestones`
  - `outcomeSummary`
- Level 规则固定为：
  - Level 1：`Explorer`
  - Level 2：`Builder`
  - Level 3：`Practitioner`
  - Level 4：`Expert`
  - Level 5：`Master`
- `milestones` 固定返回 `courses / lessons / streak` 三类，前后端统一使用 `current / target` 渲染
- 整体完成率按学生已注册课程范围统计：`SUM(completed_lessons_count) / SUM(total_lessons)`
- `totalLessons` 通过 `course_lessons cl JOIN course_stages cs ON cs.id = cl.stage_id` 聚合到课程维度
- 连续学习优先按今天计算；今天无记录时从昨天开始，避免当天未学习即清零
- 最近活跃天数按最近 7 个自然日统计
- 作业提交、已评分、已发布成绩进入 `outcomeSummary`，不参与课程完成率
- Agent 手册进度进入 `outcomeSummary`
- `/study` 顶部里程碑和 `/profile` 等级卡片已接入同一 overview 数据源
- `/api/teacher/students/progress` 课程视角已改为任课班级过滤：
  - `class_members`
  - `classes`
  - `class_teachers.teacher_id = currentTeacherID`
  - 管理员保留全量可见

### 本轮验证

- `cd EDU_Backend_Go && go test ./internal/router -run 'TestLearningOverview|TestTeacherStudentProgress' -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

### 明确未完成项

- 首版学习成果是聚合视图，不是正式证书、徽章或可审核成果档案
- 顶部学习概览默认按学生全局统计，不随班级 Tab 切换
- 浏览器级真实冒烟截图 / 录屏附件仍未补

## 三端权限体系 + Teacher Portal

### 本轮已完成

- 安全基线已补齐：
  - 默认管理员密码改为配置项
  - HTTP CORS 改为白名单
  - `/ws/terminal` 已接入 Origin 白名单校验
- JWT 已扩展 `portal` 字段，登录与 refresh 使用同一 payload 结构
- Casbin 角色继承已固定为 `admin > teacher > student`
- 路由已分层：
  - `student`：保留 `/api/*` 主学习链路
  - `teacher`：新增 `/api/teacher/*`
  - `admin`：新增 `/api/admin/*`
- 资源归属已收口：
  - `projects.created_by`
  - `courses.creator_id`
  - `agent_manuals.creator_id`
- 前端三端入口已接通：
  - `student -> /study`
  - `teacher -> /teacher/dashboard`
  - `admin -> /admin/dashboard`
- Teacher Portal 已挂接：
  - 仪表盘
  - 课程管理
  - 项目管理
  - 实训手册
  - 学生进度
- AdminPanel 已移除教学管理分组，新增权限矩阵与只读系统设置页

### 本轮验证

- 已通过：
  - `go test ./...`
  - `npm exec tsc --noEmit`
  - 真实浏览器环境下的三角色登录、跳转与本地登录态保存时机冒烟
  - teacher scope 与 logout blacklist 的 HTTP / WebSocket 回归
  - Classic Lab 的 `create / execute / terminal / stop` 真实闭环
- 本轮记录：
  - 现有云库课程镜像 `opencode-lab:latest` 作为 smoke 源会出现 `Pod Pending`
  - 使用临时草稿 smoke 课程与镜像 `registry.cn-beijing.aliyuncs.com/svinsight/course:fisco_newbasicv6` 已完成运行时闭环，验证后课程已删除
  - 当时暂缓的外部模块页面联调已被 2026-07-14 下架结论取代

### 相关文档

- [teacher-admin-portal-rbac.md](teacher-admin-portal-rbac.md)
- [M0-BASELINE-ACCEPTANCE.md](../../docs/M0-BASELINE-ACCEPTANCE.md)
- [M1-CLASS-ORGANIZATION-DELIVERY.md](../../docs/M1-CLASS-ORGANIZATION-DELIVERY.md)
- [M2-CONTENT-PUBLISHING-DELIVERY.md](../../docs/M2-CONTENT-PUBLISHING-DELIVERY.md)

## 2026-04-23 M2 内容生产与发布首版主链路

### 已完成范围

- 已新增 `publishing` 后端子系统
- 已通过 `AutoMigrate` 注册：
  - `lab_templates`
  - `content_publish_checks`
  - `publish_audit_logs`
- 已新增接口：
  - `POST /api/teacher/courses/:id/publish-check`
  - `POST /api/teacher/projects/:id/publish-check`
  - `POST /api/teacher/manuals/:id/publish-check`
  - `GET /api/teacher/lab-templates`
  - `GET /api/admin/lab-templates`
  - `POST /api/admin/lab-templates`
  - `PUT /api/admin/lab-templates/:id`
  - `PATCH /api/admin/lab-templates/:id/status`
  - `GET /api/admin/publish-audit-logs`

### 已落实的发布语义

- 课程、项目发布前统一先跑 checker
- checker 含 `errors` 时发布返回 `409`，不写发布状态
- checker 含 `warnings` 时允许发布，但写入审计
- 手册 `isPublished=1` 已接入同一门禁，不能绕过发布检查
- 课程 / 项目 Classic Lab 运行时已支持优先读取 Lab 模板镜像与资源
- 历史项目类型已改为防回流发布门禁，普通项目统一使用 Classic Lab

### 已补的前端入口

- 教师端：
  - 课程管理已补发布检查、学生视角预览、发布 / 下架 / 草稿状态反馈
  - 项目管理已补发布检查、学生视角预览、发布 / 下架 / 草稿状态反馈
  - 实训手册已补“保存内容 / 发布检查 / 检查后发布 / 设为草稿”
- 管理端：
  - 已新增 `/admin/content-governance`
  - 首版包含 `Lab 模板` 与 `发布审计` 两个 Tab

### 本轮验证

- `go test ./...` 通过
- `npm exec tsc --noEmit` 通过
- 已补发布门禁专项路由测试：
  - 课程实验课时缺手册阻断
  - 手册缺有效验证阻断
  - Classic Lab 停用模板阻断
  - 历史项目类型重新发布阻断
- 已补真实浏览器级专项冒烟文档记录：
  - 管理端 `/admin/content-governance` 完成 Lab 模板创建、停用与审计记录查看
  - 教务端 `/teacher/courses` 完成课程发布检查 Drawer 与阻断原因展示验证
  - 学生端 `/study` 完成学生 Layout、我的任务空态、我的班级空态与已发布内容可见性验证

### 明确延期项

- 真实浏览器级专项冒烟已补文档记录；截图 / 录屏附件未沉淀
- 发布审计全文检索、批量治理与更深层诊断
- M6 级别的全局 / 班级 / 用户资源配额治理

## 2026-04-23 M3 作业发布与实训任务首版主链路

### 已完成范围

- 已新增 `assignment` 后端子系统
- 已通过 `AutoMigrate` 注册：
  - `teaching_assignments`
  - `assignment_resources`
  - `assignment_classes`
  - `assignment_rules`
- 已新增 SQL 迁移：
  - `deployments/sql/20260423_m3_assignments.sql`
- 已新增接口：
  - `GET|POST /api/teacher/assignments`
  - `GET|PUT /api/teacher/assignments/:id`
  - `POST /api/teacher/assignments/:id/publish`
  - `POST /api/teacher/assignments/:id/close`
  - `POST /api/teacher/assignments/:id/draft`
  - `GET /api/student/assignments`
  - `GET /api/student/assignments/:id`
  - `GET /api/admin/assignments/overview`
  - `GET /api/admin/assignments`

### 已落实的作业语义

- 作业状态固定为 `draft / published / closed / archived`
- 教师只能管理自己创建或自己主教师班级关联的作业
- 学生只能看到自己所在班级的已发布 / 已关闭作业
- 管理员首版只读观测，不代编辑
- 发布门禁会阻断无班级、无资源、资源未发布、历史资源类型、绑定停用班级

### 已补的前端入口

- 教师端：
  - 已新增 `/teacher/assignments`
  - 支持列表、搜索、筛选、创建、编辑、详情、发布、关闭、草稿
- 学生端：
  - `/study` 已新增“我的任务”区块
  - 支持任务详情 Drawer 与资源跳转
- 管理端：
  - 已新增 `/admin/assignments`
  - 支持作业状态分布与列表观测

### 本轮验证

- `go test ./...` 通过
- `npm exec tsc --noEmit` 通过
- 新增后端回归覆盖：
  - 教师不能发布他人班级作业
  - 草稿学生不可见
  - 发布后目标班级学生可见
  - 非班级学生不可见
  - 关闭后学生仍可查详情但 `canEnter=false`
  - 发布门禁阻断无班级、无资源、资源未发布、历史资源类型、停用班级

### 明确延期项

- M4：提交、验证证据、评分和反馈发布
- M5：通知、催交、逾期提醒和教师过程工作台
- M6：资源配额、作业关联 Lab 会话治理和更深层审计

## 2026-04-22 M1 班级与教学组织首版主链路

### 已完成范围

- 已新增 `terms / classes / class_members / class_teachers`
- 已通过 AutoMigrate 注册四张表
- 已新增三端接口：
  - `GET /api/teacher/terms`
  - `GET|POST /api/teacher/classes`
  - `GET|PUT /api/teacher/classes/:id`
  - `GET /api/teacher/classes/:id/members`
  - `POST /api/teacher/classes/:id/members/import`
  - `DELETE /api/teacher/classes/:id/members/:userId`
  - `GET /api/student/classes`
  - `GET|POST /api/admin/terms`
  - `PUT /api/admin/terms/:id`
  - `PATCH /api/admin/terms/:id/status`
  - `GET /api/admin/classes`
  - `GET /api/admin/classes/:id`
  - `PATCH /api/admin/classes/:id/status`
- 已补前端入口：
  - `/teacher/classes`
  - `/study` 班级摘要区块
  - `/admin/classes`

### 已落实的权限与语义

- 教师只能操作自己作为 `owner` 的班级
- 管理员可查看全部学期与全部班级
- 学生仅可查看自己加入的班级
- 教师默认列表只展示活跃班级
- 班级停用后，学生仍可看到历史归属，成员历史不删除

### 已落实的导入规则

- 成员导入支持 `CSV / XLSX`
- 模板列固定为 `studentId / username / email`
- 匹配优先级固定为 `studentId > username > email`
- 仅允许导入 `roleType=1` 且 `status=active`
- 同文件重复、已在班级中、账号不存在、角色不符、状态异常均按逐行结果返回

### 本轮验证

- `go test ./...` 通过
- `npm exec tsc --noEmit` 通过
- 新增后端回归覆盖：
  - 教师创建班级
  - teacher scope 拦截
  - 成员导入逐行结果
  - 学生班级可见
  - 管理员停用班级后教师 / 学生联动

### 明确延期项

- 多教师协同分配 UI
- 班级下课程 / 项目 / 作业分配
- 学生独立班级工作区
- 通知、提醒、班级消息中心
- 班级停用后阻断作业发布的真实业务接线

## 2026-04-22 M0 验收补充

### 自动化与健康检查

- `go test ./...` 通过
- `npm exec tsc --noEmit` 通过
- `/api/health` 返回 `database=up`、`k8s=up`、`redis=up`

### 权限与退出

- 已完成 admin / teacher / student 三端 API 权限回归
- 已完成 `/api/teacher/*` teacher scope 回归
- 已完成 logout 后 HTTP token 失效回归
- 已完成 logout 后 `/ws/terminal` query token 拒绝回归

### 前端三端入口

- 已完成学生弹窗登录、教务登录、管理登录三条入口冒烟
- 已验证角色误入时不会写入本地 `authToken/currentUser`
- 已验证 student / teacher / admin 的越权跳转行为

### Classic Lab 运行时

- 使用临时草稿 smoke 课程完成 `create / execute / terminal / stop` 真实闭环
- 运行时返回会话 `163`，状态 `running`
- 命令执行输出 `m0-lab-exec-ok`
- 终端收到 `m0-terminal-ok`
- 停止后会话状态为 `stopped`

### 已下架历史模块

- 本节原健康检查结论只代表 2026-04-22 时点；相关路由和配置已于 2026-07-14 下架

## 阶段总览

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| Phase 0：基线冻结与可实施化准备 | 已完成 | 已产出接口、数据、环境变量、K8S 接入文档 |
| Phase 1：Go 工程基础设施搭建 | 已完成 | 工程骨架、配置、日志、数据库、K8S、上传、健康检查已落地 |
| Phase 2：认证与用户系统重构 | 已完成 | 认证、用户、权限边界、自助资料更新已打通 |
| Phase 3：课程、项目、学习与资源管理 | 已完成 | 课程/项目 CRUD、学习资料、学习进度链路已完成 |
| Phase 4：Agent 与 AI 聚合能力 | 进行中 | Agent / AI 首版接口已完成，继续做真实模型与页面回归 |
| Phase 5：Lab K8S 化运行时 | 进行中 | Classic Lab 已在真实集群完成 Pod/Service/noVNC/terminal/stop 闭环验证，课程和项目统一接入 |
| Phase 6：部署体系与开发测试环境完善 | 未开始 | 待业务主链路稳定后推进 |
| Phase 7：全量联调与回归 | 未开始 | 待核心模块完成后推进 |
| Phase 8：整体验收与切换准备 | 未开始 | 待开发测试环境验证后推进 |

## Phase 2 完成内容

### 已完成接口

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `PUT /api/users/:id/password`
- `PUT /api/users/:id/freeze`
- `PUT /api/users/:id/activate`

### 已完成兼容点

- JWT payload 兼容：`{ userId, username, roleType }`
- 密码哈希兼容 TS 旧后端的 PBKDF2 `salt:hash` 格式
- 登录兼容三种身份标识：
  - 用户名
  - 邮箱
  - 学号/工号
- `/api/auth/me` 兼容两种读取方式：
  - `Authorization: Bearer <token>`
  - `?userId=...`
- 用户更新采用“只更新传入字段”语义
- 管理员后台与普通用户个人中心的权限边界已区分
- `JWT_EXPIRES_IN=7d` 等 Node 风格时长写法已兼容

### 权限边界

- 管理员可执行：
  - 用户列表
  - 创建用户
  - 删除用户
  - 冻结/激活用户
  - 更新任意用户资料
  - 重置任意用户密码
- 普通登录用户可执行：
  - 获取自己的用户详情
  - 更新自己的个人资料
  - 修改自己的密码
- 普通用户不可执行：
  - 查看其他用户详情
  - 更新其他用户资料
  - 访问用户列表
  - 执行用户管理动作

## 验证结果

### 已通过

- `go test ./...`
- 真实数据库用户登录验证：
  - `admin / admin@123` 已在 Go 后端与前端代理链路验证通过
- 路由级认证/用户测试已覆盖：
  - 登录成功
  - 邮箱登录
  - 学号登录
  - `/auth/me` token 模式
  - `/auth/me` query 模式
  - 普通用户自助改资料
  - 普通用户不能越权修改他人
  - 普通用户不能访问用户列表
  - 管理员可访问用户列表
  - 本人改密码需要旧密码
  - 管理员可重置他人密码
  - 冻结用户 refresh token 被拒绝

### 待做

- 用真实前端页面进行浏览器级冒烟验证
- 用真实 MySQL 数据做一次接口联调确认

## Phase 3 当前完成内容

### 已完成接口

- `GET /api/courses`
- `GET /api/courses/:id`
- `GET /api/courses/slug/:slug`
- `GET /api/courses/:id/stages`
- `GET /api/courses/:id/lessons`
- `GET /api/courses/:id/stages/:stageId/lessons`
- `GET /api/courses/lessons/:lessonId`
- `GET /api/courses/lessons/:lessonId/materials`
- `POST /api/courses/:id/enroll`
- `GET /api/courses/:id/progress`
- `POST /api/courses/lessons/:lessonId/start`
- `POST /api/courses/lessons/:lessonId/complete`
- `GET /api/learning/enrollments`
- `GET /api/learning/continue`
- `GET /api/learning/activity`
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/projects/slug/:slug`
- `GET /api/projects/:id/units`
- `POST /api/courses`
- `PUT /api/courses/:id`
- `DELETE /api/courses/:id`
- `POST /api/courses/:id/publish`
- `POST /api/courses/:id/archive`
- `POST /api/courses/:id/draft`
- `POST /api/courses/:id/stages`
- `PUT /api/courses/:id/stages/:stageId`
- `DELETE /api/courses/:id/stages/:stageId`
- `POST /api/courses/:id/stages/reorder`
- `POST /api/courses/:id/stages/:stageId/lessons`
- `PUT /api/courses/:id/lessons/:lessonId`
- `DELETE /api/courses/:id/lessons/:lessonId`
- `POST /api/courses/:id/stages/:stageId/lessons/reorder`
- `GET /api/skills`
- `GET /api/skills/category/:category`
- `POST /api/skills`
- `PUT /api/skills/:id`
- `DELETE /api/skills/:id`
- `POST /api/courses/lessons/:lessonId/materials`
- `PUT /api/courses/materials/:materialId`
- `DELETE /api/courses/materials/:materialId`
- `POST /api/courses/lessons/:lessonId/materials/reorder`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `PUT /api/projects/:id/publish`
- `PUT /api/projects/:id/archive`
- `PUT /api/projects/:id/draft`
- `POST /api/projects/:id/units`
- `PUT /api/projects/:id/units/:unitId`
- `DELETE /api/projects/:id/units/:unitId`
- `PUT /api/projects/:id/units/reorder`
- `GET /api/tags`
- `POST /api/tags`
- `PUT /api/tags/:id`
- `DELETE /api/tags/:id`
- `POST /api/upload/images`
- `DELETE /api/upload/file`

### 已完成兼容点

- 课程列表继续返回 `{ list, total, page, pageSize }`
- 课程详情继续返回 `stages[].lessons[]` 嵌套结构
- 项目列表继续返回 `{ list, total, page, pageSize }`
- 项目详情继续返回 `tags` 与 `units`
- 学习主链路继续兼容：
  - 加入课程
  - 开始课时
  - 完成课时
  - 课程学习记录
  - 继续学习
  - 活跃日志
- 课时完成响应继续兼容 `record + earnedXP`
- 管理后台课程保存链路已覆盖：
  - 课程创建/更新/删除
  - 阶段创建/更新/删除/排序
  - 课时创建/更新/删除/排序
- 管理后台项目保存链路已覆盖：
  - 项目创建/更新/删除
  - 单元创建/更新/删除/排序
- 学习资料链路已覆盖：
  - 上传
  - 更新标题/排序
  - 删除
- 通用上传兼容已补齐：
  - 单图上传
  - 多图上传
  - 文件删除支持 query `filePath`

### 当前剩余工作

- 需要用真实前端页面继续完成浏览器级联调确认：
  - 课程管理编辑页
  - 项目管理编辑页
  - 学习资料管理弹窗
- Docker/Lab 旧接口仍未接入 Go：
  - `/api/docker/*`
  - 相关运行时能力待后续 Phase 5 迁移
- 需要继续补管理端细节契约：
  - 若前端存在隐含的管理员权限假设，需要在后续引入更严格的权限收口

## Phase 4 当前完成内容

### 已完成接口

- `GET /api/agent/manual/:sourceType/:sourceId`
- `POST /api/agent/verify`
- `POST /api/agent/chat`
- `POST /api/agent/chat/stream`
- `POST /api/agent/explain`
- `GET /api/agent/progress/:sourceType/:sourceId`
- `POST /api/agent/progress`
- `POST /api/agent/suggestion`
- `POST /api/agent/prompt-enhance`
- `GET /api/agent/admin/manual/:sourceType/:sourceId`
- `POST /api/agent/admin/manual`
- `PUT /api/agent/admin/manual/:id`
- `DELETE /api/agent/admin/manual/:id`
- `POST /api/agent/admin/manual/:id/steps`
- `POST /api/agent/admin/import`
- `POST /api/agent/admin/parse-preview`

### 已完成兼容点

- Agent 相关接口继续兼容 TS 的“裸 JSON”返回习惯：
  - 手册读取
  - 进度读写
  - AI 问答
  - 代码解释
  - 验证建议
  - 管理端手册维护
- `POST /api/agent/chat/stream` 已兼容 SSE 输出：
  - `data: {"content":"..."}`
  - `data: [DONE]`
- `POST /api/agent/prompt-enhance` 继续兼容前端当前的统一包裹读取方式：
  - `{ success, data }`
- Markdown 导入与预览已兼容：
  - `## 步骤 n: 标题`
  - `### heading`
  - 代码块
  - 列表
  - `<!-- questions: ... -->`
  - `<!-- verify: ... -->`

### 当前已知边界

- `verifyStep` 已接入 Lab 运行时 exec bridge，当前已覆盖：
  - `file_exists`
  - `command_output`
  - `service_running`
  - `custom`
- 历史 OpenClaw / Feishu 客户端、降级响应和配置已于 2026-07-14 移除

## 验证结果

### 已通过

- `go test ./...`
- 路由级 Phase 4 测试已覆盖：
  - Agent 管理端手册创建/步骤保存/发布
  - Agent 公共手册读取
  - Agent 用户进度读写
  - AI 问答
  - 代码解释
  - 验证建议
  - Prompt Enhance
  - SSE 流式输出
  - Markdown 预览与导入
  - 已下架路由返回 404

### 待做

- 用真实前端页面联调：
  - AgentWidget
  - AgentManualEditor
  - PromptEnginePanel
- 用真实 DashScope / Qwen 配置验证：
  - 非流式问答
  - 流式问答
  - Prompt Enhance

## Phase 5 当前完成内容

### 已完成接口

- `GET /api/lab/images`
- `GET /api/lab/active`
- `GET /api/lab/sessions`
- `POST /api/lab/create`
- `POST /api/lab/stop/:sessionId`
- `GET /api/lab/urls`
- `POST /api/lab/execute`
- `ALL /api/lab/proxy/:sessionId/:target/*`
- `GET /ws/terminal`

### 已完成兼容点

- `user_lab_sessions` 按现有字段兼容落库，未强制依赖新增 schema 字段
- Lab 会话首版按 `1 session = 1 Pod + 1 Service` 编排
- 课程使用 `envImage + 可选 ideImage`
- 项目详情和列表不再返回运行时类型，项目统一进入 K8S Classic Lab
- `/ws/terminal` 保留现有 query 参数，内部切换为 K8S exec bridge
- `POST /api/lab/execute` 使用 K8S exec 执行非交互命令，供 Agent 验证/快捷命令链路复用
- noVNC、IDE 和模板 Web 应用通过 K8S Service proxy 返回同源代理路径，不暴露节点裸端口
- noVNC `vncUrl.path` 已改为绝对 `/api/lab/proxy/:sessionId/novnc/websockify`，避免 iframe 下相对路径错误
- 代理层已保留 `Connection: Upgrade` / `Upgrade: websocket`，noVNC `websockify` 可通过 Go 后端完成 101 升级

### 当前已知边界

- 历史项目分流与外部 Gateway 配置已移除，旧项目由下架迁移归档
- `sshInfo` 为兼容字段，首版不提供真实 SSH，终端统一走 K8S exec bridge
- TTL 到期清理与异常僵尸 Pod/Service 回收已接入 janitor 后台任务
- `user_lab_sessions` 的 K8S 扩展字段仍建议后续做非破坏性迁移

### 验证结果

- `go test ./...`
- 真实 K8S 集群预检已通过：
  - `kubectl -n edu-runtime-dev get secret aliyun-registry`
  - `kubectl auth can-i create pods/services/pods/exec -n edu-runtime-dev`
- 已创建 smoke 课程数据：
  - 课程 slug：`k8s-classic-smoke`
  - 课程 ID：`41`
  - 课时 ID：`363`
  - 环境镜像：`registry.cn-beijing.aliyuncs.com/svinsight/course:fisco_newbasicv6`
- `POST /api/lab/create` 已成功创建会话并落库，真实生成：
  - `lab-session-142` / `lab-service-142`
  - `lab-session-143` / `lab-service-143`
- K8S 事件已确认镜像直接复用节点缓存：
  - `Container image "...fisco_newbasicv6" already present on machine`
- `GET /api/lab/active` 已返回 `session + urls`，`runtimeMode=classic`
- `POST /api/lab/execute` 已成功执行 `pwd`、`whoami`、`ls`
- `/ws/terminal` 已用真实 WebSocket 会话验证输入、输出、resize
- `/api/lab/proxy/:sessionId/novnc/vnc.html` 与 `.../websockify` 已验证可返回页面资源并完成 `RFB 003.008` 握手
- `POST /api/lab/stop/:sessionId` 已验证能删除 Pod/Service，并把数据库状态改为 `stopped`
- Agent 自动验证已接入运行时执行链路，并新增规则级测试覆盖
- Lab janitor 已新增测试覆盖：
  - 过期会话自动停止并回收 Pod/Service
  - DB 不存在的孤儿 Pod/Service 自动删除

## 下一阶段入口

### 默认下一步

- 进入二阶段 `M1 班级与教学组织闭环`
- 开工前以 [M0-BASELINE-ACCEPTANCE.md](../../docs/M0-BASELINE-ACCEPTANCE.md) 作为一阶段收口事实基线

### 建议开工顺序

1. 执行 `go test ./...`，确认 Go 后端现有测试通过
2. 执行 `npm exec tsc --noEmit`，确认前端类型检查通过
3. 开始 `M1 班级与教学组织闭环` 的数据模型与接口设计
4. 把云库现有课程镜像回收到稳定可启动镜像，避免后续 smoke 继续依赖临时课程
5. 按 [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](../../docs/PHASE-2-TEACHING-PLATFORM-UPGRADE.md) 推进 M1

## 运行说明

- Go 后端目录：`EDU_Backend_Go/`
- 前端目录：`EDU_Frontend/`
- 本地开发默认链路：
  - 前端 Vite：`http://localhost:3000`
  - Go 后端：`http://localhost:4000`
  - 前端通过 `/api` 与 `/ws` 代理访问 Go 后端
