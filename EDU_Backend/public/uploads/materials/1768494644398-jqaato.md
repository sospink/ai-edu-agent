# 多 Agent 协作 - 知识手册

## 📚 课程概述

### 学习目标

- 理解多 Agent 系统（MAS）的概念
- 掌握 LangGraph 状态机编排
- 学会设计 Agent 协作模式
- 理解状态管理和消息传递

### 适用人群

- 已掌握单 Agent 开发的开发者
- 需要构建复杂 AI 系统的工程师
- 对分布式 AI 系统感兴趣的学习者

---

## 🎯 核心概念

### 什么是多 Agent 系统（MAS）？

**多 Agent 系统（Multi-Agent System, MAS）** 是由多个自主 Agent 组成的系统，这些 Agent 通过协作完成复杂任务。

**MAS 的特点**：
- **分工协作** - 每个 Agent 负责特定任务
- **并行处理** - 多个 Agent 可以同时工作
- **灵活组合** - Agent 可以动态组合
- **容错性强** - 单个 Agent 失败不影响整体

### 为什么需要多 Agent？

**单 Agent 的局限**：
- 任务过于复杂，单个 Agent 难以处理
- 需要不同的专业能力
- 需要并行处理提高效率

**多 Agent 的优势**：
- ✅ 专业分工 - 每个 Agent 专注自己擅长的领域
- ✅ 提高效率 - 并行处理加快速度
- ✅ 易于扩展 - 添加新 Agent 扩展能力
- ✅ 提高质量 - 多个视角提高决策质量

### LangGraph 状态机

**LangGraph** 是一个用于构建多 Agent 工作流的框架，基于状态机模型。

**核心概念**：
- **State（状态）** - 系统的当前状态
- **Node（节点）** - Agent 或处理步骤
- **Edge（边）** - 状态转换规则
- **Graph（图）** - 完整的工作流

**状态机示例**：
```
[Start] → [Agent A] → [Agent B] → [Agent C] → [End]
            ↓           ↓           ↓
         [State]    [State]    [State]
```

---

## 🏗️ 技术架构

### 多 Agent 系统架构

```
┌─────────────────────────────────────────┐
│      Multi-Agent System                 │
├─────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │Agent │  │Agent │  │Agent │          │
│  │  A   │  │  B   │  │  C   │          │
│  └──┬───┘  └──┬───┘  └──┬───┘          │
│     │         │         │               │
│     └─────────┼─────────┘               │
│               ↓                         │
│        ┌─────────────┐                  │
│        │   Shared    │                  │
│        │    State    │                  │
│        └─────────────┘                  │
├─────────────────────────────────────────┤
│         Orchestrator                    │
│      (LangGraph Engine)                 │
└─────────────────────────────────────────┘
```

### Agent 协作模式

**1. Sequential（顺序）**
```
Agent A → Agent B → Agent C
```
- 按顺序执行
- 前一个 Agent 的输出是下一个的输入
- 适用于流水线式任务

**2. Parallel（并行）**
```
        ┌→ Agent A ┐
Start → ├→ Agent B ├→ Merge → End
        └→ Agent C ┘
```
- 同时执行多个 Agent
- 最后合并结果
- 适用于独立的子任务

**3. Conditional（条件）**
```
        ┌→ Agent A (if condition)
Start → ┤
        └→ Agent B (else)
```
- 根据条件选择 Agent
- 动态决策
- 适用于分支逻辑

**4. Loop（循环）**
```
Agent A → Agent B → Check
    ↑                 ↓
    └─────────────────┘ (if not done)
```
- 重复执行直到满足条件
- 迭代优化
- 适用于需要多轮处理的任务

---

## 💡 设计原则

### 1. 单一职责

每个 Agent 只负责一个明确的任务。

**好的设计**：
```python
class CreativeAgent:
    """只负责生成创意"""
    def generate_ideas(self, topic):
        pass

class CriticAgent:
    """只负责评估批评"""
    def critique_ideas(self, ideas):
        pass
```

### 2. 清晰的接口

Agent 之间通过标准化的接口通信。

```python
class AgentInterface:
    def execute(self, state: Dict) -> Dict:
        """
        标准执行接口
        
        Args:
            state: 输入状态
        
        Returns:
            更新后的状态
        """
        pass
```

### 3. 状态管理

使用共享状态在 Agent 之间传递信息。

```python
from typing import TypedDict, List

class WorkflowState(TypedDict):
    """工作流状态"""
    topic: str
    ideas: List[str]
    critiques: List[str]
    final_result: str
    current_step: str
```

### 4. 错误处理

优雅地处理 Agent 失败。

```python
def execute_agent(agent, state):
    try:
        return agent.execute(state)
    except Exception as e:
        # 记录错误
        state['errors'].append({
            'agent': agent.name,
            'error': str(e)
        })
        # 继续执行或终止
        return state
```

---

## 🎨 实际应用

### 应用场景 1：创意风暴系统

**需求**：生成、评估、优化创意

**Agent 设计**：
- **Creative Agent** - 生成创意
- **Critic Agent** - 评估批评
- **Refiner Agent** - 优化改进
- **Summarizer Agent** - 总结报告

**工作流**：
```
Topic → Creative → Critic → Refiner → Summarizer → Report
```

### 应用场景 2：代码审查系统

**需求**：自动审查代码质量

**Agent 设计**：
- **Style Agent** - 检查代码风格
- **Security Agent** - 检查安全问题
- **Performance Agent** - 分析性能
- **Report Agent** - 生成报告

**工作流**（并行）：
```
        ┌→ Style Agent    ┐
Code → ├→ Security Agent ├→ Report Agent → Report
        └→ Performance   ┘
```

### 应用场景 3：客服系统

**需求**：处理客户咨询

**Agent 设计**：
- **Router Agent** - 路由问题
- **FAQ Agent** - 回答常见问题
- **Technical Agent** - 处理技术问题
- **Escalation Agent** - 升级复杂问题

**工作流**（条件）：
```
        ┌→ FAQ Agent (if simple)
Query → Router → Technical Agent (if technical)
        └→ Escalation Agent (if complex)
```

---

## ⚠️ 常见问题

### 问题 1：Agent 之间通信混乱

**症状**：Agent 无法正确传递信息

**解决方案**：
- 使用 TypedDict 定义状态结构
- 明确每个 Agent 的输入输出
- 使用状态验证

```python
from typing import TypedDict

class State(TypedDict):
    """明确的状态定义"""
    input: str
    step1_result: str
    step2_result: str
    final_output: str
```

### 问题 2：工作流死锁

**症状**：Agent 相互等待，无法继续

**解决方案**：
- 避免循环依赖
- 设置超时机制
- 添加终止条件

```python
def run_workflow(state, max_iterations=10):
    for i in range(max_iterations):
        state = execute_step(state)
        if is_complete(state):
            break
    return state
```

### 问题 3：状态爆炸

**症状**：状态对象过大，影响性能

**解决方案**：
- 只保存必要信息
- 使用引用而非复制
- 定期清理旧数据

```python
class State(TypedDict):
    # 只保存必要字段
    current_data: str
    metadata: Dict
    # 不保存完整历史
```

---

## 🚀 进阶内容

### 高级特性 1：动态 Agent 选择

根据任务动态选择 Agent。

```python
class DynamicOrchestrator:
    def select_agent(self, task):
        if task['complexity'] < 5:
            return SimpleAgent()
        else:
            return ComplexAgent()
```

### 高级特性 2：Agent 投票机制

多个 Agent 投票决策。

```python
def vote_decision(agents, input_data):
    votes = []
    for agent in agents:
        vote = agent.decide(input_data)
        votes.append(vote)
    
    # 多数投票
    return max(set(votes), key=votes.count)
```

### 高级特性 3：分层协作

构建多层 Agent 系统。

```python
class HierarchicalMAS:
    def __init__(self):
        self.high_level_agents = [...]  # 战略层
        self.mid_level_agents = [...]   # 战术层
        self.low_level_agents = [...]   # 执行层
```

---

## 📖 推荐资源

### 学习资料

- **LangGraph 文档** - 官方教程和示例
- **论文**：Multi-Agent Systems: A Survey
- **书籍**：《多智能体系统导论》

### 开源项目

- **AutoGen** - 微软的多 Agent 框架
- **CrewAI** - 角色扮演的多 Agent 系统
- **MetaGPT** - 软件开发的多 Agent 系统

### 工具推荐

- **LangSmith** - 调试和监控
- **LangServe** - 部署服务
- **Streamlit** - 构建 UI

---

## 🎓 总结

### 关键要点

1. **MAS** - 多个 Agent 协作完成复杂任务
2. **LangGraph** - 使用状态机编排工作流
3. **协作模式** - Sequential, Parallel, Conditional, Loop
4. **状态管理** - 使用共享状态传递信息

### 多 Agent 的挑战

- ⚠️ 协调复杂性 - 如何协调多个 Agent
- ⚠️ 状态一致性 - 如何保持状态同步
- ⚠️ 性能优化 - 如何提高执行效率
- ⚠️ 错误处理 - 如何处理 Agent 失败

### 下一步学习

- 实践：完成创意风暴实验
- 进阶：学习 AI 安全与合规
- 应用：构建自己的多 Agent 系统

继续学习，掌握多 Agent 协作的核心技能！🚀
