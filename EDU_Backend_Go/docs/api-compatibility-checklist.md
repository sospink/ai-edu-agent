# API 兼容基线清单

基于当前 `EDU_Backend/` 与 `EDU_Frontend/` 的真实实现整理。该清单是 `EDU_Backend_Go` 的外部兼容目标，不是理想化接口设计。

## 基线规模

- TypeORM 模型：19
- 路由模块：14
- 路由入口：117
- 协议类型：
  - REST
  - SSE
  - WebSocket
  - iframe Lab Proxy

## REST 路由分组

- `/api/auth/*`
- `/api/users/*`
- `/api/projects/*`
- `/api/tags/*`
- `/api/upload/*`
- `/api/courses/*`
- `/api/skills/*`
- `/api/learning/*`
- `/api/docker/*`
- `/api/lab/*`
- `/api/agent/*`
- `/api/integrations/*`
- `/api/health`

## 当前收口原则

- 兼容目标采用“主链路替代”，不是逐行复刻 TS 历史接口。
- 课程/项目实训、Agent、上传、学习与鉴权属于切换阻塞面。
- `/api/docker/*` 属于旧 Docker 管理面，默认不纳入 Go 切换阻塞项。
- `/api/integrations/*` 作为管理员运维观测入口，需继续兼容管理员鉴权语义。

## 必须兼容的协议约束

### JWT

- Payload:
  - `userId`
  - `username`
  - `roleType`

### SSE

- Endpoint: `POST /api/agent/chat/stream`
- 数据格式：

```text
data: {"content":"..."}

data: [DONE]
```

### WebSocket

- Endpoint: `/ws/terminal`
- Query 参数：
  - `token`
  - `sessionId`
  - `terminalId`
  - `mode`
  - `command`
  - `sessionPolicy`
  - `transport`
  - `initialCommand`

### Lab Proxy

- Endpoint:
  - `/api/lab/proxy/:sessionId/:target`
  - `/api/lab/proxy/:sessionId/:target/*`
- 约束：
  - 支持 iframe 同源嵌入
  - 允许 `authToken` query 作为认证回退
  - 透传上游响应，同时剥离会影响 iframe 的头

## 当前已在 Go 实现的主链路入口

- `GET /api/health`
- `GET /api/version`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `PUT /api/users/:id/password`
- `PUT /api/users/:id/freeze`
- `PUT /api/users/:id/activate`
- `POST /api/upload/image`
- `POST /api/upload/file`
- `POST /api/upload/material`
- `/uploads/*`
- `/api/uploads/*`
- `/ws/terminal` K8S exec bridge
- `/api/lab/*` K8S Classic Lab 主链路
- `/api/agent/*`
- `/api/integrations/k8s/health`
- `/api/integrations/config/summary`

## 当前仍需重点验收的接口组

- `/api/integrations/*` 的真实运维环境验证

## 2026-07-14 下架说明

- OpenClaw 视图、Lab Gateway 代理和与其耦合的 Feishu 健康接口不再属于当前兼容目标。
- 下架前契约保存在 `codex/archive-openclaw-20260714`，不得据此在 Go 主线重新补齐旧入口。

## 明确不纳入本轮切换阻塞项

- `/api/docker/*`
  - TS 旧容器管理接口仍存在于 `EDU_Backend/`
  - Go 不再按 Docker 管理面做 1:1 复刻
  - 若未来仍有后台运维依赖，单独立项补兼容，不与主链路切换耦合
