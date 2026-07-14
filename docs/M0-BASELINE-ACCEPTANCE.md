# M0 一阶段收口基线验收记录

最后更新：2026-04-22

## 1. 验收范围

本次 M0 只做一阶段 Go 主链路收口，不启动 M1 班级、作业、评分等二阶段业务开发。

本轮实际覆盖：

- Go 后端自动化回归
- 前端类型检查
- 健康检查与运行态预检
- 三端登录、角色跳转、teacher scope、token blacklist
- Classic Lab 真实运行时闭环
- 文档与状态同步

说明：本文是 2026-04-22 的历史基线验收记录；当时存在、后来于 2026-07-14 下架的 OpenClaw 检查不再属于当前验收范围，当前事实以 [OPENCLAW-RETIREMENT.md](OPENCLAW-RETIREMENT.md) 为准。

## 2. 基线环境

- 前端：`http://localhost:3000`
- Go 后端：`http://localhost:4000`
- 健康检查：`GET /api/health`
- 健康结论：`database=up`、`k8s=up`、`redis=up`

补充说明：

- 当前工作区为脏树，存在大量历史改动与未跟踪文件；本轮只追加 M0 验收文档与状态同步，不回退其他改动。
- 本轮探索产生的 `.playwright-cli/` 临时目录已清理。

## 3. 自动化基线

### 3.1 Go 测试

- 命令：`go test ./...`
- 结果：通过

### 3.2 前端类型检查

- 命令：`npm exec tsc --noEmit`
- 结果：通过

## 4. 账号与权限回归

### 4.1 Smoke 账号

- 管理员：`admin`
- 教师：`teacher01`
- 学生：`m0_student_smoke`

说明：

- 本轮为 M0 新建并保留了专用学生 smoke 账号 `m0_student_smoke`
- 本轮运行中曾多次重置 smoke 密码用于验证，但密码未写入仓库文档

### 4.2 API 权限回归

已验证：

- teacher 访问 `/api/teacher/courses` 返回 200，且只看到自己名下资源
- teacher 访问 `/api/teacher/projects` 返回 200，且只看到自己名下资源
- teacher 访问 `/api/admin/settings` 返回 403
- student 访问 `/api/teacher/courses` 返回 403
- student 访问 `/api/admin/users` 返回 403
- admin 访问 `/api/teacher/courses` 返回 200，且不受 teacher scope 限制
- 公共 `/api/courses` 与 `/api/projects` 仍可正常读取，未被 teacher scope 误伤

### 4.3 Logout 黑名单回归

已验证：

- logout 前使用同一 token 访问受保护 HTTP 接口返回成功
- `POST /api/auth/logout` 后，同一 token 再访问受保护 HTTP 接口返回 401，错误为“认证令牌已失效”
- 同一 token 访问 `/ws/terminal` 握手被拒绝，返回 `HTTP/1.1 401 Unauthorized`

## 5. 三端浏览器冒烟

使用 Playwright 完成真实浏览器冒烟，已验证：

- `/login?redirect=/profile` 会打开学生登录弹窗
- 学生登录成功后进入 `/profile`，并正确写入学生登录态
- 学生访问 `/teacher/*` 被重定向到 `/study`
- 学生访问 `/admin/*` 被重定向到 `/`
- 教师账号在学生弹窗登录时被拒绝，且不写入本地登录态
- 管理员账号在学生弹窗登录时被拒绝，且不写入本地登录态
- 未登录访问 `/teacher/dashboard` 会进入 `/admin/login?redirect=/teacher/dashboard`
- 教师从教务入口登录后进入 `/teacher/dashboard`
- 教师访问 `/admin/*` 会被拦截
- 未登录访问 `/admin` 会进入 `/admin/login?redirect=/admin`
- 管理员从管理入口登录后进入 `/admin/dashboard`
- 管理员可进入 `/teacher/dashboard`
- 学生账号在教务登录 Tab 与管理登录 Tab 都会被拒绝，且不写入本地登录态

## 6. Classic Lab 运行时冒烟

### 6.1 历史数据检查

先对现有云端数据进行了运行时基线检查：

- 现有课程 `37/34/35/36/39` 的 `envImage` 为 `opencode-lab:latest`
- 直接用现有课程 `37` 创建 Lab 时，会话 `161` 被标记为 `error`
- 错误信息为：`SSH 连接失败: Pod 尚未就绪，当前状态 Pending`

结论：

- 云库现有课程镜像配置不适合作为稳定的 M0 smoke 源

### 6.2 临时 smoke 课程闭环验证

为避免把“课程内容镜像问题”误判成“Lab 主链路失效”，本轮临时创建了一个草稿 smoke 课程用于运行时验收，验证完成后已删除。

临时 smoke 课程配置：

- 课程 ID：`41`
- Slug：`m0-runtime-final-1776869795775`
- 镜像：`registry.cn-beijing.aliyuncs.com/svinsight/course:fisco_newbasicv6`

验证结果：

- `POST /api/lab/create` 成功
- 会话 `163` 创建成功并进入 `running`
- 返回了可用的 VNC URL
- `POST /api/lab/execute` 成功，输出 `m0-lab-exec-ok`
- `/ws/terminal` 成功连接，并接收到 `m0-terminal-ok`
- `POST /api/lab/stop/163` 成功
- 会话 `163` 最终状态为 `stopped`
- 临时 smoke 课程已删除

结论：

- Classic Lab 的 `create / active / execute / terminal / stop` 真实闭环可用
- 当前需要单独处理的是“云库现有课程镜像配置”，不是 K8S Lab 主链路本身

## 7. 已下架历史模块记录

本节原记录的 OpenClaw / Feishu 健康检查属于 2026-04-22 时点的历史证据。相关产品能力已于 2026-07-14 下架，不应据此判断当前路由或配置仍然存在。

## 8. M0 结论

结论：M0 已完成本轮约定范围内的基线收口，可作为 M1 开工基线。

原因：

- 自动化基线通过
- 三端登录与权限边界通过
- teacher scope 与 blacklist HTTP / WS 回归通过
- Classic Lab 真实运行时闭环通过
- 当时暂缓的外部模块联调不阻塞 M1；该模块现已正式下架

## 9. 已知后续项

- 需要把云库现有课程的实验镜像统一回收到可稳定启动的 smoke / 正式镜像，避免再次出现 `Pod Pending`
- 管理端复杂编辑页仍需继续逐页冒烟

## 10. M1 开工条件

满足，可以进入 `M1 班级与教学组织闭环`。

建议开工前引用以下文档作为基线：

- [PROJECT-STATUS.md](PROJECT-STATUS.md)
- [development-progress.md](../EDU_Backend_Go/docs/development-progress.md)
- [PHASE-2-TEACHING-PLATFORM-UPGRADE.md](PHASE-2-TEACHING-PLATFORM-UPGRADE.md)
