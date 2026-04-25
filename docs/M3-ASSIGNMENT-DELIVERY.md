# M3 作业发布与实训任务闭环首版主链路交付记录

最后更新：2026-04-23

## 当前结论

- `M3` 已启动并完成“作业发布与学生待办可见”的首版主链路
- 当前只能表述为“已完成 M3 首版主链路”，不能表述为“M3 模块已完成”
- 本轮不包含提交、自动验证证据、评分、反馈发布、通知催交和资源配额治理

## 已完成范围

### 后端

- 已新增四张表：
  - `teaching_assignments`
  - `assignment_resources`
  - `assignment_classes`
  - `assignment_rules`
- 已新增 SQL 迁移：
  - `EDU_Backend_Go/deployments/sql/20260423_m3_assignments.sql`
- 已接入 `AutoMigrate`
- 已新增接口：
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

### 状态与权限

- 作业状态固定为：
  - `draft=0`
  - `published=1`
  - `closed=2`
  - `archived=3`
- 教师可管理自己创建或自己主教师班级关联的作业
- 学生只能看到自己所在班级的已发布 / 已关闭作业
- 管理员首版只读观测，不做代编辑

### 发布门禁

- 无班级不能发布
- 无资源不能发布
- 绑定停用班级不能发布
- 课程 / 课时 / 项目 / 项目单元 / 手册资源必须已发布
- OpenClaw 作业资源必须绑定带 `OpenClaw` 标签的已发布项目
- 门禁失败返回 `409`，响应包含可消费的检查结果

### 前端

- 教师端新增 `/teacher/assignments`
  - 列表
  - 搜索 / 状态筛选 / 刷新
  - 创建 / 编辑作业
  - 资源绑定
  - 班级选择
  - 发布 / 关闭 / 设为草稿
  - 详情 Drawer
- 学生端 `/study` 新增“我的任务”区块
  - 待办列表
  - 任务详情 Drawer
  - 按资源类型跳转课程 / 项目 / Classic Lab / OpenClaw
- 管理端新增 `/admin/assignments`
  - 作业状态分布
  - 作业列表
  - 搜索 / 状态筛选 / 刷新

## 验证结果

- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 自动化覆盖

- 教师不能发布他人班级作业
- 草稿作业学生不可见
- 发布后目标班级学生可见
- 非班级学生不可见
- 关闭后学生仍可查看详情，但 `canEnter=false`
- 无班级、无资源、资源未发布、OpenClaw 缺标签、绑定停用班级均阻断发布

## 明确未完成项

- M4：提交、自动验证证据、评分与反馈发布
- M5：通知、催交、逾期提醒和教师过程工作台
- M6：资源配额、作业关联 Lab 会话治理和更深层审计
- 作业详情的课程课时 / 项目单元级精确跳转仍是首版跳转，后续应随 M4/M5 继续细化
