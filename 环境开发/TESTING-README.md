# 课程测试快速指南

## 三种测试方式

### 方式 1: 快速测试（推荐）⚡

**在宿主机上运行**，自动测试容器内的所有课程环境。

#### Linux/Mac:
```bash
cd 环境开发
chmod +x test-courses-quick.sh
./test-courses-quick.sh
```

#### Windows:
```cmd
cd 环境开发
test-courses-quick.bat
```

**优点**: 
- 一键测试所有内容
- 自动检查环境、依赖、课程文件
- 生成详细的测试报告

---

### 方式 2: 容器内详细测试 🔍

**进入容器后运行**，获得更详细的测试信息。

```bash
# 1. 进入容器
docker exec -it ai-lab bash

# 2. 运行详细测试
cd /workspace/courses
chmod +x test-courses-detailed.sh
./test-courses-detailed.sh
```

**优点**:
- 更详细的测试输出
- 可以看到每个测试步骤
- 包含 API 配置检查

---

### 方式 3: 手动测试 ✋

**通过 VNC 桌面或 SSH 终端**，逐个测试每门课程。

#### 通过 VNC 桌面:

1. 打开浏览器访问: http://192.168.20.3:6080/
2. 打开终端 (Applications -> Terminal)
3. 运行测试命令:

```bash
# 测试课程 1
cd /workspace/courses/prompt-engineering
python3 example.py

# 测试课程 2
cd /workspace/courses/mcp-server
node example.js

# 测试课程 4
cd /workspace/courses/agent-gordon
python3 example.py

# 测试课程 5
cd /workspace/courses/multi-agent
python3 example.py

# 测试课程 6
cd /workspace/courses/guardrails
python3 example.py
```

#### 通过 SSH:

```bash
# 1. 连接到容器
ssh root@192.168.20.3 -p 2222
# 密码: opencode

# 2. 运行测试命令（同上）
```

**优点**:
- 可以看到完整的输出
- 可以修改代码并重新测试
- 适合调试问题

---

## 测试前准备

### 1. 确保容器正在运行

```bash
docker ps | grep ai-lab
```

如果没有运行，启动容器：

```bash
docker start ai-lab
```

### 2. 配置 API Keys（重要！）

大多数课程需要 AI API Keys 才能运行。

```bash
# 进入容器
docker exec -it ai-lab bash

# 复制模板
cd /workspace
cp .env.template .env

# 编辑 .env 文件
vim .env  # 或使用 nano、mousepad
```

**必需的 API Keys**:

```bash
# OpenAI (必需)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Anthropic (可选)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# 通义千问 (可选)
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
```

**获取 API Keys**:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/
- 通义千问: https://dashscope.console.aliyun.com/

---

## 测试输出示例

### 成功的测试输出:

```
==========================================
  AI 课程环境快速测试
==========================================

[1/5] 检查容器状态...
✓ 容器正在运行

[2/5] 检查 Python 环境...
✓ Python 3.10.12

[3/5] 检查 Node.js 环境...
✓ Node.js v18.19.0

[4/5] 检查课程文件...
✓ prompt-engineering
✓ mcp-server
✓ ade-skill
✓ agent-gordon
✓ multi-agent
✓ guardrails

[5/5] 运行详细测试...
----------------------------------------
[INFO] 检查 Python 版本...
[✓] Python 3.10 已安装
[✓] langchain
[✓] langgraph
[✓] openai
...
通过: 25
失败: 0
----------------------------------------

==========================================
  ✓ 所有测试通过！
==========================================
```

### 失败的测试输出:

```
[✗] OPENAI_API_KEY 未配置或格式不正确
[✗] 课程 1 示例运行失败
查看日志: cat /tmp/test-course1.log

通过: 20
失败: 5

==========================================
  ! 部分测试失败
==========================================

故障排除:
1. 检查容器日志: docker logs ai-lab
2. 进入容器调试: docker exec -it ai-lab bash
3. 查看测试日志: docker exec ai-lab cat /tmp/test-course*.log
```

---

## 常见问题

### Q1: 测试显示 "容器未运行"

**解决**:
```bash
docker start ai-lab
```

### Q2: Python 包缺失

**解决**:
```bash
docker exec -it ai-lab bash
pip3 install langchain langchain-openai langgraph openai
```

### Q3: API Key 错误

**解决**:
1. 检查 `.env` 文件是否存在
2. 检查 API Key 格式是否正确（以 `sk-` 开头）
3. 检查 API Key 是否有效（未过期）

### Q4: 课程示例运行失败

**解决**:
```bash
# 查看详细错误日志
docker exec ai-lab cat /tmp/test-course1.log

# 手动运行查看错误
docker exec -it ai-lab bash
cd /workspace/courses/prompt-engineering
python3 example.py
```

---

## 测试检查清单

使用此清单确保所有测试通过：

- [ ] 容器正在运行
- [ ] Python 3.10 已安装
- [ ] Node.js 18 已安装
- [ ] 所有 Python 包已安装
- [ ] 所有 Node.js 包已安装
- [ ] `.env` 文件已创建
- [ ] API Keys 已配置
- [ ] 所有课程目录存在
- [ ] 所有示例文件存在
- [ ] 课程 1 示例可运行
- [ ] 课程 2 示例可运行
- [ ] 课程 4 示例可运行
- [ ] 课程 5 示例可运行
- [ ] 课程 6 示例可运行

---

## 下一步

测试通过后，你可以：

1. **开始学习课程**: 
   - 查看 `/workspace/courses/` 下的课程文件
   - 阅读每个课程的 README.md

2. **修改示例代码**:
   - 使用 VNC 桌面中的文本编辑器
   - 或通过 SSH 使用 vim/nano

3. **创建自己的项目**:
   - 在 `/workspace/` 下创建新目录
   - 使用 OpenCode AI 辅助编程

4. **使用 OpenCode**:
   ```bash
   opencode
   ```

---

## 相关文档

- **详细测试指南**: [COURSE-TESTING-GUIDE.md](COURSE-TESTING-GUIDE.md)
- **课程说明**: [README-AI-COURSES.md](README-AI-COURSES.md)
- **使用指南**: [USAGE-GUIDE.md](USAGE-GUIDE.md)
- **构建指南**: [BUILD-GUIDE.md](BUILD-GUIDE.md)

---

**提示**: 如果遇到问题，请先查看 [COURSE-TESTING-GUIDE.md](COURSE-TESTING-GUIDE.md) 中的故障排除部分。
