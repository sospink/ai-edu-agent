#!/bin/bash

# =============================================================================
# AI 课程详细测试脚本
# 测试所有课程的环境、依赖和示例代码
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 测试函数
test_command() {
    local name="$1"
    local command="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$command" > /dev/null 2>&1; then
        log_success "$name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 打印标题
print_header() {
    echo ""
    echo "=========================================="
    echo "  $1"
    echo "=========================================="
    echo ""
}

# 打印分隔线
print_separator() {
    echo "------------------------------------------"
}

# =============================================================================
# 开始测试
# =============================================================================

print_header "AI 课程环境测试"

# -----------------------------------------------------------------------------
# 阶段 1: 环境检查
# -----------------------------------------------------------------------------
print_header "阶段 1: 环境检查"

log_info "检查 Python 版本..."
if python3 --version | grep -q "Python 3.10"; then
    log_success "Python 3.10 已安装"
else
    log_error "Python 3.10 未安装或版本不正确"
fi

log_info "检查 Node.js 版本..."
if node --version | grep -q "v18"; then
    log_success "Node.js 18 已安装"
else
    log_warning "Node.js 版本可能不是 18"
fi

log_info "检查 OpenCode..."
test_command "OpenCode 已安装" "which opencode"

print_separator

# -----------------------------------------------------------------------------
# 阶段 2: Python 依赖检查
# -----------------------------------------------------------------------------
print_header "阶段 2: Python 依赖检查"

log_info "检查 Python 包..."

test_command "langchain" "python3 -c 'import langchain'"
test_command "langchain-openai" "python3 -c 'import langchain_openai'"
test_command "langchain-anthropic" "python3 -c 'import langchain_anthropic'"
test_command "langgraph" "python3 -c 'import langgraph'"
test_command "openai" "python3 -c 'import openai'"
test_command "anthropic" "python3 -c 'import anthropic'"
test_command "fastapi" "python3 -c 'import fastapi'"
test_command "uvicorn" "python3 -c 'import uvicorn'"
test_command "nemoguardrails" "python3 -c 'import nemoguardrails'" || log_warning "Nemo Guardrails 可选，某些课程可能需要"

print_separator

# -----------------------------------------------------------------------------
# 阶段 3: Node.js 依赖检查
# -----------------------------------------------------------------------------
print_header "阶段 3: Node.js 依赖检查"

log_info "检查 Node.js 全局包..."

test_command "opencode-ai" "npm list -g opencode-ai"
test_command "@modelcontextprotocol/sdk" "npm list -g @modelcontextprotocol/sdk"

print_separator

# -----------------------------------------------------------------------------
# 阶段 4: API 配置检查
# -----------------------------------------------------------------------------
print_header "阶段 4: API 配置检查"

log_info "检查 .env 文件..."

if [ -f "/workspace/.env" ]; then
    log_success ".env 文件存在"
    
    # 检查 API Keys
    if grep -q "OPENAI_API_KEY=sk-" /workspace/.env; then
        log_success "OPENAI_API_KEY 已配置"
    else
        log_warning "OPENAI_API_KEY 未配置或格式不正确"
    fi
    
    if grep -q "ANTHROPIC_API_KEY=sk-ant-" /workspace/.env; then
        log_success "ANTHROPIC_API_KEY 已配置"
    else
        log_warning "ANTHROPIC_API_KEY 未配置（可选）"
    fi
    
    if grep -q "DASHSCOPE_API_KEY=sk-" /workspace/.env; then
        log_success "DASHSCOPE_API_KEY 已配置"
    else
        log_warning "DASHSCOPE_API_KEY 未配置（可选）"
    fi
else
    log_error ".env 文件不存在"
    log_info "请创建 .env 文件: cp /workspace/.env.template /workspace/.env"
fi

print_separator

# -----------------------------------------------------------------------------
# 阶段 5: 课程文件检查
# -----------------------------------------------------------------------------
print_header "阶段 5: 课程文件检查"

COURSES_DIR="/workspace/courses"

log_info "检查课程目录..."

test_command "prompt-engineering 目录" "[ -d $COURSES_DIR/prompt-engineering ]"
test_command "mcp-server 目录" "[ -d $COURSES_DIR/mcp-server ]"
test_command "ade-skill 目录" "[ -d $COURSES_DIR/ade-skill ]"
test_command "agent-gordon 目录" "[ -d $COURSES_DIR/agent-gordon ]"
test_command "multi-agent 目录" "[ -d $COURSES_DIR/multi-agent ]"
test_command "guardrails 目录" "[ -d $COURSES_DIR/guardrails ]"

log_info "检查示例文件..."

test_command "prompt-engineering/example.py" "[ -f $COURSES_DIR/prompt-engineering/example.py ]"
test_command "mcp-server/example.js" "[ -f $COURSES_DIR/mcp-server/example.js ]"
test_command "ade-skill/example.py" "[ -f $COURSES_DIR/ade-skill/example.py ]"
test_command "agent-gordon/example.py" "[ -f $COURSES_DIR/agent-gordon/example.py ]"
test_command "multi-agent/example.py" "[ -f $COURSES_DIR/multi-agent/example.py ]"
test_command "guardrails/example.py" "[ -f $COURSES_DIR/guardrails/example.py ]"

print_separator

# -----------------------------------------------------------------------------
# 阶段 6: 课程示例运行测试（需要 API Key）
# -----------------------------------------------------------------------------
print_header "阶段 6: 课程示例运行测试"

log_warning "注意: 此阶段需要有效的 API Keys，且会消耗 API 额度"
log_info "如果没有配置 API Keys，此阶段测试会失败"

# 课程 1: 提示词工程
log_info "测试课程 1: 提示词工程..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/prompt-engineering"
if timeout 30 python3 example.py > /tmp/test-course1.log 2>&1; then
    log_success "课程 1 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_error "课程 1 示例运行失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_info "查看日志: cat /tmp/test-course1.log"
fi

# 课程 2: MCP Server
log_info "测试课程 2: MCP Server 开发..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/mcp-server"
if timeout 30 node example.js > /tmp/test-course2.log 2>&1; then
    log_success "课程 2 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_error "课程 2 示例运行失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_info "查看日志: cat /tmp/test-course2.log"
fi

# 课程 3: ADE Skill
log_info "测试课程 3: ADE Skill..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/ade-skill"
if timeout 30 python3 example.py > /tmp/test-course3.log 2>&1; then
    log_success "课程 3 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_warning "课程 3 示例运行失败（可能需要特定配置）"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 课程 4: Gordon Agent
log_info "测试课程 4: 毒舌 Gordon..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/agent-gordon"
if timeout 30 python3 example.py > /tmp/test-course4.log 2>&1; then
    log_success "课程 4 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_error "课程 4 示例运行失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_info "查看日志: cat /tmp/test-course4.log"
fi

# 课程 5: Multi-Agent
log_info "测试课程 5: 创意风暴..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/multi-agent"
if timeout 30 python3 example.py > /tmp/test-course5.log 2>&1; then
    log_success "课程 5 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_error "课程 5 示例运行失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_info "查看日志: cat /tmp/test-course5.log"
fi

# 课程 6: Guardrails
log_info "测试课程 6: AI 酒吧调酒师..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd "$COURSES_DIR/guardrails"
if timeout 30 python3 example.py > /tmp/test-course6.log 2>&1; then
    log_success "课程 6 示例运行成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    log_warning "课程 6 示例运行失败（Guardrails 可能需要额外配置）"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

print_separator

# =============================================================================
# 测试总结
# =============================================================================

print_header "测试总结"

echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "  ✓ 所有测试通过！"
    echo "==========================================${NC}"
    exit 0
else
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}=========================================="
    echo "  通过率: $PASS_RATE%"
    echo "  建议检查失败的测试项"
    echo "==========================================${NC}"
    exit 1
fi
