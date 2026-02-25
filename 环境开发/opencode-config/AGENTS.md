# AI 课程实验环境

## 环境说明
这是一个预配置的 AI 课程实验环境，包含以下工具和库：

### Python 环境
- Python 3.10
- LangChain, LangGraph
- OpenAI, Anthropic SDK
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
- **brave-search** - 网页搜索 (需配置 API Key)

## 课程目录
- `/workspace/courses/prompt-engineering/` - 提示词工程
- `/workspace/courses/mcp-server/` - MCP Server 开发
- `/workspace/courses/ade-skill/` - ADE 智能体开发
- `/workspace/courses/agent-gordon/` - 单 Agent 开发
- `/workspace/courses/multi-agent/` - 多 Agent 协作
- `/workspace/courses/guardrails/` - Guardrails 安全护栏

## API 配置
在运行示例前，请先配置 API Keys：
```bash
cp /workspace/.env.template /workspace/.env
# 编辑 .env 文件，填入你的 API Keys
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

# 诊断 API
cd /workspace/courses && bash diagnose-api.sh

# 运行课程示例
cd /workspace/courses/prompt-engineering
python3 example.py
```
