#!/bin/bash
# API配置诊断脚本

echo "=========================================="
echo "  API 配置诊断"
echo "=========================================="
echo ""

# 检查1: .env文件是否存在
echo "检查1: .env文件"
echo "----------------------------------------"
if [ -f "/workspace/.env" ]; then
    echo "✓ .env文件存在"
    echo ""
    echo "内容:"
    cat /workspace/.env
    echo ""
else
    echo "✗ .env文件不存在"
    echo ""
    echo "解决方案:"
    echo "  cp /workspace/.env.template /workspace/.env"
    echo "  nano /workspace/.env"
    echo ""
    exit 1
fi

# 检查2: API Key是否配置
echo "检查2: API Key配置"
echo "----------------------------------------"
source /workspace/.env

if [ -z "$OPENAI_API_KEY" ]; then
    echo "✗ OPENAI_API_KEY 未设置"
    exit 1
elif [ "$OPENAI_API_KEY" == "your-openai-api-key-here" ]; then
    echo "✗ OPENAI_API_KEY 还是默认值,需要填写真实的API Key"
    exit 1
else
    echo "✓ OPENAI_API_KEY 已配置"
    echo "  值: ${OPENAI_API_KEY:0:20}..."
fi
echo ""

# 检查3: Python能否导入openai
echo "检查3: Python openai包"
echo "----------------------------------------"
python3 -c "import openai; print('✓ openai包已安装, 版本:', openai.__version__)" 2>&1
if [ $? -ne 0 ]; then
    echo "✗ openai包未安装或有问题"
    echo "  安装命令: pip3 install openai"
    exit 1
fi
echo ""

# 检查4: 测试真实API调用
echo "检查4: 测试真实API调用"
echo "----------------------------------------"
python3 << 'PYTHON_CODE'
import os
from openai import OpenAI

try:
    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    )
    
    print("正在调用API...")
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "qwen-turbo"),
        messages=[
            {"role": "user", "content": "你好,请回复'测试成功'"}
        ],
        max_tokens=50
    )
    
    result = response.choices[0].message.content
    print(f"✓ API调用成功!")
    print(f"  响应: {result}")
    
except Exception as e:
    print(f"✗ API调用失败: {e}")
    print("")
    print("可能的原因:")
    print("  1. API Key无效")
    print("  2. 网络连接问题")
    print("  3. API配额用完")
    print("  4. Base URL配置错误")
    exit(1)
PYTHON_CODE

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✓ 所有检查通过!"
    echo "=========================================="
    echo ""
    echo "API配置正常,示例代码应该能调用真实API"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "  ✗ API配置有问题"
    echo "=========================================="
    echo ""
    exit 1
fi
