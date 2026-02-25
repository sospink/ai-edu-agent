# 🚀 AI 课程环境使用指南

## 构建完成后的使用方法

### 1. 启动容器

```bash
docker run -d \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  --name ai-lab \
  opencode-lab-ai:latest
```

**端口说明**:
- `2222` → SSH 访问端口
- `5901` → VNC 桌面端口
- `6080` → noVNC 网页端口（推荐）

### 2. 等待服务启动

```bash
# 等待 15 秒让所有服务启动
sleep 15

# 查看启动日志
docker logs ai-lab
```

应该看到：
```
==========================================
  OpenCode Lab Environment Starting...
==========================================
[1/3] Starting SSH server on port 22...
[2/3] Starting VNC server on port 5901...
[3/3] Starting noVNC web client on port 6080...
==========================================
  Environment Ready!
==========================================
```

### 3. 访问环境

#### 方式1: 网页桌面（推荐）⭐

打开浏览器访问：
```
http://localhost:6080
```

或者带自动连接参数：
```
http://localhost:6080/vnc.html?resize=scale&autoconnect=true
```

- ✅ 无需安装任何软件
- ✅ 自动缩放适应窗口
- ✅ 无需密码（已配置为无认证模式）

#### 方式2: VNC 客户端

使用 VNC Viewer、RealVNC 等客户端：
- 地址：`localhost:5901`
- 密码：无需密码（SecurityTypes=None）

#### 方式3: SSH 终端

```bash
ssh root@localhost -p 2222
```

- 用户名：`root`
- 密码：`opencode`

### 4. 验证环境

进入容器后，运行验证脚本：

```bash
# 方式1: 在网页桌面中打开终端，运行
verify-env

# 方式2: 通过 SSH
ssh root@localhost -p 2222
verify-env

# 方式3: 使用 docker exec
docker exec ai-lab verify-env
```

应该看到：
```
===========================================
  AI Courses Environment Verification
===========================================

Python Version:
Python 3.10.x

Node.js Version:
v18.x.x

✓ LangChain 0.1.0
✓ LangGraph installed
✓ FastAPI 0.109.0
✓ Nemo Guardrails installed
✓ OpenCode installed

===========================================
  All checks completed!
===========================================
```

### 5. 开始学习课程

课程文件位于 `/workspace/courses/`：

```bash
cd /workspace/courses
ls -la
```

你会看到：
```
prompt-engineering/    # ✍️ 提示词工程 - 万能文案生成器
mcp-server/           # 🧠 MCP Server 开发 - 今日运势
ade-skill/            # 🔁 ADE 配置与智能体开发
agent-gordon/         # 🔎 智能体框架 - 毒舌 Gordon
multi-agent/          # 💬 智能体框架 - 创意风暴
guardrails/           # 🍸 安全与合规 - AI 酒吧调酒师
```

查看课程说明：
```bash
cat /workspace/courses/README.md
```

### 6. 配置 API Keys

```bash
cd /workspace
cp .env.template .env
vim .env  # 或使用 nano、gedit
```

填入你的 API Keys：
```bash
# OpenAI API Key (用于 GPT 模型)
OPENAI_API_KEY=sk-your-key-here

# Anthropic API Key (用于 Claude 模型)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# 通义千问 API Key (阿里云)
DASHSCOPE_API_KEY=sk-your-key-here
```

### 7. 运行课程示例

#### 课程1: 提示词工程
```bash
cd /workspace/courses/prompt-engineering
python3 example.py
```

#### 课程2: MCP Server 开发
```bash
cd /workspace/courses/mcp-server
node example.js
```

#### 课程3: 智能体开发 - Gordon
```bash
cd /workspace/courses/agent-gordon
python3 example.py
```

#### 课程4: 多智能体协作
```bash
cd /workspace/courses/multi-agent
python3 example.py
```

#### 课程5: 安全与合规
```bash
cd /workspace/courses/guardrails
python3 example.py
```

### 8. 测试所有课程

```bash
cd /workspace/courses
./test-all-courses.sh
```

## 容器管理命令

### 查看容器状态
```bash
docker ps | grep ai-lab
```

### 查看日志
```bash
docker logs ai-lab
docker logs -f ai-lab  # 实时查看
```

### 停止容器
```bash
docker stop ai-lab
```

### 启动容器
```bash
docker start ai-lab
```

### 重启容器
```bash
docker restart ai-lab
```

### 删除容器
```bash
docker rm -f ai-lab
```

### 进入容器终端
```bash
docker exec -it ai-lab bash
```

## 数据持久化

如果需要保存工作内容，挂载本地目录：

```bash
docker run -d \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  -v ~/ai-courses-workspace:/workspace \
  --name ai-lab \
  opencode-lab-ai:latest
```

这样你的代码和数据会保存在 `~/ai-courses-workspace` 目录中。

## 常见问题

### Q: 网页桌面打不开？
A: 
1. 确认容器正在运行：`docker ps | grep ai-lab`
2. 等待 15 秒让服务完全启动
3. 检查端口是否被占用：`netstat -an | grep 6080`

### Q: SSH 连接失败？
A: 
1. 确认使用正确的端口：`-p 2222`
2. 确认密码：`opencode`
3. 检查容器日志：`docker logs ai-lab`

### Q: 课程示例运行失败？
A: 
1. 确认已配置 API Keys：`cat /workspace/.env`
2. 检查 Python 环境：`python3 --version`
3. 验证包安装：`verify-env`

### Q: 如何更新镜像？
A: 
```bash
# 停止并删除旧容器
docker rm -f ai-lab

# 删除旧镜像
docker rmi opencode-lab-ai:latest

# 重新构建
cd ~/work/course
sudo docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .

# 启动新容器
docker run -d -p 2222:22 -p 5901:5901 -p 6080:6080 --name ai-lab opencode-lab-ai:latest
```

## 性能优化

### 调整分辨率
```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  -e VNC_RESOLUTION=1920x1080 \
  --name ai-lab \
  opencode-lab-ai:latest
```

### 限制资源使用
```bash
docker run -d \
  -p 2222:22 -p 5901:5901 -p 6080:6080 \
  --memory="4g" \
  --cpus="2" \
  --name ai-lab \
  opencode-lab-ai:latest
```

## 与原镜像的区别

| 特性 | 原镜像 (opencode-lab) | 新镜像 (opencode-lab-ai) |
|------|----------------------|--------------------------|
| 基础系统 | Ubuntu 20.04 | Ubuntu 22.04 |
| Python 版本 | 3.8 | 3.10 |
| 预装 AI 库 | ❌ 无 | ✅ 完整 |
| 课程示例 | ❌ 无 | ✅ 6门课程 |
| 启动方式 | 相同 | 相同 |
| 端口配置 | 相同 | 相同 |
| 访问方式 | 相同 | 相同 |

**结论**: 使用方式完全相同，只是增加了 AI 课程环境和示例代码！

---

**祝学习愉快！🎉**
