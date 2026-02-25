# 单 Agent 开发 - 毒舌 Gordon

> 本实验将指导您开发一个完整的单 Agent 系统——毒舌美食评论家 Gordon Ramsay。您将学习 Agent 的完整架构：PRA Loop（Perception-Reasoning-Action）、ReAct 模式、工具调用机制和记忆系统。Gordon 以其毒舌、直率的评论风格闻名，通过模拟他的性格，您将深入理解如何赋予 Agent 独特的个性和行为模式。完成本实验后，您将掌握构建智能对话 Agent 的核心技能，能够开发具有复杂推理能力的 AI 应用。

## 步骤 1: 配置 API 环境

### 配置 API Key

在运行 Agent 示例之前，需要先配置 API 密钥。Agent 需要调用 LLM API 进行推理和生成回复。

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

**关于本课程的 API 使用**：
- 示例代码已集成真实的 OpenAI API 调用
- Gordon Agent 会使用 API 进行推理和生成回复
- 如果 API 调用失败，会显示错误信息

<!-- questions: 如何获取 API Key|API 调用会产生费用吗|可以使用其他 LLM 吗 -->

## 步骤 2: 认识 Agent 架构和实验环境

### 什么是 Agent？

**Agent（智能体）** 是一个能够：
- **感知**环境（Perception）
- **推理**决策（Reasoning）
- **执行**行动（Action）
- **记忆**历史（Memory）

的自主 AI 系统。

### PRA Loop 核心循环

```
用户输入 → Perception（感知）→ Reasoning（推理）
                                      ↓
记忆更新 ← Action（行动）←──────────┘
    ↓
循环继续
```

### 进入课程目录

```bash
cd /workspace/courses/agent-gordon
ls -la
```

您会看到：
- `example.py` - 完整的 Gordon Agent 实现
- `README.md` - 课程说明

### 查看代码结构

查看代码的前80行，了解整体结构：

```bash
head -n 80 /workspace/courses/agent-gordon/example.py
```

您会看到 `GordonAgent` 类，包含完整的 PRA Loop 实现。

<!-- questions: Agent 和普通程序有什么区别|为什么叫 PRA Loop|Agent 可以用在哪些场景 -->

## 步骤 3: 运行示例程序

### 执行示例代码

运行 Gordon Agent：

```bash
cd /workspace/courses/agent-gordon && python3 example.py
```

### 观察输出

您会看到三个示例对话：
1. **评价意大利面** - 展示工具调用
2. **推荐法餐厅** - 展示推理过程
3. **比较餐厅** - 展示记忆系统

### 理解输出结构

注意每个对话的执行流程：
```
[Perception] Intent: rate_dish
[Reasoning] Planned 2 actions
[Action] Executed 2 actions
[Memory] Updated (Total: 1 entries)
```

这就是完整的 PRA Loop！

<!-- verify: command:cd /workspace/courses/agent-gordon && python3 example.py|contains|PRA Loop -->
<!-- questions: 为什么要分这么多步骤|如何识别用户意图|记忆系统有什么用 -->

## 步骤 3: 理解 Perception（感知）模块

### 什么是感知？

感知模块负责理解用户输入，识别意图和实体。

### 查看感知实现

查看 `perceive` 方法：

```bash
grep -A 20 "def perceive" /workspace/courses/agent-gordon/example.py
```

### 感知的任务

1. **意图识别** - 用户想做什么？
   - 评价菜品（rate_dish）
   - 推荐餐厅（get_recommendation）
   - 比较餐厅（compare_restaurants）

2. **实体提取** - 提取关键信息
   - 菜品名称
   - 餐厅名称
   - 偏好信息

3. **上下文理解** - 结合历史对话

### 创建简化的感知模块

让我们创建一个简化版本：

```bash
cat > /workspace/courses/agent-gordon/simple_perception.py << 'EOF'
#!/usr/bin/env python3
"""
简化的感知模块
演示意图识别的基本原理
"""

def perceive(user_input):
    """
    感知用户输入
    
    Args:
        user_input: 用户输入的文本
    
    Returns:
        感知结果
    """
    perception = {
        "raw_input": user_input,
        "intent": None,
        "entities": {}
    }
    
    # 简单的关键词匹配
    if "评价" in user_input or "怎么样" in user_input:
        perception["intent"] = "rate"
        # 提取菜品名称（简化版）
        words = user_input.split()
        for word in words:
            if word not in ["评价", "这道", "怎么样"]:
                perception["entities"]["dish"] = word
                break
    
    elif "推荐" in user_input:
        perception["intent"] = "recommend"
        perception["entities"]["type"] = "restaurant"
    
    elif "比较" in user_input:
        perception["intent"] = "compare"
    
    else:
        perception["intent"] = "chat"
    
    return perception


# 测试
if __name__ == "__main__":
    test_inputs = [
        "评价一下这道意大利面",
        "推荐一家好餐厅",
        "比较两家餐厅",
        "你好"
    ]
    
    print("=" * 60)
    print("感知模块测试")
    print("=" * 60)
    print()
    
    for user_input in test_inputs:
        result = perceive(user_input)
        print(f"输入: {user_input}")
        print(f"意图: {result['intent']}")
        print(f"实体: {result['entities']}")
        print()
EOF
```

### 运行感知测试

```bash
cd /workspace/courses/agent-gordon && python3 simple_perception.py
```

观察不同输入如何被识别为不同的意图。

<!-- verify: file_exists:/workspace/courses/agent-gordon/simple_perception.py -->
<!-- verify: command:cd /workspace/courses/agent-gordon && python3 simple_perception.py|contains|感知模块测试 -->
<!-- questions: 如何提高意图识别的准确性|什么是NLU|实体提取有什么用 -->

## 步骤 4: 理解 Reasoning（推理）模块 - ReAct 模式

### 什么是 ReAct？

**ReAct = Reasoning（推理）+ Acting（行动）**

Agent 交替进行思考和行动，而不是一次性规划所有步骤。

### ReAct 的优势

1. **可解释** - 能看到 Agent 的思考过程
2. **灵活** - 可以根据结果调整策略
3. **可调试** - 容易发现问题

### 查看推理实现

```bash
grep -A 30 "def reason" /workspace/courses/agent-gordon/example.py
```

### ReAct 示例

创建一个 ReAct 演示：

```bash
cat > /workspace/courses/agent-gordon/react_demo.py << 'EOF'
#!/usr/bin/env python3
"""
ReAct 模式演示
展示推理和行动的交替过程
"""

class ReActAgent:
    def __init__(self):
        self.tools = {
            "search": lambda q: f"搜索结果: {q}",
            "calculate": lambda expr: eval(expr)
        }
    
    def solve(self, problem):
        """
        使用 ReAct 模式解决问题
        """
        print(f"问题: {problem}")
        print("=" * 60)
        print()
        
        # Thought 1
        print("💭 Thought 1: 我需要先搜索相关信息")
        
        # Action 1
        print("🔧 Action 1: 调用搜索工具")
        result1 = self.tools["search"](problem)
        print(f"📊 Observation 1: {result1}")
        print()
        
        # Thought 2
        print("💭 Thought 2: 现在我有了信息，需要进行计算")
        
        # Action 2
        print("🔧 Action 2: 调用计算工具")
        result2 = self.tools["calculate"]("10 + 20")
        print(f"📊 Observation 2: {result2}")
        print()
        
        # Thought 3
        print("💭 Thought 3: 我已经得到答案，可以回复用户了")
        
        # Final Action
        print("✅ Final Answer: 根据搜索和计算，答案是30")


if __name__ == "__main__":
    agent = ReActAgent()
    agent.solve("计算10加20")
EOF
```

### 运行 ReAct 演示

```bash
cd /workspace/courses/agent-gordon && python3 react_demo.py
```

观察 Thought → Action → Observation 的循环。

<!-- verify: command:cd /workspace/courses/agent-gordon && python3 react_demo.py|contains|Final Answer -->
<!-- questions: 为什么要交替推理和行动|如何决定下一步做什么|ReAct 和传统规划有什么区别 -->

## 步骤 5: 实现工具调用机制

### 什么是工具？

工具是 Agent 与外部世界交互的接口。Gordon 有以下工具：
- `search_restaurant` - 搜索餐厅
- `rate_dish` - 评价菜品
- `compare_restaurants` - 比较餐厅
- `get_recommendation` - 获取推荐

### 查看工具实现

```bash
grep -A 10 "def rate_dish" /workspace/courses/agent-gordon/example.py
```

### 创建工具注册表

让我们创建一个完整的工具系统：

```bash
cat > /workspace/courses/agent-gordon/tool_system.py << 'EOF'
#!/usr/bin/env python3
"""
工具调用系统
演示如何注册和调用工具
"""

class ToolRegistry:
    """工具注册表"""
    
    def __init__(self):
        self.tools = {}
    
    def register(self, name, function, description):
        """
        注册工具
        
        Args:
            name: 工具名称
            function: 工具函数
            description: 工具描述
        """
        self.tools[name] = {
            "function": function,
            "description": description
        }
        print(f"✓ 注册工具: {name}")
    
    def call(self, name, **kwargs):
        """
        调用工具
        
        Args:
            name: 工具名称
            **kwargs: 工具参数
        
        Returns:
            工具执行结果
        """
        if name not in self.tools:
            return {"error": f"工具 {name} 不存在"}
        
        try:
            result = self.tools[name]["function"](**kwargs)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def list_tools(self):
        """列出所有工具"""
        print("\n可用工具:")
        print("-" * 60)
        for name, info in self.tools.items():
            print(f"- {name}: {info['description']}")


# 定义一些工具函数
def search_tool(query):
    """搜索工具"""
    return f"搜索 '{query}' 的结果..."

def calculate_tool(expression):
    """计算工具"""
    return eval(expression)

def weather_tool(city):
    """天气工具"""
    return f"{city} 今天晴天，温度20°C"


# 测试
if __name__ == "__main__":
    print("=" * 60)
    print("工具调用系统演示")
    print("=" * 60)
    
    # 创建注册表
    registry = ToolRegistry()
    
    # 注册工具
    registry.register("search", search_tool, "搜索信息")
    registry.register("calculate", calculate_tool, "数学计算")
    registry.register("weather", weather_tool, "查询天气")
    
    # 列出工具
    registry.list_tools()
    
    # 调用工具
    print("\n" + "=" * 60)
    print("工具调用测试")
    print("=" * 60)
    
    result1 = registry.call("search", query="Python教程")
    print(f"\n1. 搜索: {result1}")
    
    result2 = registry.call("calculate", expression="10 * 5")
    print(f"\n2. 计算: {result2}")
    
    result3 = registry.call("weather", city="北京")
    print(f"\n3. 天气: {result3}")
    
    result4 = registry.call("unknown", param="test")
    print(f"\n4. 未知工具: {result4}")
EOF
```

### 运行工具系统

```bash
cd /workspace/courses/agent-gordon && python3 tool_system.py
```

观察工具的注册、列表和调用过程。

<!-- verify: command:cd /workspace/courses/agent-gordon && python3 tool_system.py|contains|工具调用系统 -->
<!-- questions: 如何设计好的工具接口|工具调用失败怎么办|如何添加新工具 -->

## 步骤 6: 实现记忆系统

### 什么是记忆系统？

记忆系统让 Agent 能够：
- 记住对话历史
- 理解上下文
- 学习用户偏好

### 查看记忆实现

```bash
grep -A 15 "def update_memory" /workspace/courses/agent-gordon/example.py
```

### 创建记忆系统

```bash
cat > /workspace/courses/agent-gordon/memory_system.py << 'EOF'
#!/usr/bin/env python3
"""
记忆系统
演示如何管理对话历史和上下文
"""

from datetime import datetime
from collections import deque

class MemorySystem:
    """记忆系统"""
    
    def __init__(self, max_size=10):
        """
        初始化记忆系统
        
        Args:
            max_size: 短期记忆的最大容量
        """
        self.short_term = deque(maxlen=max_size)
        self.long_term = {}
        self.user_profile = {}
    
    def add(self, memory):
        """
        添加记忆
        
        Args:
            memory: 记忆条目
        """
        memory["timestamp"] = datetime.now().isoformat()
        self.short_term.append(memory)
        
        # 更新用户画像
        if "user_preference" in memory:
            self.user_profile.update(memory["user_preference"])
    
    def get_recent(self, n=5):
        """
        获取最近的 n 条记忆
        
        Args:
            n: 记忆条数
        
        Returns:
            最近的记忆列表
        """
        return list(self.short_term)[-n:]
    
    def get_context(self):
        """
        获取当前上下文
        
        Returns:
            上下文摘要
        """
        recent = self.get_recent(3)
        return {
            "recent_topics": [m.get("topic") for m in recent],
            "user_profile": self.user_profile,
            "conversation_length": len(self.short_term)
        }
    
    def search(self, keyword):
        """
        搜索记忆
        
        Args:
            keyword: 搜索关键词
        
        Returns:
            匹配的记忆列表
        """
        results = []
        for memory in self.short_term:
            if keyword in str(memory):
                results.append(memory)
        return results
    
    def clear(self):
        """清空短期记忆"""
        self.short_term.clear()


# 测试
if __name__ == "__main__":
    print("=" * 60)
    print("记忆系统演示")
    print("=" * 60)
    print()
    
    memory = MemorySystem(max_size=5)
    
    # 添加记忆
    print("添加对话记忆...")
    memory.add({
        "user": "推荐一家餐厅",
        "agent": "您喜欢什么菜系？",
        "topic": "餐厅推荐"
    })
    
    memory.add({
        "user": "我喜欢川菜",
        "agent": "推荐XX川菜馆",
        "topic": "餐厅推荐",
        "user_preference": {"cuisine": "川菜"}
    })
    
    memory.add({
        "user": "评价一下这道菜",
        "agent": "这道菜很不错",
        "topic": "菜品评价"
    })
    
    # 获取最近记忆
    print("\n最近的对话:")
    print("-" * 60)
    recent = memory.get_recent(2)
    for i, m in enumerate(recent, 1):
        print(f"{i}. 用户: {m['user']}")
        print(f"   Agent: {m['agent']}")
        print()
    
    # 获取上下文
    print("当前上下文:")
    print("-" * 60)
    context = memory.get_context()
    print(f"最近话题: {context['recent_topics']}")
    print(f"用户偏好: {context['user_profile']}")
    print(f"对话轮数: {context['conversation_length']}")
    print()
    
    # 搜索记忆
    print("搜索记忆 (关键词: 餐厅):")
    print("-" * 60)
    results = memory.search("餐厅")
    print(f"找到 {len(results)} 条相关记忆")
EOF
```

### 运行记忆系统

```bash
cd /workspace/courses/agent-gordon && python3 memory_system.py
```

观察记忆的添加、检索和上下文管理。

<!-- verify: command:cd /workspace/courses/agent-gordon && python3 memory_system.py|contains|记忆系统演示 -->
<!-- questions: 为什么需要记忆系统|如何管理记忆容量|长期记忆和短期记忆有什么区别 -->

## 步骤 7: 创建完整的 Agent

### 任务说明

现在让我们整合所有模块，创建一个完整的 Agent。

### 创建 Agent

```bash
cat > /workspace/courses/agent-gordon/my_agent.py << 'EOF'
#!/usr/bin/env python3
"""
我的第一个 Agent
整合 PRA Loop 的所有组件
"""

from simple_perception import perceive
from tool_system import ToolRegistry
from memory_system import MemorySystem

class MyAgent:
    """简化的 Agent 实现"""
    
    def __init__(self):
        self.name = "MyAgent"
        self.tools = ToolRegistry()
        self.memory = MemorySystem()
        
        # 注册工具
        self.tools.register(
            "greet",
            lambda name: f"你好，{name}！",
            "打招呼"
        )
        self.tools.register(
            "calculate",
            lambda expr: eval(expr),
            "计算"
        )
        
        print(f"✓ {self.name} 初始化完成")
    
    def run(self, user_input):
        """
        运行 PRA Loop
        
        Args:
            user_input: 用户输入
        
        Returns:
            Agent 回复
        """
        print("\n" + "=" * 60)
        print(f"处理输入: {user_input}")
        print("=" * 60)
        
        # 1. Perception (感知)
        print("\n[1] Perception (感知)")
        print("-" * 60)
        perception = perceive(user_input)
        print(f"意图: {perception['intent']}")
        print(f"实体: {perception['entities']}")
        
        # 2. Reasoning (推理)
        print("\n[2] Reasoning (推理)")
        print("-" * 60)
        actions = self.reason(perception)
        print(f"规划了 {len(actions)} 个行动")
        
        # 3. Action (行动)
        print("\n[3] Action (行动)")
        print("-" * 60)
        results = []
        for action in actions:
            print(f"执行: {action['type']}")
            if action['type'] == 'tool_call':
                result = self.tools.call(
                    action['tool'],
                    **action['args']
                )
                results.append(result)
            elif action['type'] == 'response':
                results.append({"response": action['content']})
        
        # 4. Memory Update (记忆更新)
        print("\n[4] Memory Update (记忆更新)")
        print("-" * 60)
        self.memory.add({
            "user": user_input,
            "perception": perception,
            "actions": actions,
            "results": results
        })
        print(f"记忆已更新 (总计: {len(self.memory.short_term)} 条)")
        
        # 生成回复
        response = self.generate_response(results)
        print("\n[回复]")
        print("-" * 60)
        print(response)
        
        return response
    
    def reason(self, perception):
        """推理：根据意图规划行动"""
        intent = perception['intent']
        
        if intent == "chat":
            return [{
                "type": "response",
                "content": "你好！我是 MyAgent，有什么可以帮你的吗？"
            }]
        else:
            return [{
                "type": "response",
                "content": f"我理解你的意图是: {intent}"
            }]
    
    def generate_response(self, results):
        """生成最终回复"""
        responses = []
        for result in results:
            if "response" in result:
                responses.append(result["response"])
            elif "result" in result:
                responses.append(str(result["result"]))
        return "\n".join(responses)


# 测试
if __name__ == "__main__":
    print("=" * 60)
    print("我的第一个 Agent")
    print("=" * 60)
    
    agent = MyAgent()
    
    # 测试对话
    test_inputs = [
        "你好",
        "推荐一家餐厅",
        "评价这道菜"
    ]
    
    for user_input in test_inputs:
        agent.run(user_input)
        print()
EOF
```

### 运行您的 Agent

```bash
cd /workspace/courses/agent-gordon && python3 my_agent.py
```

观察完整的 PRA Loop 执行过程。

<!-- verify: command:cd /workspace/courses/agent-gordon && python3 my_agent.py|contains|我的第一个 Agent -->
<!-- questions: 如何优化 Agent 的性能|如何让 Agent 更智能|如何调试 Agent -->

## 步骤 8: 总结与实践建议

### 本节课学到了什么

恭喜您完成了单 Agent 开发实验！让我们回顾关键知识点：

**PRA Loop 架构**：
1. **Perception** - 感知用户输入，识别意图
2. **Reasoning** - 推理决策，规划行动
3. **Action** - 执行行动，调用工具
4. **Memory** - 更新记忆，维护上下文

**核心概念**：
- ReAct 模式：推理和行动交替进行
- 工具调用：Agent 与外部世界交互
- 记忆系统：维护对话历史和上下文
- 模块化设计：每个模块独立可测试

**实践技能**：
- 实现意图识别
- 设计工具注册表
- 管理记忆系统
- 构建完整的 Agent

### Agent 开发最佳实践

1. **清晰的架构** - 模块化设计，职责分明
2. **可观测性** - 记录每个步骤的执行情况
3. **错误处理** - 优雅地处理各种异常
4. **可扩展性** - 易于添加新工具和功能
5. **可测试性** - 每个模块都可以独立测试

### 实际应用场景

Agent 可以用于：
- **客服系统** - 自动回答问题，处理请求
- **个人助理** - 管理日程，发送提醒
- **代码助手** - 代码审查，bug 修复
- **数据分析** - 自动分析数据，生成报告

### 下一步学习

在后续课程中，您将学习：
- 多 Agent 协作 - 多个 Agent 协同工作
- AI 安全与合规 - 确保 Agent 的安全性

### 扩展练习

尝试以下练习巩固学习：

1. **添加新工具** - 实现天气查询、新闻搜索等工具
2. **优化推理** - 实现更复杂的推理逻辑
3. **增强记忆** - 实现长期记忆和用户画像
4. **连接 LLM** - 使用真实的 LLM API
5. **构建应用** - 创建一个完整的对话应用

继续加油！Agent 开发是 AI 应用的核心！🚀

<!-- questions: 如何让 Agent 更像人|如何评估 Agent 的性能|有什么 Agent 开发框架推荐 -->
