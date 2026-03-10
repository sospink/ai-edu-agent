# AI 课程环境使用指南（home-course）

## 1. 启动容器

```bash
docker run -d \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  --name ai-lab \
  opencode-lab-ai:latest
```

等待服务启动：

```bash
sleep 15
docker logs ai-lab
```

## 2. 访问环境

- 网页桌面：`http://localhost:6080`
- SSH：`ssh root@localhost -p 2222`
- VS Code 图标：`/root/Desktop/VSCode.desktop`

## 3. 验证基础环境

```bash
docker exec ai-lab verify-env
```

## 4. 配置 API Keys

推荐自动配置：

```bash
cd 环境开发
./setup-api-keys.sh
```

手动配置（容器内 `/workspace/.env`）：

```env
ZHIPUAI_API_KEY=your-key
ZHIPU_API_KEY=your-key
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4-flash
```

## 5. 课程目录

主目录：`/root`（即 `~`）

```bash
docker exec -it ai-lab bash
cd /root
ls -la
```

旧目录 `/workspace/courses` 已移除。

## 6. 运行课程

### 6.1 ADE 配置与智能体开发

```bash
cd /root/ADE_Agent
ls -la .opencode
```

### 6.2 MCP Server 开发

```bash
cd /root/MCP_Server
npm start
```

### 6.3 单 Agent（毒舌 Gordon）

```bash
cd /root/AgentFramework
python3 main.py --demo
```

### 6.4 多 Agent（创意风暴）

```bash
cd /root/MultiAgentFramework/brainstorm-mas
python3 main.py --demo
# 或启动 API
python3 main.py --api
```

### 6.5 安全与合规（Guardrails）

```bash
cd /root/SecurityGuardrails/bartender-guardrails
python3 main.py --demo
```

## 7. 快速测试脚本

```bash
cd 环境开发
./test-courses-quick.sh
```

该脚本会检查：

- 容器运行状态
- 家目录下的课程目录
- 核心依赖可导入
- MCP 构建产物
- 各课程模块加载

## 8. 常见问题

### Q1: `docker: command not found`

本机未安装 Docker 或环境变量未生效。

### Q2: 课程目录缺失

请确认使用最新镜像重建容器：

```bash
docker rm -f ai-lab
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

若基础镜像拉取异常，可切换镜像源：

```bash
docker build --build-arg BASE_IMAGE=m.daocloud.io/docker.io/library/ubuntu:22.04 -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

### Q3: API 调用失败

检查容器内 `.env`：

```bash
docker exec ai-lab cat /workspace/.env
```
