# 课程后端

在课程目录安装 `python3 -m pip install -r requirements.txt`，运行 `bash scripts/start.sh`；脚本检查服务健康状态，缺少前端构建时先执行构建，再启动端口 8000 的后端。
镜像内使用 `bash scripts/restart.sh`：通过 Supervisor 重启 `workbench`，随后等待 `/api/health` 恢复。
本地开发在原启动终端按 Ctrl+C 停止服务，再执行 `bash scripts/start.sh`；课程虚拟环境可通过 `PYTHON=/opt/venvs/prompt-workbench/bin/python` 指定。
平台负责 Lab 访问权限和隔离，本服务不提供共享多用户账户；每个 Lab 使用独立数据目录。
服务额外统一保护所有 API 与静态资源：仅 ASGI 连接来源为 `127.0.0.1` 或 `::1` 时直接放行；其他来源必须携带由平台服务端注入的 `X-EDU-Lab-Access`，以恒定时间比较匹配当前 Lab token。
唯一匿名例外是 `GET /api/health`，用于 kubelet readiness，仅返回 status/version。空 token 的本地开发也拒绝其他来源访问受保护路径；缺失、错误或重复访问头统一返回安全的 403。
浏览器不持有 token。服务不信任任何转发头，部署 Uvicorn 必须启用 `--no-proxy-headers`，避免服务器先改写 ASGI client.host；平台代理访问头必须与 Pod 环境的会话 token 一致。

网关仅从环境读取 `EDU_MODEL_BASE_URL`、`EDU_MODEL_TOKEN`、`EDU_MODEL_NAME`，不接受浏览器传入凭证。
`GET /api/config` 实际访问网关 `/models`（5 秒超时、5 秒短缓存），只有返回明确可用模型才设置 `configured=true`。
优先选列表中与配置匹配的 ID；别名未出现在列表且只有一个模型时使用该实际 ID；多模型无法明确匹配时禁用。
断连、授权失败、空列表、错误响应均返回 `configured=false`、空模型名和安全 `detail`，不回传上游正文或网关地址。
该探测表示模型列表可达，不保证后续生成额度。请求仍发送配置的网关模型别名，实验保存生成响应中的真实模型名。
模型别名默认 `course-model`；实际实验模型名来自网关响应。缺失 `X-Request-ID` 的响应拒绝保存，不生成本地替代标识。
实验的 `configVersion: number | null` 来自生成响应头 `X-Model-Config-Version`，用于关联后台模型配置变更。
仅记录非负且 JavaScript 可精确表示的整数；缺失或非法头为 `null`，不根据缓存或当前配置补造历史版本。
旧实验 API 回显版本为 `null`，导出保留原始已存记录。所有网关请求（含 `/models`）均携带当前 Lab session 凭证。
网关错误仅按 `error.type` 白名单映射双语安全说明，区分余额、上游权限、限流、会话失效等；不回传上游错误正文。
网关失败保留失败状态，错误正文不透传，90 秒总超时。断连轮询尽可能中止 HTTP 调用，不能撤销网关已产生的消耗。

数据默认保存在 `backend/data/workbench.sqlite3`，可使用 `PROMPT_WORKBENCH_DB` 指向当前 Lab 的持久化目录。
SQLite WAL 和事务保护并发写入；草稿支持覆盖保存，实验不可修改，可幂等删除。实验列表最近 100 条，导出包含全部记录。
`draftId` 仅检查来源草稿存在，实验保存完整提示词快照，删除草稿不会破坏历史。

`frontend/dist` 构建后由同一服务提供。API 路由优先，未知 API 返回 JSON 404。
平台代理应剥离 Lab 前缀，或使用 ASGI `root_path` / Uvicorn `--root-path`；前端相对地址保留代理子路径。

`bash scripts/check.sh` 离线运行确定性测试，不读取真实网关配置，不消耗额度。
支持阶段 `environment`、`schema`、`drafts`、`run`、`export`、`all`，如 `bash scripts/check.sh schema`；无参数等同 `all`。
阶段只筛选隔离库和 mock transport 测试，不证明学生已完成真实模型实验。教学手册的在线记录检查仍须单独执行。
解释器优先级：`PYTHON` 环境变量、存在的 `/opt/venvs/prompt-workbench/bin/python`、`python3`。
Python 最低 3.11（使用 `asyncio.timeout`），依赖固定为已测试版本。
`bash scripts/export.sh --output backend/exports/result.zip` 本地导出（目标必须不存在）。
也可通过 `GET /api/export` 下载。源码严格白名单，拒绝符号链接、硬链接、凭证模式与超大文件；不含运行配置、依赖和 dist。
导出报告说明跳过的源码。人工复核语义与证据充分性，自动校验不证明所有事实正确。
导出包含 `scripts/start.sh` 和 `scripts/restart.sh` 源码；Supervisor 运行配置、凭证和镜像依赖仍不包含在成果包内。

待上游验收：真实 Lab 权限隔离、网关凭证注入、前端构建与浏览器端到端联调；本目录测试使用显式注入的本地 transport，不提供生产 mock 开关。

服务生成的错误、样例、Validation issues 支持 `zh-CN` / `en-US`。优先读取 `X-Locale`，其次按权重匹配 `Accept-Language`，默认中文。
校验字段名、checks 名称保持稳定机器标识。用户草稿、原始提示词、模型回答、parsed 数据不翻译；历史记录的校验说明只在返回时本地化，数据库与导出保留规范原文。
