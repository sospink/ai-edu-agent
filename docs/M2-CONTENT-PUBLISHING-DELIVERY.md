# M2 内容生产与发布闭环首版主链路交付记录

最后更新：2026-04-24

## 当前结论

- `M2` 已完成首版主链路，不应表述为“模块已完成”
- 当前已打通：
  - Go 后端 `publishing` 子系统
  - 课程 / 项目 / Agent 手册统一发布检查
  - 发布阻断与发布审计
  - Lab 模板接入 Classic Lab 运行时
  - 教师端课程 / 项目 / 手册发布治理首版
  - 管理端内容治理页首版（Lab 模板 + 发布审计）
- 当前仍缺：
  - 管理端检索、批量治理与更深层审计钻取

## 本轮范围

### 后端

- 已新增 `lab_templates`、`content_publish_checks`、`publish_audit_logs`
- 已接入 `AutoMigrate`
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
- 已落实发布语义：
  - 课程 / 项目发布前先跑检查
  - 检查含 `errors` 时返回 `409`，不更新发布状态
  - `warnings` 允许发布，但写入审计
  - 手册 `isPublished=1` 不能绕过发布门禁

### Lab 模板与运行时

- 课程、项目已支持绑定 `labTemplateId`
- Classic Lab 创建时优先使用模板镜像与资源配置
- 未绑定模板时继续兼容旧 `envImage / ideImage`
- OpenClaw 项目继续保持独立链路，不强绑 Classic 模板

### 教师端

- 课程管理：
  - 已支持 Lab 模板选择
  - 已支持发布检查 Drawer
  - 已支持学生视角预览 Drawer
  - 已支持发布 / 下架 / 草稿状态切换
- 项目管理：
  - 已支持 Lab 模板选择
  - 已支持发布检查 Drawer
  - 已支持学生视角预览 Drawer
  - 已支持发布 / 下架 / 草稿状态切换
- 实训手册：
  - 已从单纯发布复选框升级为“保存内容 / 发布检查 / 检查后发布 / 设为草稿”
  - 已展示发布阻断与检查摘要
  - 已在发布检查 Drawer 中提供步骤级预览摘要

### 管理端

- 已新增 `/admin/content-governance`
- 首版包含两个 Tab：
  - `Lab 模板`
  - `发布审计`
- `Lab 模板` 已支持：
  - 列表
  - 创建
  - 编辑
  - 启用 / 停用
- `发布审计` 已支持：
  - 分页列表
  - 内容类型 / 动作 / 结果筛选
  - 详情 Drawer 查看 errors / warnings / snapshot

## 规则落实情况

### 课程 / 项目

- 基础信息为空会阻断
- 结构为空会阻断
- Classic Lab 内容缺镜像且未绑定启用中的模板会阻断
- Lab / Challenge 课时或单元缺已发布手册或缺验证规则会阻断
- OpenClaw 项目标签异常或健康检查失败会阻断

### Agent 手册

- 标题为空会阻断
- 步骤为空会阻断
- 步骤内容为空会阻断
- 全手册无有效验证规则会阻断

## 验证结果

- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 2026-04-23 收口补充

- 已补发布门禁专项路由测试：
  - 课程实验课时缺 Agent 手册时发布返回 `409`
  - Agent 手册缺有效验证规则时直接发布返回 `409`
  - Classic Lab 绑定停用 Lab 模板时发布返回 `409`
  - 疑似 OpenClaw 项目缺 `OpenClaw` 标签时发布返回 `409`
- 已核验技术债 Review 修正项：
  - `EDU_Frontend/src/services/api.ts` 当前未打印 token 片段
  - `EDU_Frontend/src/components/study/LabPage.tsx` 当前未发现 `console.log`
  - 默认管理员密码已通过 `DEFAULT_ADMIN_PASSWORD` 配置项治理，测试 fixture 中的 `admin@123` 不作为生产安全债处理

## 2026-04-24 浏览器级冒烟补档

- Admin：使用 `admin` 账号进入 `/admin/content-governance`
  - `Lab 模板` Tab 正常加载已有模板
  - 创建 `M2 浏览器冒烟模板` 成功，页面出现 `Lab 模板已创建` Toast
  - 停用该模板成功，确认弹窗文案为 `停用 Lab 模板`
  - 切换到 `发布审计` Tab 后可见 `模板创建` 与 `模板状态` 两条成功审计记录
- Teacher Portal：
  - 使用 `teacher` 账号进入 `/teacher/courses`，教务端 Layout 与课程空态正常展示
  - 当前本地历史课程 `creatorId=0`，普通教师账号无可管理课程；因此发布检查链路使用管理员显式进入教务端验证
  - 管理员显式进入 `/teacher/courses` 后，对 `智能体框架与开发` 执行 `发布检查`
  - 发布检查 Drawer 正常打开，显示 `需修复`、阻断项 `1`
  - 阻断原因明确为 `关联手册尚未发布`，关联资源为 `创意风暴 - 多智能体协作开发实训手册`
- Student：使用 `m0_student_smoke` 账号进入 `/study`
  - 学生端 Layout 正常展示，无管理端 / 教务端菜单混入
  - `我的任务` 区块正常展示空态：`当前没有发布给你的班级任务，可以继续自由学习课程。`
  - `我的班级` 区块正常展示空态：`当前还没有加入任何班级，后续教师导入后会自动出现在这里。`
  - 已发布课程内容在学习中心可见

## 明确未完成项

- 真实浏览器级专项冒烟已补文档记录；本轮未额外沉淀截图 / 录屏文件作为交付附件
- 发布审计当前以筛选和详情查看为主，未做全文检索与批量操作
- Lab 模板当前仍是模板级资源默认值，不包含 M6 的全局 / 班级 / 用户配额治理

## 结论措辞

当前只能表述为：

- `M2 已完成首版主链路`
- `已完成内容发布治理的后端与教师端 / 管理端首版闭环`

当前不能表述为：

- `M2 已完成`
- `内容生产与发布模块已 100% 完成`
