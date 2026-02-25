# 多 Agent 协作 - 创意风暴

> 本实验将指导您构建一个多 Agent 协作系统——创意风暴平台。您将学习如何使用 LangGraph 风格的状态机编排多个 Agent 协同工作。系统包含4个专业 Agent：Creative（创意生成）、Critic（批评评估）、Refiner（优化改进）、Summarizer（总结报告），它们按顺序协作,将一个简单的主题转化为高质量的创意方案。通过本实验，您将掌握多 Agent 系统的设计、状态管理和工作流编排，能够构建复杂的 AI 协作应用。

## 步骤 1: 配置 API 环境

### 配置 API Key

在运行多 Agent 系统之前，需要先配置 API 密钥。多 Agent 系统需要调用 LLM API 进行创意生成和内容处理。

**查看环境配置文件**：

```bash
cat /workspace/.env
```

您应该看到以下配置：

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

**如果需要修改配置**：

```bash
# 使用 nano 编辑器修改
nano /workspace/.env

# 或使用 vi 编辑器
vi /workspace/.env
```

**配置说明**：
- `OPENAI_API_KEY` - 您的通义千问 API Key（必需）
- `OPENAI_BASE_URL` - API 服务地址（已配置）
- `OPENAI_MODEL` - 使用的模型（qwen-turbo 或 qwen-plus）

**验证配置**：

```bash
# 检查 API Key 是否配置
echo $OPENAI_API_KEY
```

如果显示 `sk-` 开头的字符串，说明配置成功。

<!-- questions: 多 Agent 系统为什么需要 API|每个 Agent 都要调用 API 吗|如何控制 API 成本 -->

## 步骤 2: 认识多 Agent 系统

### 什么是多 Agent 系统？

**多 Agent 系统（MAS）** 由多个自主 Agent 组成，通过协作完成复杂任务。

**优势**：
- **专业分工** - 每个 Agent 专注特定任务
- **并行处理** - 提高效率
- **灵活组合** - 易于扩展

### 进入课程目录

```bash
cd /workspace/courses/multi-agent
ls -la
```

您会看到：
- `example.py` - 完整的多 Agent 系统实现
- `README.md` - 课程说明

### 查看代码结构

查看代码的前100行：

```bash
head -n 100 /workspace/courses/multi-agent/example.py
```

您会看到4个 Agent 类和一个编排器（Orchestrator）。

<!-- questions: 多 Agent 和单 Agent 有什么区别|什么时候需要多 Agent|如何设计 Agent 分工 -->

## 步骤 3: 运行示例程序

### 执行示例代码

运行创意风暴系统：

```bash
cd /workspace/courses/multi-agent && python3 example.py
```

### 观察输出

您会看到完整的工作流：
1. **工作流程图** - 展示 Agent 协作流程
2. **Creative Agent** - 生成3个创意
3. **Critic Agent** - 评估每个创意
4. **Refiner Agent** - 优化创意
5. **Summarizer Agent** - 生成最终报告

### 理解工作流

注意每个步骤的状态转换：
```
start → generate_ideas → critique_ideas → refine_ideas → generate_report → end
```

这就是 LangGraph 风格的状态机！

<!-- verify: command:cd /workspace/courses/multi-agent && python3 example.py|contains|头脑风暴完成 -->
<!-- questions: 为什么要按这个顺序|能否并行执行|如何添加新的 Agent -->

## 步骤 3: 理解状态管理

### 什么是状态？

**状态（State）** 是在 Agent 之间传递的共享数据结构。

### 查看状态定义

查看 `BrainstormState` 定义：

```bash
grep -A 10 "class BrainstormState" /workspace/courses/multi-agent/example.py
```

### 状态的作用

1. **数据传递** - Agent 之间传递信息
2. **流程控制** - 记录当前步骤
3. **结果累积** - 保存中间结果

### 创建简化的状态系统

```bash
cat > /workspace/courses/multi-agent/state_demo.py << 'EOF'
#!/usr/bin/env python3
"""
状态管理演示
展示如何在 Agent 之间传递状态
"""

from typing import TypedDict, List

class SimpleState(TypedDict):
    """简化的状态定义"""
    input: str
    step1_result: str
    step2_result: str
    step3_result: str
    current_step: str

def agent_a(state: SimpleState) -> SimpleState:
    """Agent A: 处理输入"""
    print(f"[Agent A] 处理: {state['input']}")
    state['step1_result'] = f"A处理了: {state['input']}"
    state['current_step'] = "agent_b"
    return state

def agent_b(state: SimpleState) -> SimpleState:
    """Agent B: 进一步处理"""
    print(f"[Agent B] 处理: {state['step1_result']}")
    state['step2_result'] = f"B优化了: {state['step1_result']}"
    state['current_step'] = "agent_c"
    return state

def agent_c(state: SimpleState) -> SimpleState:
    """Agent C: 最终处理"""
    print(f"[Agent C] 处理: {state['step2_result']}")
    state['step3_result'] = f"C完成了: {state['step2_result']}"
    state['current_step'] = "end"
    return state

# 测试
if __name__ == "__main__":
    print("=" * 60)
    print("状态管理演示")
    print("=" * 60)
    print()
    
    # 初始化状态
    state: SimpleState = {
        "input": "创意主题",
        "step1_result": "",
        "step2_result": "",
        "step3_result": "",
        "current_step": "agent_a"
    }
    
    # 执行工作流
    workflow = {
        "agent_a": agent_a,
        "agent_b": agent_b,
        "agent_c": agent_c
    }
    
    while state['current_step'] != "end":
        current = state['current_step']
        print(f"\n当前步骤: {current}")
        print("-" * 60)
        state = workflow[current](state)
    
    print("\n" + "=" * 60)
    print("最终结果:")
    print(state['step3_result'])
    print("=" * 60)
EOF
```

### 运行状态演示

```bash
cd /workspace/courses/multi-agent && python3 state_demo.py
```

观察状态如何在 Agent 之间传递。

<!-- verify: command:cd /workspace/courses/multi-agent && python3 state_demo.py|contains|状态管理演示 -->
<!-- questions: 为什么要用 TypedDict|状态太大怎么办|如何验证状态 -->

## 步骤 4: 创建 Agent 协作系统

### 任务说明

让我们创建一个简化的多 Agent 系统：文章创作系统。

### 创建 Agent

```bash
cat > /workspace/courses/multi-agent/article_agents.py << 'EOF'
#!/usr/bin/env python3
"""
文章创作多 Agent 系统
演示 Agent 协作
"""

from typing import TypedDict, List

class ArticleState(TypedDict):
    """文章创作状态"""
    topic: str
    outline: List[str]
    content: str
    review: str
    final_article: str
    current_step: str

class OutlineAgent:
    """大纲生成 Agent"""
    
    def __init__(self):
        self.name = "OutlineAgent"
    
    def execute(self, state: ArticleState) -> ArticleState:
        """生成文章大纲"""
        print(f"[{self.name}] 为主题 '{state['topic']}' 生成大纲...")
        
        state['outline'] = [
            "1. 引言",
            "2. 核心内容",
            "3. 案例分析",
            "4. 总结"
        ]
        
        print(f"✓ 生成了 {len(state['outline'])} 个章节")
        return state

class WriterAgent:
    """写作 Agent"""
    
    def __init__(self):
        self.name = "WriterAgent"
    
    def execute(self, state: ArticleState) -> ArticleState:
        """根据大纲写作"""
        print(f"[{self.name}] 根据大纲写作...")
        
        content_parts = []
        for section in state['outline']:
            content_parts.append(f"{section}\n这是关于 {state['topic']} 的内容...")
        
        state['content'] = "\n\n".join(content_parts)
        print(f"✓ 完成了 {len(state['content'])} 字的内容")
        return state

class ReviewerAgent:
    """审阅 Agent"""
    
    def __init__(self):
        self.name = "ReviewerAgent"
    
    def execute(self, state: ArticleState) -> ArticleState:
        """审阅文章"""
        print(f"[{self.name}] 审阅文章...")
        
        state['review'] = "文章结构清晰，内容完整，建议增加更多案例。"
        print(f"✓ 审阅完成")
        return state

class EditorAgent:
    """编辑 Agent"""
    
    def __init__(self):
        self.name = "EditorAgent"
    
    def execute(self, state: ArticleState) -> ArticleState:
        """编辑优化"""
        print(f"[{self.name}] 根据审阅意见优化...")
        
        state['final_article'] = f"""
# {state['topic']}

{state['content']}

---
审阅意见: {state['review']}
"""
        print(f"✓ 文章编辑完成")
        return state

class ArticleOrchestrator:
    """文章创作编排器"""
    
    def __init__(self):
        self.outline_agent = OutlineAgent()
        self.writer_agent = WriterAgent()
        self.reviewer_agent = ReviewerAgent()
        self.editor_agent = EditorAgent()
        
        # 定义工作流
        self.workflow = {
            "start": "outline",
            "outline": "write",
            "write": "review",
            "review": "edit",
            "edit": "end"
        }
    
    def run(self, topic: str) -> str:
        """运行文章创作流程"""
        print("=" * 60)
        print(f"开始创作文章: {topic}")
        print("=" * 60)
        print()
        
        # 初始化状态
        state: ArticleState = {
            "topic": topic,
            "outline": [],
            "content": "",
            "review": "",
            "final_article": "",
            "current_step": "start"
        }
        
        # 执行工作流
        while state["current_step"] != "end":
            current = state["current_step"]
            next_step = self.workflow[current]
            
            print(f"\n步骤: {current} → {next_step}")
            print("-" * 60)
            
            if next_step == "outline":
                state = self.outline_agent.execute(state)
                state["current_step"] = next_step
            elif next_step == "write":
                state = self.writer_agent.execute(state)
                state["current_step"] = next_step
            elif next_step == "review":
                state = self.reviewer_agent.execute(state)
                state["current_step"] = next_step
            elif next_step == "edit":
                state = self.editor_agent.execute(state)
                state["current_step"] = next_step
            elif next_step == "end":
                state["current_step"] = "end"
        
        print("\n" + "=" * 60)
        print("文章创作完成!")
        print("=" * 60)
        
        return state["final_article"]

# 测试
if __name__ == "__main__":
    orchestrator = ArticleOrchestrator()
    article = orchestrator.run("人工智能的未来")
    
    print("\n最终文章:")
    print("=" * 60)
    print(article)
EOF
```

### 运行文章创作系统

```bash
cd /workspace/courses/multi-agent && python3 article_agents.py
```

观察4个 Agent 如何协作完成文章创作。

<!-- verify: command:cd /workspace/courses/multi-agent && python3 article_agents.py|contains|文章创作完成 -->
<!-- questions: 如何添加新的 Agent|如何改变执行顺序|如何实现并行执行 -->

## 步骤 5: 实现并行协作

### 任务说明

让我们实现一个并行执行的多 Agent 系统。

### 创建并行系统

```bash
cat > /workspace/courses/multi-agent/parallel_agents.py << 'EOF'
#!/usr/bin/env python3
"""
并行 Agent 系统
演示多个 Agent 同时执行
"""

import time
from typing import TypedDict, List, Dict

class ParallelState(TypedDict):
    """并行任务状态"""
    input: str
    results: Dict[str, str]

class AnalysisAgent:
    """分析 Agent"""
    def execute(self, input_data: str) -> str:
        print(f"[Analysis] 分析中...")
        time.sleep(0.5)  # 模拟处理时间
        return f"分析结果: {input_data} 的分析报告"

class SummaryAgent:
    """摘要 Agent"""
    def execute(self, input_data: str) -> str:
        print(f"[Summary] 生成摘要...")
        time.sleep(0.5)
        return f"摘要: {input_data} 的核心要点"

class TranslationAgent:
    """翻译 Agent"""
    def execute(self, input_data: str) -> str:
        print(f"[Translation] 翻译中...")
        time.sleep(0.5)
        return f"翻译: {input_data} (English version)"

class ParallelOrchestrator:
    """并行编排器"""
    
    def __init__(self):
        self.agents = {
            "analysis": AnalysisAgent(),
            "summary": SummaryAgent(),
            "translation": TranslationAgent()
        }
    
    def run(self, input_data: str) -> Dict[str, str]:
        """并行执行所有 Agent"""
        print("=" * 60)
        print("并行执行 Agent")
        print("=" * 60)
        print()
        
        results = {}
        
        # 在实际应用中，这里应该使用线程池或异步执行
        # 为了演示，我们顺序执行但展示并行的概念
        print("同时启动所有 Agent...")
        print()
        
        for name, agent in self.agents.items():
            results[name] = agent.execute(input_data)
        
        print()
        print("=" * 60)
        print("所有 Agent 执行完成")
        print("=" * 60)
        
        return results

# 测试
if __name__ == "__main__":
    orchestrator = ParallelOrchestrator()
    results = orchestrator.run("人工智能技术")
    
    print("\n结果汇总:")
    print("-" * 60)
    for name, result in results.items():
        print(f"{name}: {result}")
EOF
```

### 运行并行系统

```bash
cd /workspace/courses/multi-agent && python3 parallel_agents.py
```

观察多个 Agent 如何并行工作。

<!-- verify: command:cd /workspace/courses/multi-agent && python3 parallel_agents.py|contains|并行执行 -->
<!-- questions: 并行和顺序有什么区别|如何实现真正的并行|并行有什么风险 -->

## 步骤 6: 添加条件分支

### 创建条件路由系统

```bash
cat > /workspace/courses/multi-agent/conditional_agents.py << 'EOF'
#!/usr/bin/env python3
"""
条件路由 Agent 系统
根据条件选择不同的 Agent
"""

from typing import TypedDict

class ConditionalState(TypedDict):
    """条件路由状态"""
    input: str
    complexity: str
    result: str

class SimpleAgent:
    """简单任务 Agent"""
    def execute(self, input_data: str) -> str:
        return f"简单处理: {input_data}"

class ComplexAgent:
    """复杂任务 Agent"""
    def execute(self, input_data: str) -> str:
        return f"复杂处理: {input_data} (详细分析)"

class RouterAgent:
    """路由 Agent"""
    def classify(self, input_data: str) -> str:
        """判断任务复杂度"""
        if len(input_data) < 10:
            return "simple"
        else:
            return "complex"

class ConditionalOrchestrator:
    """条件编排器"""
    
    def __init__(self):
        self.router = RouterAgent()
        self.simple_agent = SimpleAgent()
        self.complex_agent = ComplexAgent()
    
    def run(self, input_data: str) -> str:
        """根据条件路由到不同 Agent"""
        print("=" * 60)
        print("条件路由系统")
        print("=" * 60)
        print()
        
        # 判断复杂度
        complexity = self.router.classify(input_data)
        print(f"输入: {input_data}")
        print(f"复杂度: {complexity}")
        print()
        
        # 路由到对应 Agent
        if complexity == "simple":
            print("→ 路由到 SimpleAgent")
            result = self.simple_agent.execute(input_data)
        else:
            print("→ 路由到 ComplexAgent")
            result = self.complex_agent.execute(input_data)
        
        print(f"\n结果: {result}")
        return result

# 测试
if __name__ == "__main__":
    orchestrator = ConditionalOrchestrator()
    
    print("\n测试1: 简单输入")
    orchestrator.run("你好")
    
    print("\n\n测试2: 复杂输入")
    orchestrator.run("请详细分析人工智能的发展趋势")
EOF
```

### 运行条件路由

```bash
cd /workspace/courses/multi-agent && python3 conditional_agents.py
```

观察如何根据条件选择不同的 Agent。

<!-- verify: command:cd /workspace/courses/multi-agent && python3 conditional_agents.py|contains|条件路由系统 -->
<!-- questions: 如何设计路由规则|能否有多个条件|如何处理边界情况 -->

## 步骤 7: 实践练习

### 练习任务

创建一个"代码审查"多 Agent 系统：

**要求**：
1. **Style Agent** - 检查代码风格
2. **Security Agent** - 检查安全问题
3. **Performance Agent** - 分析性能
4. **Report Agent** - 生成报告

**工作流**：并行执行前3个 Agent，然后汇总生成报告

### 参考结构

```python
class CodeReviewOrchestrator:
    def __init__(self):
        self.style_agent = StyleAgent()
        self.security_agent = SecurityAgent()
        self.performance_agent = PerformanceAgent()
        self.report_agent = ReportAgent()
    
    def run(self, code: str):
        # 1. 并行执行检查
        # 2. 汇总结果
        # 3. 生成报告
        pass
```

尝试自己实现这个系统！

<!-- questions: 如何设计检查规则|如何合并结果|如何处理冲突 -->

## 步骤 8: 总结与实践建议

### 本节课学到了什么

恭喜您完成了多 Agent 协作实验！

**核心概念**：
- **MAS** - 多个 Agent 协作完成任务
- **状态管理** - 使用共享状态传递信息
- **工作流编排** - 设计 Agent 执行顺序
- **协作模式** - Sequential, Parallel, Conditional

**实践技能**：
- 设计 Agent 分工
- 实现状态传递
- 编排工作流程
- 处理并行和条件

### 多 Agent 开发最佳实践

1. **清晰分工** - 每个 Agent 职责明确
2. **标准接口** - 统一的输入输出格式
3. **状态管理** - 使用 TypedDict 定义状态
4. **错误处理** - 优雅处理 Agent 失败
5. **可观测性** - 记录每个步骤的执行

### 实际应用场景

- **内容创作** - 多个 Agent 协作创作
- **代码审查** - 并行检查不同方面
- **客服系统** - 路由到专业 Agent
- **数据分析** - 分工处理不同维度

### 下一步学习

- 进阶：学习 AI 安全与合规
- 应用：构建自己的多 Agent 系统
- 优化：提高系统性能和可靠性

继续加油！多 Agent 协作是构建复杂 AI 系统的关键！🚀

<!-- questions: 如何调试多 Agent 系统|如何监控 Agent 性能|有什么多 Agent 框架推荐 -->
