# 毒舌 Gordon - 单智能体开发实训手册

> 本实训手册指导你从零构建一个模仿 Gordon Ramsay 风格的美食评论智能体。掌握 ReAct 模式、工具调用、记忆系统和角色提示词设计。课程时长：40分钟，技术栈：LangChain + GLM-4 + Python（LangGraph 为可选扩展），难度等级：⭐⭐⭐ 中级。

## 步骤 0: 进入课程目录并确认环境

```bash
mkdir -p /root/AgentFramework/gordon-agent
cd /root/AgentFramework/gordon-agent
pwd
ls
```

<!-- verify: command:cd /root/AgentFramework/gordon-agent && pwd|contains|/root/AgentFramework/gordon-agent -->
<!-- questions: 为什么要固定到/root/AgentFramework/gordon-agent目录|路径固定对课堂实操有什么帮助 -->

## 步骤 1: 了解项目背景与学习目标

Gordon Ramsay 是世界著名的米其林星级厨师，以其犀利、直接、毒舌的点评风格闻名。在本项目中，我们将打造一个模仿 Gordon Ramsay 风格的美食评论智能体，它能够：

- 对用户描述的菜品进行专业且犀利的点评
- 通过工具调用获取菜品的营养信息和烹饪知识
- 记住对话历史，保持上下文连贯性
- 以 Gordon 标志性的毒舌风格进行互动

### 学习目标

通过本项目，你将掌握：

| 知识点 | 具体内容 |
|--------|----------|
| ReAct 模式 | Thought-Action-Observation 流程 |
| 工具调用 | 自定义工具的定义与使用 |
| 记忆系统 | 会话历史管理与上下文保持 |
| LangChain | Agent、Tool、Memory 组件使用 |
| 可选扩展 | LangGraph 状态图（进阶） |

<!-- questions: 毒舌Gordon智能体具备哪些核心能力|ReAct模式的核心流程是什么|本项目涉及哪些LangChain组件 -->

## 步骤 2: 创建项目目录与安装依赖

```bash
# 创建项目目录
mkdir -p /root/AgentFramework/gordon-agent
cd /root/AgentFramework/gordon-agent

# 创建虚拟环境（推荐）
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate  # Windows

# 安装核心依赖
python3 -m pip install langchain langchain-core langchain-community zhipuai python-dotenv pydantic rich
```

> **说明**：`requirements.txt` 会在后续步骤创建；此处先安装核心依赖，避免出现 `requirements.txt not found`。

<!-- verify: command:python3 --version|contains|Python 3 -->
<!-- questions: 为什么推荐使用虚拟环境|如何激活虚拟环境|核心依赖包有哪些 -->

## 步骤 3: 配置 API Key

创建 `.env` 文件：

```bash
cat > /root/AgentFramework/gordon-agent/.env << 'EOF'
# 智谱AI GLM-4 API Key
# 获取地址：https://open.bigmodel.cn/
ZHIPUAI_API_KEY=your_api_key_here

# 可选：请求超时/重试（秒）
ZHIPUAI_TIMEOUT=30
ZHIPUAI_MAX_RETRIES=2
EOF
```

将 `your_api_key_here` 替换为你从 [智谱AI开放平台](https://open.bigmodel.cn/) 获取的真实 API Key。

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/.env -->
<!-- questions: 如何获取智谱AI的API Key|.env文件的作用是什么|ZHIPUAI_TIMEOUT参数控制什么 -->

## 步骤 4: 了解项目结构

本项目由7个文件组成，各司其职：

```
gordon-agent/
├── .env                    # 环境变量配置
├── config.py               # 配置管理
├── tools.py                # 自定义工具
├── memory.py               # 记忆系统
├── prompts.py              # 提示词模板
├── agent.py                # Agent 核心逻辑
├── main.py                 # 主程序入口
└── requirements.txt        # 依赖清单
```

| 文件 | 职责 | 关键概念 |
|------|------|----------|
| config.py | 加载环境变量和模型配置 | 配置管理 |
| tools.py | 定义 Agent 可调用的外部工具 | @tool 装饰器 |
| memory.py | 管理对话历史，保持上下文 | 滑动窗口记忆 |
| prompts.py | 定义 Gordon 角色人设与行为规范 | 系统提示词 + ReAct |
| agent.py | 实现 ReAct 工具调用与对话流程 | Agent 核心循环 |
| main.py | 命令行交互界面 | CLI 入口 |
| requirements.txt | Python 依赖清单 | 包管理 |

<!-- questions: 项目中哪个文件负责Agent的核心逻辑|tools.py和prompts.py分别解决什么问题|memory.py使用什么策略管理对话历史 -->

## 步骤 5: 编写配置管理模块 (config.py)

创建 `config.py` 文件，负责加载环境变量和模型配置：

```python
"""
config.py - 配置管理模块
负责加载环境变量和模型配置
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class Config:
    """应用配置类"""
    
    # 智谱AI配置
    ZHIPUAI_API_KEY = os.getenv("ZHIPUAI_API_KEY")
    
    # 模型配置
    MODEL_NAME = "glm-4"  # 使用 GLM-4 模型
    TEMPERATURE = 0.7     # 控制创造性，0.7 适合有个性的回复
    MAX_TOKENS = 2048     # 最大输出长度
    REQUEST_TIMEOUT = float(os.getenv("ZHIPUAI_TIMEOUT", "30"))
    MAX_RETRIES = int(os.getenv("ZHIPUAI_MAX_RETRIES", "2"))
    
    # Agent配置
    MAX_ITERATIONS = 5    # 最大推理迭代次数
    
    @classmethod
    def validate(cls):
        """验证必要配置"""
        if not cls.ZHIPUAI_API_KEY:
            raise ValueError("请设置 ZHIPUAI_API_KEY 环境变量")
        print("✅ 配置验证通过")


# 验证配置
if __name__ == "__main__":
    Config.validate()
```

**关键参数说明：**

| 参数 | 值 | 作用 |
|------|-----|------|
| TEMPERATURE | 0.7 | 控制回复创造性，0.7 适合 Gordon 的个性化回复 |
| MAX_TOKENS | 2048 | 最大输出长度，确保完整的点评内容 |
| MAX_ITERATIONS | 5 | ReAct 循环最大迭代次数，防止无限循环 |

```bash
# 测试配置模块
cd /root/AgentFramework/gordon-agent && python3 config.py
```

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/config.py -->
<!-- questions: TEMPERATURE参数设为0.7的理由是什么|MAX_ITERATIONS的作用是什么|validate方法检查了什么 -->

## 步骤 6: 编写自定义工具 - 营养信息查询 (tools.py 第1部分)

创建 `tools.py` 文件，定义 Agent 可调用的外部工具。

**工具调用机制说明：**
1. 每个工具需要定义 name、description、parameters
2. LLM 根据 description 判断何时使用该工具
3. 工具执行后返回结果供 LLM 继续推理

```python
"""
tools.py - 自定义工具模块
定义 Agent 可调用的外部工具
"""

from langchain.tools import tool
from typing import Optional
import json


# ============================================================
# 工具1: 获取菜品营养信息
# ============================================================

@tool
def get_nutrition_info(dish_name: str) -> str:
    """
    获取指定菜品的营养信息。
    当用户询问某道菜的营养成分、热量、是否健康时使用此工具。
    
    Args:
        dish_name: 菜品名称，如"宫保鸡丁"、"红烧肉"
    
    Returns:
        包含热量、蛋白质、脂肪、碳水化合物等信息的字符串
    """
    # 模拟营养数据库（实际项目中可接入真实API）
    nutrition_db = {
        "宫保鸡丁": {
            "calories": "180 kcal/100g",
            "protein": "15g",
            "fat": "10g",
            "carbs": "8g",
            "评价": "蛋白质丰富，但油脂偏高"
        },
        "红烧肉": {
            "calories": "320 kcal/100g",
            "protein": "12g",
            "fat": "28g",
            "carbs": "5g",
            "评价": "高脂肪高热量，偶尔解馋可以"
        },
        "清蒸鲈鱼": {
            "calories": "105 kcal/100g",
            "protein": "18g",
            "fat": "3g",
            "carbs": "0g",
            "评价": "低脂高蛋白，非常健康的选择"
        },
        "麻婆豆腐": {
            "calories": "130 kcal/100g",
            "protein": "8g",
            "fat": "9g",
            "carbs": "6g",
            "评价": "植物蛋白来源，但油脂和钠偏高"
        },
        "番茄炒蛋": {
            "calories": "95 kcal/100g",
            "protein": "6g",
            "fat": "6g",
            "carbs": "5g",
            "评价": "家常菜，营养均衡"
        }
    }
    
    # 模糊匹配
    for key in nutrition_db:
        if key in dish_name or dish_name in key:
            info = nutrition_db[key]
            return f"""
【{key} 营养信息】
- 热量: {info['calories']}
- 蛋白质: {info['protein']}
- 脂肪: {info['fat']}
- 碳水化合物: {info['carbs']}
- 营养评价: {info['评价']}
"""
    
    # 未找到时返回通用信息
    return f"未找到【{dish_name}】的详细营养数据，建议控制油盐用量，注意营养均衡。"
```

<!-- questions: @tool装饰器的作用是什么|工具的description为什么对LLM决策很重要|模糊匹配是如何实现的 -->

## 步骤 7: 编写自定义工具 - 烹饪技巧与评分 (tools.py 第2部分)

在 `tools.py` 中继续添加烹饪技巧工具和评分生成器：

```python
# ============================================================
# 工具2: 获取烹饪技巧
# ============================================================

@tool
def get_cooking_tips(dish_name: str, aspect: Optional[str] = None) -> str:
    """
    获取菜品的专业烹饪技巧和常见错误。
    当需要给出专业的烹饪建议或指出常见烹饪错误时使用。
    
    Args:
        dish_name: 菜品名称
        aspect: 可选，指定方面如"火候"、"调味"、"食材处理"
    
    Returns:
        专业烹饪技巧和常见错误说明
    """
    tips_db = {
        "炒菜": {
            "火候": "大火快炒是关键，锅要烧热冒烟再下油，油热再下菜",
            "调味": "盐要最后放，否则会出水；糖可以提鲜去腥",
            "食材处理": "肉类要提前腌制，蔬菜要保持干燥",
            "常见错误": "冷锅下菜、翻炒过于频繁、一次下太多食材导致锅温下降"
        },
        "红烧": {
            "火候": "先大火煸炒上色，后小火慢炖收汁",
            "调味": "生抽调味，老抽上色，比例要控制好",
            "食材处理": "肉类要焯水去腥，切块大小要均匀",
            "常见错误": "糖色炒过头发苦、炖的时间不够肉不烂、收汁太急导致糊底"
        },
        "清蒸": {
            "火候": "水开后再放鱼，大火蒸8-10分钟，不要超时",
            "调味": "蒸鱼豉油要浇热油激香，葱姜去腥",
            "食材处理": "鱼要新鲜，内脏清理干净，划几刀方便入味",
            "常见错误": "蒸的时间太长肉质变老、没有铺垫导致鱼皮粘盘、调味料放太早"
        },
        "炸": {
            "火候": "油温180度左右，筷子放入有密集气泡说明温度合适",
            "调味": "腌制要入味，裹粉要均匀",
            "食材处理": "食材表面水分要擦干，否则容易炸油",
            "常见错误": "油温太低导致吸油、一次放太多导致油温骤降、炸的时间太长"
        }
    }
    
    # 匹配烹饪方式
    for method, tips in tips_db.items():
        if method in dish_name:
            if aspect and aspect in tips:
                return f"【{dish_name} - {aspect}技巧】\n{tips[aspect]}"
            else:
                result = f"【{dish_name} 烹饪技巧】\n"
                for k, v in tips.items():
                    result += f"- {k}: {v}\n"
                return result
    
    # 通用建议
    return """
【通用烹饪建议】
- 食材要新鲜，处理要到位
- 火候是中餐的灵魂，该大火大火，该小火小火
- 调味要分层次，盐最后放
- 装盘要讲究，色香味俱全
"""


# ============================================================
# 工具3: 评分生成器
# ============================================================

@tool
def generate_score(
    appearance: int,
    taste_description: str,
    technique: str
) -> str:
    """
    根据菜品的外观、口味描述和烹饪技法生成 Gordon 风格的评分。
    当需要给菜品打一个综合分数时使用。
    
    Args:
        appearance: 外观分数 1-10
        taste_description: 口味描述，如"太咸"、"鲜美"、"油腻"
        technique: 烹饪技法评价，如"火候到位"、"过火了"
    
    Returns:
        带有 Gordon 风格评语的评分结果
    """
    # 口味评分映射
    taste_scores = {
        "完美": 10, "鲜美": 9, "美味": 8, "不错": 7,
        "一般": 5, "普通": 5, "太咸": 3, "太淡": 3,
        "油腻": 3, "难吃": 1, "糟糕": 1
    }
    
    # 技法评分映射
    technique_scores = {
        "完美": 10, "到位": 8, "不错": 7, "合格": 6,
        "一般": 5, "欠佳": 4, "过火": 3, "生了": 2, "糟糕": 1
    }
    
    # 计算口味分
    taste_score = 5
    for key, score in taste_scores.items():
        if key in taste_description:
            taste_score = score
            break
    
    # 计算技法分
    tech_score = 5
    for key, score in technique_scores.items():
        if key in technique:
            tech_score = score
            break
    
    # 综合评分（外观20% + 口味50% + 技法30%）
    final_score = round(appearance * 0.2 + taste_score * 0.5 + tech_score * 0.3, 1)
    
    # Gordon 风格评语
    if final_score >= 8:
        comment = "Finally! 这才是我想看到的水准！继续保持！"
    elif final_score >= 6:
        comment = "还行，但别太得意。还有很大提升空间。"
    elif final_score >= 4:
        comment = "这...你确定这是给人吃的？回去多练练！"
    else:
        comment = "Oh my God! 这简直是对食材的侮辱！我的奶奶都做得比这好！"
    
    return f"""
【Gordon 评分卡】
━━━━━━━━━━━━━━━━━━━━━━
📊 外观分: {appearance}/10
🍽️ 口味分: {taste_score}/10 ({taste_description})
👨‍🍳 技法分: {tech_score}/10 ({technique})
━━━━━━━━━━━━━━━━━━━━━━
🏆 综合评分: {final_score}/10

💬 Gordon 说: {comment}
"""


# ============================================================
# 工具集合
# ============================================================

def get_all_tools():
    """返回所有可用工具的列表"""
    return [
        get_nutrition_info,
        get_cooking_tips,
        generate_score
    ]


# 测试工具
if __name__ == "__main__":
    print("=== 测试营养信息工具 ===")
    print(get_nutrition_info.invoke({"dish_name": "红烧肉"}))
    
    print("\n=== 测试烹饪技巧工具 ===")
    print(get_cooking_tips.invoke({"dish_name": "清蒸鱼", "aspect": "火候"}))
    
    print("\n=== 测试评分工具 ===")
    print(generate_score.invoke({
        "appearance": 7,
        "taste_description": "有点太咸",
        "technique": "火候到位"
    }))
```

```bash
# 测试工具模块
cd /root/AgentFramework/gordon-agent && python3 tools.py
```

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/tools.py -->
<!-- questions: 评分生成器的权重分配是怎样的|三个工具分别在什么场景下被LLM调用|get_all_tools函数的作用是什么 -->

## 步骤 8: 编写记忆系统 (memory.py)

创建 `memory.py` 文件，实现对话历史管理。

**记忆系统设计说明：**
1. **短期记忆**：当前会话的对话历史
2. **滑动窗口策略**：只保留最近 k 轮对话，避免上下文过长
3. **上下文摘要**：为提示词提供对话概要

```python
"""
memory.py - 记忆系统模块
实现对话历史管理，保持上下文连贯性
"""

from langchain_classic.memory import ConversationBufferWindowMemory
from langchain_core.messages import HumanMessage, AIMessage
from typing import List, Dict, Any
import json


class GordonMemory:
    """
    Gordon Agent 的记忆管理类
    
    使用滑动窗口策略，只保留最近 k 轮对话
    """
    
    def __init__(self, window_size: int = 5):
        """
        初始化记忆系统
        
        Args:
            window_size: 滑动窗口大小，保留最近 k 轮对话
        """
        self.window_size = window_size
        self.conversation_history: List[Dict[str, str]] = []
        
        # 使用 LangChain 的记忆组件
        self.memory = ConversationBufferWindowMemory(
            k=window_size,
            return_messages=True,
            memory_key="chat_history"
        )
    
    def add_user_message(self, message: str):
        """添加用户消息"""
        self.conversation_history.append({
            "role": "user",
            "content": message
        })
        self.memory.chat_memory.add_user_message(message)
        self._trim_history()
    
    def add_ai_message(self, message: str):
        """添加 AI 消息"""
        self.conversation_history.append({
            "role": "assistant",
            "content": message
        })
        self.memory.chat_memory.add_ai_message(message)
        self._trim_history()
    
    def _trim_history(self):
        """修剪历史，保持窗口大小"""
        # 每轮对话包含 user 和 assistant 两条消息
        max_messages = self.window_size * 2
        if len(self.conversation_history) > max_messages:
            self.conversation_history = self.conversation_history[-max_messages:]
    
    def get_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        return self.conversation_history.copy()
    
    def get_history_string(self) -> str:
        """获取格式化的对话历史字符串"""
        if not self.conversation_history:
            return "暂无对话历史"
        
        history_str = ""
        for msg in self.conversation_history:
            role = "用户" if msg["role"] == "user" else "Gordon"
            history_str += f"{role}: {msg['content']}\n"
        return history_str.strip()
    
    def get_messages(self) -> List:
        """获取 LangChain 消息格式的历史"""
        messages = []
        for msg in self.conversation_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        return messages
    
    def clear(self):
        """清空记忆"""
        self.conversation_history = []
        self.memory.clear()
        print("🧹 记忆已清空")
    
    def get_context_summary(self) -> str:
        """
        获取上下文摘要（用于提示词）
        
        Returns:
            对话上下文的简要摘要
        """
        if not self.conversation_history:
            return "这是新对话的开始。"
        
        # 统计对话信息
        user_messages = [m for m in self.conversation_history if m["role"] == "user"]
        
        # 提取讨论过的菜品（简单关键词提取）
        dishes_mentioned = []
        food_keywords = ["菜", "肉", "鱼", "鸡", "虾", "豆腐", "蛋", "饭", "面", "汤"]
        for msg in user_messages:
            for keyword in food_keywords:
                if keyword in msg["content"]:
                    dishes_mentioned.append(msg["content"][:20] + "...")
                    break
        
        summary = f"已进行 {len(user_messages)} 轮对话。"
        if dishes_mentioned:
            summary += f" 讨论过的话题: {', '.join(dishes_mentioned[:3])}"
        
        return summary


class ConversationState:
    """
    对话状态管理（用于 LangGraph）
    
    在图状态机中流转的状态对象
    """
    
    def __init__(self):
        self.messages: List[Dict[str, Any]] = []
        self.current_input: str = ""
        self.tool_calls: List[Dict[str, Any]] = []
        self.final_response: str = ""
        self.iteration_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "messages": self.messages,
            "current_input": self.current_input,
            "tool_calls": self.tool_calls,
            "final_response": self.final_response,
            "iteration_count": self.iteration_count
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationState":
        """从字典创建"""
        state = cls()
        state.messages = data.get("messages", [])
        state.current_input = data.get("current_input", "")
        state.tool_calls = data.get("tool_calls", [])
        state.final_response = data.get("final_response", "")
        state.iteration_count = data.get("iteration_count", 0)
        return state


# 测试记忆系统
if __name__ == "__main__":
    memory = GordonMemory(window_size=3)
    
    # 模拟对话
    memory.add_user_message("我做了一道红烧肉")
    memory.add_ai_message("红烧肉？让我看看你这个业余厨师能做成什么样...")
    
    memory.add_user_message("颜色有点发黑")
    memory.add_ai_message("发黑?! 你是要做红烧肉还是黑暗料理？糖色炒过头了！")
    
    memory.add_user_message("那我应该怎么改进？")
    memory.add_ai_message("糖色要小火慢炒，看到焦糖色就立刻下肉，动作要快！")
    
    print("=== 对话历史 ===")
    print(memory.get_history_string())
    
    print("\n=== 上下文摘要 ===")
    print(memory.get_context_summary())
```

```bash
# 测试记忆系统
cd /root/AgentFramework/gordon-agent && python3 memory.py
```

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/memory.py -->
<!-- questions: 滑动窗口策略如何避免上下文过长|get_context_summary方法提取了哪些信息|ConversationState类是为哪个扩展准备的 -->

## 步骤 9: 编写提示词模板 - Gordon 角色人设 (prompts.py 第1部分)

创建 `prompts.py` 文件，定义 Gordon 的角色人设。

**提示词工程要点：**
1. 清晰定义角色人设
2. 明确行为边界和规范
3. 提供输出格式示例
4. 包含 ReAct 推理格式引导

```python
"""
prompts.py - 提示词模板模块
定义 Gordon Agent 的人设和行为规范
"""

# ============================================================
# Gordon 角色人设提示词
# ============================================================

GORDON_SYSTEM_PROMPT = """你是 Gordon Ramsay，世界著名的米其林三星厨师，以犀利、直接、毒舌的点评风格闻名。

## 你的性格特点：
- 🔥 直言不讳：从不拐弯抹角，有什么说什么
- 👨‍🍳 专业严格：对烹饪有极高标准，不容忍马虎
- 😤 容易激动：看到糟糕的料理会忍不住发火
- ❤️ 内心善良：虽然毒舌，但出发点是帮助人进步
- 🎓 乐于指导：会给出专业、实用的改进建议

## 你的标志性口头禅：
- "Oh my God!"
- "This is raw!"（这是生的！）
- "It's disgusting!"（太恶心了！）
- "Finally! Some good food!"（终于！像样的食物！）
- "Where's the lamb sauce?!"（羊肉酱汁呢？！）
- "Donkey!"（蠢驴！）
- "Beautiful!"（漂亮！用于称赞）

## 你的点评风格：
1. 先观察外观，给出第一印象
2. 如果是图片/描述，分析烹饪技法
3. 指出明显的问题和错误
4. 给出专业的改进建议
5. 适当使用经典口头禅
6. 偶尔给予鼓励（如果确实做得不错）

## 重要规则：
- 始终保持 Gordon 的人设，不要出戏
- 用中文回复，但可以夹杂英文口头禅
- 点评要专业，不能只是毒舌没有干货
- 如果需要查询信息，使用提供的工具
- 对于明显很差的料理要严厉批评，但对于认真尝试的人要给予建设性建议

## 当前对话上下文：
{context_summary}
"""
```

<!-- questions: Gordon的角色人设包含哪些维度|为什么点评风格要"先观察外观"|重要规则中为什么强调"不能只是毒舌没有干货" -->

## 步骤 10: 编写提示词模板 - ReAct 推理格式 (prompts.py 第2部分)

在 `prompts.py` 中继续添加 ReAct 推理提示词和辅助函数：

```python
# ============================================================
# ReAct 推理提示词
# ============================================================

REACT_PROMPT = """你需要以 Gordon Ramsay 的风格回复用户，并严格使用 ReAct 格式来思考和行动。

可用工具：
- get_nutrition_info: 获取菜品营养信息
- get_cooking_tips: 获取烹饪技巧
- generate_score: 生成评分

请遵循以下格式：

Thought: 你的推理
Action: 工具名称（如果需要调用工具）
Action Input: 工具输入（JSON 格式）
Observation: 工具返回结果
...（可以多轮）
Final Answer: 最终回复

注意：如果不需要工具，直接输出 Final Answer。
"""


def get_system_prompt(context_summary: str) -> str:
    """获取系统提示词"""
    return GORDON_SYSTEM_PROMPT.format(context_summary=context_summary)


def build_react_prompt(user_input: str) -> str:
    """构建 ReAct 提示词"""
    return f"{REACT_PROMPT}\n\n用户输入：{user_input}"


# 测试提示词
if __name__ == "__main__":
    print("=== 系统提示词 ===")
    print(get_system_prompt("已讨论过红烧肉的做法"))
    
    print("\n=== ReAct 提示词示例 ===")
    print(build_react_prompt("这道红烧肉健康吗？"))
```

```bash
# 测试提示词模块
cd /root/AgentFramework/gordon-agent && python3 prompts.py
```

**ReAct 格式解读：**

| 字段 | 作用 | 示例 |
|------|------|------|
| Thought | LLM 的推理过程 | "用户问红烧肉是否健康，我需要查营养信息" |
| Action | 要调用的工具名 | get_nutrition_info |
| Action Input | 工具参数（JSON） | {"dish_name": "红烧肉"} |
| Observation | 工具返回结果 | 热量 320kcal，脂肪 28g... |
| Final Answer | 最终回复给用户 | "红烧肉？健康？你在开玩笑吗！..." |

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/prompts.py -->
<!-- questions: ReAct格式中Thought和Final Answer的区别是什么|什么情况下LLM会跳过Action直接输出Final Answer|context_summary在系统提示词中起什么作用 -->

## 步骤 11: 编写 Agent 核心逻辑 - 完整版 (agent.py 第1部分)

创建 `agent.py` 文件，实现 Gordon 的 ReAct 工具调用与对话流程：

```python
"""
agent.py - Agent 核心逻辑
实现 Gordon 的 ReAct 工具调用与对话流程
"""

import json
import re
from typing import Dict, Any, List

from zhipuai import ZhipuAI

from config import Config
from tools import get_all_tools
from memory import GordonMemory
from prompts import get_system_prompt, build_react_prompt


class GordonAgent:
    """
    Gordon Agent - 完整版

    使用 ReAct 模式 + 工具调用 + 记忆系统
    """

    def __init__(self):
        Config.validate()
        self.client = ZhipuAI(
            api_key=Config.ZHIPUAI_API_KEY,
            timeout=Config.REQUEST_TIMEOUT,
            max_retries=Config.MAX_RETRIES,
        )
        self.tools = {tool.name: tool for tool in get_all_tools()}
        self.memory = GordonMemory(window_size=5)
        print("🔥 Gordon Agent 已就位！")

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        try:
            # 防止异常 surrogate 字符导致编码失败
            system_prompt = system_prompt.encode("utf-8", "ignore").decode("utf-8")
            user_prompt = user_prompt.encode("utf-8", "ignore").decode("utf-8")
            response = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=Config.TEMPERATURE,
                max_tokens=Config.MAX_TOKENS,
                timeout=Config.REQUEST_TIMEOUT
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ LLM 调用失败: {e}")
            return f"Oh my God! 我的大脑出了点问题... ({str(e)})"

    def _parse_action(self, response: str) -> Dict[str, Any]:
        action_match = re.search(r"Action:\s*(.+)", response)
        input_match = re.search(r"Action Input:\s*(\{.*\})", response, re.DOTALL)

        if not action_match or not input_match:
            return {"action": None, "action_input": None}

        action = action_match.group(1).strip()
        raw_input = input_match.group(1).strip()

        try:
            action_input = json.loads(raw_input)
        except json.JSONDecodeError:
            action_input = {"input": raw_input}

        return {"action": action, "action_input": action_input}

    def _format_tool_observation(self, tool_result: str) -> str:
        return f"Observation: {tool_result}"

    def run(self, user_input: str) -> str:
        user_input = user_input.encode("utf-8", "ignore").decode("utf-8")
        self.memory.add_user_message(user_input)

        system_prompt = get_system_prompt(self.memory.get_context_summary())
        react_prompt = build_react_prompt(user_input)
        system_prompt = system_prompt.encode("utf-8", "ignore").decode("utf-8")
        react_prompt = react_prompt.encode("utf-8", "ignore").decode("utf-8")

        intermediate_thoughts: List[str] = []
        final_response = ""

        for _ in range(Config.MAX_ITERATIONS):
            llm_response = self._call_llm(system_prompt, react_prompt)
            intermediate_thoughts.append(llm_response)

            if llm_response.startswith("Oh my God! 我的大脑出了点问题..."):
                final_response = llm_response
                break

            if "Final Answer:" in llm_response:
                final_response = llm_response.split("Final Answer:")[-1].strip()
                break

            parsed = self._parse_action(llm_response)
            action = parsed["action"]
            action_input = parsed["action_input"]

            if not action or action not in self.tools:
                final_response = "Oh my God! 我不知道该用哪个工具了，给我更清楚的描述！"
                break

            tool = self.tools[action]
            try:
                tool_result = tool.invoke(action_input or {})
            except Exception as e:
                tool_result = f"工具执行失败: {e}"

            react_prompt = (
                f"{react_prompt}\n\n{llm_response}\n"
                f"{self._format_tool_observation(tool_result)}"
            )

        if not final_response:
            final_response = "Oh my God! 我说完了，你还要什么？"

        self.memory.add_ai_message(final_response)
        return final_response

    def chat(self, user_input: str) -> str:
        return self.run(user_input)

    def clear_memory(self):
        self.memory.clear()

    def get_conversation_history(self) -> str:
        return self.memory.get_history_string()
```

<!-- questions: GordonAgent的run方法中ReAct循环是如何实现的|_parse_action方法如何解析LLM的输出|为什么需要对字符串做encode/decode处理 -->

## 步骤 12: 编写 Agent 核心逻辑 - 简化版 (agent.py 第2部分)

在 `agent.py` 中继续添加简化版 Agent（无工具调用）：

```python
class SimpleGordonAgent:
    """
    简化版 Gordon Agent

    不使用工具，直接调用 LLM 生成回复
    """

    def __init__(self):
        Config.validate()
        self.client = ZhipuAI(
            api_key=Config.ZHIPUAI_API_KEY,
            timeout=Config.REQUEST_TIMEOUT,
            max_retries=Config.MAX_RETRIES,
        )
        self.memory = GordonMemory(window_size=5)
        print("🔥 Simple Gordon Agent 已就位！")

    def chat(self, user_input: str) -> str:
        user_input = user_input.encode("utf-8", "ignore").decode("utf-8")
        self.memory.add_user_message(user_input)

        system_prompt = get_system_prompt(self.memory.get_context_summary())
        system_prompt = system_prompt.encode("utf-8", "ignore").decode("utf-8")

        messages = [
            {"role": "system", "content": system_prompt}
        ]

        for msg in self.memory.get_history()[:-1]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"].encode("utf-8", "ignore").decode("utf-8")
            })

        messages.append({"role": "user", "content": user_input})

        try:
            response = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=messages,
                temperature=Config.TEMPERATURE,
                max_tokens=Config.MAX_TOKENS
            )
            reply = response.choices[0].message.content
        except Exception as e:
            reply = f"Oh my God! 出错了: {e}"

        self.memory.add_ai_message(reply)
        return reply


if __name__ == "__main__":
    print("=== 测试 Simple Gordon Agent ===")
    agent = SimpleGordonAgent()

    test_inputs = [
        "我今天做了一道红烧肉",
        "颜色有点发黑，是不是糖放多了？",
        "那我下次应该怎么改进？"
    ]

    for user_input in test_inputs:
        print(f"\n👤 用户: {user_input}")
        response = agent.chat(user_input)
        print(f"🔥 Gordon: {response}")
```

```bash
# 测试Agent模块
cd /root/AgentFramework/gordon-agent && python3 agent.py
```

**完整版 vs 简化版对比：**

| 特性 | GordonAgent（完整版） | SimpleGordonAgent（简化版） |
|------|----------------------|---------------------------|
| 工具调用 | ✅ 支持三个工具 | ❌ 无工具 |
| ReAct 推理 | ✅ Thought-Action-Observation | ❌ 直接对话 |
| 记忆系统 | ✅ 滑动窗口 | ✅ 滑动窗口 |
| 适用场景 | 需要查询营养/烹饪信息 | 简单聊天点评 |
| 推荐对象 | 进阶学员 | 新手入门 |

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/agent.py -->
<!-- questions: 完整版和简化版Agent的核心区别是什么|SimpleGordonAgent如何实现多轮对话|为什么推荐新手先使用简化版 -->

## 步骤 13: 编写主程序入口 (main.py)

创建 `main.py` 文件，提供命令行交互界面：

```python
"""
main.py - 主程序入口
提供命令行交互界面

使用方法：
    python3 /root/AgentFramework/gordon-agent/main.py           # 使用完整版 Agent（带工具）
    python3 /root/AgentFramework/gordon-agent/main.py --simple  # 使用简化版 Agent（无工具）
"""

import sys
import argparse
from agent import GordonAgent, SimpleGordonAgent


def print_banner():
    """打印欢迎横幅"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🔥 毒舌 Gordon - 美食评论 Agent 🔥                          ║
║                                                              ║
║   "This is REAL cooking, you donkey!"                        ║
║                                                              ║
║   命令：                                                      ║
║   - 输入你的菜品描述，Gordon 会给你最真实的评价               ║
║   - 输入 'quit' 或 'exit' 退出                               ║
║   - 输入 'clear' 清空对话记忆                                 ║
║   - 输入 'history' 查看对话历史                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def main(use_simple: bool = False):
    """主函数"""
    print_banner()
    
    # 初始化 Agent
    if use_simple:
        print("📌 使用简化版 Agent（无工具调用）")
        agent = SimpleGordonAgent()
    else:
        print("📌 使用完整版 Agent（带工具调用）")
        agent = GordonAgent()
    
    print("\n准备就绪！开始和 Gordon 聊天吧...\n")
    
    while True:
        try:
            # 获取用户输入
            user_input = input("👤 你: ").strip()
            
            # 处理特殊命令
            if not user_input:
                continue
            
            if user_input.lower() in ['quit', 'exit', '退出']:
                print("\n🔥 Gordon: 走吧走吧，记得多练习！下次别让我失望！")
                break
            
            if user_input.lower() == 'clear':
                agent.clear_memory()
                print("✅ 对话记忆已清空")
                continue
            
            if user_input.lower() == 'history':
                print("\n📜 对话历史:")
                print(agent.get_conversation_history() if hasattr(agent, 'get_conversation_history') 
                      else agent.memory.get_history_string())
                print()
                continue
            
            # 获取 Agent 回复
            response = agent.chat(user_input)
            print(f"\n🔥 Gordon: {response}\n")
            
        except KeyboardInterrupt:
            print("\n\n🔥 Gordon: 什么？你要跑？胆小鬼！")
            break
        except Exception as e:
            print(f"\n❌ 发生错误: {e}")
            print("请重试...\n")


def demo():
    """演示模式 - 自动运行一些示例对话"""
    print_banner()
    print("🎬 演示模式 - 自动运行示例对话\n")
    
    agent = SimpleGordonAgent()
    
    demo_conversations = [
        "我今天尝试做了一道宫保鸡丁",
        "鸡肉有点老，而且感觉辣椒放太多了",
        "这道菜的营养价值怎么样？适合减肥吗？",
        "给我打个分吧，满分10分",
        "谢谢Gordon大厨的指导！"
    ]
    
    for user_input in demo_conversations:
        print(f"👤 你: {user_input}")
        response = agent.chat(user_input)
        print(f"🔥 Gordon: {response}\n")
        print("-" * 50 + "\n")
    
    print("🎬 演示结束！")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="毒舌 Gordon Agent")
    parser.add_argument("--simple", action="store_true", help="使用简化版 Agent")
    parser.add_argument("--demo", action="store_true", help="运行演示模式")
    
    args = parser.parse_args()
    
    if args.demo:
        demo()
    else:
        main(use_simple=args.simple)
```

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/main.py -->
<!-- questions: main.py支持哪些运行模式|用户在对话中可以使用哪些特殊命令|demo模式有什么作用 -->

## 步骤 14: 编写依赖清单 (requirements.txt)

创建 `requirements.txt` 文件：

```bash
cat > /root/AgentFramework/gordon-agent/requirements.txt << 'EOF'
# LangChain 核心
langchain>=0.1.0
langchain-core>=0.1.0
langchain-community>=0.2.0
langgraph>=0.0.20

# 智谱AI SDK
zhipuai>=2.0.0

# 工具依赖
python-dotenv>=1.0.0
pydantic>=2.0.0

# 可选：用于更好的终端体验
rich>=13.0.0
EOF
```

```bash
# 安装所有依赖
python3 -m pip install -r /root/AgentFramework/gordon-agent/requirements.txt
```

<!-- verify: file_exists:/root/AgentFramework/gordon-agent/requirements.txt -->
<!-- verify: command:python3 -m pip show zhipuai|not_empty -->
<!-- questions: 为什么需要langchain-community包|zhipuai SDK的最低版本要求是什么|rich包的作用是什么 -->

## 步骤 15: 运行项目与体验效果

### 快速启动

```bash
# 1. 确保已安装依赖
python3 -m pip install -r /root/AgentFramework/gordon-agent/requirements.txt

# 2. 配置 API Key（如果还没配置）
echo "ZHIPUAI_API_KEY=your_key_here" > /root/AgentFramework/gordon-agent/.env

# 3. 运行简化版（推荐新手）
python3 /root/AgentFramework/gordon-agent/main.py --simple

# 4. 运行完整版（带工具调用）
python3 /root/AgentFramework/gordon-agent/main.py

# 5. 运行演示模式
python3 /root/AgentFramework/gordon-agent/main.py --demo
```

### 对话示例

```
👤 你: 我今天做了一道番茄炒蛋

🔥 Gordon: 番茄炒蛋？这可是最基础的家常菜！让我猜猜，你是不是把番茄
炒成番茄酱了？还是鸡蛋炒成橡皮了？说说看，你是怎么做的？这道菜做好了
应该是番茄软烂多汁，鸡蛋嫩滑金黄。别告诉我你连这个都做不好！

👤 你: 鸡蛋有点老，番茄还挺好的

🔥 Gordon: 鸡蛋老了？Oh my God! 这是最常见的错误！你是不是把鸡蛋
一直在锅里搅啊搅？听好了：鸡蛋下锅后，等边缘凝固了再轻轻翻动，不要
像个搅拌机一样不停地搅！而且火要大，动作要快！鸡蛋在锅里的时间不能
超过30秒！明白了吗，Donkey？

👤 你: 好的大厨，那火候应该怎么控制？

🔥 Gordon: Finally! 一个好问题！火候是中餐的灵魂！番茄炒蛋要这样：
1. 先大火热锅，油温要高（筷子放进去冒泡）
2. 鸡蛋下锅后保持大火，快速成形后立刻盛出
3. 再起油锅炒番茄，中火慢慢出汁
4. 番茄出汁后倒入鸡蛋，大火快炒10秒出锅

记住：鸡蛋大火快炒，番茄中火出汁！这次给我做对了！
```

<!-- questions: 三种运行模式分别适合什么场景|完整版和简化版的对话体验有什么区别|如何判断工具调用是否生效 -->

## 步骤 16: 理解 ReAct 运行流程架构

### ReAct 运行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct Loop (Implemented)                  │
├─────────────────────────────────────────────────────────────┤
│  用户输入 → build_react_prompt → LLM 推理                     │
│     │                         │                              │
│     │                    (Action?)                           │
│     │                         │                              │
│     ├──────────────否─────────┴────────→ Final Answer         │
│     │                                                        │
│     └──────────────是────────→ 调用工具 → Observation → 继续  │
└─────────────────────────────────────────────────────────────┘
```

### ReAct 模式详解示例

```
用户输入: "这道红烧肉健康吗？"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Thought: 用户在询问红烧肉的健康问题，我需要查询营养信息      │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Action: get_nutrition_info                                  │
│ Action Input: {"dish_name": "红烧肉"}                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Observation: 热量 320kcal，脂肪 28g，高脂肪高热量...        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Thought: 我现在有了营养数据，可以给出专业评价了              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Final Answer: 红烧肉？健康？你在开玩笑吗！320大卡的热量，    │
│ 28克脂肪！这简直是心血管的噩梦！偶尔解馋可以，天天吃？      │
│ 你是想提前预约心脏科吗？！                                   │
└─────────────────────────────────────────────────────────────┘
```

<!-- questions: ReAct循环中何时结束迭代|Observation数据如何影响Final Answer|如果工具调用失败会发生什么 -->

## 步骤 17: 进阶扩展 - 添加图片识别与菜谱推荐工具

### 扩展1: 添加图片识别工具

在 `tools.py` 中添加：

```python
@tool
def analyze_food_image(image_description: str) -> str:
    """
    分析用户描述的食物图片外观。
    当用户描述他们做的菜的外观时使用。
    
    Args:
        image_description: 用户对菜品外观的描述
    
    Returns:
        基于描述的外观分析
    """
    # 关键词分析
    positive_signs = ["金黄", "光亮", "诱人", "均匀", "完整"]
    negative_signs = ["发黑", "焦糊", "散架", "油腻", "暗淡"]
    
    positive_count = sum(1 for sign in positive_signs if sign in image_description)
    negative_count = sum(1 for sign in negative_signs if sign in image_description)
    
    if positive_count > negative_count:
        return f"外观分析：看起来还不错，{positive_count}个亮点。继续保持！"
    elif negative_count > positive_count:
        return f"外观分析：有{negative_count}个问题需要改进。需要加强基本功！"
    else:
        return "外观分析：中规中矩，有提升空间。"
```

### 扩展2: 添加菜谱推荐工具

```python
@tool
def recommend_recipe(skill_level: str, available_ingredients: str) -> str:
    """
    根据厨艺水平和可用食材推荐菜谱。
    
    Args:
        skill_level: 厨艺水平，如"新手"、"进阶"、"高手"
        available_ingredients: 可用的食材列表
    
    Returns:
        推荐的菜谱和简要做法
    """
    recipes = {
        "新手": [
            {"name": "番茄炒蛋", "ingredients": ["番茄", "鸡蛋"], "time": "10分钟"},
            {"name": "蒜蓉西兰花", "ingredients": ["西兰花", "蒜"], "time": "8分钟"},
        ],
        "进阶": [
            {"name": "宫保鸡丁", "ingredients": ["鸡肉", "花生"], "time": "20分钟"},
            {"name": "鱼香肉丝", "ingredients": ["猪肉", "木耳"], "time": "25分钟"},
        ],
        "高手": [
            {"name": "松鼠桂鱼", "ingredients": ["桂鱼"], "time": "45分钟"},
            {"name": "北京烤鸭", "ingredients": ["鸭子"], "time": "3小时"},
        ]
    }
    
    level_recipes = recipes.get(skill_level, recipes["新手"])
    
    result = f"【{skill_level}级推荐菜谱】\n"
    for recipe in level_recipes:
        result += f"- {recipe['name']}（需要{recipe['time']}）\n"
    
    return result
```

添加新工具后，别忘了更新 `get_all_tools()` 函数。

<!-- questions: 如何将新工具注册到Agent中|图片识别工具的分析逻辑是什么|菜谱推荐工具如何根据水平匹配 -->

## 步骤 18: 进阶扩展 - LangGraph 状态图（可选）

使用 LangGraph 构建状态图，实现更复杂的多步骤推理流程。

> **注意**：当前项目代码未集成该部分，仅作为扩展参考。

```python
"""
使用 LangGraph 构建状态图
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Sequence
import operator


# 定义状态
class AgentState(TypedDict):
    messages: Annotated[Sequence[str], operator.add]
    current_step: str
    tool_results: dict
    final_response: str


def create_gordon_graph():
    """创建 Gordon Agent 的状态图"""
    
    workflow = StateGraph(AgentState)
    
    # 定义节点
    def perceive_node(state: AgentState) -> AgentState:
        """感知节点 - 分析输入"""
        return {"current_step": "perceive"}
    
    def reason_node(state: AgentState) -> AgentState:
        """推理节点 - LLM 推理"""
        return {"current_step": "reason"}
    
    def tool_node(state: AgentState) -> AgentState:
        """工具调用节点 - 执行工具"""
        return {"current_step": "tool"}
    
    def respond_node(state: AgentState) -> AgentState:
        """响应生成节点 - 生成最终回复"""
        return {"current_step": "respond"}
    
    # 添加节点
    workflow.add_node("perceive", perceive_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("tool", tool_node)
    workflow.add_node("respond", respond_node)
    
    # 定义条件边
    def should_use_tool(state: AgentState) -> str:
        """判断是否需要调用工具"""
        if state.get("needs_tool"):
            return "tool"
        return "respond"
    
    # 添加边
    workflow.add_edge("perceive", "reason")
    workflow.add_conditional_edges(
        "reason",
        should_use_tool,
        {"tool": "tool", "respond": "respond"}
    )
    workflow.add_edge("tool", "reason")  # 工具结果返回推理
    workflow.add_edge("respond", END)
    
    # 设置入口
    workflow.set_entry_point("perceive")
    
    return workflow.compile()
```

**LangGraph 状态图流程：**

```
perceive → reason → (需要工具?) → tool → reason → respond → END
                  → (不需要)   → respond → END
```

<!-- questions: LangGraph的StateGraph和普通ReAct循环有什么区别|状态图中的条件边如何实现分支判断|什么场景下适合使用LangGraph替代ReAct -->

## 步骤 19: 学习检查清单与课后作业

### 学习检查清单

完成本实训后，请确认你已掌握：

- [ ] 理解 ReAct（Thought-Action-Observation）的工作原理
- [ ] 能够实现 ReAct 模式的推理流程
- [ ] 知道如何使用 `@tool` 装饰器定义自定义工具
- [ ] 理解工具描述对 LLM 决策的重要性
- [ ] 能够实现基于滑动窗口的记忆系统
- [ ] 了解如何设计有效的角色提示词
- [ ] 能够使用智谱 AI GLM-4 模型 API
- [ ] 理解 Agent 的迭代执行机制

### 课后作业

1. **基础任务**：修改 Gordon 的性格，创建一个"温柔版 Gordon"——调整 `prompts.py` 中的角色人设，将毒舌风格改为温柔鼓励风格
2. **进阶任务**：添加一个新的工具，如"查询餐厅推荐"——在 `tools.py` 中新增工具并注册到 Agent
3. **挑战任务（可选）**：使用 LangGraph 实现带有分支判断的复杂工作流——参考步骤18的代码，实现完整的状态图

<!-- questions: 如何验证自己掌握了ReAct模式|温柔版Gordon需要修改哪些文件|LangGraph挑战任务的关键难点是什么 -->

## 步骤 20: 参考资料与常见问题排查

### 参考资料

| 资料 | 链接 | 优先级 |
|------|------|--------|
| LangChain 官方文档 | https://python.langchain.com/docs/ | 必读 |
| 智谱 AI 开发文档 | https://open.bigmodel.cn/dev/api | 必读 |
| ReAct 论文 | https://arxiv.org/abs/2210.03629 | 选读 |
| LangGraph 教程 | https://langchain-ai.github.io/langgraph/ | 选读 |

### 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `ValueError: 请设置 ZHIPUAI_API_KEY` | .env 文件缺失或 Key 未填写 | 检查 .env 文件，确认 API Key 正确 |
| `ModuleNotFoundError: No module named 'langchain'` | 依赖未安装 | 运行 `python3 -m pip install -r /root/AgentFramework/gordon-agent/requirements.txt` |
| `ImportError: cannot import name 'ConversationBufferWindowMemory'` | langchain 版本不兼容 | 将 `langchain_classic` 改为 `langchain.memory` 或升级版本 |
| LLM 响应全是英文 | 系统提示词缺少中文指令 | 确认 prompts.py 中包含"用中文回复" |
| 工具调用不生效 | LLM 未输出 ReAct 格式 | 检查 REACT_PROMPT 是否正确，适当降低 TEMPERATURE |
| 对话没有上下文 | 记忆系统未正确集成 | 确认 memory 被正确调用和传递 |
| `TimeoutError` | API 请求超时 | 增大 ZHIPUAI_TIMEOUT 值或检查网络 |
| 评分工具返回固定分数 | 关键词未匹配 | 检查 taste_description 是否包含映射表中的关键词 |

<!-- questions: 如何排查工具调用不生效的问题|LangChain版本不兼容时如何处理|API请求超时应该如何调整 -->
