# 三端权限体系与 Teacher Portal 现状

最后更新：2026-04-25

## 当前结论

- 当前三端分层已切到 `student / teacher / admin`
- 登录分发已固定为：
  - `student -> /study`
  - `teacher -> /teacher/dashboard`
  - `admin -> /admin/dashboard`
- 管理员继承教师权限，可直接进入 `/teacher/*`
- 旧教学管理接口仍保留兼容期，但新前端主入口已切到 `/api/student/*`、`/api/teacher/*` 与 `/api/admin/*`

## 路由与最低角色

| 路径前缀 | 最低角色 | 说明 |
| --- | --- | --- |
| `/api/courses` `/api/projects` `/api/lab` `/api/agent` `/api/learning` | `student` | 学生主链路，教师和管理员可继承访问 |
| `/api/teacher/courses` | `teacher` | 课程管理主入口，教师在该前缀下的读写都受 `creator_id` 归属限制；`admin` 走同前缀不受归属过滤限制 |
| `/api/teacher/projects` | `teacher` | 项目管理主入口，教师在该前缀下的读写都受 `created_by` 归属限制；`admin` 走同前缀不受归属过滤限制 |
| `/api/teacher/manuals` | `teacher` | 实训手册主入口，教师读写受 `creator_id` 归属限制 |
| `/api/teacher/classes` | `teacher` | 班级管理主入口，教师只能管理自己任课班级；管理员继承全量可见 |
| `/api/teacher/assignments` | `teacher` | 作业任务主入口，绑定教师可见班级与已发布教学资源 |
| `/api/teacher/submissions` `/api/teacher/grades` | `teacher` | 批改队列、评分、退回、成绩发布、成绩簿 |
| `/api/teacher/dashboard/*` | `teacher` | 教学过程工作台、待办、风险学生、作业进度 |
| `/api/teacher/agent-observatory` | `teacher` | Agent 步骤热力、卡点详情、FAQ、干预、复盘卡 |
| `/api/teacher/students/progress` | `teacher` | 课程 / 项目 / 班级学生进度，教师按任课班级过滤 |
| `/api/admin/dashboard` | `admin` | 系统总览与运行态工作台 |
| `/api/admin/classes` | `admin` | 全校班级组织观测与状态治理 |
| `/api/admin/assignments` | `admin` | 作业观测与教学质量只读看板 |
| `/api/admin/runtime-sessions` `/api/admin/resource-quotas` `/api/admin/audit-logs` | `admin` | M6 运行时治理、配额和系统审计 |
| `/api/admin/users` | `admin` | 用户管理主入口 |
| `/api/admin/settings` `/api/admin/ai-settings` | `admin` | 系统配置观测与 AI 能力开关 |
| `/api/admin/rbac/policies` | `admin` | Casbin 角色继承、策略明细、权限矩阵 |
| `/api/integrations/*` | `admin` | 保留兼容 alias，逐步收敛到管理端系统视图 |

## 兼容层说明

- 旧教学管理写接口继续保留一轮迁移周期：
  - `/api/courses/*` 的管理动作
  - `/api/projects/*` 的管理动作
  - `/api/agent/admin/*`
- `/api/courses`、`/api/projects` 仍保持学生 / 公共主链路语义，不附带 teacher 归属过滤
- 新功能默认只落在以下主入口：
  - `/api/teacher/*`
  - `/api/admin/*`
- 兼容层目标是平滑迁移，不再作为后续功能扩展入口

## 前端门户结构

### Student

- 主链路保持：
  - `/study`
  - `/projects`
  - `/lab`
  - `/api/student/classes`
  - `/api/student/assignments`
  - `/api/student/submissions`
  - `/api/student/grades`
  - `/api/student/notifications`

### Teacher

- 入口：`/teacher/dashboard`
- 固定导航：
  - 仪表盘
  - 班级管理
  - 作业任务
  - 批改队列
  - 成绩簿
  - Agent 观察台
  - 课程管理
  - 项目管理
  - 实训手册
  - 学生进度
- 教师端是教学动作主入口，管理端不再混入课程 / 项目 / 手册编辑分组

### Admin

- 入口：`/admin/dashboard`
- 当前聚焦：
  - Dashboard / K8S 运维工作台
  - 班级组织
  - 作业观测
  - 内容治理
  - 用户管理
  - 系统设置
  - 权限矩阵
- `系统设置` 已包含 AI 辅助能力开关；其他运行配置仍以观测为主
- `权限矩阵` 第一版支持刷新，不支持在线编辑

## 数据与部署补充

- `projects` 继续沿用 `created_by`
- `courses` 新增 `creator_id`
- `agent_manuals` 新增 `creator_id`
- 旧 `courses` / `agent_manuals` 数据采用“首个 admin 账号”兜底回填，仅用于兼容权限判断，不代表真实历史创建者
- 新建课程 / 项目 / 手册会按当前登录用户准确写入 `creator_id` / `created_by`
- 若后续需要精确追溯旧数据创建者，应单独执行数据治理脚本，不混入本轮权限修复
- 一次性 SQL 迁移脚本：
  - [20260422_teacher_admin_portal.sql](../deployments/sql/20260422_teacher_admin_portal.sql)
- K8S RBAC 已补齐 `edu-runtime-dev` 的 `pods/services/pods/exec` 权限

## 本轮验证

- 已通过：
  - `go test ./...`
  - `npm exec tsc --noEmit`
- 尚未完成：
  - 真实后端 + 前端启动后的浏览器级登录冒烟
  - 三种角色的页面级可达性截图验收
