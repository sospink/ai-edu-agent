# OpenCode Lab AI 课程实验环境

基于 Ubuntu 22.04 的 AI 课程实验镜像，集成 SSH、VNC 桌面、OpenCode AI，课程资源默认放在用户家目录 `~`。

## 课程资源（家目录）

容器内主目录：`/root`（即 `~`）

包含 5 份可用课程资源：

1. `ADE_Agent` - ADE 配置与智能体开发
2. `MCP_Server` - MCP Server 开发
3. `AgentFramework` - 智能体框架与开发（单 Agent）
4. `MultiAgentFramework/brainstorm-mas` - 智能体框架与开发（多 Agent）
5. `SecurityGuardrails/bartender-guardrails` - 安全与合规

说明：
- 旧目录 `/workspace/courses` 已删除。
- `VS Code` 图标固定放在 `/root/Desktop/VSCode.desktop`。

## 快速开始

### 1. 构建镜像

```bash
cd 环境开发
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

默认会跳过 VS Code 扩展安装（可显著减少卡顿）。
如需安装扩展，可开启：

```bash
cd 环境开发
docker build \
  --build-arg INSTALL_VSCODE_EXTENSIONS=true \
  -f Dockerfile.ai-courses-optimized \
  -t opencode-lab-ai:latest .
```

若拉取 `ubuntu:22.04` 失败（如 `failed size validation`），可切换基础镜像源：

```bash
cd 环境开发
docker build \
  --build-arg BASE_IMAGE=m.daocloud.io/docker.io/library/ubuntu:22.04 \
  -f Dockerfile.ai-courses-optimized \
  -t opencode-lab-ai:latest .
```

### 2. 运行容器

```bash
docker run -d \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  --name ai-lab \
  opencode-lab-ai:latest
```

### 3. 配置 API + 快速测试

```bash
cd 环境开发
chmod +x quick-start-rebuilt.sh
./quick-start-rebuilt.sh
```

或分步执行：

```bash
./setup-api-keys.sh
./test-courses-quick.sh
```

## 访问方式

- noVNC: `http://localhost:6080`
- SSH: `ssh root@localhost -p 2222`（密码：`opencode`）
- VS Code 桌面图标：`/root/Desktop/VSCode.desktop`

## API 环境变量（统一）

镜像内 `.env` 路径：`/workspace/.env`

建议至少配置：

```env
ZHIPUAI_API_KEY=your-key
ZHIPU_API_KEY=your-key
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4-flash
```

> `setup-api-keys.sh` 会自动从 `../EDU_Backend/.env` 读取并生成这些变量。

## 课程运行示例

```bash
# 单 Agent
docker exec -it ai-lab bash -lc "cd /root/AgentFramework && python3 main.py --demo"

# 多 Agent
docker exec -it ai-lab bash -lc "cd /root/MultiAgentFramework/brainstorm-mas && python3 main.py --demo"

# MCP Server
docker exec -it ai-lab bash -lc "cd /root/MCP_Server && node dist/index.js"

# Guardrails
docker exec -it ai-lab bash -lc "cd /root/SecurityGuardrails/bartender-guardrails && python3 main.py --demo"
```

## 常用命令

```bash
# 查看日志
docker logs ai-lab

# 进入容器
docker exec -it ai-lab bash

# 停止/启动容器
docker stop ai-lab
docker start ai-lab
```

## 构建常见问题

### `ubuntu:22.04` 拉取失败 / `failed size validation`

1. 清理 BuildKit 缓存并重启 Docker。
2. 改用镜像源构建（见上面的 `BASE_IMAGE` 示例）。
3. 临时关闭 BuildKit 重试一次。

```bash
sudo docker builder prune -af
sudo systemctl restart docker
DOCKER_BUILDKIT=0 sudo docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```
