#!/bin/bash

# =============================================================================
# 快速测试脚本 - 在宿主机上运行
# 测试容器内家目录课程环境是否正常
# =============================================================================

set -e

# 自动检测容器名称
CONTAINER_NAME=$(docker ps --filter "ancestor=opencode-lab-ai:latest" --format "{{.Names}}" | head -n 1)

# 如果没有找到，尝试查找包含 "lab" 的容器
if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME=$(docker ps --filter "name=lab" --format "{{.Names}}" | head -n 1)
fi

# 如果还是没有找到，使用默认名称
if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME="ai-lab"
fi

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}错误: 未检测到 docker 命令${NC}"
    exit 1
fi

echo "=========================================="
echo "  AI 课程环境快速测试 (home-course)"
echo "=========================================="
echo ""
echo -e "${BLUE}检测到容器:${NC} $CONTAINER_NAME"
echo ""

# 检查容器是否运行
echo -e "${BLUE}[1/5]${NC} 检查容器状态..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}✓${NC} 容器正在运行"
else
    echo -e "${RED}✗${NC} 容器未运行"
    echo "请先启动容器: docker start $CONTAINER_NAME"
    exit 1
fi
echo ""

# 检查基础环境
echo -e "${BLUE}[2/5]${NC} 检查基础环境..."
PYTHON_VERSION=$(docker exec "$CONTAINER_NAME" python3 --version 2>&1 || true)
NODE_VERSION=$(docker exec "$CONTAINER_NAME" node --version 2>&1 || true)

if echo "$PYTHON_VERSION" | grep -q "Python 3.10"; then
    echo -e "${GREEN}✓${NC} $PYTHON_VERSION"
else
    echo -e "${YELLOW}!${NC} Python 版本: $PYTHON_VERSION (建议 3.10+)"
fi

if echo "$NODE_VERSION" | grep -q "v18"; then
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${YELLOW}!${NC} Node.js 版本: $NODE_VERSION (建议 v18+)"
fi
echo ""

# 检查课程目录
echo -e "${BLUE}[3/5]${NC} 检查课程目录..."
NEW_COURSE_DIRS=(
    "/root/ADE_Agent"
    "/root/MCP_Server"
    "/root/AgentFramework"
    "/root/MultiAgentFramework/brainstorm-mas"
    "/root/SecurityGuardrails/bartender-guardrails"
)

MISSING=0
for dir in "${NEW_COURSE_DIRS[@]}"; do
    if docker exec "$CONTAINER_NAME" test -d "$dir" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $dir"
    else
        echo -e "${RED}✗${NC} $dir (缺失)"
        MISSING=$((MISSING + 1))
    fi
done

echo ""

if [ "$MISSING" -gt 0 ]; then
    echo -e "${RED}警告: 检测到 $MISSING 个课程目录问题${NC}"
fi

# 运行 smoke tests
echo -e "${BLUE}[4/5]${NC} 运行课程 Smoke Tests..."
FAILURES=0

# 4.1 依赖导入测试
if docker exec "$CONTAINER_NAME" python3 -c "import zhipuai, langgraph, fastapi, nemoguardrails" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Python 核心依赖可导入"
else
    echo -e "${RED}✗${NC} Python 核心依赖导入失败"
    FAILURES=$((FAILURES + 1))
fi

# 4.2 MCP Server 构建产物测试
if docker exec "$CONTAINER_NAME" test -f /root/MCP_Server/dist/index.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC} MCP_Server 已构建 (dist/index.js 存在)"
else
    echo -e "${RED}✗${NC} MCP_Server 未构建"
    FAILURES=$((FAILURES + 1))
fi

# 4.3 AgentFramework 模块加载
if docker exec "$CONTAINER_NAME" bash -lc "cd /root/AgentFramework && python3 -c 'import config, tools, memory, prompts, agent; print(\"ok\")'" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} AgentFramework 模块加载正常"
else
    echo -e "${RED}✗${NC} AgentFramework 模块加载失败"
    FAILURES=$((FAILURES + 1))
fi

# 4.4 MultiAgentFramework 模块加载
if docker exec "$CONTAINER_NAME" bash -lc "cd /root/MultiAgentFramework/brainstorm-mas && python3 -c 'import config, state, workflow, agents, server; print(\"ok\")'" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MultiAgentFramework 模块加载正常"
else
    echo -e "${RED}✗${NC} MultiAgentFramework 模块加载失败"
    FAILURES=$((FAILURES + 1))
fi

# 4.5 Guardrails 配置加载
if docker exec "$CONTAINER_NAME" bash -lc "cd /root/SecurityGuardrails/bartender-guardrails && python3 -c 'from nemoguardrails import RailsConfig; RailsConfig.from_path(\"config\"); print(\"ok\")'" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Guardrails 配置可加载"
else
    echo -e "${RED}✗${NC} Guardrails 配置加载失败"
    FAILURES=$((FAILURES + 1))
fi

# 4.6 ADE 配置文件检查
if docker exec "$CONTAINER_NAME" test -f /root/ADE_Agent/.opencode/opencode.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} ADE_Agent OpenCode 配置存在"
else
    echo -e "${RED}✗${NC} ADE_Agent OpenCode 配置缺失"
    FAILURES=$((FAILURES + 1))
fi

echo ""

# API 配置提醒
echo -e "${BLUE}[5/5]${NC} 检查 API 环境变量..."
if docker exec "$CONTAINER_NAME" bash -lc "test -f /workspace/.env && grep -q '^OPENAI_API_KEY=' /workspace/.env"; then
    echo -e "${GREEN}✓${NC} /workspace/.env 已存在且包含 OPENAI_API_KEY"
else
    echo -e "${YELLOW}!${NC} /workspace/.env 未配置完整，请先运行: ./setup-api-keys.sh"
fi

if docker exec "$CONTAINER_NAME" bash -lc "test -f /workspace/.env && grep -q '^ZHIPUAI_API_KEY=' /workspace/.env"; then
    echo -e "${GREEN}✓${NC} /workspace/.env 包含 ZHIPUAI_API_KEY"
else
    echo -e "${YELLOW}!${NC} /workspace/.env 缺少 ZHIPUAI_API_KEY"
fi

echo ""

# 汇总
echo "=========================================="
if [ "$MISSING" -eq 0 ] && [ "$FAILURES" -eq 0 ]; then
    echo -e "${GREEN}  ✓ 所有核心测试通过！${NC}"
    TEST_EXIT_CODE=0
else
    echo -e "${YELLOW}  ! 部分测试失败${NC}"
    echo -e "${YELLOW}    - 路径问题: $MISSING${NC}"
    echo -e "${YELLOW}    - Smoke 失败: $FAILURES${NC}"
    TEST_EXIT_CODE=1
fi

echo ""
echo "下一步:"
echo "1. 访问 VNC 桌面: http://192.168.20.3:6080/"
echo "2. 或通过 SSH 连接: ssh root@192.168.20.3 -p 2222"
echo "3. 课程主目录: /root (~)"
echo "4. VSCode 图标: /root/Desktop/VSCode.desktop"
echo "=========================================="

exit "$TEST_EXIT_CODE"
