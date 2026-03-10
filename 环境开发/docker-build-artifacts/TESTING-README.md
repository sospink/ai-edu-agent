# 课程测试指南（home-course）

## 一键快速测试（推荐）

```bash
cd 环境开发
./test-courses-quick.sh
```

该脚本会检查：

1. 容器运行状态
2. Python/Node 版本
3. `/root` 下课程目录
5. 课程核心 smoke test（依赖导入、MCP 构建产物、模块加载）

## 测试前准备

### 1. 确认容器已启动

```bash
docker ps | grep ai-lab
```

### 2. 配置 API

```bash
cd 环境开发
./setup-api-keys.sh
```

## 手动测试命令

```bash
docker exec -it ai-lab bash
```

### ADE

```bash
cd /root/ADE_Agent
ls -la .opencode
```

### MCP Server

```bash
cd /root/MCP_Server
npm start
```

### 单 Agent

```bash
cd /root/AgentFramework
python3 main.py --demo
```

### 多 Agent

```bash
cd /root/MultiAgentFramework/brainstorm-mas
python3 main.py --demo
python3 main.py --api
```

### Guardrails

```bash
cd /root/SecurityGuardrails/bartender-guardrails
python3 main.py --demo
# 可选
python3 test_rails.py
```

## 常见失败点

### 1) 目录缺失

说明镜像不是新版，请重新构建：

```bash
docker rm -f ai-lab
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

若基础镜像拉取异常，可切换镜像源：

```bash
docker build --build-arg BASE_IMAGE=m.daocloud.io/docker.io/library/ubuntu:22.04 -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

### 2) API 未配置

```bash
docker exec ai-lab cat /workspace/.env
```

### 3) MCP dist 缺失

```bash
docker exec -it ai-lab bash -lc "cd /root/MCP_Server && npm install && npm run build"
```
