#!/bin/bash

# =============================================================================
# 修复缺失文件脚本
# 将缺失的课程文件和测试脚本复制到现有容器中
# =============================================================================

# 自动检测容器名称
CONTAINER_NAME=$(docker ps --filter "ancestor=opencode-lab-ai:latest" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME=$(docker ps --filter "name=lab" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_NAME" ]; then
    echo "错误: 未找到运行中的容器"
    echo "请先启动容器"
    exit 1
fi

echo "=========================================="
echo "  修复容器缺失文件"
echo "=========================================="
echo ""
echo "容器名称: $CONTAINER_NAME"
echo ""

# 复制 ade-skill 课程文件
echo "[1/2] 复制 ade-skill 课程文件..."
if docker exec $CONTAINER_NAME test -d /workspace/courses/ade-skill 2>/dev/null; then
    echo "✓ ade-skill 目录已存在"
else
    echo "→ 创建 ade-skill 目录..."
    docker exec $CONTAINER_NAME mkdir -p /workspace/courses/ade-skill
    
    echo "→ 复制示例文件..."
    docker cp courses/ade-skill/example.py $CONTAINER_NAME:/workspace/courses/ade-skill/
    docker cp courses/ade-skill/README.md $CONTAINER_NAME:/workspace/courses/ade-skill/
    
    echo "✓ ade-skill 文件已复制"
fi
echo ""

# 复制测试脚本
echo "[2/2] 复制测试脚本..."
if docker exec $CONTAINER_NAME test -f /workspace/courses/test-courses-detailed.sh 2>/dev/null; then
    echo "✓ test-courses-detailed.sh 已存在"
else
    echo "→ 复制测试脚本..."
    docker cp courses/test-courses-detailed.sh $CONTAINER_NAME:/workspace/courses/
    docker exec $CONTAINER_NAME chmod +x /workspace/courses/test-courses-detailed.sh
    
    echo "✓ 测试脚本已复制"
fi
echo ""

# 验证
echo "=========================================="
echo "  验证修复结果"
echo "=========================================="
echo ""

echo "检查课程目录..."
COURSES=("prompt-engineering" "mcp-server" "ade-skill" "agent-gordon" "multi-agent" "guardrails")
ALL_OK=true

for course in "${COURSES[@]}"; do
    if docker exec $CONTAINER_NAME test -d "/workspace/courses/$course" 2>/dev/null; then
        echo "✓ $course"
    else
        echo "✗ $course (仍然缺失)"
        ALL_OK=false
    fi
done
echo ""

echo "检查测试脚本..."
if docker exec $CONTAINER_NAME test -f /workspace/courses/test-courses-detailed.sh 2>/dev/null; then
    echo "✓ test-courses-detailed.sh"
else
    echo "✗ test-courses-detailed.sh (仍然缺失)"
    ALL_OK=false
fi
echo ""

if [ "$ALL_OK" = true ]; then
    echo "=========================================="
    echo "  ✓ 所有文件修复完成！"
    echo "=========================================="
    echo ""
    echo "现在可以重新运行测试:"
    echo "  ./test-courses-quick.sh"
    echo ""
    exit 0
else
    echo "=========================================="
    echo "  ! 部分文件仍然缺失"
    echo "=========================================="
    echo ""
    echo "建议重新构建镜像:"
    echo "  docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest ."
    echo ""
    exit 1
fi
