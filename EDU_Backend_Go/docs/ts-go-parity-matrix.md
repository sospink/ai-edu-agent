# TS -> Go 主链路替代差异矩阵

最后更新：2026-07-14

本矩阵以“主链路替代”为准，不追求把 `EDU_Backend/` 的历史接口逐行复刻到 `EDU_Backend_Go/`。判断标准是：是否影响现有前端主流程、Lab 运行时、Agent、三端教学平台和运维验收。

## 已实现等价替代

| TS 能力 | Go 当前状态 | 处理策略 | 是否阻塞切换 |
| --- | --- | --- | --- |
| `POST /api/lab/create` + `GET /api/lab/active` | 已完成 K8S Pod/Service 会话创建与状态查询 | 保留并继续增强 | 否 |
| noVNC 桌面代理 | 已完成 `/api/lab/proxy/:sessionId/novnc/*` 同源代理 | 保留并继续增强 | 否 |
| `POST /api/lab/execute` | 已切到 K8S exec，可供 Agent 与快捷命令复用 | 保留并继续增强 | 否 |
| `/ws/terminal` | 已切到 K8S exec bridge，支持输入/输出/resize | 保留并继续增强 | 否 |
| `POST /api/agent/verify` | 已接入运行时校验，不再是占位实现 | 保留并继续增强 | 否 |
| TTL 过期会话清理 | 已接入 janitor，支持过期与僵尸资源回收 | 保留并继续增强 | 否 |
| 三端权限体系 | 已切到 student / teacher / admin，管理员继承教师权限 | Go 作为唯一主权限入口 | 否 |
| 班级 / 作业 / 提交评分 / 教学工作台 | 已完成 M1-M5 首版主链路 | 视为 Go 新业务能力，不追求 TS 旧后端等价 | 否 |
| 运行治理 / AI 助教 / Agent 观察台 | 已完成 M6-M7 与 2026-04-25 Agent 教学增强首版链路 | 继续在 Go 后端演进 | 否 |

## 已实现但非 1:1

| TS 能力 | Go 当前状态 | 处理策略 | 是否阻塞切换 |
| --- | --- | --- | --- |
| Docker exec / SSH 驱动的终端与命令执行 | 已由 K8S exec bridge 替代 | 视为架构升级，不再回退到 Docker 语义 | 否 |
| `sshInfo` 可视为真实 SSH 入口 | 当前仅保留兼容字段，主链路依赖 K8S exec | 只保留兼容展示，不承诺容器 SSH 登录 | 否 |

## 主链路仍需补齐

| TS 能力 | Go 当前状态 | 处理策略 | 是否阻塞切换 |
| --- | --- | --- | --- |
| 全量浏览器级回归 | 仍需继续补齐 | 以学生、教师、管理员三端主流程为最小验收集合 | 是 |

## 可显式废弃

| TS 能力 | Go 当前状态 | 处理策略 | 是否阻塞切换 |
| --- | --- | --- | --- |
| `/api/docker/*` 容器管理面 | Go 未实现 | 视为旧 Docker 管理面，不纳入主链路替代目标 | 否 |
| 前端管理员 Docker 面板 | 代码仍保留在 `EDU_Frontend/src/services/docker.ts` 与 Dashboard 页面 | 暂列为遗留后台能力，后续单独决定删除或替换 | 否 |
| OpenClaw 页面、视图 API、Gateway / Feishu 配置与项目类型 | 2026-07-14 已从当前 React / Go 产品下架 | 旧实现保留在 `codex/archive-openclaw-20260714`，历史数据由幂等迁移归档 | 否 |

## 切换前最低验收标准

- Classic Lab：`create / active / noVNC / terminal / execute / stop` 全绿
- Agent：`manual / verify / chat / stream / progress / faq / interventions / observatory` 主链路全绿
- 项目实训：列表 / 详情 / 单元统一进入 `/lab`，历史项目与旧类型不可见且不可重新发布
- 学生端：学习中心、课程 / 项目、作业待办、提交、成绩反馈、学习成果概览全绿
- 教师端：班级、内容发布、作业、批改、成绩簿、工作台、Agent 观察台全绿
- 管理端：运维工作台、用户、班级、作业观测、内容治理、系统设置、RBAC 全绿
- 运维：`/api/integrations/k8s|config` 和 `/api/admin/integrations/health` 均可访问，且仅管理员可见
