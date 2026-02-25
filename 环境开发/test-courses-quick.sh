#!/bin/bash

# =============================================================================
# 快速测试脚本 - 在宿主机上运行
# 测试容器内的课程环境是否正常
# =============================================================================

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

echo "=========================================="
echo "  AI 课程环境快速测试"
echo "=========================================="
echo ""
echo -e "${BLUE}检测到容器:${NC} $CONTAINER_NAME"
echo ""

# 检查容器是否运行
echo -e "${BLUE}[1/5]${NC} 检查容器状态..."
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}✓${NC} 容器正在运行"
else
    echo -e "${RED}✗${NC} 容器未运行"
    echo "请先启动容器: docker start $CONTAINER_NAME"
    exit 1
fi
echo ""

# 检查 Python 环境vim

echo -e "${BLUE}[2/5]${NC} 检查 Python 环境..."
PYTHON_VERSION=$(docker exec $CONTAINER_NAME python3 --version 2>&1)
if echo "$PYTHON_VERSION" | grep -q "Python 3.10"; then
    echo -e "${GREEN}✓${NC} $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} Python 版本不正确: $PYTHON_VERSION"
fi
echo ""

# 检查 Node.js 环境
echo -e "${BLUE}[3/5]${NC} 检查 Node.js 环境..."
NODE_VERSION=$(docker exec $CONTAINER_NAME node --version 2>&1)
if echo "$NODE_VERSION" | grep -q "v18"; then
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${YELLOW}!${NC} Node.js 版本: $NODE_VERSION (建议 v18)"
fi
echo ""

# 检查课程文件
echo -e "${BLUE}[4/5]${NC} 检查课程文件..."
COURSES=(
    "prompt-engineering"
    "mcp-server"
    "ade-skill"
    "agent-gordon"
    "multi-agent"
    "guardrails"
)

MISSING=0
for course in "${COURSES[@]}"; do
    if docker exec $CONTAINER_NAME test -d "/workspace/courses/$course" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $course"
    else
        echo -e "${RED}✗${NC} $course (缺失)"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo -e "${RED}警告: $MISSING 个课程目录缺失${NC}"
fi
echo ""

# 运行详细测试
echo -e "${BLUE}[5/5]${NC} 运行详细测试..."
echo "----------------------------------------"

# 先复制测试脚本到容器（如果不存在）
docker exec $CONTAINER_NAME test -f /workspace/courses/test-courses-detailed.sh 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}!${NC} 详细测试脚本不存在，跳过详细测试"
    echo "提示: 重新构建镜像以包含测试脚本"
else
    docker exec $CONTAINER_NAME bash -c "cd /workspace/courses && chmod +x test-courses-detailed.sh && ./test-courses-detailed.sh"
    TEST_EXIT_CODE=$?
fi
echo "----------------------------------------"
echo ""

# 总结
echo "=========================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}  ✓ 所有测试通过！${NC}"
    echo ""
    echo "下一步:"
    echo "1. 访问 VNC 桌面: http://192.168.20.3:6080/"
    echo "2. 或通过 SSH 连接: ssh root@192.168.20.3 -p 2222"
    echo "3. 配置 API Keys: vim /workspace/.env"
    echo "4. 开始学习课程！"
else
    echo -e "${YELLOW}  ! 部分测试失败${NC}"
    echo ""
    echo "故障排除:"
    echo "1. 检查容器日志: docker logs $CONTAINER_NAME"
    echo "2. 进入容器调试: docker exec -it $CONTAINER_NAME bash"
    echo "3. 查看测试日志: docker exec $CONTAINER_NAME cat /tmp/test-course*.log"
fi
echo "=========================================="

exit $TEST_EXIT_CODE
