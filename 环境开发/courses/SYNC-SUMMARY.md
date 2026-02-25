# 环境与Agent手册同步总结

## 修改概述

为了解决实验环境与教学Agent智能体的交互问题，进行了以下系统性调整：

### 问题1: 路径不匹配 ✅ 已解决

**原问题**:
- Agent手册验证命令: `python3 example.py`
- 实际环境路径: `/workspace/courses/prompt-engineering/example.py`
- 错误: `can't open file '/workspace/example.py'`

**解决方案**:
- 修改所有Agent手册中的验证命令
- 添加 `cd /workspace/courses/[course-name] &&` 前缀
- 确保命令在正确的目录下执行

### 问题2: 示例代码是模拟的 ✅ 已解决

**原问题**:
- 示例代码返回模拟结果
- 无法真实调用通义千问API

**解决方案**:
- 修改 `prompt-engineering/example.py`
- 添加真实的OpenAI兼容API调用
- 支持通义千问API（qwen3-max模型）

## 已修改的文件

### 1. 示例代码

#### ✅ 环境开发/courses/prompt-engineering/example.py
- 添加真实API调用逻辑
- 使用 `openai` 库调用通义千问
- 添加错误处理和友好提示
- 支持 dry_run 模式（不调用API）

**关键修改**:
```python
from openai import OpenAI

client = OpenAI(
    api_key=self.api_key,
    base_url=self.base_url
)

response = client.chat.completions.create(
    model=self.model,
    messages=[{"role": "user", "content": prompt}],
    temperature=0.7,
    max_tokens=1000
)
```

### 2. Agent手册

#### ✅ 课程手册/01-提示词工程/02-提示词工程-实验手册.md

修改了4处验证命令：

1. **步骤3验证**: 
   - 旧: `python3 example.py`
   - 新: `cd /workspace/courses/prompt-engineering && python3 example.py`

2. **步骤4验证**:
   - 旧: `python3 my_generator.py`
   - 新: `cd /workspace/courses/prompt-engineering && python3 my_generator.py`
   - 文件检查: `/workspace/courses/prompt-engineering/my_generator.py`

3. **步骤6验证**:
   - 旧: `python3 my_generator_v2.py`
   - 新: `cd /workspace/courses/prompt-engineering && python3 my_generator_v2.py`
   - 文件检查: `/workspace/courses/prompt-engineering/my_generator_v2.py`

4. **步骤7验证**:
   - 旧: `python3 compare_prompts.py`
   - 新: `cd /workspace/courses/prompt-engineering && python3 compare_prompts.py`

## 待修改的文件

### 其他课程的Agent手册

以下手册需要类似的路径修改：

#### 🔲 课程手册/02-MCP-Server开发/03-MCP-Server开发-实验手册.md
- 验证命令: `node example.js`
- 修改为: `cd /workspace/courses/mcp-server && node example.js`

#### 🔲 课程手册/03-ADE智能体开发/04-ADE智能体开发-实验手册.md
- 验证命令: `python3 example.py`
- 修改为: `cd /workspace/courses/ade-agent && python3 example.py`
- **注意**: 环境中目录名可能是 `ade-agent` 而不是 `ADE智能体开发`

#### 🔲 课程手册/04-单Agent开发-Gordon/05-单Agent开发-实验手册.md
- 验证命令: `python3 example.py`
- 修改为: `cd /workspace/courses/agent-gordon && python3 example.py`

#### 🔲 课程手册/05-多Agent协作/06-多Agent协作-实验手册.md
- 验证命令: `python3 example.py`
- 修改为: `cd /workspace/courses/multi-agent && python3 example.py`

#### 🔲 课程手册/06-AI安全与合规/07-AI安全与合规-实验手册.md
- 验证命令: `python3 example.py`
- 修改为: `cd /workspace/courses/guardrails && python3 example.py`

### 其他课程的示例代码

以下示例代码需要添加真实API调用：

#### 🔲 环境开发/courses/agent-gordon/example.py
- 添加真实的LangChain Agent调用
- 使用通义千问作为LLM

#### 🔲 环境开发/courses/multi-agent/example.py
- 添加真实的LangGraph多Agent调用
- 使用通义千问作为LLM

#### 🔲 环境开发/courses/guardrails/example.py
- 添加真实的Guardrails检查
- 集成通义千问API

#### 🔲 环境开发/courses/mcp-server/example.js
- 当前可能已经是真实实现
- 需要验证是否正常工作

## 环境配置要求

### .env 文件配置

确保 `/workspace/.env` 包含以下配置：

```bash
# 通义千问 API (OpenAI 兼容模式)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
```

### Python依赖

确保安装了以下Python包：

```bash
pip install openai python-dotenv langchain langgraph
```

### Node.js依赖

确保安装了MCP相关包：

```bash
npm install @modelcontextprotocol/sdk
```

## 测试验证

### 测试脚本

创建了 `test-all-verifications.sh` 脚本用于测试所有验证命令：

```bash
cd /workspace/courses
chmod +x test-all-verifications.sh
./test-all-verifications.sh
```

### 手动测试步骤

1. **配置API Key**:
   ```bash
   echo "OPENAI_API_KEY=sk-xxx" >> /workspace/.env
   echo "OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1" >> /workspace/.env
   echo "OPENAI_MODEL=qwen3-max" >> /workspace/.env
   ```

2. **测试提示词工程**:
   ```bash
   cd /workspace/courses/prompt-engineering
   python3 example.py
   ```
   
   预期输出应包含 "提示词工程"

3. **测试MCP Server**:
   ```bash
   cd /workspace/courses/mcp-server
   node example.js
   ```
   
   预期输出应包含 "MCP Server"

4. **测试其他课程**: 类似步骤

## 课程路径映射

| 课程名称 | 环境目录 | 主文件 |
|---------|---------|--------|
| 提示词工程 | `/workspace/courses/prompt-engineering/` | `example.py` |
| MCP Server开发 | `/workspace/courses/mcp-server/` | `example.js` |
| ADE智能体开发 | `/workspace/courses/ade-agent/` | `example.py` |
| 单Agent开发 | `/workspace/courses/agent-gordon/` | `example.py` |
| 多Agent协作 | `/workspace/courses/multi-agent/` | `example.py` |
| AI安全与合规 | `/workspace/courses/guardrails/` | `example.py` |

## 下一步工作

### 优先级1: 完成其他课程的修改

1. 修改其他5个课程的Agent手册验证命令
2. 修改其他课程的示例代码支持真实API
3. 测试所有验证命令

### 优先级2: 文档更新

1. 更新环境开发README
2. 更新课程手册README
3. 添加API配置说明文档

### 优先级3: 优化和增强

1. 添加API调用重试机制
2. 添加API调用日志记录
3. 优化错误提示信息
4. 添加API成本统计

## 注意事项

1. **API Key安全**: 
   - 不要在代码中硬编码API Key
   - 使用环境变量管理敏感信息
   - 不要提交 `.env` 文件到Git

2. **错误处理**:
   - 所有API调用都应有try-catch
   - 提供友好的错误提示
   - 区分不同类型的错误（网络、认证、配额等）

3. **成本控制**:
   - 使用 `dry_run` 模式进行测试
   - 设置合理的 `max_tokens` 限制
   - 考虑使用较小的模型进行开发测试

4. **性能优化**:
   - 设置合理的超时时间
   - 考虑添加缓存机制
   - 避免重复调用相同的提示词

## 相关文档

- [PATH-SYNC-PLAN.md](./PATH-SYNC-PLAN.md) - 详细的同步方案
- [test-all-verifications.sh](./test-all-verifications.sh) - 测试脚本
- [API-配置说明.md](../API-配置说明.md) - API配置指南

## 更新日志

- **2026-01-16**: 初始版本
  - 修改提示词工程示例代码支持真实API
  - 修改提示词工程Agent手册验证命令
  - 创建测试脚本和文档

---

**状态**: 🟡 进行中  
**完成度**: 20% (1/6 课程已完成)  
**下次更新**: 完成其他5个课程的修改后
