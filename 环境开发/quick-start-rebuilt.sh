#!/bin/bash

# =============================================================================
# 快速启动脚本（重新构建镜像后使用）
# 仅需：配置 API + 运行测试
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=========================================="
echo "  AI 课程环境快速启动"
echo "  (重新构建镜像后版本)"
echo -e "==========================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f "Dockerfile.ai-courses-optimized" ]; then
    echo -e "${RED}错误: 请在 环境开发 目录下运行此脚本${NC}"
    exit 1
fi

# 步骤 1: 配置 API Keys
echo -e "${BLUE}[步骤 1/2]${NC} 配置 API Keys..."
echo ""

if [ -f "setup-api-keys.sh" ]; then
    chmod +x setup-api-keys.sh
    ./setup-api-keys.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ API Keys 配置完成${NC}"
    else
        echo -e "${RED}✗ API Keys 配置失败${NC}"
        exit 1
    fi
else
    echo -e "${RED}错误: setup-api-keys.sh 不存在${NC}"
    exit 1
fi

echo ""
sleep 2

# 步骤 2: 运行测试
echo -e "${BLUE}[步骤 2/2]${NC} 运行环境测试..."
echo ""

if [ -f "test-courses-quick.sh" ]; then
    chmod +x test-courses-quick.sh
    ./test-courses-quick.sh
    TEST_RESULT=$?
else
    echo -e "${YELLOW}! test-courses-quick.sh 不存在，跳过测试${NC}"
    TEST_RESULT=1
fi

echo ""

# 总结
echo -e "${CYAN}=========================================="
echo "  启动完成"
echo -e "==========================================${NC}"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有步骤成功完成！${NC}"
    echo ""
    echo "✨ 环境已就绪，可以开始学习了！"
    echo ""
    echo "访问方式："
    echo "  🌐 VNC 桌面: http://192.168.20.3:6080/"
    echo "  🔐 SSH 终端: ssh root@192.168.20.3 -p 2222 (密码: opencode)"
    echo "  📱 前端页面: http://localhost:5173/lab?sourceType=course&sourceId=22&lessonId=211"
    echo ""
    echo "测试课程："
    echo "  docker exec -it ai-lab bash"
    echo "  cd /workspace/courses/prompt-engineering"
    echo "  python3 example.py"
else
    echo -e "${YELLOW}! 部分测试失败${NC}"
    echo ""
    echo "故障排除："
    echo "  1. 检查容器是否运行: docker ps"
    echo "  2. 查看容器日志: docker logs ai-lab"
    echo "  3. 手动进入容器: docker exec -it ai-lab bash"
    echo "  4. 查看 API 配置: docker exec ai-lab cat /workspace/.env"
fi

echo ""

