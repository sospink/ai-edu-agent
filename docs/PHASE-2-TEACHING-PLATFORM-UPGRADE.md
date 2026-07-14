# Agent EDU 二阶段升级整合方案：按业务闭环交付的实训教学平台

## 1. Summary

二阶段目标不是继续补“半页面”，而是把 Agent EDU 从前期产品探索 Demo 升级为完整的单校 / 机构版实训教学平台。

核心闭环固定为：

```text
教师组织班级与发布实训任务
→ 学生进入课程 / 项目 / Agent / Lab 完成实验
→ 系统记录过程、验证结果、Lab 会话与提交
→ 教师评分、反馈、退回或发布成绩
→ 学生查看反馈并重做 / 复盘
→ 管理端监控资源、异常、审计与质量
```

本阶段继续沿用当前主架构：

- 前端：`EDU_Frontend`
- 后端：`EDU_Backend_Go`
- Classic Lab：K8S Pod / Service / noVNC / terminal / exec / stop
- 项目实训：统一进入 K8S Classic Lab
- 权限模型：`admin > teacher > student`

不回退到 TS 旧后端，不把 Docker 管理面作为二阶段主线。

## 2. 当前能力盘点

### 已具备的主链路

| 模块 | 当前状态 | 二阶段定位 |
| --- | --- | --- |
| 三端登录与权限 | 已建立 student / teacher / admin 分层 | 作为二阶段权限基线 |
| 课程与项目 | 基础管理、学习入口、详情读取可用 | 升级为可分配、可发布、可验收的教学资源 |
| Agent 手册 | 已支持手册与步骤验证主链路 | 纳入作业资源、提交与评分证据 |
| Classic Lab | K8S create / active / noVNC / terminal / execute / stop 已打通 | 纳入实训任务、提交证据、资源配额与异常监控 |
| 历史 OpenClaw 模块 | 已于 2026-07-14 下架 | 仅保留归档分支、迁移与历史审计证据 |
| Teacher Portal | 已有 dashboard / courses / projects / manuals / progress | 升级为教学工作台，而不是只读教务入口 |
| Admin Portal | 已聚焦 dashboard / users / settings / rbac | 升级为平台运行、资源、审计与质量管理中心 |

### 主要缺口

| 缺口 | 影响 |
| --- | --- |
| 没有班级 / 学期 / 班级成员模型 | 教师无法面向真实教学组织分配任务 |
| 没有作业 / 任务发布模型 | 课程、项目、Lab、Agent 之间无法形成教学任务闭环 |
| 没有提交 / 评分 / 反馈模型 | 学生完成实验后无法形成可追踪的教学成果 |
| 教师进度页偏只读 | 缺少待批改、催交、退回、重开、详情钻取等教学动作 |
| 管理端资源治理不完整 | K8S 会话、配额、模板、异常回收、审计缺少统一闭环 |
| 内容发布缺少门禁 | 课程 / 项目 / 手册 / 环境可能出现“发布了但学生不可用”的断链 |

## 3. 竞品启发

二阶段不照搬 LMS，但吸收成熟平台的闭环结构：

| 平台能力 | 可借鉴方向 | Agent EDU 落点 |
| --- | --- | --- |
| Canvas Assignments / Gradebook | 作业列、提交状态、成绩与教师评语联动 | 作业、提交、评分、反馈、成绩发布 |
| Moodle Assignment / Gradebook / Learning plans | 学习计划、活动提交、成绩簿与通知 | 班级任务、学习计划、学生待办与成绩反馈 |
| GitHub Classroom Autograding | 提交触发自动测试、学生可见测试结果 | Lab execute / Agent verification 作为自动验证证据 |
| Vocareum Cloud Labs | 云实验、集中管理、自动评分、成本控制 | K8S Lab 模板、资源配额、提交证据、成本 / 异常观测 |
| Skillable Scored Labs | 实操环境评分、活动得分、技能验证 | 实训任务分步验证、Rubric、技能掌握度 |

参考链接：

- [Canvas Gradebook](https://community.canvaslms.com/docs/DOC-10241)
- [Moodle LMS Features](https://moodle.com/us/products/lms/features/)
- [GitHub Classroom Autograding](https://docs.github.com/education/manage-coursework-with-github-classroom/teach-with-github-classroom/use-autograding)
- [Vocareum Cloud Labs](https://www.vocareum.com/cloud-labs/)
- [Skillable Scored Labs](https://docs.skillable.com/v1/docs/activities)

## 4. 开发门禁

### 4.1 任务拆分规则

二阶段所有需求默认按 `L3 业务子系统` 处理。

禁止拆成：

- 只做教师页面
- 只做学生页面
- 只做管理页面
- 只做列表读取
- 只做单条新增
- 只做静态 Dashboard

必须拆成：

- 班级与教学组织闭环
- 内容生产与发布闭环
- 作业发布与实训任务闭环
- 提交、验证、评分、反馈闭环
- 教学过程工作台闭环
- 管理与运维闭环
- AI 助教辅助闭环

### 4.2 每个模块的最小闭环

每个二阶段模块必须同时覆盖：

- 数据模型
- Go 后端 API
- 教师端入口
- 学生端入口
- 管理端观测 / 治理入口
- 权限边界
- 状态机
- 主要写链路
- 列表 / 详情 / 搜索 / 筛选 / 刷新
- loading / empty / error / unauthorized / forbidden / success / disabled 状态
- 操作后的统计、列表、详情同步
- 自动化测试或稳定的手动冒烟脚本

未覆盖完整闭环时，只能标记为：

- 模块首版主链路
- 页面展示层
- 读链路已打通
- 仍缺闭环项

不得标记为：

- 模块完成
- 页面完成
- 100% 完成

## 5. 二阶段模块拆解

### M0 一阶段收口基线

目标：冻结当前 Go 主链路，作为二阶段开发基线。

最小闭环：

- 后端通过 `go test ./...`
- 前端通过 `npm exec tsc --noEmit`
- 登录、角色跳转、teacher scope、token blacklist、`/ws/terminal` blacklist 完成回归
- 明确记录一阶段已完成项、遗留边界和不能回退的架构事实
- 更新 `PROJECT-STATUS.md` 或阶段记录，防止后续会话被旧 TS / Docker 语义带偏

验收：

- 学生、教师、管理员三端登录与权限隔离可用
- `/api/teacher/*` 教师资源归属限制可用
- `/api/courses`、`/api/projects` 学生主链路不受 teacher scope 影响
- logout 后 HTTP 与 terminal websocket 旧 token 均失效

### M1 班级与教学组织闭环

目标：让平台具备真实教学组织能力。

核心能力：

- 管理学期、班级、班级成员、任课教师关系
- 教师创建 / 编辑 / 停用自己负责的班级
- 教师导入学生、移除学生、查看成员状态
- 学生查看自己所属班级和任课教师
- 管理员查看全校班级结构，处理异常成员和停用班级

推荐实体：

- `terms`
- `classes`
- `class_members`
- `class_teachers`

推荐接口：

- `GET /api/teacher/classes`
- `POST /api/teacher/classes`
- `GET /api/teacher/classes/:id`
- `PUT /api/teacher/classes/:id`
- `POST /api/teacher/classes/:id/members/import`
- `DELETE /api/teacher/classes/:id/members/:userId`
- `GET /api/student/classes`
- `GET /api/admin/classes`
- `PATCH /api/admin/classes/:id/status`

验收：

- 教师 A 创建班级并导入学生后，学生端能看到该班级
- 教师 A 不能管理教师 B 的班级
- 管理员能查看、停用任意班级
- 停用班级后不再允许发布新作业，但历史提交和成绩可查询

当前实现备注：

- 2026-04-22 已完成 `单主教师版` 首版主链路
- 已落地学期、班级、班级成员、主教师关系、教师端班级管理、学生端 `/study` 班级摘要、管理端班级组织页
- 多教师协同分配、班级下任务分发、班级通知中心继续留在后续阶段

### M2 内容生产与发布闭环

目标：避免“内容能保存但学生不可用”的伪完成。

核心能力：

- 课程、项目、Agent 手册、Lab 模板形成统一发布门禁
- 教师可草稿编辑、预览学生视角、发布、下架、归档
- 发布前检查素材、手册步骤、验证命令、环境镜像与 Lab 模板
- 管理员维护 Lab 模板、镜像、资源配额和发布审计

推荐实体：

- `lab_templates`
- `content_publish_checks`
- `publish_audit_logs`

推荐接口：

- `POST /api/teacher/courses/:id/publish-check`
- `POST /api/teacher/projects/:id/publish-check`
- `POST /api/teacher/manuals/:id/publish-check`
- `GET /api/admin/lab-templates`
- `POST /api/admin/lab-templates`
- `PUT /api/admin/lab-templates/:id`
- `PATCH /api/admin/lab-templates/:id/status`

验收：

- 缺少 Agent 手册或验证命令时，教师发布前能看到明确阻断原因
- Classic Lab 课程必须能解析有效 K8S 模板或镜像配置
- 历史已下架项目类型必须阻断重新发布；普通项目统一校验 Classic Lab 镜像或模板
- 学生预览与真实学生入口一致

当前实现备注：

- 2026-04-23 已完成 `首版主链路`
- 已落地 `publishing` 后端子系统、发布阻断、发布审计、Lab 模板管理与教师端发布治理
- 已补管理端 `/admin/content-governance`
- 已补发布门禁专项路由测试；2026-04-24 已补真实浏览器级专项冒烟文档记录，截图 / 录屏附件继续留在后续阶段

### M3 作业发布与实训任务闭环

目标：把课程、项目、Agent、Lab 串成真实教学任务。

核心能力：

- 教师创建作业，绑定班级和教学资源
- 支持绑定课程课时、项目单元、Agent 手册或 Classic Lab
- 设置截止时间、尝试次数、评分规则、是否允许迟交、是否允许重做
- 学生在学习中心看到待完成任务，点击后进入对应学习 / 实训入口
- 管理员查看任务分布、发布异常、资源压力

推荐实体：

- `teaching_assignments`
- `assignment_resources`
- `assignment_classes`
- `assignment_rules`

状态机：

- `draft`
- `published`
- `closed`
- `archived`

推荐接口：

- `GET /api/teacher/assignments`
- `POST /api/teacher/assignments`
- `GET /api/teacher/assignments/:id`
- `PUT /api/teacher/assignments/:id`
- `POST /api/teacher/assignments/:id/publish`
- `POST /api/teacher/assignments/:id/close`
- `POST /api/teacher/assignments/:id/draft`
- `GET /api/student/assignments`
- `GET /api/student/assignments/:id`
- `GET /api/admin/assignments/overview`
- `GET /api/admin/assignments`

验收：

- 教师发布作业后，班级内学生立即看到待办
- 不在班级内的学生看不到该作业
- 草稿作业学生不可见
- 关闭作业后学生不能新增提交，但教师和管理员可查看历史记录

当前实现备注：

- 2026-04-23 已完成 `首版主链路`
- 已落地 `assignment` 后端子系统、四张作业表、教师 / 学生 / 管理端首版接口
- 已补教师端 `/teacher/assignments`、学生端 `/study` 我的任务区块、管理端 `/admin/assignments`
- 已补后端路由测试，覆盖可见性、越权、关闭详情与发布门禁
- 提交、验证证据、评分、反馈、通知催交与资源配额治理继续归入 M4-M6

### M4 提交、自动验证、评分反馈闭环

目标：形成“学生成果可追踪、教师评分可闭环”的核心教学能力。

核心能力：

- 学生提交实验结果、代码片段、截图、日志、说明文本
- 系统关联 Lab 会话、Agent 步骤、验证命令结果
- 教师查看待批改队列、自动验证结果、提交详情
- 教师按 Rubric 评分、写反馈、退回重做、发布成绩
- 学生查看成绩、反馈、验证报告和重做入口

推荐实体：

- `submissions`
- `submission_files`
- `submission_checks`
- `rubrics`
- `rubric_items`
- `grades`
- `teacher_feedback`

提交状态机：

- `not_started`
- `in_progress`
- `submitted`
- `returned`
- `graded`
- `resubmitted`

评分状态机：

- `pending`
- `auto_checked`
- `reviewed`
- `published`

推荐接口：

- `POST /api/student/assignments/:id/submissions`
- `GET /api/student/submissions/:id`
- `GET /api/student/grades`
- `GET /api/teacher/submissions`
- `GET /api/teacher/submissions/:id`
- `POST /api/teacher/submissions/:id/checks/run`
- `POST /api/teacher/submissions/:id/grade`
- `POST /api/teacher/submissions/:id/return`
- `POST /api/teacher/grades/:id/publish`

验收：

- 学生提交后，教师待批改数增加
- 自动验证结果能被教师看到，且不覆盖教师最终评分
- 教师发布成绩后，学生成绩页和作业详情同步更新
- 教师退回重做后，学生能重新提交，并保留历史提交记录

### M5 教学过程工作台闭环

目标：教师 Dashboard 从统计展示升级为可操作教学工作台。

当前交付记录：M5 首版主链路已落地，详见 [M5-TEACHING-WORKBENCH-DELIVERY.md](M5-TEACHING-WORKBENCH-DELIVERY.md)。

核心能力：

- 待批改、逾期未交、验证失败、Lab 创建失败、卡住步骤、低完成率班级
- 支持按班级、课程、项目、作业、状态筛选
- 支持查看学生详情、提交详情、Lab 日志、Agent 步骤进度
- 支持提醒学生、重开提交、退回重做、导出成绩

推荐接口：

- `GET /api/teacher/dashboard/teaching-overview`
- `GET /api/teacher/dashboard/todo-items`
- `GET /api/teacher/dashboard/risk-students`
- `GET /api/teacher/dashboard/assignment-progress`
- `POST /api/teacher/notifications/remind`

验收：

- 教师进入 dashboard 后可以直接处理待批改和异常学生
- 点击任何 KPI 都能钻取到可操作列表，而不是只有数字
- 对学生发送提醒后，学生端通知可见
- 重开提交后，学生作业状态恢复为可提交

### M6 管理与运维闭环

目标：管理员能治理平台运行质量，而不只是看系统信息。

当前交付记录：M6 首版主链路已落地，详见 [M6-OPERATIONS-GOVERNANCE-DELIVERY.md](M6-OPERATIONS-GOVERNANCE-DELIVERY.md)。

核心能力：

- 运行会话、K8S Pod / Service、资源配额、镜像模板与配置健康
- 异常会话停止、僵尸会话回收、配额调整、模板启停
- 审计日志覆盖系统域操作：配额变更、会话停止、模板启停、异常回收、权限相关操作
- 首版支持按运行时、状态、用户、来源查看会话；成本账单和更细粒度资源消耗归后续专项

推荐实体：

- `resource_quotas`
- `runtime_session_events`
- `audit_logs`

推荐接口：

- `GET /api/admin/runtime-sessions`
- `POST /api/admin/runtime-sessions/:id/stop`
- `GET /api/admin/resource-quotas`
- `PUT /api/admin/resource-quotas/:id`
- `GET /api/admin/audit-logs`
- `GET /api/admin/integrations/health`

验收：

- 管理员能停止异常 Lab 会话，且停止接口幂等
- 配额调整后，新建 Lab 会话按新配额生效
- K8S 或配置健康异常时，Dashboard 给出可消费的中文状态
- 关键操作能在审计日志查到操作者、对象、时间和结果

### M7 AI 助教辅助闭环

目标：AI 作为教师助手，不替代教师最终评分。

核心能力：

- AI 根据提交、验证结果、Lab 日志生成摘要
- AI 解释验证失败原因，给出学生可理解的改进建议
- AI 生成教师反馈草稿，教师可编辑后发布
- AI 汇总班级薄弱知识点和高频错误
- 所有 AI 建议可关闭、可追溯、不可自动发布最终成绩

已落地实体：

- `ai_requests`
- `ai_suggestions`
- `ai_feature_settings`

已落地接口：

- `POST /api/teacher/submissions/:id/ai/suggest-feedback`
- `POST /api/teacher/assignments/:id/ai/summary`
- `POST /api/teacher/students/:id/ai/weakness`
- `PATCH /api/teacher/ai-suggestions/:id`
- `GET /api/teacher/ai/status`
- `GET /api/admin/ai-settings`
- `PATCH /api/admin/ai-settings`

验收：

- AI 生成内容默认是草稿状态
- 教师未确认前，学生不可见
- AI 建议必须标明依据：提交内容、验证结果、日志或步骤进度
- 管理员可关闭 AI 辅助评分能力

## 6. 数据模型草案

### 教学组织

```text
terms
  id, name, start_date, end_date, status, created_at, updated_at

classes
  id, term_id, name, code, description, status, creator_id, created_at, updated_at

class_members
  id, class_id, user_id, role, status, joined_at, removed_at

class_teachers
  id, class_id, teacher_id, role, status, created_at
```

### 作业与任务

```text
teaching_assignments
  id, title, description, status, creator_id, due_at, allow_late, max_attempts,
  grading_mode, published_at, closed_at, created_at, updated_at

assignment_classes
  id, assignment_id, class_id, created_at

assignment_resources
  id, assignment_id, resource_type, resource_id, source_type, source_id,
  lab_runtime_mode, required, sort_order

assignment_rules
  id, assignment_id, rule_type, config_json, created_at
```

### 提交、验证、评分

```text
submissions
  id, assignment_id, student_id, attempt_no, status, lab_session_id,
  agent_manual_id, submitted_at, returned_at, graded_at, created_at, updated_at

submission_files
  id, submission_id, file_type, title, url, metadata_json, created_at

submission_checks
  id, submission_id, check_type, status, score, max_score,
  command, output, error, metadata_json, created_at

rubrics
  id, assignment_id, title, total_score, created_at, updated_at

rubric_items
  id, rubric_id, title, description, max_score, sort_order

grades
  id, submission_id, student_id, assignment_id, score, max_score,
  status, graded_by, published_at, created_at, updated_at

teacher_feedback
  id, submission_id, teacher_id, content, visibility, created_at, updated_at
```

### 平台治理

```text
notifications
  id, user_id, type, title, content, source_type, source_id, read_at, created_at

lab_templates
  id, name, runtime_mode, image, ide_image, resource_limits_json,
  status, created_by, created_at, updated_at

resource_quotas
  id, scope_type, scope_id, cpu_limit, memory_limit, session_limit,
  storage_limit, created_at, updated_at

audit_logs
  id, actor_id, action, target_type, target_id, result, detail_json, created_at
```

## 7. API 分组原则

### 教师端

教师接口只允许访问自己创建、负责或被授权的教学资源。

推荐分组：

- `/api/teacher/classes`
- `/api/teacher/assignments`
- `/api/teacher/submissions`
- `/api/teacher/grades`
- `/api/teacher/feedback`
- `/api/teacher/dashboard/*`
- `/api/teacher/notifications/*`

### 学生端

学生接口只允许访问自己所属班级、已发布任务、自己的提交与成绩。

推荐分组：

- `/api/student/classes`
- `/api/student/assignments`
- `/api/student/submissions`
- `/api/student/grades`
- `/api/student/notifications`

### 管理端

管理端关注全局治理、资源状态、审计和平台质量，不替代教师日常教学操作。

推荐分组：

- `/api/admin/classes`
- `/api/admin/assignments`
- `/api/admin/lab-templates`
- `/api/admin/resource-quotas`
- `/api/admin/runtime-sessions`
- `/api/admin/audit-logs`
- `/api/admin/integrations/*`

## 8. 前端页面地图

### 教师端

- `/teacher/dashboard`：教学工作台
- `/teacher/classes`：班级与成员
- `/teacher/assignments`：作业与实训任务
- `/teacher/assignments/:id`：作业详情、提交、进度
- `/teacher/submissions/:id`：提交批改与反馈
- `/teacher/grades`：成绩簿
- `/teacher/courses`、`/teacher/projects`、`/teacher/manuals`：内容生产与发布

### 学生端

- `/study`：学习中心，增加待办任务和班级入口
- `/student/assignments`：我的任务
- `/student/assignments/:id`：任务详情与进入实训
- `/student/submissions/:id`：提交详情
- `/student/grades`：我的成绩与反馈
- `/lab`：作为课程和项目的统一实训运行入口

### 管理端

- `/admin/dashboard`：平台运行与教学质量总览
- `/admin/classes`：组织结构观测与异常处理
- `/admin/lab-templates`：实验模板与镜像
- `/admin/resource-quotas`：资源配额
- `/admin/runtime-sessions`：运行会话
- `/admin/audit-logs`：审计日志

## 9. 前端页面与组件设计规范

二阶段新增前端页面必须先参考项目现有设计系统，不允许另起一套后台模板或组件体系。

主参考文档：

- [EDU_Frontend/DESIGN.md](../EDU_Frontend/DESIGN.md)
- [feature-delivery-checklist.md](feature-delivery-checklist.md)

### 9.1 技术与组件边界

- 继续使用 React 18 + TypeScript + Vite。
- UI 组件继续使用 HeroUI + Tailwind CSS + Framer Motion。
- 图标只使用 `lucide-react`，不额外引入新图标库。
- 通用工具栏优先复用 `ToolbarSearchField`、`ToolbarSelect`。
- 确认类操作优先复用 `ConfirmDialog`。
- 全局反馈优先使用 Toast / HeroUI `addToast`，不使用浏览器 `alert`。
- 新增服务请求放在 `EDU_Frontend/src/services/*`，类型放在 `EDU_Frontend/src/types/*` 或业务服务文件内，不在页面组件里散落请求细节。

### 9.2 三端视觉边界

学生端：

- 保持主门户学习体验，使用动态 `Background`、浮动 Navbar、AgentWidget、GuideHub 等现有学生端语义。
- 新增“我的任务 / 我的成绩 / 作业详情”不能做成后台表格页，应以学习路径、待办、反馈、继续实训为核心。
- 可使用更强的动效和学习氛围，但必须保证任务状态、截止时间、提交入口清晰。

教务端：

- 保持 `/teacher/*` 侧边栏工作台结构和 `Teacher Portal` 语义。
- 页面应围绕教师决策与操作：待批改、逾期、异常、班级完成率、学生详情、提醒、退回、评分。
- 避免只有 KPI 卡片；每个关键数字必须能钻取到可操作列表或详情。

管理端：

- 保持 `/admin/*` 固定侧边栏 + 粘性 Header 的系统控制台语义。
- 页面应围绕平台治理：资源、配额、会话、健康检查、审计、权限。
- 不把管理端做成课程教务操作台；日常教学动作仍归教师端。

Lab：

- `/lab` 保持学生实训工作区语义，课程与项目共用同一 K8S 运行时和交互契约。
- `/lab` 保持实训运行界面优先，新增作业关联信息时不能挤压 terminal / noVNC / Agent 的核心操作区。

### 9.3 页面组件交付清单

每个二阶段前端页面开工前必须列出：

- 路由：页面挂在哪个端、是否受角色保护、未授权去哪里。
- 数据：读取哪些接口、写入哪些接口、是否需要聚合接口。
- 布局：主工作区、筛选区、详情区、操作区、空态区如何分布。
- 组件：复用哪些已有组件，新增哪些业务组件，组件放在哪个目录。
- 交互：搜索、筛选、分页、刷新、详情、Drawer、Dialog、批量操作是否需要。
- 状态：loading、empty、error、unauthorized、forbidden、success、disabled、submitting。
- 联动：保存、发布、提交、评分、提醒、停止会话后，哪些列表 / 统计 / 详情需要刷新。
- 响应式：桌面、平板、移动端至少保证可读可操作，不能只适配宽屏。

### 9.4 页面质量要求

- 产品工作台页面以“可操作信息架构”为先，不默认堆 dashboard-card mosaics。
- 卡片只在承载明确交互或分组时使用；能用分区、表格、列表、状态条表达的，不滥用大卡片。
- 列表长文本默认单行截断，关键状态使用 Badge / Chip，危险操作必须有确认。
- 表单必须有默认值、校验、提交中禁用、成功反馈、失败反馈和关闭 / 返回策略。
- Modal / Drawer / Tabs 不允许只做外观，必须接真实数据和真实行为。
- Framer Motion 只做页面入场、列表过渡、弹窗出现、状态切换等有助于理解的动效，不做噪音动画。
- 新增页面不得出现假按钮、假 Tab、假社交登录、假统计、硬编码 demo 数据冒充真实链路。

### 9.5 每阶段前端落点

| 模块 | 教师端前端 | 学生端前端 | 管理端前端 |
| --- | --- | --- | --- |
| M1 班级与教学组织 | 班级列表、成员管理、导入、停用 | 我的班级、任课教师 | 全校班级、异常成员、停用治理 |
| M2 内容生产与发布 | 发布检查、学生预览、素材 / 手册完整性 | 只看已发布内容 | Lab 模板、镜像、发布审计 |
| M3 作业发布与实训任务 | 作业创建、发布、分配、详情 | 我的任务、任务详情、进入实训 | 作业分布、异常发布、资源预估 |
| M4 提交评分反馈 | 待批改、提交详情、Rubric、反馈 | 提交、成绩、反馈、重做 | 提交趋势、异常提交观测 |
| M5 教学过程工作台 | 待办、风险学生、进度钻取、提醒 | 通知、待办变化、重开提交 | 教学质量观测 |
| M6 管理与运维 | 只读关联状态 | 只读异常提示 | 会话、配额、健康、审计、停止异常 |
| M7 AI 助教辅助 | 摘要、反馈草稿、薄弱点诊断 | 只看教师确认后的反馈 | AI 能力开关、审计 |

## 10. 验收场景

### 场景 A：班级到作业发布

1. 教师创建班级。
2. 教师导入学生。
3. 教师创建作业并绑定课程课时和 Agent 手册。
4. 教师发布作业。
5. 学生端出现待完成任务。
6. 管理端能看到该作业及其资源预估。

### 场景 B：实训提交到评分反馈

1. 学生从作业进入课程 / 项目 / Lab。
2. 学生完成 Agent 步骤和验证命令。
3. 学生提交实验结果。
4. 系统记录 Lab 会话、验证结果、提交时间。
5. 教师在待批改队列查看提交。
6. 教师评分、写反馈并发布。
7. 学生看到成绩和反馈。
8. Dashboard 统计同步更新。

### 场景 C：异常与治理

1. 学生 Lab 创建失败或验证失败。
2. 教师 Dashboard 出现风险学生 / 异常任务。
3. 教师查看日志、提醒学生或重开提交。
4. 管理员查看 K8S 与配置健康状态。
5. 管理员停止异常会话或调整配额。
6. 审计日志记录关键操作。

## 11. 明确不做项

二阶段默认不做：

- 多租户 SaaS 组织隔离
- 外部 LMS LTI 深度集成
- 自动替代教师最终评分
- 大规模考试防作弊系统
- 复杂财务 / 计费系统
- 回退 TS 后端实现新增能力
- Docker 管理面重建

这些能力如果后续需要，应作为独立三阶段或专项方案，不混入二阶段闭环开发。

## 12. 阶段节奏

| 阶段 | 目标 | 合入门禁 |
| --- | --- | --- |
| M0 | 一阶段收口基线 | Go 测试、前端类型检查、权限与退出回归 |
| M1 | 班级与教学组织 | 教师建班、学生可见、管理员治理闭环 |
| M2 | 内容生产与发布 | 发布门禁、学生预览、模板治理闭环 |
| M3 | 作业发布与实训任务 | 作业从教师发布到学生待办可见闭环 |
| M4 | 提交、验证、评分、反馈 | 学生提交到教师评分再到学生反馈闭环 |
| M5 | 教学过程工作台 | 教师能从 Dashboard 处理待办和异常 |
| M6 | 管理与运维 | 管理员能治理会话、配额、模板、审计 |
| M7 | AI 助教辅助 | AI 草稿、摘要、诊断可用且可控 |

每个阶段合入时必须补充：

- 后端测试结论
- 前端类型检查结论
- 三端手动冒烟记录
- 已完成闭环项
- 未完成项及原因
- 下一阶段入口

## 13. M0-M7 分阶段执行步骤清单

本节用于把 M0-M7 从“阶段目标”拆成可直接执行的工程步骤。每个阶段都必须按固定顺序推进：数据与迁移、后端接口、权限与状态、前端三端入口、测试与冒烟、文档与进度同步。

### 13.1 M0 一阶段收口基线

目标：冻结当前 Go 主链路，形成二阶段开工前的可信基线。

执行步骤：

1. 数据与迁移：确认当前云端 MySQL 连接、Redis blacklist 配置、现有迁移脚本和 `creator_id` 兜底说明一致。
2. 后端接口：回归 `/api/auth/*`、`/api/teacher/*`、`/api/admin/*`、`/api/lab/*`、`/ws/terminal` 主链路。
3. 权限与状态：验证 student / teacher / admin 三端角色跳转、Casbin 继承、teacher scope、logout blacklist、HTTP 与 WebSocket token 失效。
4. 前端三端入口：冒烟 `/login` 学生弹窗、`/admin/login` 教务 / 管理登录、`/teacher/dashboard`、`/admin/dashboard`、Navbar 三端入口。
5. 测试与冒烟：执行 `go test ./...`、`npm exec tsc --noEmit`，补一轮真实浏览器三角色登录与 Lab 关键链路记录；若云库没有稳定可用的 Lab smoke 源，允许临时创建草稿 smoke 课程进行 Classic Lab 验证，并在验证后删除。
6. 文档与进度同步：更新 `PROJECT-STATUS.md`、`EDU_Backend_Go/docs/development-progress.md`，明确 M0 已完成项、未完成项和 M1 入口。

合入门禁：

- Go 测试与前端类型检查通过。
- 三端登录、权限隔离、teacher scope、blacklist HTTP / WS 回归通过。
- 历史下架模块不再纳入 M1 当前验收；若发现旧入口或旧类型残留，必须按下架缺陷处理。

### 13.2 M1 班级与教学组织闭环

目标：建立真实教学组织模型，让教师能按班级管理学生并分配后续教学任务。

执行步骤：

1. 数据与迁移：新增 `terms`、`classes`、`class_members`、`class_teachers` 迁移，补状态字段、创建者字段、必要索引和兼容默认值。
2. 后端接口：新增 teacher / student / admin 三组班级接口，后端按 domain repository / service / handler 分层实现。
3. 权限与状态：教师只能管理自己创建或任课的班级，学生只能读取自己的班级，管理员可查看和停用全部班级。
4. 前端三端入口：教师端新增班级列表、班级详情、成员导入、移除成员、停用班级；学生端新增我的班级；管理端新增全校班级观测与异常成员处理。
5. 测试与冒烟：覆盖教师 A 无法管理教师 B 班级、学生加入班级后可见、停用班级后不可发布新任务、历史记录仍可查。
6. 文档与进度同步：在阶段记录中写明 M1 完成的班级生命周期、未覆盖的导入增强项和 M2 内容发布入口。

合入门禁：

- 教师建班、导入学生、学生可见、管理员停用班级形成端到端闭环。
- 所有班级页面具备 loading / empty / error / forbidden / success 状态。
- 班级成员变化后教师端、学生端、管理端列表与统计同步刷新。

### 13.3 M2 内容生产与发布闭环

目标：让课程、项目、Agent 手册、Lab 模板发布前可检查、可预览、可审计。

执行步骤：

1. 数据与迁移：新增或扩展 `lab_templates`、`content_publish_checks`、`publish_audit_logs`，记录模板、检查结果和发布审计。
2. 后端接口：新增课程、项目、手册的 publish-check 接口，新增管理端 Lab 模板 CRUD / 启停接口。
3. 权限与状态：教师只能检查和发布自己有权限的内容，管理员可维护模板和查看发布审计，草稿 / 发布 / 下架 / 归档状态必须一致。
4. 前端三端入口：教师端补发布检查、学生视角预览、素材 / 手册 / 验证命令完整性提示；管理端补 Lab 模板、镜像、资源限制和发布审计页面。
5. 测试与冒烟：覆盖缺少手册、缺少验证命令、Classic Lab 模板无效、历史项目类型防回流时的阻断提示。
6. 文档与进度同步：记录可发布内容标准、发布阻断规则和 M3 作业绑定可用资源范围。

合入门禁：

- 教师不能发布缺少关键实训链路的内容。
- 学生预览和真实学生入口一致。
- 管理端能追溯模板变更和内容发布记录。

### 13.4 M3 作业发布与实训任务闭环

目标：把班级、课程、项目、Agent、Classic Lab 串成可分配的实训任务。

执行步骤：

1. 数据与迁移：新增 `teaching_assignments`、`assignment_resources`、`assignment_classes`、`assignment_rules`，补作业状态、截止时间、尝试次数和评分模式。
2. 后端接口：新增教师作业列表、创建、编辑、详情、发布、关闭接口；新增学生任务列表 / 详情接口；新增管理端作业观测接口。
3. 权限与状态：草稿仅教师可见，发布后仅目标班级学生可见，关闭后不可新增提交但历史可查。
4. 前端三端入口：教师端新增作业创建向导、资源绑定、班级分配、发布确认和详情页；学生端新增我的任务和任务详情入口；管理端新增作业分布、异常发布和资源预估视图。
5. 测试与冒烟：覆盖班级可见性、非班级学生不可见、草稿不可见、关闭后不可提交、项目资源正确进入 `/lab`。
6. 文档与进度同步：记录作业状态机、资源绑定规则、M4 提交入口和延期项。

合入门禁：

- 教师发布作业后，学生端待办立即可见。
- 作业详情能正确跳转课程、项目、Agent 或 Lab。
- 管理端能看到作业数量、发布状态和异常任务。

### 13.5 M4 提交、自动验证、评分反馈闭环

目标：让学生实训成果可提交、可验证、可评分、可反馈、可追踪。

执行步骤：

1. 数据与迁移：新增 `submissions`、`submission_files`、`submission_checks`、`rubrics`、`rubric_items`、`grades`、`teacher_feedback`。
2. 后端接口：新增学生提交、提交详情、成绩查看接口；新增教师提交队列、提交详情、运行验证、评分、退回、发布成绩接口。
3. 权限与状态：提交状态覆盖 not_started / in_progress / submitted / returned / graded / resubmitted，评分状态覆盖 pending / auto_checked / reviewed / published。
4. 前端三端入口：学生端补提交表单、验证报告、成绩反馈、重做入口；教师端补待批改队列、提交详情、Rubric 评分、反馈编辑和发布成绩。
5. 测试与冒烟：覆盖学生提交后教师待批改增加、自动验证不覆盖教师评分、教师退回后学生可重交、成绩发布后学生可见。
6. 文档与进度同步：记录提交证据范围、评分发布规则、M5 教学工作台需要聚合的待办与风险数据。

合入门禁：

- 学生提交到教师评分再到学生查看反馈形成完整闭环。
- 自动验证结果、Lab 会话、Agent 步骤进度能作为提交证据展示。
- 退回重做保留历史提交，不覆盖旧评分和反馈记录。

### 13.6 M5 教学过程工作台闭环

目标：把教师 Dashboard 从只读统计升级为可处理教学待办的工作台。

执行步骤：

1. 数据与迁移：优先复用 M1-M4 数据，必要时补通知、提醒、工作台聚合缓存或事件记录。
2. 后端接口：新增教师工作台聚合接口，覆盖待批改、逾期未交、验证失败、Lab 失败、风险学生、班级完成率和作业进度。
3. 权限与状态：教师只能看到自己班级和作业的待办；提醒、重开提交、退回重做必须写审计或事件。
4. 前端三端入口：教师端改造 dashboard，KPI 必须可钻取到列表或详情，补提醒学生、重开提交、查看 Lab 日志和学生详情。
5. 测试与冒烟：覆盖待批改数、逾期数、风险学生、提醒后学生通知、重开提交后学生状态变化。
6. 文档与进度同步：记录工作台指标口径、可操作项、未完成的高级分析和 M6 管理端治理入口。

合入门禁：

- 教师能从 dashboard 直接处理至少一类待办和一类异常。
- 每个关键数字都有钻取路径，不允许只有静态 KPI。
- 操作后 dashboard、列表、学生端通知或状态同步更新。

### 13.7 M6 管理与运维闭环

目标：让管理员能治理平台运行质量、资源配额、异常会话和审计，而不是只看只读概览。

当前交付记录：M6 首版主链路已落地，详见 [M6-OPERATIONS-GOVERNANCE-DELIVERY.md](M6-OPERATIONS-GOVERNANCE-DELIVERY.md)。

执行步骤：

1. 数据与迁移：新增或完善 `resource_quotas`、`runtime_session_events`、`audit_logs`，关联用户、班级、作业、Lab 会话和操作人。
2. 后端接口：新增运行会话、停止会话、资源配额、Lab 模板、审计日志、集成健康聚合接口。
3. 权限与状态：管理员拥有全局治理权限；停止会话和清理接口必须幂等；NotFound 作为可接受状态处理。
4. 前端三端入口：管理端补运行会话、资源配额、健康检查、审计日志、异常回收入口；教师端和学生端仅展示必要的只读异常提示。
5. 测试与冒烟：覆盖停止异常会话、配额调整生效、K8S 异常状态展示、审计日志记录操作者和结果。
6. 文档与进度同步：记录管理端运维能力边界、生产 Redis / K8S 配置要求和 M7 AI 开关入口。

合入门禁：

- 管理员能停止异常会话并看到状态变化。
- 配额调整影响后续新建 Lab 会话。
- 关键治理操作均进入审计日志。

### 13.8 M7 AI 助教辅助闭环

目标：让 AI 成为教师的评分与反馈助手，但不替代教师最终判断。

执行步骤：

1. 数据与迁移：新增 `ai_requests`、`ai_suggestions`、`ai_feature_settings`，记录输入依据、生成结果、确认人、采纳内容和全局开关。
2. 后端接口：新增提交反馈草稿、作业摘要、薄弱点诊断、建议确认 / 忽略与 AI 开关接口，接入现有 AI 配置与服务边界。
3. 权限与状态：AI 结果默认是草稿，教师确认前学生不可见，管理员可关闭 AI 辅助能力。
4. 前端三端入口：教师端补 AI 摘要、反馈草稿、薄弱点诊断和采纳 / 编辑 / 放弃；学生端只显示教师确认后的反馈；管理端补 AI 能力开关和审计。
5. 测试与冒烟：覆盖 AI 草稿不可直接发布、教师编辑后发布、管理员关闭后入口禁用、AI 依据可追溯。
6. 文档与进度同步：记录 AI 使用边界、不可自动评分规则、提示词 / 模型配置位置和后续三阶段增强方向。

合入门禁：

- AI 只能生成建议和草稿，不能自动发布最终成绩。
- 教师确认后的反馈才进入学生端。
- AI 建议能追溯到提交内容、验证结果、日志或步骤进度。

## 14. 默认假设

- 平台定位为单校 / 机构版。
- 管理员继承教师入口能力，但管理端不替代教师日常教学操作。
- 学生端以任务、学习、提交、反馈为主，不暴露后台式管理页面。
- AI 能力只做辅助评分、反馈草稿和学习诊断，不自动发布最终成绩。
- 历史 OpenClaw 模块已下架，不再参与项目、作业或运行时模型；所有新项目实训统一使用 Classic Lab。
- 新增能力默认落在 `EDU_Backend_Go`，TS 后端仅作为历史行为参考。
