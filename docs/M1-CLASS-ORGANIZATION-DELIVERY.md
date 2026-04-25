# M1 班级与教学组织闭环交付记录

最后更新：2026-04-22

## 1. 本轮定位

本轮已完成 `M1 班级与教学组织闭环` 的首版主链路，不是整个模块的最终完成版。

当前已锁定范围：

- 班级必须关联学期
- 首版成员导入支持 `CSV / XLSX`
- 学生端“我的班级”内嵌到 `/study`
- 只交付“单主教师”闭环
- `class_teachers` 已落地，但前端暂不做多教师协同分配

## 2. 已交付内容

### 2.1 数据模型

Go 后端已新增：

- `terms`
- `classes`
- `class_members`
- `class_teachers`

状态机：

- 学期：`planning / active / archived`
- 班级：`active / disabled / archived`
- 成员：`active / removed`

关键约束：

- 班级必须挂学期
- 班级必须有 `owner_teacher_id`
- 创建班级时自动写入一条 `class_teachers.role=owner`
- `class_members(class_id, user_id)` 唯一

### 2.2 后端接口

教师端：

- `GET /api/teacher/terms`
- `GET /api/teacher/classes`
- `POST /api/teacher/classes`
- `GET /api/teacher/classes/:id`
- `PUT /api/teacher/classes/:id`
- `GET /api/teacher/classes/:id/members`
- `POST /api/teacher/classes/:id/members/import`
- `DELETE /api/teacher/classes/:id/members/:userId`

学生端：

- `GET /api/student/classes`

管理端：

- `GET /api/admin/terms`
- `POST /api/admin/terms`
- `PUT /api/admin/terms/:id`
- `PATCH /api/admin/terms/:id/status`
- `GET /api/admin/classes`
- `GET /api/admin/classes/:id`
- `PATCH /api/admin/classes/:id/status`

### 2.3 权限与行为

- 教师只能读写自己作为 `owner` 的班级
- 管理员可查看全部班级与全部学期
- 学生只能看到自己 `active` 加入的班级
- 管理员停用班级后：
  - 教师默认列表不再展示该班级
  - 学生仍能看到历史班级归属
  - 历史成员记录保留

### 2.4 导入规则

成员导入规则已落地：

- 上传字段名：`file`
- 支持 `.csv`、`.xlsx`
- 模板列：`studentId / username / email`
- 匹配优先级：`studentId > username > email`
- 只允许导入 `roleType=1` 且 `status=active`
- 同文件重复、已在班级中、账号不存在、角色不符、状态异常均返回逐行结果
- 返回结构固定为：
  - `summary`
  - `rows`

## 3. 前端入口

### 教务端

新增 `/teacher/classes`：

- 列表
- 搜索
- 学期筛选
- 状态筛选
- 新建 / 编辑班级弹窗
- 班级详情抽屉
- 成员列表
- 导入弹窗
- 移除成员确认弹窗

### 学生端

`/study` 已新增“我的班级”区块：

- 班级名
- 学期名
- 主教师
- 班级状态
- 活跃成员数 / 总成员数

### 管理端

新增 `/admin/classes`：

- `学期管理`
- `班级总览`

支持：

- 新建 / 编辑学期
- 学期状态切换
- 全校班级查询
- 班级详情查看
- 班级停用 / 重新启用 / 归档

## 4. 验证结果

已通过：

- `cd EDU_Backend_Go && go test ./...`
- `cd EDU_Frontend && npm exec tsc --noEmit`
- 新增后端回归：
  - 教师创建学期与班级主链路
  - teacher scope 拦截
  - CSV 导入结果逐行返回
  - 学生班级可见性
  - 管理员停用班级后教师 / 学生联动语义

## 5. 本轮未完成项

以下内容明确延期：

- 多教师协同分配 UI
- 班级下课程 / 项目 / 作业分配
- 学生独立班级工作区
- 批量停用 / 批量导入历史对账
- 通知、提醒、班级消息中心
- 班级停用后阻断作业发布的真实业务接线
  - 当前只在后端 service 中预留规则，不对未落地的作业系统做伪实现

## 6. M2 前置条件

M2 内容生产与发布闭环可以直接建立在本轮结果上继续推进，前提是：

- 保持学期 / 班级模型不回退
- 作业与发布逻辑复用现有 `classId / termId / owner_teacher_id`
- 后续新增任务分配时优先复用 `GET /api/student/classes` 结果做学生待办聚合
