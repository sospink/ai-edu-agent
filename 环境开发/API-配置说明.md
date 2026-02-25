# API Keys 配置说明

## 快速配置（推荐）

使用自动配置脚本，一键从后端复制配置到容器：

```bash
cd 环境开发
chmod +x setup-api-keys.sh
sudo ./setup-api-keys.sh
```

这个脚本会：
1. 自动检测运行中的容器
2. 从 `EDU_Backend/.env` 读取通义千问配置
3. 在容器内创建 `/workspace/.env` 文件
4. 配置 OpenAI 兼容模式

---

## 配置详情

### 使用的 API

**通义千问 (阿里云)**
- API Key: `sk-e163cee3d11541738ee4a99f16690b2b`
- 模型: `qwen3-max`
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`

### OpenAI 兼容模式

通义千问提供了 OpenAI 兼容的 API 接口，所以课程代码可以直接使用：

```python
# 课程代码中
api_key = os.getenv("OPENAI_API_KEY")  # 实际使用通义千问的 Key
base_url = os.getenv("OPENAI_BASE_URL")  # 通义千问的兼容接口
model = os.getenv("OPENAI_MODEL")  # qwen3-max
```

---

## 容器内的 .env 文件

自动配置脚本会在容器内创建 `/workspace/.env` 文件：

```bash
# 通义千问配置
DASHSCOPE_API_KEY=sk-e163cee3d11541738ee4a99f16690b2b
QWEN_MODEL=qwen3-max
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# OpenAI 兼容配置（课程代码使用）
OPENAI_API_KEY=sk-e163cee3d11541738ee4a99f16690b2b
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
```

---

## 手动配置（可选）

如果不想使用自动脚本，可以手动配置：

### 1. 进入容器

```bash
docker exec -it ai-lab bash
```

### 2. 创建 .env 文件

```bash
cd /workspace
cat > .env << 'EOF'
# 通义千问配置
DASHSCOPE_API_KEY=sk-e163cee3d11541738ee4a99f16690b2b
QWEN_MODEL=qwen3-max
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# OpenAI 兼容配置
OPENAI_API_KEY=sk-e163cee3d11541738ee4a99f16690b2b
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
EOF
```

### 3. 验证配置

```bash
cat /workspace/.env
```

---

## 测试配置

### 测试课程 1: 提示词工程

```bash
docker exec -it ai-lab bash
cd /workspace/courses/prompt-engineering
python3 example.py
```

应该看到：
```
✓ API 配置成功
  Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
  Model: qwen3-max
```

### 测试课程 4: Gordon Agent

```bash
cd /workspace/courses/agent-gordon
python3 example.py
```

应该看到：
```
✓ API 配置成功 (Model: qwen3-max)
```

---

## 课程与 API 的关系

| 课程 | 需要 API | 说明 |
|------|---------|------|
| 1. 提示词工程 | ✅ 是 | 需要调用 LLM 生成文案 |
| 2. MCP Server | ❌ 否 | 仅演示 MCP 协议 |
| 3. ADE Skill | ✅ 是 | 需要 LLM 进行代码翻译 |
| 4. Gordon Agent | ✅ 是 | 需要 LLM 生成评论 |
| 5. Multi-Agent | ✅ 是 | 需要 LLM 进行协作 |
| 6. Guardrails | ✅ 是 | 需要 LLM + 安全检查 |

---

## 常见问题

### Q1: 为什么使用 OPENAI_API_KEY 而不是 DASHSCOPE_API_KEY？

A: 课程代码是通用的，使用 OpenAI 的标准接口。通义千问提供了 OpenAI 兼容模式，所以我们把通义千问的 Key 赋值给 `OPENAI_API_KEY`，这样课程代码无需修改就能使用。

### Q2: 可以使用其他模型吗？

A: 可以！修改 `.env` 文件中的 `OPENAI_MODEL`：

```bash
# 通义千问其他模型
OPENAI_MODEL=qwen-turbo
OPENAI_MODEL=qwen-plus
OPENAI_MODEL=qwen3-max

# 如果有 OpenAI 官方 Key
OPENAI_API_KEY=sk-your-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
```

### Q3: API Key 会过期吗？

A: 是的，需要定期检查。如果 API 调用失败，请：
1. 检查阿里云控制台的 API Key 状态
2. 检查账户余额
3. 更新 `EDU_Backend/.env` 中的 Key
4. 重新运行 `setup-api-keys.sh`

### Q4: 如何查看 API 调用日志？

A: 课程代码会打印配置信息。如需详细日志，可以在代码中添加：

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## 安全提示

⚠️ **重要**: API Key 是敏感信息

1. **不要提交到 Git**
   - `.env` 文件已在 `.gitignore` 中
   - 不要在代码中硬编码 API Key

2. **定期轮换**
   - 建议每 3-6 个月更换一次 API Key
   - 在阿里云控制台可以生成新的 Key

3. **监控使用量**
   - 定期检查 API 调用量和费用
   - 设置用量告警

---

## 相关文档

- [通义千问 API 文档](https://help.aliyun.com/zh/dashscope/)
- [OpenAI 兼容模式说明](https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/)
- [课程使用指南](USAGE-GUIDE.md)
- [测试指南](TESTING-README.md)

---

**更新时间**: 2026-01-15
