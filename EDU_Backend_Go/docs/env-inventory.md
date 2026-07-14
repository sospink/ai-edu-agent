# 环境变量清单

基于当前 TS 后端、前端与升级方案整理。

## 兼容策略

- Go 后端同时支持两套命名：
  - Go 新命名，例如 `DATABASE_HOST`
  - TS 兼容命名，例如 `MYSQL_HOST`
- 当两者同时存在时，以显式传入的环境变量覆盖配置文件值。
- 为了减轻迁移成本，当前优先保证 TS 兼容命名可直接工作。
- 默认会自动加载 dotenv 文件，优先级如下：
  - `EDU_Backend/.env` 作为迁移兜底配置
  - `EDU_Backend_Go/.env` 作为 Go 侧覆盖配置
  - 进程环境变量优先级最高

## App

- `APP_NAME`
- `APP_ENV`
- `APP_VERSION`

## Server

- `PORT`
- `HOST`
- `SERVER_HOST`
- `SERVER_PORT`
- `SERVER_READ_TIMEOUT_SECONDS`
- `SERVER_WRITE_TIMEOUT_SECONDS`

## Database

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `DATABASE_CHARSET`
- `DATABASE_MAX_OPEN_CONNS`
- `DATABASE_MAX_IDLE_CONNS`
- `DATABASE_CONN_MAX_LIFETIME_MINUTES`

## Redis

- `REDIS_ENABLED`
- `REDIS_ADDR`
- `REDIS_PASSWORD`
- `REDIS_DB`

生产验收要求：

- `REDIS_ENABLED=true` 必须开启。`/api/auth/logout` 与 `/ws/terminal` 的 token blacklist 依赖 Redis，关闭时会保留兼容行为但旧 token 不会被服务端立即吊销。
- `REDIS_ADDR`、`REDIS_PASSWORD`、`REDIS_DB` 需要指向生产 Redis 实例，不能沿用本地默认空密码配置。

## JWT

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_ISSUER`

## Lab SSH

- `LAB_SSH_HOST`
- `LAB_SSH_PORT`
- `LAB_SSH_USER`
- `LAB_SSH_PASSWORD`

## WebSocket

- `WS_PORT`
- `TERMINAL_DEBUG`

## Docker / legacy runtime

- `DOCKER_HOST`
- `DOCKER_PORT`
- `DOCKER_TLS`
- `DOCKER_CERT_PATH`
- `PROJECT_LAB_RUNTIME`

## Upload

- `UPLOAD_ROOT`
- `UPLOAD_PUBLIC_BASE`
- `UPLOAD_MAX_IMAGE_MB`
- `UPLOAD_MAX_FILE_MB`

## K8S

- `K8S_ENABLED`
- `K8S_IN_CLUSTER`
- `K8S_KUBECONFIG`
- `K8S_NAMESPACE`
- `K8S_RUNTIME_NAMESPACE`
- `K8S_INGRESS_CLASS`
- `K8S_LAB_IMAGE_PULL_SECRET`

## AI / Qwen / OpenAI Compatible

- `DASHSCOPE_API_KEY`
- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `QWEN_MODEL`

## 已下架配置

OpenClaw 与其耦合的 Feishu 配置已于 2026-07-14 从当前 Go 运行时移除。旧环境中的同名变量不会再被读取，可在完成回滚窗口确认后从部署 Secret / ConfigMap 清理；不得重新加入前端或当前后端配置结构。

## Secret 归类建议

放入 K8S Secret：

- `DATABASE_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `QWEN_API_KEY`

放入 ConfigMap：

- 非敏感主机与端口
- 默认模型名
- 上传目录
- Namespace / Ingress 等部署参数
