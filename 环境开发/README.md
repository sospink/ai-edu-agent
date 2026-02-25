# OpenCode Lab AI 课程实验环境

基于 Ubuntu 22.04 的 AI 课程实验环境 Docker 镜像，集成 SSH、VNC 桌面、OpenCode AI 和 6 门 AI 课程。

## 📚 文档

- **[README.md](README.md)** - 本文档（构建和使用指南）
- **[USAGE-GUIDE.md](USAGE-GUIDE.md)** - 详细使用说明
- **[TESTING-README.md](TESTING-README.md)** - 课程测试指南
- **[API-配置说明.md](API-配置说明.md)** - API Keys 配置说明

## 🎯 包含的 AI 课程

1. ✍️ **提示词工程** - 万能文案生成器
2. 🧠 **MCP Server 开发** - 今日运势
3. 🔁 **ADE 配置与智能体开发** - 代码翻译官 Skill
4. 🔎 **智能体框架与开发** - 毒舌 Gordon (Single Agent)
5. 💬 **智能体框架与开发** - 创意风暴 (Multi-Agent)
6. 🍸 **安全与合规** - AI 酒吧调酒师 (Guardrails)

所有课程文件位于容器内的 `/workspace/courses/` 目录。

## 功能特性

- **桌面环境**: XFCE4 + TigerVNC + noVNC 网页访问
- **开发工具**: Python 3.10 + Node.js 18 + OpenCode AI
- **AI 库**: LangChain, LangGraph, OpenAI, Anthropic, Nemo Guardrails
- **访问方式**: VNC 桌面、SSH 终端、前端实训页面
- **中文支持**: 文泉驿字体

## 快速开始

### 1. 构建镜像

```bash
cd 环境开发
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

**使用代理加速**（可选）:
```bash
docker build \
  --build-arg http_proxy=http://192.168.20.3:7890 \
  --build-arg https_proxy=http://192.168.20.3:7890 \
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

### 3. 访问方式

#### 网页桌面（推荐）
```
http://192.168.20.3:6080/
```
- 无需密码，自动连接
- 自动缩放适应窗口

#### SSH 终端
```bash
ssh root@192.168.20.3 -p 2222
# 密码: opencode
```

#### 前端实训页面
```
http://localhost:5173/lab?sourceType=course&sourceId=22&lessonId=211
```

### 4. 配置 API Keys 并测试

**一键配置和测试**（推荐）:
```bash
cd 环境开发
chmod +x quick-start-rebuilt.sh
sudo ./quick-start-rebuilt.sh
```

这会自动：
1. 从后端读取通义千问配置
2. 在容器内创建 `.env` 文件
3. 运行完整测试

**或分步执行**:
```bash
# 1. 配置 API Keys
sudo ./setup-api-keys.sh

# 2. 测试环境
sudo ./test-courses-quick.sh
```

## 配置 API Keys

### 方式 1: 自动配置（推荐）⭐

使用自动脚本从后端配置复制：

```bash
cd 环境开发
chmod +x setup-api-keys.sh
sudo ./setup-api-keys.sh
```

这会自动配置通义千问 API（OpenAI 兼容模式）。

### 方式 2: 手动配置

```bash
# 进入容器
docker exec -it ai-lab bash

# 创建配置文件
cd /workspace
cat > .env << 'EOF'
# 通义千问配置（OpenAI 兼容模式）
OPENAI_API_KEY=sk-e163cee3d11541738ee4a99f16690b2b
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
EOF
```

**详细说明**: 查看 [API-配置说明.md](API-配置说明.md)

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 22 → 2222 | SSH | 远程终端访问 |
| 5901 | VNC | 桌面客户端连接 |
| 6080 | noVNC | 网页端桌面访问 |

## 常用命令

```bash
# 查看容器日志
docker logs ai-lab

# 进入容器
docker exec -it ai-lab bash

# 停止容器
docker stop ai-lab

# 启动容器
docker start ai-lab

# 删除容器
docker rm -f ai-lab

# 重新构建镜像
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

## 故障排除

### 问题 1: 重新构建后需要做什么？

**答**: 重新构建后，课程文件已经在镜像中，只需配置 API Keys：

```bash
cd 环境开发
sudo ./quick-start-rebuilt.sh
```

或手动配置：
```bash
sudo ./setup-api-keys.sh
```

### 问题 2: 课程文件缺失（旧容器）

如果使用的是旧镜像创建的容器，运行修复脚本:
```bash
chmod +x fix-missing-files.sh
sudo ./fix-missing-files.sh
```

**建议**: 重新构建镜像以永久包含所有文件。

### 问题 3: VNC 连接失败

1. 检查容器日志:
```bash
docker logs ai-lab | grep "noVNC"
# 应该看到: noVNC started via websockify on port 6080
```

2. 重启后端服务（如果使用前端页面）:
```bash
cd EDU_Backend
npm run dev
```

### 问题 3: VNC 连接失败

1. 检查容器日志:
```bash
docker logs ai-lab | grep "noVNC"
# 应该看到: noVNC started via websockify on port 6080
```

2. 重启后端服务（如果使用前端页面）:
```bash
cd EDU_Backend
npm run dev
```

### 问题 4: API Keys 未配置

运行配置脚本：
```bash
cd 环境开发
sudo ./setup-api-keys.sh
```

验证配置：
```bash
docker exec ai-lab cat /workspace/.env
```

### 问题 5: Python 包缺失

```bash
docker exec -it ai-lab bash
pip3 install langchain langchain-openai langgraph openai
```

### 问题 5: Python 包缺失

```bash
docker exec -it ai-lab bash
pip3 install langchain langchain-openai langgraph openai
```

### 问题 6: 需要 sudo 权限

将用户添加到 docker 组:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 环境变量

可在运行时自定义:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| VNC_RESOLUTION | 1920x1080 | 桌面分辨率 |
| VNC_DEPTH | 24 | 色彩深度 |

示例:
```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  -e VNC_RESOLUTION=2560x1440 \
  --name ai-lab \
  opencode-lab-ai:latest
```

## 数据持久化

挂载本地目录:
```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  -v $(pwd)/workspace:/workspace \
  --name ai-lab \
  opencode-lab-ai:latest
```

## 预装软件

- **系统**: Ubuntu 22.04, XFCE4 Desktop
- **开发**: Python 3.10, Node.js 18, Git, Vim
- **AI 工具**: OpenCode AI, LangChain, LangGraph
- **浏览器**: Firefox
- **编辑器**: Mousepad, Gedit

## 注意事项

1. VNC 默认无密码，仅建议内网使用
2. SSH 默认密码 `opencode`，生产环境请修改
3. 首次构建约需 10-20 分钟
4. 课程示例需要配置 API Keys

## 技术支持

- 查看详细文档: [USAGE-GUIDE.md](USAGE-GUIDE.md)
- 测试指南: [TESTING-README.md](TESTING-README.md)
- 检查容器日志: `docker logs ai-lab`

---

**版本**: 1.0  
**更新**: 2026-01-15

```
http://localhost:6080/vnc.html?resize=scale&autoconnect=true
```

- 无需密码，自动连接
- `resize=scale` 参数启用自动缩放，桌面会适应浏览器窗口大小

#### VNC 客户端

使用 VNC Viewer、RealVNC 等客户端连接：

- 地址：`localhost:5901`
- 密码：无需密码

#### SSH 终端

```bash
ssh root@localhost -p 2222
```

- 用户名：`root`
- 密码：`opencode`

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 22 (映射到 2222) | SSH | 远程终端访问 |
| 5901 | VNC | 桌面客户端连接 |
| 6080 | noVNC | 网页端桌面访问 |

## 环境变量

可在运行时通过 `-e` 参数自定义：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| VNC_RESOLUTION | 1920x1080 | 桌面分辨率 |
| VNC_DEPTH | 24 | 色彩深度 |

示例：

```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  -e VNC_RESOLUTION=2560x1440 \
  --name lab \
  opencode-lab
```

## 数据持久化

挂载本地目录到容器的 `/workspace`：

```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  -v $(pwd)/projects:/workspace \
  --name lab \
  opencode-lab
```

## 常用命令

```bash
# 查看容器日志
docker logs lab

# 进入容器终端
docker exec -it lab bash

# 停止容器
docker stop lab

# 启动容器
docker start lab

# 删除容器
docker rm -f lab
```

## 预装软件

- Git
- Vim
- Node.js 18 + npm
- OpenCode AI
- Firefox
- Mousepad
- XFCE4 终端

## 注意事项

1. VNC 服务默认无密码认证，仅建议在内网或本地使用
2. SSH 默认密码为 `opencode`，生产环境请修改
3. 首次构建镜像需要下载较多依赖，耗时约 10-20 分钟
