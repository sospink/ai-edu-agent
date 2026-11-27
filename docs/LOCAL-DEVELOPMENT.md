# 同事拉取与本地运行

## 获取代码

需要仓库读取权限，SSH 公钥须绑定 GitHub 账号：

```bash
git clone git@github.com:sospink/ai-edu-agent.git
cd ai-edu-agent
git switch main
git pull --ff-only origin main
```

无需递归初始化历史实训目录的子仓库。当前平台源码及 Harness 上游快照均为普通跟踪文件，拉取即可获得。没有仓库权限时需仓库管理员邀请；启动脚本不能授予 GitHub 权限。

## 推荐启动方式

支持 macOS、Linux，以及 Windows 的 WSL2。安装并启动 Docker Desktop 或 Docker Engine + Compose v2；初始化脚本需要 Bash 和 OpenSSL。镜像构建需要访问镜像仓库、npm 和 Go 模块源。建议给 Docker 分配至少 6 GB 内存。

在仓库根目录执行：

```bash
bash scripts/local-dev.sh init
bash scripts/local-dev.sh up
bash scripts/local-dev.sh check
```

- 页面：`http://localhost:3000`
- 后端：`http://localhost:4000/api/health`
- 管理员：`admin`
- 首次密码：本机 `.runtime/local-dev.env` 中的 `LOCAL_ADMIN_PASSWORD`

脚本生成随机本地密码，不输出密码到日志，不覆盖已有配置。该文件被 Git 忽略，不提交、不发给其他同事。管理员仅在用户表为空时创建；后续修改环境文件不会重置数据库中的账号密码。

Docker 内安装 Node 22 和 Go 1.26 依赖，本机不必安装 Node/Go。前端使用 `npm ci` 锁定依赖。首次构建较慢，后续复用依赖缓存。端口被占用时修改上述本地配置中的 `LOCAL_WEB_PORT`、`LOCAL_API_PORT`，重新执行 `up`。

启动的是独立 MySQL 空库，自动创建当前模型表和管理员；不读取本机已有 `.env`，不连接 35、42 或生产 K8S，不复制生产用户、令牌、课程和手册。课程列表为空是正常初始状态。可登录管理员创建用户、课程和项目，再进入教师编辑链路。已有课程素材可经平台上传；提示词工作台内容导入工具见 `EDU_Backend_Go/cmd/seed_prompt_workbench/README.md`，它需要明确的镜像和创建者信息，不会自动复制线上数据。

## 日常开发和数据保留

```bash
bash scripts/local-dev.sh status
bash scripts/local-dev.sh logs
bash scripts/local-dev.sh down
```

`down` 停止本地容器但保留数据库、上传文件和后端设置卷。不要随意删除 `.runtime/local-dev.env`，否则随机数据库密码会与已有卷不一致。

前端 `src/`、`public/` 以只读挂载接入，编辑后 Vite 热更新。修改前端依赖、Vite 配置或后端 Go 代码后，重新执行 `up` 构建。API、WebSocket 和 `/uploads` 均经 Vite 同源代理到本地后端。

本地开发配置不作为生产部署方案：只绑定回环地址，自动建表只用于这个独立本地数据库。生产仍使用审核过的 SQL migration 和部署流程。

## AI、Harness 与 K8S 的边界

基础启动提供三端页面、登录、内容编辑及本地数据库读写。调用大模型需要管理员在系统设置中配置自己的提供商、API Key 和模型；密钥不写入前端。

K8S Classic Lab 默认关闭。Desktop、WebIDE、Terminal 和执行验证需要另行接入测试集群，配置独立 namespace、镜像与配额；禁止直接复用生产 kubeconfig 和运行命名空间。启用这些能力不是“启动页面”就自动具备的。

Harness 完整上游源码在 `third_party/deepseek-harness/`；平台运行封装在 `services/course-harness/`。可单独在本机 Docker 构建并验证官方 Web：

```bash
docker build --platform linux/amd64 -t agent-edu-harness:local services/course-harness
python3 services/course-harness/smoke.py --image agent-edu-harness:local --name local-harness-check --port 13080
```

此检查使用独立容器、卷和只读示例工作区，报告保存在 `services/course-harness/.artifacts/`；它验证 Web 启动与登录交换，不代表真实模型推理或平台完整接入。不要直接分享包含启动令牌的 Docker 日志。

嵌入平台的助教还需要 Go 管理 Docker 实例、私网可达、持久化工作区、模型网关和公共访问 origin。当前生产方式依赖 Linux 宿主直接访问 Docker 私网；macOS Docker Desktop 上不能假设宿主能访问相同容器 IP。基础 Compose 因此不挂 Docker socket，也不自动启用助教。完整集成建议使用隔离 Linux 开发机，参照 `docs/COURSE-HARNESS-DEPLOYMENT.md` 配置，不能直接把生产部署脚本指向本地执行。

上游快照为 0.2.3 参考源码，当前已验收运行时为 `deepseek-harness-runtime-bin==0.2.2rc2`。源码自行构建属于升级验证，不应默认与线上二进制等价。

## 检查与排障

```bash
docker compose --env-file .runtime/local-dev.env -f compose.local.yaml exec frontend npm exec tsc --noEmit
docker compose --env-file .runtime/local-dev.env -f compose.local.yaml exec frontend npm run build
```

后端单测在本机安装 Go 1.26 后于 `EDU_Backend_Go/` 执行 `go test ./...`。集成测试不得连接生产库。

- 无法拉取：先确认 GitHub 仓库权限和 SSH key；也可改用自己的 HTTPS 认证。
- 无法下载镜像或依赖：确认 Docker、npm、Go 源网络可达，查看 `logs` 或构建输出。
- 页面可开但 API 失败：确认 MySQL 健康、backend 启动成功，再执行 `check`。
- 数据库拒绝登录：检查本地配置是否被更换，以及原数据库卷是否仍使用旧密码。
- 素材无法打开：上传后应走 `/uploads` 本地代理；线上素材文件不会随 Git 自动下载。

## 本轮验证记录

2026-11-27：已使用仅包含 Git 待提交文件的干净源码副本构建前后端镜像，并在独立 MySQL 空库启动平台。通过健康检查、首页浏览器渲染、管理员首次登录、课程新增/修改/读取/删除、文件上传/同源读取/删除和退出登录。测试数据已清理。Go 全量测试、前端 TypeScript 检查和容器内生产构建均通过。

此记录不代表独立本地配置已具备 K8S 实训和嵌入式助教完整链路，也不代表同步了生产数据库。
