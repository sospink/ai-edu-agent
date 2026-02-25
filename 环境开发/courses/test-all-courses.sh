#!/bin/bash

# =============================================================================
# 测试所有课程示例
# =============================================================================

echo "=========================================="
echo "  测试所有课程示例"
echo "=========================================="
echo ""

COURSES_DIR="/workspace/courses"
FAILED=0

# 测试课程1: 提示词工程
echo "📝 测试课程1: 提示词工程"
echo "------------------------------------------"
cd "$COURSES_DIR/prompt-engineering"
if python3 example.py > /dev/null 2>&1; then
    echo "✅ 课程1 测试通过"
else
    echo "❌ 课程1 测试失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试课程2: MCP Server
echo "🧠 测试课程2: MCP Server 开发"
echo "------------------------------------------"
cd "$COURSES_DIR/mcp-server"
if node example.js > /dev/null 2>&1; then
    echo "✅ 课程2 测试通过"
else
    echo "❌ 课程2 测试失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试课程4: 单 Agent
echo "🔎 测试课程4: 毒舌 Gordon"
echo "------------------------------------------"
cd "$COURSES_DIR/agent-gordon"
if python3 example.py > /dev/null 2>&1; then
    echo "✅ 课程4 测试通过"
else
    echo "❌ 课程4 测试失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试课程5: 多 Agent
echo "💬 测试课程5: 创意风暴"
echo "------------------------------------------"
cd "$COURSES_DIR/multi-agent"
if python3 example.py > /dev/null 2>&1; then
    echo "✅ 课程5 测试通过"
else
    echo "❌ 课程5 测试失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试课程6: Guardrails
echo "🍸 测试课程6: AI 酒吧调酒师"
echo "------------------------------------------"
cd "$COURSES_DIR/guardrails"
if python3 example.py > /dev/null 2>&1; then
    echo "✅ 课程6 测试通过"
else
    echo "❌ 课程6 测试失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 总结
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo "  ✅ 所有课程测试通过!"
else
    echo "  ❌ $FAILED 个课程测试失败"
fi
echo "=========================================="

exit $FAILED
