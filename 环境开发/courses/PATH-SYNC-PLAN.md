# 环境与Agent手册路径同步方案

## 问题分析

### 问题1: 路径不匹配
- **Agent手册验证命令**: `python3 example.py`
- **实际环境路径**: `/workspace/courses/prompt-engineering/example.py`
- **结果**: 验证失败 - `can't open file '/workspace/example.py'`

### 问题2: 示例代码是模拟的
- 当前代码返回模拟结果
- 需要真实调用通义千问API

## 解决方案

### 方案A: 修改验证命令（推荐）

**优点**:
- 保持环境目录结构清晰
- 每个课程独立目录
- 便于管理和扩展

**实施**:
1. 修改所有Agent手册中的验证命令
2. 从 `python3 example.py` 改为 `python3 /workspace/courses/[course-name]/example.py`

### 方案B: 修改环境结构

**优点**:
- 验证命令简单
- 符合手册描述

**缺点**:
- 需要重新构建Docker镜像
- 多个课程文件混在一起

**不推荐使用**

## 实施计划

### 第一步: 修改示例代码支持真实API

为每个课程的 `example.py` 添加真实API调用：

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

response = client.chat.completions.create(
    model=os.getenv("OPENAI_MODEL", "qwen3-max"),
    messages=[{"role": "user", "content": prompt}]
)
```

### 第二步: 统一验证命令路径

修改所有Agent手册中的验证命令：

**提示词工程**:
- 旧: `<!-- verify: command:python3 example.py|contains|提示词工程 -->`
- 新: `<!-- verify: command:cd /workspace/courses/prompt-engineering && python3 example.py|contains|提示词工程 -->`

**MCP Server开发**:
- 旧: `<!-- verify: command:node example.js|contains|MCP Server -->`
- 新: `<!-- verify: command:cd /workspace/courses/mcp-server && node example.js|contains|MCP Server -->`

**其他课程**: 类似修改

### 第三步: 更新环境配置

确保 `.env` 文件包含正确的API配置：

```bash
# 通义千问 API (OpenAI 兼容模式)
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
```

## 课程路径映射表

| 课程 | 环境路径 | 验证命令前缀 |
|------|---------|-------------|
| 提示词工程 | `/workspace/courses/prompt-engineering/` | `cd /workspace/courses/prompt-engineering &&` |
| MCP Server开发 | `/workspace/courses/mcp-server/` | `cd /workspace/courses/mcp-server &&` |
| ADE智能体开发 | `/workspace/courses/ade-agent/` | `cd /workspace/courses/ade-agent &&` |
| 单Agent开发 | `/workspace/courses/agent-gordon/` | `cd /workspace/courses/agent-gordon &&` |
| 多Agent协作 | `/workspace/courses/multi-agent/` | `cd /workspace/courses/multi-agent &&` |
| AI安全与合规 | `/workspace/courses/guardrails/` | `cd /workspace/courses/guardrails &&` |

## 实施检查清单

- [ ] 修改 `prompt-engineering/example.py` 支持真实API
- [ ] 修改 `mcp-server/example.js` 支持真实API
- [ ] 修改 `agent-gordon/example.py` 支持真实API
- [ ] 修改 `multi-agent/example.py` 支持真实API
- [ ] 修改 `guardrails/example.py` 支持真实API
- [ ] 更新提示词工程实验手册验证命令
- [ ] 更新MCP Server实验手册验证命令
- [ ] 更新ADE智能体实验手册验证命令
- [ ] 更新单Agent实验手册验证命令
- [ ] 更新多Agent实验手册验证命令
- [ ] 更新AI安全实验手册验证命令
- [ ] 测试所有验证命令
- [ ] 更新环境README文档

## 测试验证

### 测试步骤

1. 启动Docker环境
2. 配置API Key
3. 逐个运行验证命令
4. 确认输出包含预期内容

### 测试脚本

```bash
#!/bin/bash
# 测试所有课程验证命令

echo "测试提示词工程..."
cd /workspace/courses/prompt-engineering && python3 example.py | grep "提示词工程"

echo "测试MCP Server..."
cd /workspace/courses/mcp-server && node example.js | grep "MCP Server"

echo "测试单Agent..."
cd /workspace/courses/agent-gordon && python3 example.py | grep "PRA Loop"

echo "测试多Agent..."
cd /workspace/courses/multi-agent && python3 example.py | grep "头脑风暴"

echo "测试AI安全..."
cd /workspace/courses/guardrails && python3 example.py | grep "护栏系统"

echo "所有测试完成！"
```

## 注意事项

1. **API Key安全**: 不要在代码中硬编码API Key
2. **错误处理**: 添加API调用失败的友好提示
3. **超时设置**: 设置合理的API调用超时时间
4. **成本控制**: 使用较小的模型进行测试
5. **日志记录**: 记录API调用情况便于调试
