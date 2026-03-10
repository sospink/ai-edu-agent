#!/bin/bash

# =============================================================================
# API Keys 配置脚本
# 自动将后端的 API 配置复制到容器中
# =============================================================================

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 基础检查
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}错误: 未检测到 docker 命令${NC}"
    exit 1
fi

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

# 工具函数
get_env_value() {
    local key="$1"
    grep -E "^${key}=" "$BACKEND_ENV" | tail -n 1 | cut -d'=' -f2-
}

first_non_empty() {
    for value in "$@"; do
        if [ -n "$value" ]; then
            echo "$value"
            return 0
        fi
    done
    echo ""
}

# 提取配置（兼容多来源）
ZHIPUAI_API_KEY_RAW=$(get_env_value "ZHIPUAI_API_KEY")
ZHIPU_API_KEY_RAW=$(get_env_value "ZHIPU_API_KEY")
OPENAI_API_KEY_RAW=$(get_env_value "OPENAI_API_KEY")
DASHSCOPE_API_KEY=$(get_env_value "DASHSCOPE_API_KEY")

QWEN_MODEL=$(get_env_value "QWEN_MODEL")
OPENAI_MODEL_RAW=$(get_env_value "OPENAI_MODEL")

QWEN_BASE_URL=$(get_env_value "QWEN_BASE_URL")
OPENAI_BASE_URL_RAW=$(get_env_value "OPENAI_BASE_URL")

# 归一化变量
ZHIPUAI_API_KEY=$(first_non_empty "$ZHIPUAI_API_KEY_RAW" "$ZHIPU_API_KEY_RAW" "$OPENAI_API_KEY_RAW" "$DASHSCOPE_API_KEY")
ZHIPU_API_KEY=$(first_non_empty "$ZHIPU_API_KEY_RAW" "$ZHIPUAI_API_KEY_RAW" "$OPENAI_API_KEY_RAW" "$DASHSCOPE_API_KEY")
OPENAI_API_KEY=$(first_non_empty "$OPENAI_API_KEY_RAW" "$ZHIPUAI_API_KEY" "$ZHIPU_API_KEY" "$DASHSCOPE_API_KEY")
OPENAI_BASE_URL=$(first_non_empty "$OPENAI_BASE_URL_RAW" "$QWEN_BASE_URL" "https://open.bigmodel.cn/api/paas/v4")
OPENAI_MODEL=$(first_non_empty "$OPENAI_MODEL_RAW" "$QWEN_MODEL" "glm-4-flash")

echo -e "${BLUE}[1/3]${NC} 从后端读取配置..."
echo "  ZHIPUAI_API_KEY: ${ZHIPUAI_API_KEY:0:20}..."
echo "  ZHIPU_API_KEY: ${ZHIPU_API_KEY:0:20}..."
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
echo "  DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:0:20}..."
echo "  OPENAI_MODEL: $OPENAI_MODEL"
echo "  OPENAI_BASE_URL: $OPENAI_BASE_URL"
echo ""

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}错误: 未从后端读取到可用 API Key${NC}"
    echo "请检查 $BACKEND_ENV 中是否存在以下任一键："
    echo "  ZHIPUAI_API_KEY / ZHIPU_API_KEY / OPENAI_API_KEY / DASHSCOPE_API_KEY"
    exit 1
fi

# 创建容器内的 .env 文件
echo -e "${BLUE}[2/3]${NC} 创建容器内的 .env 文件..."

ENV_CONTENT="# AI API Keys Configuration
# 自动从后端配置生成

# ============================================
# 新版课程统一配置
# ============================================
# 智谱 SDK（单Agent/多Agent）
ZHIPUAI_API_KEY=$ZHIPUAI_API_KEY
# MCP Server 测试脚本
ZHIPU_API_KEY=$ZHIPU_API_KEY

# OpenAI 兼容（Guardrails/部分脚本）
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_BASE_URL=$OPENAI_BASE_URL
OPENAI_MODEL=$OPENAI_MODEL

# 兼容通义千问变量
DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY
QWEN_MODEL=$QWEN_MODEL
QWEN_BASE_URL=$QWEN_BASE_URL

# ============================================
# 其他 API Keys (可选)
# ============================================
# Anthropic API (如果有)
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# ============================================
# 使用说明
# ============================================
# 1. AgentFramework/MultiAgentFramework 读取 ZHIPUAI_API_KEY
# 2. MCP_Server 测试脚本读取 ZHIPU_API_KEY
# 3. Guardrails 读取 OPENAI_API_KEY + OPENAI_BASE_URL
# 4. 如需切换模型，请修改 OPENAI_MODEL
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
docker exec $CONTAINER_NAME bash -c "cat /workspace/.env | grep -E '(ZHIPU|DASHSCOPE|OPENAI|QWEN)' | grep -v '^#'"
echo ""

echo "=========================================="
echo -e "${GREEN}  ✓ API Keys 配置完成！${NC}"
echo "=========================================="
echo ""
echo "配置详情:"
echo "  - 已写入 ZHIPUAI/ZHIPU/OpenAI 兼容变量"
echo "  - 模型: $OPENAI_MODEL"
echo "  - Base URL: $OPENAI_BASE_URL"
echo ""
echo "测试配置:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo "  cd /root/AgentFramework"
echo "  python3 main.py --demo"
echo ""
