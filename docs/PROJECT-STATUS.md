# PROJECT STATUS

最后更新：2026-07-14

## 当前结论
- 当前主架构：`Go 后端 + K8S Classic Lab + 三端教学闭环`
- 前端主链路已基本切到 `EDU_Backend_Go`
- TS 后端主要保留为历史参考与配置迁移来源，当前分支不再注册 OpenClaw / Feishu 路由或项目运行时分流
- 三端入口已切到 `student / teacher / admin` 分层，管理员保留进入教务端能力
- 二阶段升级规划已固化为“按业务模块闭环交付”，主文档见 [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
- M0 一阶段收口基线已完成本轮验收范围，详见 [M0-BASELINE-ACCEPTANCE.md](M0-BASELINE-ACCEPTANCE.md)
- M1 班级与教学组织闭环已完成“单主教师版”首版主链路，详见 [M1-CLASS-ORGANIZATION-DELIVERY.md](M1-CLASS-ORGANIZATION-DELIVERY.md)
- M2 内容生产与发布闭环已完成首版主链路，详见 [M2-CONTENT-PUBLISHING-DELIVERY.md](M2-CONTENT-PUBLISHING-DELIVERY.md)
- M3 作业发布与实训任务闭环已完成首版主链路，详见 [M3-ASSIGNMENT-DELIVERY.md](M3-ASSIGNMENT-DELIVERY.md)
- M4 提交评分与反馈发布闭环已完成首版主链路，详见 [M4-SUBMISSION-GRADING-DELIVERY.md](M4-SUBMISSION-GRADING-DELIVERY.md)
- M5 教学过程工作台闭环已完成首版主链路，详见 [M5-TEACHING-WORKBENCH-DELIVERY.md](M5-TEACHING-WORKBENCH-DELIVERY.md)
- M6 管理与运维闭环已完成首版主链路，详见 [M6-OPERATIONS-GOVERNANCE-DELIVERY.md](M6-OPERATIONS-GOVERNANCE-DELIVERY.md)
- M7 AI 助教辅助闭环已完成首版主链路，详见 [M7-AI-TEACHING-ASSISTANT-DELIVERY.md](M7-AI-TEACHING-ASSISTANT-DELIVERY.md)
- 2026-04-25 已在 M7 之后继续补强 Agent 教学观察台：服务端聊天记录、验证尝试、复盘卡、技能标签、班级 FAQ、教师干预与终端事件已形成首版读写链路
- 学生端学习中心顶部与个人中心等级已接入真实学习成果概览：`/api/learning/overview`

## 已完成的关键主链路
### 用户 / 学习 / 项目
- 认证与用户主链路可用
- 课程、学习中心、项目列表 / 详情 / 基础管理链路可用
- `/study` 学习者榜单已改为真实接口 `/api/users/student-leaderboard`
- `/study` 顶部里程碑与 `/profile` 等级卡片已改为同一学习成果概览数据源
- 学习成果首版口径为聚合视图：课程课时进度、连续学习、作业提交 / 成绩发布、Agent 步骤进度；不等同于证书 / 徽章系统

### Classic Lab
- `create / active / noVNC / terminal / execute / stop` 已打通
- 终端桥接已切为 K8S exec
- Agent 自动验证已复用 `/api/lab/execute`
- TTL janitor / 僵尸会话回收已接入

### 历史 OpenClaw 模块下架
- 2026-07-14 已创建并推送下架前归档分支 `codex/archive-openclaw-20260714`
- React 页面 / 路由 / service、Go 领域 / 路由 / 配置、项目类型、作业资源和管理观测面已移除
- 历史项目、关联作业、旧模板和运行会话由 `20260714_retire_openclaw.sql` 幂等收口，提交证据列继续保留审计
- 当前项目实训只保留 `/projects -> 项目详情 -> /lab -> K8S Classic Lab`

### Admin Dashboard
- 已从旧 Docker 面板转向 K8S 运行概览工作台
- 后端已有 `/api/integrations/dashboard/*` 聚合接口

### 三端权限体系
- JWT 已扩展 `portal`
- Casbin 角色继承已固定为 `admin > teacher > student`
- Teacher Portal 已建立独立 `/teacher/*` 入口
- AdminPanel 已移除教学管理分组，管理端聚焦系统视图
- 权限矩阵与系统设置第一页已改为只读观测面板

### M1 班级与教学组织
- 已新增学期、班级、班级成员、主教师关系四张核心表
- 已补 `/api/teacher/classes`、`/api/student/classes`、`/api/admin/terms|classes` 首版接口
- 教师端已新增“班级管理”页，支持新建、编辑、导入成员、成员移除、详情查看
- 学生端 `/study` 已内嵌“我的班级”区块
- 管理端 `/admin/classes` 已新增“学期管理 / 班级总览”双 Tab 工作区

### M2 内容生产与发布
- 已新增 `publishing` 后端子系统与 `lab_templates / content_publish_checks / publish_audit_logs`
- 已补课程 / 项目 / 手册 `publish-check` 接口与发布阻断逻辑
- 课程、项目、手册发布 / 下架 / 草稿状态已接入发布审计
- Classic Lab 已支持优先读取模板镜像与模板资源配置
- 教师端课程 / 项目管理已补发布检查、学生视角预览、发布 / 下架 / 草稿操作
- 教师端实训手册已升级为“保存内容 / 发布检查 / 检查后发布 / 设为草稿”
- 管理端已新增 `/admin/content-governance`，首版包含 `Lab 模板` 与 `发布审计` 双 Tab
- 已补发布门禁专项路由测试，覆盖缺手册、手册缺验证、停用模板、历史项目类型防回流等阻断路径

### M3 作业发布与实训任务
- 已新增 `assignment` 后端子系统与 `teaching_assignments / assignment_resources / assignment_classes / assignment_rules`
- 已补教师端作业列表、创建、编辑、详情、发布、关闭、草稿接口
- 已补学生端我的任务列表 / 详情接口
- 已补管理端作业概览 / 列表观测接口
- 教师端已新增 `/teacher/assignments` 作业任务工作台
- 学生端 `/study` 已新增”我的任务”区块与任务详情 Drawer
- 管理端已新增 `/admin/assignments` 作业观测页

### M4 提交评分与反馈发布
- 已新增 7 张表：`submissions / submission_files / submission_checks / rubrics / rubric_items / grades / teacher_feedback`
- 学生提交接口支持首次提交与重新提交（attempt_no 递增，历史记录保留）
- 新提交自动抓取 5 种证据快照（`lesson_progress / agent_progress / lab_session / lab_command / manual_review`）；历史检查类型与列只保留审计
- 教师批改队列接口支持状态 / 班级 / 作业筛选；详情接口含 rubric / checks / grade / feedback
- 教师可分项评分（Rubric items）、保存（`reviewed`）、退回（需 `AllowResubmit`）、发布成绩（`reviewed → published`）
- 学生成绩接口隐藏未发布分数（`hideUnpublishedGrade` 保护）
- 教师端已新增 `/teacher/submissions` 批改队列与 `/teacher/submissions/:id` 详情评分页
- 学生端 `StudyAssignmentsSection` 已新增提交表单、历史记录、成绩与反馈展示
- 路由专项测试覆盖完整生命周期（提交 → 退回 → 重提 → 评分 → 发布 → 学生可见）

### M5 教学过程工作台
- 已新增 `notifications / teacher_action_logs / submission_reopens` 与 `assignment_rules.allow_return`
- 已补教师端教学概览、综合待办、风险学生、作业进度、独立成绩簿接口
- 教师端 `/teacher/dashboard` 已升级为可操作工作台，支持 KPI 钻取、提醒、重开提交、待办详情跳转
- 教师端已新增 `/teacher/grades` 成绩簿页面，支持筛选、提交详情跳转、本地 CSV
- 学生端 `/study` 已新增通知入口，支持已读、作业详情跳转和 `openAssignment` 深链
- 管理端 `/admin/assignments` 已新增教学质量只读观测区块

### M6 管理与运维
- 已新增 `resource_quotas / runtime_session_events / audit_logs`
- 已补生产 SQL 迁移 `EDU_Backend_Go/deployments/sql/20260424_m6_operations.sql`
- Classic Lab 创建前已接入资源配额解析与并发拦截，课程和项目使用同一配额模型
- 管理端已补运行会话、详情、日志、事件流、幂等停止、资源配额、审计日志、集成健康聚合接口
- `/admin/dashboard` 已升级为 M6 运维工作台，支持会话治理、配额创建 / 编辑 / 启停、审计和健康观测
- 教师端 `/teacher/dashboard` 已新增“班级 Lab 异常”只读区块
- 停止会话、配额变更、模板启停与异常回收进入系统审计

### M7 AI 助教辅助
- 已新增 `ai_requests / ai_suggestions / ai_feature_settings`
- 已补生产 SQL 迁移 `EDU_Backend_Go/deployments/sql/20260424_m7_ai_assistant.sql`
- 教师端已补 AI 反馈草稿、作业摘要、风险学生薄弱点诊断接口
- `grade / return` 已支持采用合法 pending `aiSuggestionId`，采用后 suggestion 置为 `confirmed` 并保存 `adopted_content`
- 管理端已新增 `/api/admin/ai-settings` 与 `/admin/settings` AI 辅助能力开关，关闭后教师 AI 生成返回中文 503
- 前端 `/teacher/submissions/:id`、`/teacher/dashboard`、`/admin/settings` 已接入 M7 首版入口
- 路由专项测试覆盖重复生成、关闭开关、权限、采纳确认、非法复用等主路径

### Agent 教学观察台增强
- 已新增生产迁移：
  - `EDU_Backend_Go/deployments/sql/20260425_agent_teaching_v1.sql`
  - `EDU_Backend_Go/deployments/sql/20260425_agent_teaching_v2.sql`
- 已新增 Agent 学习事件、步骤验证尝试、服务端聊天会话 / 消息、复盘卡、步骤技能标签、FAQ、教师干预、终端事件等表
- 教师端已新增 `/teacher/agent-observatory`，支持按班级和手册查看步骤热力、学生卡点、近期对话、终端证据、FAQ 与干预记录
- 教师可维护步骤技能标签、生成步骤诊断和 FAQ 草稿；FAQ 需要教师发布后才对学生可见
- 学生侧 `/api/agent/faq`、`/api/agent/pending-interventions`、复盘查看等链路已按班级和学生身份做权限限制
- 路由专项测试覆盖教师归属、管理员继承、外班教师 403、FAQ 发布 / 归档、material note 对学生隐藏、手册导入权限等主路径

### 学习成果概览首版
- 已新增 `GET /api/learning/overview`，统一返回 Level、整体完成率、课程 / 课时进度、连续学习、最近 7 天活跃、里程碑与成果摘要
- Level 规则固定为 `Explorer / Builder / Practitioner / Expert / Master` 五级，里程碑按课程、课时、连续学习三类返回 `current / target`
- 整体完成率按当前学生已注册课程范围计算：`SUM(completed_lessons_count) / SUM(课程课时数)`
- 课程课时数通过 `course_lessons -> course_stages` 聚合，不依赖课程表冗余列
- 学生端 `/study` 顶部卡片和 `/profile` 等级卡片已共用该 overview 数据源
- 教师端 `/teacher/students/progress` 课程视角已改为按 `class_teachers.teacher_id` 过滤任课班级学生，管理员保留全量可见

## 当前仍需继续收口的重点
- OpenClaw 下架专项已完成本地 Go 全量测试、前后端生产构建、关键词审计、浏览器冒烟和 MySQL 8 双次迁移演练；生产库执行仍需纳入正式部署窗口与备份流程
- 云库现有课程实验镜像需要进一步回收，避免再次出现 `Pod Pending`
- 管理端复杂编辑页的全量回归
- M1 当前仍缺多教师协同分配、班级任务分配、通知与班级工作区深层联动
- M2 已补真实浏览器级专项冒烟文档记录，仍缺截图 / 录屏附件与更深层审计治理能力
- M5 已完成首版主链路，仍缺浏览器级真实冒烟记录、截图 / 录屏附件和更深层 Lab 日志钻取
- M6 已完成首版主链路，仍缺浏览器级真实冒烟截图 / 录屏附件、生产级成本账单与 AI 运维能力
- M7 已完成首版主链路，仍缺浏览器级真实冒烟截图 / 录屏附件、成本账单、AI 运维面板和 prompt 版本治理
- Agent 教学观察台仍缺浏览器级完整截图 / 录屏验收、教师干预成效闭环统计、FAQ 学生侧曝光效果统计
- 学习成果概览已完成首版主链路，仍缺浏览器级真实冒烟截图 / 录屏附件；证书 / 徽章 / 正式学习成果档案仍未纳入本轮

## 推荐作为事实来源的文档
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
- [M0-BASELINE-ACCEPTANCE.md](M0-BASELINE-ACCEPTANCE.md)
- [M1-CLASS-ORGANIZATION-DELIVERY.md](M1-CLASS-ORGANIZATION-DELIVERY.md)
- [M2-CONTENT-PUBLISHING-DELIVERY.md](M2-CONTENT-PUBLISHING-DELIVERY.md)
- [M3-ASSIGNMENT-DELIVERY.md](M3-ASSIGNMENT-DELIVERY.md)
- [M4-SUBMISSION-GRADING-DELIVERY.md](M4-SUBMISSION-GRADING-DELIVERY.md)
- [M5-TEACHING-WORKBENCH-DELIVERY.md](M5-TEACHING-WORKBENCH-DELIVERY.md)
- [M6-OPERATIONS-GOVERNANCE-DELIVERY.md](M6-OPERATIONS-GOVERNANCE-DELIVERY.md)
- [M7-AI-TEACHING-ASSISTANT-DELIVERY.md](M7-AI-TEACHING-ASSISTANT-DELIVERY.md)
- [../EDU_Backend_Go/docs/development-progress.md](../EDU_Backend_Go/docs/development-progress.md)
- [../EDU_Backend_Go/docs/ts-go-parity-matrix.md](../EDU_Backend_Go/docs/ts-go-parity-matrix.md)
- [../EDU_Backend_Go/docs/teacher-admin-portal-rbac.md](../EDU_Backend_Go/docs/teacher-admin-portal-rbac.md)

## 不应再作为当前事实来源的资料
- 顶层旧产品说明
- 顶层旧升级改造计划
- 旧 Docker 环境说明

这些资料即使仍保留在旧顶层目录或 `docs/archive/` 中，也仅供历史参考，不应覆盖当前 Go + K8S 主线结论。
