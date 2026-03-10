# API Keys 配置说明（new-course）

## 推荐方式：自动配置

```bash
cd 环境开发
./setup-api-keys.sh
```

脚本会：

1. 自动检测运行中的 `opencode-lab-ai:latest` 容器
2. 从 `../EDU_Backend/.env` 读取可用 Key
3. 生成容器内 `/workspace/.env`
4. 同时写入 `ZHIPUAI/ZHIPU/OPENAI` 兼容变量

## 容器内 .env 标准字段

```env
# 智谱 SDK（单Agent/多Agent）
ZHIPUAI_API_KEY=...

# MCP Server 测试脚本
ZHIPU_API_KEY=...

# OpenAI 兼容（Guardrails/部分脚本）
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4-flash

# 兼容变量（可选）
DASHSCOPE_API_KEY=...
QWEN_MODEL=...
QWEN_BASE_URL=...
```

## 手动配置（可选）

```bash
docker exec -it ai-lab bash
cd /workspace
cp .env.template .env
vim .env
```

## 快速验证

```bash
docker exec ai-lab bash -lc "grep -E '(ZHIPU|OPENAI|QWEN|DASHSCOPE)' /workspace/.env | grep -v '^#'"
```

## 课程与变量关系

- `AgentFramework` / `MultiAgentFramework`：`ZHIPUAI_API_KEY`
- `MCP_Server/test/test_with_glm.py`：`ZHIPU_API_KEY`
- `SecurityGuardrails`：`OPENAI_API_KEY` + `OPENAI_BASE_URL`
- `ADE_Agent`：按 `.opencode`/运行环境使用对应模型 Key

## 常见问题

### 1) 未读取到 Key

检查 `../EDU_Backend/.env` 是否存在且包含：

- `ZHIPUAI_API_KEY` 或 `ZHIPU_API_KEY` 或 `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`

### 2) Guardrails 调用失败

优先确认：

- `OPENAI_API_KEY` 有值
- `OPENAI_BASE_URL` 与当前 Key 对应

### 3) 单/多 Agent 报缺少 ZHIPUAI_API_KEY

确认 `/workspace/.env` 中存在：

```env
ZHIPUAI_API_KEY=...
```
