# M5 教学过程工作台闭环首版主链路交付记录

最后更新：2026-04-24

## 当前结论

- `M5` 已完成首版主链路，不应表述为“模块已完成”
- 当前已打通：
  - 教师端从 `/teacher/dashboard` 查看待批改、逾期未交、验证失败、Lab 异常、风险学生和作业进度
  - KPI 可钻取到待办列表，教师可从待办进入提交详情
  - 教师可发送站内提醒、按学生或班级重开提交
  - 学生端可在 `/study` 查看站内通知、标记已读，并通过通知打开作业详情
  - `/study?openAssignment=:id` 可自动打开作业详情 Drawer
  - 教师端新增 `/teacher/grades` 独立成绩簿，支持筛选、查看提交详情和本地 CSV 导出
  - 管理端 `/admin/assignments` 增加教学质量只读观测

## 已完成范围

### 后端

- 已新增三张 M5 表：
  - `notifications`
  - `teacher_action_logs`
  - `submission_reopens`
- 已扩展 `assignment_rules.allow_return`，退回与重提解耦：
  - `allow_return` 控制教师是否可退回
  - `allow_resubmit` 或有效 `submission_reopens` 授权控制学生是否可重交
- 已新增 / 补齐接口：
  - `GET /api/teacher/dashboard/teaching-overview`
  - `GET /api/teacher/dashboard/todo-items`
  - `GET /api/teacher/dashboard/risk-students`
  - `GET /api/teacher/dashboard/assignment-progress`
  - `GET /api/teacher/grades`
  - `POST /api/teacher/notifications/remind`
  - `POST /api/teacher/assignments/:id/reopen`
  - `GET /api/student/notifications`
  - `POST /api/student/notifications/:id/read`
  - `GET /api/admin/teaching-quality/overview`
- 已修复 M5 聚合兼容性：
  - `MAX(updated_at)` 在 SQLite 测试和 MySQL 运行时均可解析
  - `todo-items` 默认返回综合待办，传 `type` 时精确筛选
  - Lab 异常匹配补充 `source_type + resource_type` 约束，避免课程 / 项目同 ID 误匹配
  - M5 SQL 迁移中的 `allow_return` 改为幂等添加

### 前端

- 教师端 `/teacher/dashboard` 已从只读概览升级为教学过程工作台：
  - KPI 卡片可点击筛选待办
  - 待办支持查看详情、提醒、重开提交
  - 风险学生支持提醒
  - 作业进度支持班级提醒
- 教师端新增 `/teacher/grades`：
  - 成绩状态 / 班级 / 关键词筛选
  - 查看提交详情
  - 基于当前查询结果本地生成 CSV
- 作业规则表单补齐 `allowReturn`
- 学生端 `StudyAssignmentsSection` 新增通知入口：
  - 未读数量
  - 通知列表
  - 标记已读
  - 作业通知跳转详情
- 管理端 `/admin/assignments` 新增教学质量观测区块。

## 指标口径

- 待批改：`submissions.status IN submitted/resubmitted`
- 逾期未交：作业已发布 / 已关闭、`due_at < now`、目标活跃学生没有提交
- 验证失败：`submission_checks.status = failed`
- Lab 异常：关联作业资源且 `user_lab_sessions.status = error`
- 低完成率：作业进度中班级提交率低于 50%
- 风险学生：逾期未交、验证失败、低完成率、退回未重交、超过 7 天无提交或 Lab 活跃任一命中

## 验证结果

- `cd EDU_Backend_Go && go test ./internal/router -run 'TestM5WorkbenchNotificationsReopenAndGrades|TestM4SubmissionGradeReturnAndPublishFlow|TestM3AssignmentLifecycleAndVisibility' -count=1`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 明确未完成项

- M5 尚未完成浏览器级真实冒烟记录与截图 / 录屏附件
- 风险学生首版为固定规则，不包含 AI 预测或画像模型
- 通知首版仅站内通知，不包含外部 IM / 邮件 / 短信推送
- 管理端只做教学质量观测，不提供教师日常操作接管
- Lab 日志深钻仍沿用 M6 管理与运维方向，不在 M5 内展开
- 资源配额治理、异常会话回收和更深层审计归入 M6

## 结论措辞

当前只能表述为：

- `M5 已完成首版主链路`
- `已打通教学过程工作台的发现待办 → 钻取原因 → 教师操作 → 学生端同步 → 管理端观测首版闭环`

当前不能表述为：

- `M5 已完成`
- `教学过程工作台模块已 100% 完成`
