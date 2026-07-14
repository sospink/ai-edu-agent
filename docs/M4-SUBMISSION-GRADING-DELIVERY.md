# M4 提交评分与反馈发布闭环首版主链路交付记录

最后更新：2026-04-24

## 当前结论

- `M4` 已完成首版主链路，不应表述为"模块已完成"
- 当前已打通：
  - 学生提交（首次 + 重新提交）
  - 提交时自动抓取证据快照（5 种当前 check_type）
  - 教师批改队列与详情评分（Rubric 分项 + 总分）
  - 教师退回（`AllowResubmit=true` 场景）
  - 教师发布成绩（`reviewed → published` 状态机）
  - 学生查看成绩与反馈（仅 `published` 可见）
  - 学生提交表单自动检测当前活跃 Lab 会话，并按作业资源自动派生 Agent 证据引用
- 当前仍缺：
  - 提交通知推送（M5）
  - AI 自动评分（M6）
  - 资源配额治理（M6）
  - 教师独立成绩单视图（`/api/teacher/grades` 列表接口）

## 已完成范围

### 后端

- 已新增七张表：
  - `submissions`
  - `submission_files`
  - `submission_checks`
  - `rubrics`
  - `rubric_items`
  - `grades`
  - `teacher_feedback`
- 已新增 SQL 迁移：
  - `EDU_Backend_Go/deployments/sql/20260424_m4_submissions.sql`
- 已接入 `AutoMigrate`
- 已新增接口：
  - `POST /api/student/assignments/:id/submissions`（首次提交 & 重新提交复用）
  - `GET /api/student/submissions/:id`（学生自己的提交详情）
  - `GET /api/student/grades`（学生成绩列表，仅返回 `published` 分数）
  - `GET /api/teacher/submissions`（批改队列，支持状态 / 班级 / 作业筛选）
  - `GET /api/teacher/submissions/:id`（提交详情，含 checks / rubric / grade / feedback）
  - `POST /api/teacher/submissions/:id/grade`（保存评分 + 反馈，状态更新为 `reviewed`）
  - `POST /api/teacher/submissions/:id/return`（退回给学生，需 `AllowResubmit=true`）
  - `POST /api/teacher/submissions/:id/checks/run`（重新触发验证，可选传 command）
  - `POST /api/teacher/grades/:id/publish`（发布成绩，`reviewed → published`，幂等）

### 状态机

- 提交状态（`submissions.status`）：
  - `not_started → in_progress → submitted → returned → graded → resubmitted`
  - 重新提交时 attempt_no 递增，历史记录不覆盖
- 成绩状态（`grades.status`）：
  - `pending → auto_checked → reviewed → published`
  - 发布只接受 `reviewed` 输入；`published` 状态下幂等 200

### 发布门禁（提交侧）

- 作业未发布不可提交（`409`）
- 学生不在目标班级不可提交（`403`）
- 超出 `AttemptLimit` 不可提交（`409`）
- 未允许重新提交时不可重复提交（`409`）
- 逾期截止时间时尊重 `AllowLate` 规则

### 证据自动快照

提交成功时在同一事务内自动写入 `submission_checks`，涵盖：

| check_type | 数据来源 |
|---|---|
| `lesson_progress` | `user_lesson_records` |
| `agent_progress` | `user_agent_progress`（步骤数 + 完成步骤列表）|
| `lab_session` | `user_lab_sessions`（提交时绑定的活跃会话）|
| `lab_command` | 教师重新验证时记录的验证命令 |
| `manual_review` | 等待教师批改 / 教师重新检查 |

快照在提交时立即生成，不依赖 Lab 会话是否仍存活。

### 评分系统

- 每个作业自动确保关联一条 `rubrics` 记录（创建时传 `rubricItems` 即生成，不传则建默认 `完成质量 / 100` 单项 Rubric）
- `rubric_items` 分项 `maxScore` 之和构成总分上限
- `GradeSubmissionRequest.Scores` 传入分项得分，后端自动对单项 clamp 至 `maxScore`，汇总为总分
- `grades.rubric_scores_json` 快照分项评分用于学生端展示

### 成绩可见性保护

- `hideUnpublishedGrade`：学生请求自己的提交 / 成绩时，若 `grade.status != 'published'`，剥除 `score`、`rubricScores`、`grade` 字段
- `feedback` 在 `published` 后随成绩一并展示
- 教师端始终可见原始数据

### 前端

- 教师端新增 `/teacher/submissions`
  - 批改队列列表
  - 状态 / 班级 / 作业 / 关键词筛选
  - 跳转详情页
- 教师端新增 `/teacher/submissions/:id`
  - 完整提交内容展示（文字 / 文件 / checks）
  - Rubric 分项评分输入（单项 clamp，总分自动汇总）
  - "重新验证" / "保存评分" / "发布成绩" / "退回给学生"
  - 发布按钮仅在 `grade.status === 'reviewed'` 时启用
- 学生端 `StudyAssignmentsSection` 新增 `SubmissionPanel`
  - 提交表单（内容文字 + 自动检测的 labSessionId / agentManualId）
  - 提交历史列表（`SubmissionHistoryCard`，含 checks / attempt_no）
  - 已发布成绩展示（绿色区块，含分项 rubric 评分）
  - 教师反馈展示（琥珀色区块）
  - `canSubmit` / `disabledReason` 控制提交入口
  - 证据输入从手填文本框改为只读检测状态，避免学生填写内部会话 ID

## 验证结果

- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 自动化覆盖（`router_m4_submission_test.go`）

覆盖完整生命周期单测：

1. 非班级学生提交被 `403` 阻断
2. 学生首次提交成功（`201`），自动快照 checks 非空
3. 教师批改队列可见该条提交（Total=1）
4. 成绩发布前学生查看 grade status 为 `pending`（分数不可见）
5. 教师退回给学生（`200`）
6. 学生重新提交（`201`），attempt_no=2，status=`resubmitted`
7. 教师对第二次提交评分（总分 90，状态 `reviewed`）
8. 教师发布成绩（`200`）
9. 学生查看成绩列表，状态 `published`，score=90
10. 作业详情 `submissionProgress.publishedGrades=1`，`returned=1`

## 明确未完成项

- **无独立教师成绩单接口**：`GET /api/teacher/grades` 列表不存在；教师当前只能通过提交列表 + 筛选间接查看已评成绩
- **Lab / Agent 证据 UX 已修正**：提交表单会自动读取当前活跃 Lab 会话，并按作业资源自动派生 Agent manual；当前仍缺历史 Lab 会话选择器。旧 OpenClaw session 列和 check 仅保留历史审计，不再由新提交生成
- **退回与重新提交的耦合**：`ReturnTeacherSubmission` 要求 `AllowResubmit=true`，不允许重新提交的班级无法退回（仅能评分 + 反馈）
- **提交通知**：M5 实现（催交 / 提交确认 / 成绩发布推送）
- **AI 自动评分**：M6 实现（check 结果 → 自动建议分数）
- **配额治理**：M6 实现（作业资源与 Lab 会话限额联动）
- **管理端提交观测**：首版未建立 admin submissions 观测接口和页面

## 结论措辞

当前只能表述为：

- `M4 已完成首版主链路`
- `已完成提交 → 评分 → 反馈 → 发布成绩的后端与教师端 / 学生端首版闭环`

当前不能表述为：

- `M4 已完成`
- `提交评分模块已 100% 完成`
