#!/bin/bash
# 测试所有课程的验证命令
# 用于确保环境与Agent手册同步

echo "=========================================="
echo "  测试所有课程验证命令"
echo "=========================================="
echo ""

# 检查 .env 文件
if [ ! -f "/workspace/.env" ]; then
    echo "⚠️  警告: /workspace/.env 文件不存在"
    echo "   请先配置 API Key"
    echo ""
    echo "   配置方法:"
    echo "   1. 复制模板: cp /workspace/.env.template /workspace/.env"
    echo "   2. 编辑文件: vim /workspace/.env"
    echo "   3. 填写你的 API Key"
    echo ""
    exit 1
fi

# 检查 API Key 是否配置
source /workspace/.env
if [ "$OPENAI_API_KEY" == "your-openai-api-key-here" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  警告: OPENAI_API_KEY 未配置"
    echo "   请编辑 /workspace/.env 文件并填写真实的 API Key"
    echo ""
    exit 1
fi

echo "✓ API Key 已配置"
echo ""

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
test_course() {
    local course_name=$1
    local course_dir=$2
    local test_file=$3
    local expected_output=$4
    
    TOTAL=$((TOTAL + 1))
    
    echo "=========================================="
    echo "测试课程 $TOTAL: $course_name"
    echo "=========================================="
    echo "目录: $course_dir"
    echo "文件: $test_file"
    echo "预期输出包含: $expected_output"
    echo ""
    
    cd "$course_dir" || {
        echo "❌ 失败: 目录不存在"
        FAILED=$((FAILED + 1))
        echo ""
        return 1
    }
    
    if [ ! -f "$test_file" ]; then
        echo "❌ 失败: 文件不存在"
        FAILED=$((FAILED + 1))
        echo ""
        return 1
    fi
    
    echo "执行命令..."
    
    # 根据文件类型执行不同的命令
    if [[ "$test_file" == *.py ]]; then
        output=$(python3 "$test_file" 2>&1)
    elif [[ "$test_file" == *.js ]]; then
        output=$(node "$test_file" 2>&1)
    else
        echo "❌ 失败: 未知文件类型"
        FAILED=$((FAILED + 1))
        echo ""
        return 1
    fi
    
    exit_code=$?
    
    echo "输出:"
    echo "----------------------------------------"
    echo "$output" | head -n 20
    echo "----------------------------------------"
    echo ""
    
    if [ $exit_code -eq 0 ] && echo "$output" | grep -q "$expected_output"; then
        echo "✅ 通过"
        PASSED=$((PASSED + 1))
    else
        echo "❌ 失败"
        if [ $exit_code -ne 0 ]; then
            echo "   退出码: $exit_code"
        fi
        if ! echo "$output" | grep -q "$expected_output"; then
            echo "   输出不包含预期内容: $expected_output"
        fi
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# 测试所有课程
test_course "提示词工程" "/workspace/courses/prompt-engineering" "example.py" "提示词工程"
test_course "MCP Server开发" "/workspace/courses/mcp-server" "example.js" "MCP Server"
test_course "ADE智能体开发" "/workspace/courses/ade-skill" "example.py" "翻译完成"
test_course "单Agent开发-Gordon" "/workspace/courses/agent-gordon" "example.py" "PRA Loop"
test_course "多Agent协作" "/workspace/courses/multi-agent" "example.py" "头脑风暴"
test_course "AI安全与合规" "/workspace/courses/guardrails" "example.py" "护栏系统"

# 显示测试结果
echo "=========================================="
echo "  测试结果汇总"
echo "=========================================="
echo "总计: $TOTAL"
echo "通过: $PASSED"
echo "失败: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 所有测试通过！"
    echo ""
    echo "下一步:"
    echo "  - 所有课程环境已就绪"
    echo "  - 可以开始使用教学Agent智能体"
    echo "  - 验证命令与Agent手册已同步"
    exit 0
else
    echo "⚠️  部分测试失败"
    echo ""
    echo "请检查:"
    echo "  1. API Key 是否正确"
    echo "  2. 网络连接是否正常"
    echo "  3. 课程文件是否完整"
    exit 1
fi
