#!/bin/bash
# 本地测试环境快速设置脚本
# 适用于 Ubuntu 24.04 + Python 3.12

set -e

echo "=========================================="
echo "提示词工程 - 本地测试环境设置"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查Python版本
echo -e "${YELLOW}[1/5]${NC} 检查Python版本..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓${NC} $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} Python3 未安装"
    exit 1
fi
echo ""

# 2. 安装依赖
echo -e "${YELLOW}[2/5]${NC} 安装Python依赖..."
pip3 install --quiet openai python-dotenv
echo -e "${GREEN}✓${NC} openai 已安装"
echo -e "${GREEN}✓${NC} python-dotenv 已安装"
echo ""

# 3. 创建 .env 文件
echo -e "${YELLOW}[3/5]${NC} 配置环境变量..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# 通义千问 API (OpenAI 兼容模式)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
EOF
    echo -e "${YELLOW}⚠${NC}  已创建 .env 文件"
    echo -e "${YELLOW}⚠${NC}  请编辑 .env 文件，填入你的 API Key"
    echo ""
    echo "   nano .env"
    echo "   或"
    echo "   vim .env"
    echo ""
else
    echo -e "${GREEN}✓${NC} .env 文件已存在"
fi
echo ""

# 4. 验证配置
echo -e "${YELLOW}[4/5]${NC} 验证配置..."
source .env
if [ "$OPENAI_API_KEY" = "sk-your-api-key-here" ]; then
    echo -e "${RED}✗${NC} 请先配置 API Key"
    echo ""
    echo "编辑 .env 文件："
    echo "  nano .env"
    echo ""
    echo "将 OPENAI_API_KEY 改为你的真实 API Key"
    exit 1
else
    echo -e "${GREEN}✓${NC} API Key 已配置"
fi
echo ""

# 5. 测试运行
echo -e "${YELLOW}[5/5]${NC} 测试运行示例代码..."
if python3 example.py | grep -q "提示词工程"; then
    echo -e "${GREEN}✓${NC} 示例代码运行成功"
else
    echo -e "${RED}✗${NC} 示例代码运行失败"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✓ 设置完成！${NC}"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 运行示例: python3 example.py"
echo "  2. 测试真实API: python3 test_real_api.py"
echo ""
