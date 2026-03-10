# AI 课程实验环境

## 环境说明
这是一个预配置的 AI 课程实验环境，包含以下工具和库：

### Python 环境
- Python 3.10
- LangChain, LangGraph
- OpenAI SDK, ZhipuAI SDK
- FastAPI, Uvicorn
- Nemo Guardrails

### Node.js 环境
- Node.js 18
- @modelcontextprotocol/sdk

### MCP 工具集
已预配置以下 MCP 服务器：
- **filesystem** - 文件读写操作 (限制在 /workspace)
- **memory** - 持久化记忆，跨会话保存上下文
- **puppeteer** - 浏览器自动化，网页截图和测试
- **git** - Git 操作，提交、分支管理
- **sqlite** - SQLite 数据库操作
- **fetch** - HTTP 请求，API 调用
- **sequential-thinking** - 逐步推理思考

## 课程目录
主目录：`/root`（即 `~`）

- `/root/ADE_Agent/` - ADE 智能体开发
- `/root/MCP_Server/` - MCP Server 开发
- `/root/AgentFramework/` - 单 Agent 开发
- `/root/MultiAgentFramework/brainstorm-mas/` - 多 Agent 协作
- `/root/SecurityGuardrails/bartender-guardrails/` - Guardrails 安全护栏

## API 配置
在运行示例前，请先配置 API Keys：

```bash
cp /workspace/.env.template /workspace/.env
# 编辑 .env 文件，填入你的 API Keys
```

建议最少配置：

```env
ZHIPUAI_API_KEY=your-key
ZHIPU_API_KEY=your-key
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4-flash
```

## 验证环境
运行 `verify-env` 命令检查环境配置。

## 使用 OpenCode
```bash
# 启动 OpenCode
opencode

# 使用 AI 课程助手 Skill
# 在 OpenCode 中输入 /skill ai-tutor 激活教学助手
```

## 常用命令
```bash
# 验证环境
verify-env

# 运行单 Agent 示例
cd /root/AgentFramework
python3 main.py --demo

# 运行多 Agent 示例
cd /root/MultiAgentFramework/brainstorm-mas
python3 main.py --demo
```
