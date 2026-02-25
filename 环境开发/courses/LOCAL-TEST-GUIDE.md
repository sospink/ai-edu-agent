# 本地测试指南 - Ubuntu 24.04 + Python 3.12

## 环境信息
- **操作系统**: Ubuntu 24.04
- **Python版本**: Python 3.12
- **测试目标**: 验证示例代码可以正常调用通义千问API

## 快速开始

### 1. 安装Python依赖

```bash
# 进入项目目录
cd "环境开发/courses/prompt-engineering"

# 安装依赖
pip install openai python-dotenv

# 或者使用 pip3
pip3 install openai python-dotenv
```

### 2. 配置API Key

创建 `.env` 文件：

```bash
# 在 prompt-engineering 目录下创建 .env 文件
cat > .env << 'EOF'
# 通义千问 API (OpenAI 兼容模式)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
EOF
```

**重要**: 将 `sk-your-api-key-here` 替换为你的真实API Key

### 3. 测试运行

```bash
# 测试 Dry Run 模式（不调用API）
python3 example.py

# 如果要测试真实API调用，需要修改代码中的 dry_run=True 为 dry_run=False
```

## 详细步骤

### 步骤1: 检查Python版本

```bash
python3 --version
# 应该显示: Python 3.12.x
```

### 步骤2: 创建虚拟环境（推荐）

```bash
# 在 courses 目录下创建虚拟环境
cd "环境开发/courses"
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 升级 pip
pip install --upgrade pip
```

### 步骤3: 安装所有依赖

```bash
# 基础依赖
pip install openai python-dotenv

# 如果要测试其他课程，还需要：
pip install langchain langchain-openai langgraph

# 查看已安装的包
pip list | grep -E "openai|dotenv|langchain"
```

### 步骤4: 获取通义千问API Key

1. 访问阿里云控制台: https://dashscope.console.aliyun.com/
2. 开通DashScope服务
3. 创建API Key
4. 复制API Key（格式: `sk-xxxxxxxxxxxxxxxx`）

### 步骤5: 配置环境变量

**方法1: 使用 .env 文件（推荐）**

```bash
cd "环境开发/courses/prompt-engineering"

# 创建 .env 文件
nano .env
# 或使用 vim
vim .env
```

添加以下内容：
```
OPENAI_API_KEY=sk-your-actual-api-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

**方法2: 临时环境变量**

```bash
export OPENAI_API_KEY="sk-your-actual-api-key"
export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export OPENAI_MODEL="qwen-turbo"
```

### 步骤6: 测试示例代码

```bash
cd "环境开发/courses/prompt-engineering"

# 运行示例（默认是 dry_run 模式）
python3 example.py
```

**预期输出**:
```
============================================================
课程1: 提示词工程 - 万能文案生成器
============================================================

✓ API 配置成功
  Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
  Model: qwen-turbo

📝 示例1: 小红书风格 - 产品推广
------------------------------------------------------------
你是一位专业的文案撰写专家。

【任务】
为以下主题创作一篇文案：智能手表新品发布
...
```

### 步骤7: 测试真实API调用

修改 `example.py` 中的 `dry_run` 参数：

```python
# 在 main() 函数中，找到这两行：
result = generator.generate(
    topic="智能手表新品发布",
    tone="casual",
    platform="xiaohongshu",
    length=150,
    keywords=["健康监测", "时尚"],
    dry_run=True  # 改为 False
)
```

或者创建一个测试脚本：

```bash
cat > test_real_api.py << 'EOF'
#!/usr/bin/env python3
"""测试真实API调用"""

import os
from dotenv import load_dotenv

load_dotenv()

# 导入生成器
import sys
sys.path.append('.')
from example import ContentGenerator

def test_real_api():
    print("=" * 60)
    print("测试真实API调用")
    print("=" * 60)
    print()
    
    # 创建生成器
    generator = ContentGenerator()
    
    # 测试真实API调用
    print("📝 生成小红书风格文案...")
    print("-" * 60)
    
    result = generator.generate(
        topic="周末去哪里玩",
        tone="casual",
        platform="xiaohongshu",
        length=100,
        keywords=["放松", "美食"],
        dry_run=False  # 真实调用API
    )
    
    if "error" in result:
        print(f"❌ 错误: {result['content']}")
    else:
        print("✅ 生成成功!")
        print()
        print("生成的文案:")
        print("-" * 60)
        print(result['content'])
        print("-" * 60)
        print()
        if result.get('tokens_used'):
            print(f"Token使用: {result['tokens_used']}")

if __name__ == "__main__":
    test_real_api()
EOF

# 运行测试
python3 test_real_api.py
```

## 常见问题排查

### 问题1: ModuleNotFoundError: No module named 'openai'

**解决方案**:
```bash
pip3 install openai
# 或者
python3 -m pip install openai
```

### 问题2: ModuleNotFoundError: No module named 'dotenv'

**解决方案**:
```bash
pip3 install python-dotenv
```

### 问题3: API Key未配置

**错误信息**: `⚠️ 警告: 未设置 OPENAI_API_KEY`

**解决方案**:
1. 检查 `.env` 文件是否存在
2. 检查 `.env` 文件中的API Key是否正确
3. 确保 `.env` 文件在正确的目录下

```bash
# 检查 .env 文件
cat .env

# 检查环境变量是否加载
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('OPENAI_API_KEY'))"
```

### 问题4: API调用失败

**错误信息**: `[错误] API 调用失败: ...`

**可能原因**:
1. API Key无效或过期
2. 网络连接问题
3. API配额用完
4. Base URL配置错误

**排查步骤**:
```bash
# 测试网络连接
curl -I https://dashscope.aliyuncs.com

# 测试API Key（使用curl）
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-turbo",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 问题5: Python版本不兼容

**错误信息**: `SyntaxError` 或类型提示相关错误

**解决方案**:
```bash
# 确认Python版本
python3 --version

# 如果版本低于3.10，升级Python或修改代码中的类型提示
```

## 测试检查清单

- [ ] Python 3.12 已安装
- [ ] pip 已升级到最新版本
- [ ] openai 包已安装
- [ ] python-dotenv 包已安装
- [ ] .env 文件已创建
- [ ] API Key 已配置
- [ ] Dry Run 模式测试通过
- [ ] 真实API调用测试通过
- [ ] 输出包含 "提示词工程" 关键词

## 完整测试脚本

创建一个完整的测试脚本：

```bash
cat > full_test.sh << 'EOF'
#!/bin/bash
# 完整测试脚本

set -e

echo "=========================================="
echo "提示词工程示例代码测试"
echo "=========================================="
echo ""

# 1. 检查Python版本
echo "1. 检查Python版本..."
python3 --version
echo ""

# 2. 检查依赖
echo "2. 检查依赖..."
python3 -c "import openai; print('✓ openai 已安装')"
python3 -c "import dotenv; print('✓ python-dotenv 已安装')"
echo ""

# 3. 检查环境变量
echo "3. 检查环境变量..."
if [ -f .env ]; then
    echo "✓ .env 文件存在"
    source .env
    if [ -n "$OPENAI_API_KEY" ]; then
        echo "✓ OPENAI_API_KEY 已配置"
    else
        echo "✗ OPENAI_API_KEY 未配置"
        exit 1
    fi
else
    echo "✗ .env 文件不存在"
    exit 1
fi
echo ""

# 4. 运行示例代码
echo "4. 运行示例代码（Dry Run模式）..."
python3 example.py | grep "提示词工程"
echo "✓ 示例代码运行成功"
echo ""

echo "=========================================="
echo "✓ 所有测试通过！"
echo "=========================================="
EOF

chmod +x full_test.sh
./full_test.sh
```

## 下一步

测试通过后，你可以：

1. **测试其他课程**: 使用相同的方法测试其他课程的示例代码
2. **修改其他课程**: 参考提示词工程的修改方式
3. **部署到Docker**: 将测试通过的代码部署到Docker环境

## 参考资料

- [通义千问API文档](https://help.aliyun.com/zh/dashscope/)
- [OpenAI Python SDK](https://github.com/openai/openai-python)
- [python-dotenv文档](https://pypi.org/project/python-dotenv/)

---

**测试环境**: Ubuntu 24.04 + Python 3.12  
**最后更新**: 2026-01-16
