# 官方 Harness 课程运行时

本目录仅封装官方 `deepseek-harness-runtime-bin==0.2.2rc2` 的原始 Web 应用，不修改或替换官方客户端资源。`0.2.3` 源码只用于参考；镜像、CLI 和启动验收均以 wheel 的 `0.2.2rc2` 为准。Go 服务负责授权、独立实例生命周期、登录桥接、前缀剥离代理和模型网关。

## 构建

在仓库根目录执行：

```sh
docker build --platform linux/amd64 \
  -t registry.cn-beijing.aliyuncs.com/svinsight/course:harness-web-0.2.2rc2-20261126 \
  services/course-harness
```

基础镜像固定摘要；运行时固定版本。已推送并部署42的摘要为
`sha256:2f0862658947e26e9f82f8cbb939edb86bbae9c0fe4ebc1fe7e091b7fe3dece9`。
完整平台接入和验收记录见 `docs/COURSE-HARNESS-DEPLOYMENT.md`。

## 容器契约

| 项目 | 值 |
| --- | --- |
| 用户 | `1000:1000` |
| 应用根目录 | `/opt/course-harness` |
| Python / dsh | `/opt/venv/bin/python`、`/opt/venv/bin/dsh` |
| `HOME` / `DSH_HOME` | `/home/harness`，按用户、课时、语言独立持久化 |
| 课程快照 | `/workspace`，后端提供只读挂载 |
| 临时目录 | `/tmp`，可写、可执行 tmpfs |
| Web 监听 | 容器具体 IPv4，`3080`；不使用 `0.0.0.0` |
| 根文件系统 | `--read-only` |

必需环境变量：

```text
EDU_PUBLIC_URL=http://42.240.132.79:8080/api/course-harness/proxy/{randomid}/
EDU_TRUSTED_HOST=42.240.132.79:8080
EDU_MODEL_BASE_URL=http://gateway:4000/api/course-harness/model/{id}/v1
EDU_MODEL_TOKEN=<后端颁发的短期、实例范围令牌>
EDU_LOCALE=zh-CN 或 en-US
EDU_COURSE_TITLE=<课程名称>
```

示例地址仅描述契约，本地验收不连接这些服务器。宿主机供应商 API Key 不得传入容器。

后端应使用 `--cap-drop=ALL --security-opt=no-new-privileges:true`，以及
`--tmpfs /tmp:rw,exec,nosuid,size=128m,mode=1777 --cpus=0.75 --memory=768m --pids-limit=160`。
Docker 新命名卷可从镜像继承 home 的 UID 1000 所有权；已有目录或挂载卷须由后端预先准备权限，容器不以 root 修复权限。
不要把多个用户、课时或语言挂载到同一 home；恢复会话必须使用相同独立卷。课程快照应由后端整理为文本/Markdown，供读文件工具使用。

实际启动参数：

```text
/opt/venv/bin/dsh web --patch /opt/course-harness/course.patch.yml
  --host <容器IPv4> --port 3080 --no-open
  --public-url <EDU_PUBLIC_URL> --trusted-host <EDU_TRUSTED_HOST>
```

## 配置边界

- 保留官方 Web profile，仅通过 overlay 修改宿主配置。
- `preset-standard`、`preset-ptc`、`preset-minimal`、`preset-cordis` 禁用；默认且唯一启用的 preset 是 `course`。
- `edu` 通过 `llm-pi-ai` 的 `openai-completions` 请求网关，模型别名为 `course-assistant`，凭据引用为 `apiKeyEnv: EDU_MODEL_TOKEN`。别名不表示实际底层供应商。
- 课程 persona 固定回答语言，要求基于课程文件、引用相对文件名和行号，不足时明确说明。
- 官方 `locale` 插件的 `config.preference` 按 `EDU_LOCALE` 设为 `zh` 或 `en`，不注入或修改客户端资源。
- 模型只注册 `read`、`glob`、`grep`；禁止写入、编辑、shell、MCP、网络搜索及工作目录切换。执行守卫要求显式 `/workspace` 绝对路径并校验真实路径，拒绝快照外符号链接。
- `git` 供官方启动过程使用，不向模型提供 shell 工具。官方 UI 的功能入口由原始应用渲染；禁用宿主能力不等于重新设计客户端。
- 宿主插件通过 `workspaceRegistry.initializeDefault()` 注册 `/workspace`，使用课程名称作为工作区标题。自带工作区身份和会话持久化沿用官方实现。
- 插件管理、HMR、遥测关闭。官方设置服务依赖 `config-editor`，保留该宿主依赖；只读镜像中的最后一层 overlay 固定课程配置。此封装限制模型工具，不是面向恶意已登录用户的完整多租户安全边界；实例、卷、快照和网络隔离由后端承担。

## 启动令牌与代理

官方进程输出带 `dsh web` 标签的入口 URL，其查询参数 `token` 是该进程的启动令牌。后端通过 Docker 日志 API **在内存中**解析 URL 和 `token`，不能把原始日志、Cookie 或令牌转发给前端日志系统。

本目录 `smoke.py` 展示解析流程，终端输出一律脱敏。不要直接把 `docker logs` 的原始输出贴到工具或工单。

登录桥接对容器根路径请求 `GET /?token=<令牌>`，成功应返回 `303`、`Set-Cookie` 和相对跳转。Go 负责 Cookie Path 隔离与必要重写；转发 Host/Origin 的 authority 必须与可信主机一致。公开 `/api/course-harness/proxy/{id}/` 是**剥离前缀**的代理入口，静态资源、HTTP API 和 WebSocket 均须保留官方语义。`--public-url` 本身不授予来源信任。

## 本机验收

```sh
python3 services/course-harness/smoke.py
```

默认创建独立容器 `course-harness-smoke-20261126`、卷 `course-harness-smoke-20261126-home`，端口仅发布为 `127.0.0.1:13080`。脚本生成本目录 `.artifacts/snapshot`，验证原始 Web HTML、登录交换、非 root、只读根和只读课程挂载，报告保存于 `.artifacts/smoke-result.json`，不保存启动令牌。

同名容器已存在时脚本拒绝覆盖。可以指定 `--name` 和 `--port` 创建另一个独立实例。模型网关在这个基础冒烟中不执行真实推理；跨代理登录和真实模型问答仍由 Go 联调验收。

已存在的本轮测试容器可通过 `python3 services/course-harness/smoke.py --existing` 再次验证。

2026-11-26 本机验收结果：

- 官方 0.2.2rc2 wheel 启动无插件激活警告，工作区初始化成功。
- 原始登录交换返回 303，原始 Web HTML 返回 200。
- Chromium 实际渲染原始 Web：标题 `DeepSeek Harness`，`html.lang=zh-CN`，浏览器运行错误为 0。
- 原始 preset 菜单只有 `Course Tutor`，模型选择为 `Course Assistant`，权限显示“仅可查看”。
- 首次预览版说明保留官方行为，需要用户点“继续”；未绕过官方界面流程。
- 已核对 UID 1000、根只读、快照只读、0.75 CPU / 768 MiB / 160 PID。
- 重建容器复用 home 卷后，已注册的课程工作区仍存在。
- 主冒烟使用 Docker 默认 bridge 与命名 home 卷；持久 bind 权限、Kimi 网关推理和完整前缀代理尚未在此脚本中验收。
- 截图位于 `.artifacts/original-web.png` 和 `.artifacts/original-web-course.png`，报告中包含本地镜像 ID。后续主流程已推送镜像并在42完成真实中英文问答、历史恢复、停止生成与跨用户拒绝验收，见平台交付记录。

额外隔离冷启动验证：`course-harness-offline-20261126` 使用全新 home 卷、独立 `--internal` 网络及 `enable_icc=false`，在相同资源限制下成功初始化工作区；容器内部官方登录交换为 303，原始 HTML 为 200，无插件激活警告，不依赖外部下载。

**网络差异及已采用方案：** internal网络不提供有效宿主发布端口。42上的Go后端直接访问容器私网地址3080，保持internal与ICC-off，不发布额外端口；完整前缀代理已实测通过。另须显式挂载`/tmp:...exec...`，否则官方原生绑定无法加载。

只在不再需要本轮测试容器时执行：

```sh
docker rm -f course-harness-smoke-20261126
docker volume rm course-harness-smoke-20261126-home
```
