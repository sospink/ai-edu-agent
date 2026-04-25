# 数据库映射基线

来源：仓库根目录 `edu_db.sql`

## 基线原则

- 以当前 MySQL 表结构为唯一真相
- Go 首版按现表 1:1 映射
- 双栈阶段禁止 GORM 自动改表
- 允许的 schema 变更仅限非破坏性新增字段

## 当前表清单

1. `agent_manuals`
2. `agent_steps`
3. `course_lessons`
4. `course_stages`
5. `courses`
6. `lesson_materials`
7. `lesson_skills`
8. `project_tags`
9. `project_units`
10. `projects`
11. `skills`
12. `sys_users`
13. `tags`
14. `user_activity_logs`
15. `user_agent_progress`
16. `user_course_enrollments`
17. `user_lab_sessions`
18. `user_lesson_records`
19. `user_project_progress`

## 已优先建模的表

- `sys_users`

字段对齐重点：

- `id`
- `username`
- `email`
- `password`
- `phone`
- `student_id`
- `full_name`
- `avatar_url`
- `bio`
- `github_link`
- `role_type`
- `status`
- `created_at`
- `updated_at`

## 后续需要显式处理的复杂表

### `user_lab_sessions`

K8S 重构阶段建议保留现有字段，同时只新增非破坏性字段：

- `runtime_provider`
- `runtime_ref`
- `namespace`
- `pod_name`
- `service_name`

### `agent_steps`

包含 JSON 字段：

- `content`
- `quick_questions`
- `verification`

### `user_agent_progress`

包含 JSON 字段：

- `completed_steps`
- `chat_history`

## 建议迁移顺序

1. `sys_users`
2. `tags`
3. `skills`
4. `courses`
5. `course_stages`
6. `course_lessons`
7. `lesson_materials`
8. `projects`
9. `project_units`
10. `project_tags`
11. `user_*` 进度表
12. `agent_*`
13. `user_lab_sessions`
