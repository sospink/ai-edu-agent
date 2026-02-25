# 单 Agent 开发 - 知识手册

## 📚 课程概述

### 学习目标

- 理解 Agent 的完整架构：PRA Loop
- 掌握 ReAct 模式（Reasoning + Acting）
- 学会实现工具调用机制
- 理解记忆系统的设计和应用

### 适用人群

- 有 Python 基础的开发者
- 对 AI Agent 开发感兴趣的工程师
- 想要构建智能对话系统的学习者

---

## 🎯 核心概念

### 什么是 Agent？

**Agent（智能体）** 是一个能够感知环境、自主决策并采取行动的 AI 系统。

**Agent 的特点**：
- **自主性** - 能够独立做出决策
- **反应性** - 能够感知环境变化
- **主动性** - 能够主动采取行动
- **社交性** - 能够与用户或其他 Agent 交互

### PRA Loop 架构

PRA Loop 是 Agent 的核心运行循环：

```
┌─────────────────────────────────────┐
│         PRA Loop                    │
│                                     │
│  ┌──────────┐                      │
│  │Perception│ ← 感知环境            │
│  │  (感知)  │                      │
│  └────┬─────┘                      │
│       │                             │
│       ↓                             │
│  ┌──────────┐                      │
│  │Reasoning │ ← 推理决策            │
│  │  (推理)  │                      │
│  └────┬─────┘                      │
│       │                             │
│       ↓                             │
│  ┌──────────┐                      │
│  │  Action  │ ← 执行行动            │
│  │  (行动)  │                      │
│  └────┬─────┘                      │
│       │                             │
│       └─────→ 更新记忆 → 循环      │
└─────────────────────────────────────┘
```

**1. Perception（感知）**
- 接收用户输入
- 解析意图和实体
- 理解上下文

**2. Reasoning（推理）**
- 分析当前状态
- 规划行动方案
- 选择最佳策略

**3. Action（行动）**
- 调用工具
- 生成回复
- 执行任务

**4. Memory Update（记忆更新）**
- 保存对话历史
- 更新知识库
- 维护上下文

### ReAct 模式

**ReAct = Reasoning（推理）+ Acting（行动）**

ReAct 是一种让 Agent 交替进行推理和行动的模式：

```
用户输入 → Thought（思考）→ Action（行动）→ Observation（观察）
           ↑                                      ↓
           └──────────────────────────────────────┘
                    循环直到完成任务
```

**ReAct 的优势**：
- **可解释性** - 能看到 Agent 的思考过程
- **可调试性** - 容易发现推理错误
- **灵活性** - 可以动态调整策略
- **鲁棒性** - 能处理复杂任务

**ReAct 示例**：
```
用户: "推荐一家好的法餐厅"

Thought: 用户需要餐厅推荐，我应该先了解他们的偏好
Action: ask_preference("您喜欢什么价位的？")

用户: "中等价位"

Thought: 用户喜欢中等价位，我需要搜索符合条件的餐厅
Action: search_restaurant(cuisine="法餐", price="中等")

Observation: 找到3家餐厅

Thought: 我应该推荐评分最高的那家
Action: respond("我推荐XX餐厅，评分4.8分...")
```

---

## 🏗️ 技术架构

### Agent 的完整架构

```
┌─────────────────────────────────────────────┐
│              Agent System                   │
├─────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐        │
│  │  Perception  │  │   Reasoning  │        │
│  │   Module     │  │    Module    │        │
│  └──────────────┘  └──────────────┘        │
├─────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐        │
│  │    Action    │  │    Memory    │        │
│  │    Module    │  │    System    │        │
│  └──────────────┘  └──────────────┘        │
├─────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐        │
│  │     Tool     │  │     LLM      │        │
│  │   Registry   │  │    Engine    │        │
│  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────┘
```

### 工具调用机制

**工具（Tool）** 是 Agent 与外部世界交互的接口。

**工具的类型**：
- **查询工具** - 搜索、查询数据库
- **操作工具** - 发送邮件、创建任务
- **计算工具** - 数学计算、数据分析
- **通信工具** - API 调用、消息发送

**工具注册表**：
```python
class Agent:
    def __init__(self):
        self.tools = {
            "search": self.search_tool,
            "calculate": self.calculate_tool,
            "send_email": self.email_tool
        }
    
    def call_tool(self, tool_name, args):
        if tool_name in self.tools:
            return self.tools[tool_name](**args)
        else:
            raise ToolNotFoundError(tool_name)
```

### 记忆系统

**记忆系统** 让 Agent 能够记住过去的交互，提供上下文。

**记忆的类型**：

1. **短期记忆（Working Memory）**
   - 当前对话的上下文
   - 最近几轮的交互
   - 临时状态信息

2. **长期记忆（Long-term Memory）**
   - 用户偏好
   - 历史交互记录
   - 知识库

3. **情景记忆（Episodic Memory）**
   - 特定事件的记录
   - 完整的对话历史
   - 时间戳信息

**记忆管理策略**：
```python
class MemorySystem:
    def __init__(self, max_size=10):
        self.short_term = []  # 短期记忆
        self.long_term = {}   # 长期记忆
        self.max_size = max_size
    
    def add(self, memory):
        self.short_term.append(memory)
        
        # 保持短期记忆窗口大小
        if len(self.short_term) > self.max_size:
            # 将旧记忆移到长期记忆
            old_memory = self.short_term.pop(0)
            self.archive(old_memory)
    
    def archive(self, memory):
        # 归档到长期记忆
        key = memory['timestamp']
        self.long_term[key] = memory
```

---

## 💡 设计原则

### 1. 模块化设计

将 Agent 拆分成独立的模块，每个模块负责特定功能。

**好的设计**：
```python
class Agent:
    def __init__(self):
        self.perception = PerceptionModule()
        self.reasoning = ReasoningModule()
        self.action = ActionModule()
        self.memory = MemorySystem()
```

### 2. 可扩展性

设计时考虑未来的扩展需求。

**工具扩展**：
```python
class Agent:
    def register_tool(self, name, function):
        """动态注册新工具"""
        self.tools[name] = function
    
    def unregister_tool(self, name):
        """移除工具"""
        if name in self.tools:
            del self.tools[name]
```

### 3. 错误处理

优雅地处理各种错误情况。

```python
class Agent:
    def run(self, user_input):
        try:
            # 感知
            perception = self.perceive(user_input)
            
            # 推理
            actions = self.reason(perception)
            
            # 行动
            results = self.act(actions)
            
            return self.format_response(results)
            
        except PerceptionError as e:
            return "抱歉，我没有理解您的意思"
        except ToolError as e:
            return f"工具调用失败：{e}"
        except Exception as e:
            return "抱歉，出现了一些问题"
```

### 4. 可观测性

记录 Agent 的运行状态，便于调试和优化。

```python
class Agent:
    def run(self, user_input):
        # 记录输入
        self.log("INPUT", user_input)
        
        # 记录感知结果
        perception = self.perceive(user_input)
        self.log("PERCEPTION", perception)
        
        # 记录推理过程
        actions = self.reason(perception)
        self.log("REASONING", actions)
        
        # 记录行动结果
        results = self.act(actions)
        self.log("ACTION", results)
        
        return results
```

---

## 🎨 实际应用

### 应用场景 1：客服 Agent

**需求**：自动回答客户问题，处理简单请求

**设计**：
```python
class CustomerServiceAgent:
    def __init__(self):
        self.tools = {
            "search_faq": self.search_faq,
            "create_ticket": self.create_ticket,
            "check_order": self.check_order
        }
    
    def perceive(self, user_input):
        # 识别意图：查询、投诉、咨询
        intent = self.classify_intent(user_input)
        return {"intent": intent, "text": user_input}
    
    def reason(self, perception):
        if perception["intent"] == "query":
            return [{"tool": "search_faq", "args": {...}}]
        elif perception["intent"] == "complaint":
            return [{"tool": "create_ticket", "args": {...}}]
```

### 应用场景 2：个人助理 Agent

**需求**：管理日程、发送提醒、处理邮件

**设计**：
```python
class PersonalAssistantAgent:
    def __init__(self):
        self.tools = {
            "add_event": self.add_calendar_event,
            "send_email": self.send_email,
            "set_reminder": self.set_reminder
        }
        self.memory = MemorySystem()
    
    def run(self, user_input):
        # 使用记忆系统理解上下文
        context = self.memory.get_context()
        
        # 结合上下文进行推理
        perception = self.perceive(user_input, context)
        actions = self.reason(perception)
        results = self.act(actions)
        
        # 更新记忆
        self.memory.add({
            "input": user_input,
            "actions": actions,
            "results": results
        })
        
        return results
```

### 应用场景 3：代码审查 Agent

**需求**：自动审查代码，提供改进建议

**设计**：
```python
class CodeReviewAgent:
    def __init__(self):
        self.tools = {
            "analyze_code": self.static_analysis,
            "check_style": self.style_check,
            "find_bugs": self.bug_detection
        }
    
    def review(self, code):
        # 多步骤推理
        thoughts = []
        
        # Thought 1: 分析代码结构
        thoughts.append("首先分析代码结构")
        structure = self.tools["analyze_code"](code)
        
        # Thought 2: 检查代码风格
        thoughts.append("检查代码风格")
        style_issues = self.tools["check_style"](code)
        
        # Thought 3: 查找潜在bug
        thoughts.append("查找潜在问题")
        bugs = self.tools["find_bugs"](code)
        
        # 生成报告
        return self.generate_report(structure, style_issues, bugs)
```

---

## ⚠️ 常见问题

### 问题 1：Agent 陷入循环

**症状**：Agent 重复执行相同的行动

**原因**：
- 推理逻辑有问题
- 缺少终止条件
- 记忆系统未正确更新

**解决方案**：
```python
class Agent:
    def __init__(self):
        self.max_iterations = 10
        self.action_history = []
    
    def run(self, user_input):
        for i in range(self.max_iterations):
            action = self.reason(...)
            
            # 检查是否重复
            if action in self.action_history[-3:]:
                return "检测到循环，终止执行"
            
            self.action_history.append(action)
            result = self.act(action)
            
            if self.is_complete(result):
                break
        
        return result
```

### 问题 2：工具调用失败

**症状**：Agent 无法正确调用工具

**原因**：
- 工具参数错误
- 工具不存在
- 权限不足

**解决方案**：
```python
class Agent:
    def call_tool(self, tool_name, args):
        # 验证工具存在
        if tool_name not in self.tools:
            return {"error": f"工具 {tool_name} 不存在"}
        
        # 验证参数
        try:
            self.validate_args(tool_name, args)
        except ValidationError as e:
            return {"error": f"参数错误: {e}"}
        
        # 调用工具
        try:
            return self.tools[tool_name](**args)
        except Exception as e:
            return {"error": f"工具执行失败: {e}"}
```

### 问题 3：记忆溢出

**症状**：记忆占用过多内存

**解决方案**：
```python
class MemorySystem:
    def __init__(self, max_short_term=10, max_long_term=100):
        self.short_term = deque(maxlen=max_short_term)
        self.long_term = {}
        self.max_long_term = max_long_term
    
    def add(self, memory):
        self.short_term.append(memory)
    
    def archive(self, memory):
        # 使用 LRU 策略管理长期记忆
        if len(self.long_term) >= self.max_long_term:
            # 删除最旧的记忆
            oldest_key = min(self.long_term.keys())
            del self.long_term[oldest_key]
        
        self.long_term[memory['timestamp']] = memory
```

---

## 🚀 进阶内容

### 高级特性 1：多模态感知

支持文本、图像、语音等多种输入。

```python
class MultimodalAgent:
    def perceive(self, input_data):
        if input_data['type'] == 'text':
            return self.perceive_text(input_data['content'])
        elif input_data['type'] == 'image':
            return self.perceive_image(input_data['content'])
        elif input_data['type'] == 'audio':
            return self.perceive_audio(input_data['content'])
```

### 高级特性 2：分层推理

将复杂任务分解为多个层次。

```python
class HierarchicalAgent:
    def reason(self, perception):
        # 高层推理：制定总体策略
        strategy = self.high_level_reasoning(perception)
        
        # 中层推理：分解为子任务
        subtasks = self.decompose_task(strategy)
        
        # 低层推理：规划具体行动
        actions = []
        for subtask in subtasks:
            actions.extend(self.plan_actions(subtask))
        
        return actions
```

### 高级特性 3：自我反思

Agent 能够评估自己的表现并改进。

```python
class ReflectiveAgent:
    def run(self, user_input):
        # 执行任务
        result = self.execute(user_input)
        
        # 自我评估
        evaluation = self.evaluate(result)
        
        # 如果表现不好，重新尝试
        if evaluation['score'] < 0.7:
            improved_result = self.retry_with_improvement(
                user_input, 
                evaluation['feedback']
            )
            return improved_result
        
        return result
```

---

## 📖 推荐资源

### 学习资料

- **论文**：ReAct: Synergizing Reasoning and Acting in Language Models
- **书籍**：《人工智能：一种现代方法》
- **课程**：CS224N - Natural Language Processing with Deep Learning

### 开源项目

- **LangChain** - Agent 开发框架
- **AutoGPT** - 自主 Agent 实现
- **BabyAGI** - 任务驱动的 Agent

### 工具推荐

- **LangSmith** - Agent 调试和监控
- **Weights & Biases** - 实验跟踪
- **Streamlit** - 快速构建 UI

---

## 🎓 总结

### 关键要点

1. **PRA Loop** - Agent 的核心运行循环
2. **ReAct 模式** - 推理和行动交替进行
3. **工具调用** - Agent 与外部世界交互的方式
4. **记忆系统** - 维护上下文和历史信息

### Agent 开发的挑战

- ⚠️ 推理准确性 - 如何做出正确决策
- ⚠️ 工具可靠性 - 如何处理工具失败
- ⚠️ 记忆管理 - 如何高效管理记忆
- ⚠️ 可解释性 - 如何解释 Agent 的行为

### 下一步学习

- 实践：完成毒舌 Gordon Agent 实验
- 进阶：学习多 Agent 协作
- 应用：开发自己的 Agent 应用

继续学习，掌握 Agent 开发的核心技能！🚀
