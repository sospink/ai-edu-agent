#!/bin/bash

# =============================================================================
# API Keys 配置脚本
# 自动将后端的 API 配置复制到容器中
# =============================================================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 自动检测容器名称
CONTAINER_NAME=$(docker ps --filter "ancestor=opencode-lab-ai:latest" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME=$(docker ps --filter "name=lab" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_NAME" ]; then
    echo -e "${YELLOW}错误: 未找到运行中的容器${NC}"
    echo "请先启动容器"
    exit 1
fi

echo "=========================================="
echo "  配置 API Keys"
echo "=========================================="
echo ""
echo -e "${BLUE}容器名称:${NC} $CONTAINER_NAME"
echo ""

# 读取后端 .env 文件中的配置
BACKEND_ENV="../EDU_Backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
    echo -e "${YELLOW}警告: 未找到后端 .env 文件${NC}"
    echo "路径: $BACKEND_ENV"
    exit 1
fi

# 提取配置
DASHSCOPE_API_KEY=$(grep "^DASHSCOPE_API_KEY=" "$BACKEND_ENV" | cut -d'=' -f2)
QWEN_MODEL=$(grep "^QWEN_MODEL=" "$BACKEND_ENV" | cut -d'=' -f2)
QWEN_BASE_URL=$(grep "^QWEN_BASE_URL=" "$BACKEND_ENV" | cut -d'=' -f2)

echo -e "${BLUE}[1/3]${NC} 从后端读取配置..."
echo "  DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:0:20}..."
echo "  QWEN_MODEL: $QWEN_MODEL"
echo "  QWEN_BASE_URL: $QWEN_BASE_URL"
echo ""

# 创建容器内的 .env 文件
echo -e "${BLUE}[2/3]${NC} 创建容器内的 .env 文件..."

ENV_CONTENT="# AI API Keys Configuration
# 自动从后端配置生成

# ============================================
# 通义千问配置 (阿里云)
# ============================================
DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY

# 通义千问模型
QWEN_MODEL=$QWEN_MODEL

# 通义千问 API 地址 (OpenAI 兼容模式)
QWEN_BASE_URL=$QWEN_BASE_URL

# ============================================
# OpenAI 兼容配置
# ============================================
# 使用通义千问的 OpenAI 兼容模式
OPENAI_API_KEY=$DASHSCOPE_API_KEY
OPENAI_BASE_URL=$QWEN_BASE_URL
OPENAI_MODEL=$QWEN_MODEL

# ============================================
# 其他 API Keys (可选)
# ============================================
# OpenAI 官方 API (如果有)
# OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic API (如果有)
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# ============================================
# 使用说明
# ============================================
# 1. 课程代码会自动读取 OPENAI_API_KEY
# 2. 实际使用的是通义千问的 OpenAI 兼容模式
# 3. 模型: $QWEN_MODEL
# 4. 如需使用其他模型，请修改 OPENAI_MODEL
"

# 写入容器
echo "$ENV_CONTENT" | docker exec -i $CONTAINER_NAME bash -c "cat > /workspace/.env"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} .env 文件已创建"
else
    echo -e "${YELLOW}✗${NC} .env 文件创建失败"
    exit 1
fi
echo ""

# 验证配置
echo -e "${BLUE}[3/3]${NC} 验证配置..."
docker exec $CONTAINER_NAME bash -c "cat /workspace/.env | grep -E '(DASHSCOPE|OPENAI|QWEN)' | grep -v '^#'"
echo ""

echo "=========================================="
echo -e "${GREEN}  ✓ API Keys 配置完成！${NC}"
echo "=========================================="
echo ""
echo "配置详情:"
echo "  - 使用通义千问 API"
echo "  - 模型: $QWEN_MODEL"
echo "  - OpenAI 兼容模式"
echo ""
echo "测试配置:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo "  cd /workspace/courses/prompt-engineering"
echo "  python3 example.py"
echo ""

