"""
agents.py - 多 Agent 定义模块
定义创意风暴系统中的所有 Agent 角色

Agent 角色设计说明：
1. 创意 Agent（×3）：从不同视角生成创意方案
2. 评审 Agent：对所有创意进行评分筛选
3. 优化 Agent：对 Top-K 创意进行深化完善
4. 汇报 Agent：生成最终的创意报告

每个 Agent 本质上是一个【System Prompt + LLM 调用 + 输出解析】的组合
"""

from zhipuai import ZhipuAI
from typing import List
from state import BrainstormState, IdeaItem
from config import Config
import json
import uuid


# ============================================================
# LLM 调用工具函数
# ============================================================

def call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    """
    统一的 LLM 调用函数

    Args:
        system_prompt: 角色设定提示词
        user_prompt: 用户/任务提示词
        temperature: 温度参数（创意高、评审低）

    Returns:
        LLM 的文本回复
    """
    client = ZhipuAI(api_key=Config.ZHIPUAI_API_KEY)

    try:
        response = client.chat.completions.create(
            model=Config.MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=Config.MAX_TOKENS,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ LLM 调用失败: {e}")
        return f"[LLM 错误] {str(e)}"


def parse_json_from_llm(content: str) -> list:
    """
    从 LLM 输出中提取 JSON

    LLM 输出不总是规范的 JSON，需要做兜底处理
    """
    try:
        json_str = content
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        return json.loads(json_str.strip())
    except (json.JSONDecodeError, IndexError):
        return []


# ============================================================
# 创意 Agent - 角色提示词
# ============================================================

CREATIVE_PROMPTS = {
    "技术可行性": """你是一位资深技术架构师，擅长从技术可行性角度思考创新方案。

你的思考维度：
- 现有技术栈能否支撑？需要哪些新技术？
- 技术实现的难度和周期如何？
- 是否有开源方案可以借鉴？
- 技术风险点在哪里？

请针对给定主题，提出 2-3 个具有技术创新性的创意方案。""",

    "商业价值": """你是一位敏锐的商业分析师，擅长从市场和商业价值角度评估创新机会。

你的思考维度：
- 目标用户群体是谁？市场规模多大？
- 商业模式是什么？如何变现？
- 竞品分析：有没有类似产品？差异化在哪？
- 投入产出比如何？

请针对给定主题，提出 2-3 个具有商业潜力的创意方案。""",

    "用户体验": """你是一位用户体验设计专家，擅长从终端用户的真实需求出发思考产品创新。

你的思考维度：
- 用户的核心痛点是什么？
- 使用场景是怎样的？
- 交互体验如何降低使用门槛？
- 用户的情感需求是什么？

请针对给定主题，提出 2-3 个以用户为中心的创意方案。""",
}

CREATIVE_OUTPUT_FORMAT = """
请严格按照以下 JSON 格式输出（不要输出其他内容）：

```json
[
  {
    "title": "创意标题",
    "description": "详细描述（100-200字）"
  }
]
```
"""


# ============================================================
# 创意 Agent 节点函数
# ============================================================

def create_creative_node(perspective: str):
    """
    工厂函数：为指定视角创建创意 Agent 节点

    设计模式说明：
    使用闭包捕获 perspective 参数，避免为每个视角写重复代码
    这和实训一中的单 Agent 不同——这里是"同一模板，不同角色"

    Args:
        perspective: 创意视角名称

    Returns:
        可被 LangGraph 调用的节点函数
    """

    def creative_node(state: BrainstormState) -> dict:
        print(f"  💡 [{perspective}] 创意 Agent 开始工作...")

        system_prompt = CREATIVE_PROMPTS[perspective] + CREATIVE_OUTPUT_FORMAT

        # 构造任务上下文
        context = f"创意主题：{state['topic']}\n补充需求：{state['requirements']}"

        # 如果不是第一轮，加入上轮评审反馈作为参考
        if state.get("evaluated_ideas"):
            top_ideas = [i for i in state["evaluated_ideas"] if (i.get("score") or 0) >= 7]
            if top_ideas:
                context += "\n\n上轮高分创意供参考（请在此基础上发散新思路，不要重复）：\n"
                for idea in top_ideas:
                    context += f"- {idea['title']}（{idea.get('score', 'N/A')}分）\n"

        # 调用 LLM
        response = call_llm(system_prompt, context, Config.CREATIVE_TEMPERATURE)

        # 解析输出为结构化创意
        parsed = parse_json_from_llm(response)
        new_ideas = []
        for item in parsed:
            new_ideas.append(IdeaItem(
                id=str(uuid.uuid4())[:8],
                perspective=perspective,
                title=item.get("title", "未命名创意"),
                description=item.get("description", ""),
                score=None,
                feedback=None,
            ))

        # 解析失败的兜底
        if not new_ideas:
            new_ideas.append(IdeaItem(
                id=str(uuid.uuid4())[:8],
                perspective=perspective,
                title=f"[解析失败] {perspective}视角创意",
                description=response[:500],
                score=None,
                feedback=None,
            ))

        # 追加到创意池（注意是追加，不是覆盖）
        existing = state.get("raw_ideas", [])

        print(f"  ✅ [{perspective}] 产出 {len(new_ideas)} 条创意")

        return {
            "raw_ideas": existing + new_ideas,
            "current_agent": f"creative_{perspective}",
        }

    return creative_node


# 创建三个视角的创意节点
tech_creative_node = create_creative_node("技术可行性")
biz_creative_node = create_creative_node("商业价值")
ux_creative_node = create_creative_node("用户体验")


# ============================================================
# 评审 Agent
# ============================================================

CRITIC_SYSTEM_PROMPT = """你是一位严格但公正的创意评审专家。你的任务是对每一条创意方案进行评分和点评。

评分维度（每项 1-10 分，取平均）：
1. **创新性**：方案是否有新意？是否区别于常见做法？
2. **可行性**：以当前技术和资源，能否在6个月内落地？
3. **影响力**：如果成功实施，能带来多大的价值？
4. **完整性**：方案描述是否清晰、逻辑是否自洽？

请严格按照以下 JSON 格式输出评审结果：

```json
[
  {
    "id": "创意的原始id",
    "score": 8.5,
    "feedback": "简要点评（50字以内）"
  }
]
```

注意：评分要有区分度，不要都给高分或都给低分。feedback 要具体指出优点或不足。
"""


def critic_node(state: BrainstormState) -> dict:
    """
    评审 Agent 节点：对所有原始创意评分

    类比：这是头脑风暴会议中的"评委环节"
    评审需要高确定性，所以 temperature 设为 0.3
    """
    print("  📝 评审 Agent 开始工作...")

    raw_ideas = state.get("raw_ideas", [])
    if not raw_ideas:
        return {"evaluated_ideas": [], "current_agent": "critic"}

    # 构造评审输入
    ideas_text = ""
    for idea in raw_ideas:
        ideas_text += f"\n--- 创意 {idea['id']} [{idea['perspective']}视角] ---\n"
        ideas_text += f"标题：{idea['title']}\n"
        ideas_text += f"描述：{idea['description']}\n"

    user_prompt = f"创意主题：{state['topic']}\n\n以下是待评审的创意方案：\n{ideas_text}"

    response = call_llm(CRITIC_SYSTEM_PROMPT, user_prompt, Config.CRITIC_TEMPERATURE)

    # 解析评审结果并合并到创意中
    scores_list = parse_json_from_llm(response)
    scores_map = {item["id"]: item for item in scores_list} if scores_list else {}

    evaluated = []
    for idea in raw_ideas:
        score_info = scores_map.get(idea["id"], {})
        evaluated.append(IdeaItem(
            id=idea["id"],
            perspective=idea["perspective"],
            title=idea["title"],
            description=idea["description"],
            score=score_info.get("score", 5.0),
            feedback=score_info.get("feedback", "评审数据解析失败，给予默认分数"),
        ))

    # 按分数降序排列
    evaluated.sort(key=lambda x: x.get("score") or 0, reverse=True)

    print(f"  ✅ 评审完成，最高分 {evaluated[0].get('score', '?')} 分")

    return {
        "evaluated_ideas": evaluated,
        "current_agent": "critic",
    }


# ============================================================
# 优化 Agent
# ============================================================

REFINER_SYSTEM_PROMPT = """你是一位资深产品优化专家。你的任务是对已通过评审的优秀创意进行深化完善。

对每个创意，你需要：
1. **补充方案细节**：将概念级描述扩展为可执行的方案
2. **融合多视角优势**：如果不同视角有互补的创意，尝试融合
3. **预判风险**：指出潜在问题和应对策略
4. **明确下一步**：给出具体的 MVP（最小可行产品）建议

请严格按照以下 JSON 格式输出：

```json
[
  {
    "id": "原始创意id",
    "title": "优化后的标题",
    "description": "深化后的方案描述（200-400字）",
    "risks": "主要风险与应对（100字以内）",
    "mvp_plan": "MVP建议（100字以内）"
  }
]
```
"""


def refiner_node(state: BrainstormState) -> dict:
    """
    优化 Agent 节点：对 Top-K 创意进行深化

    类比：会议中的"方案深化环节"，从创意变为可执行方案
    """
    print("  ✨ 优化 Agent 开始工作...")

    evaluated = state.get("evaluated_ideas", [])
    top_ideas = evaluated[:Config.TOP_K_IDEAS]

    if not top_ideas:
        return {"refined_ideas": [], "current_agent": "refiner"}

    ideas_text = ""
    for idea in top_ideas:
        ideas_text += f"\n--- {idea['id']} [{idea['perspective']}] 评分：{idea.get('score', 'N/A')} ---\n"
        ideas_text += f"标题：{idea['title']}\n"
        ideas_text += f"描述：{idea['description']}\n"
        ideas_text += f"评审反馈：{idea.get('feedback', '无')}\n"

    user_prompt = f"创意主题：{state['topic']}\n\n以下是通过评审的 Top 创意：\n{ideas_text}"

    response = call_llm(REFINER_SYSTEM_PROMPT, user_prompt, Config.REFINER_TEMPERATURE)

    # 解析优化结果
    parsed = parse_json_from_llm(response)
    refined = []
    if parsed:
        for item in parsed:
            original = next((i for i in top_ideas if i["id"] == item.get("id")), {})
            refined.append({
                **original,
                "title": item.get("title", original.get("title", "")),
                "description": item.get("description", original.get("description", "")),
                "risks": item.get("risks", ""),
                "mvp_plan": item.get("mvp_plan", ""),
            })
    else:
        refined = top_ideas  # 解析失败则返回原始创意

    print(f"  ✅ 优化了 {len(refined)} 条创意")

    return {
        "refined_ideas": refined,
        "current_agent": "refiner",
    }


# ============================================================
# 汇报 Agent
# ============================================================

REPORTER_SYSTEM_PROMPT = """你是一位专业的商业报告撰写者。请将创意风暴的成果整理为一份结构清晰的创意报告。

报告格式要求：
1. **概述**：一句话总结本次创意风暴的主题和成果
2. **推荐方案**：按优先级排列，每个方案包含标题、描述、优势、风险和 MVP 计划
3. **综合建议**：从整体角度给出实施建议

使用 Markdown 格式输出报告。报告应专业、简洁、可直接用于汇报。
"""


def reporter_node(state: BrainstormState) -> dict:
    """
    汇报 Agent 节点：生成最终报告

    类比：会议结束时的"纪要整理"环节
    """
    print("  📊 汇报 Agent 开始工作...")

    refined = state.get("refined_ideas", [])
    evaluated = state.get("evaluated_ideas", [])
    ideas_to_report = refined if refined else evaluated

    if not ideas_to_report:
        return {
            "final_report": "## 创意风暴报告\n\n本次风暴未产生有效创意，建议调整主题后重新进行。",
            "current_agent": "reporter",
        }

    ideas_text = ""
    for i, idea in enumerate(ideas_to_report, 1):
        ideas_text += f"\n### 方案 {i}：{idea.get('title', '未命名')}\n"
        ideas_text += f"- 视角：{idea.get('perspective', '综合')}\n"
        ideas_text += f"- 评分：{idea.get('score', 'N/A')}\n"
        ideas_text += f"- 描述：{idea.get('description', '')}\n"
        ideas_text += f"- 风险：{idea.get('risks', '待评估')}\n"
        ideas_text += f"- MVP：{idea.get('mvp_plan', '待规划')}\n"

    user_prompt = (
        f"创意主题：{state['topic']}\n"
        f"补充需求：{state['requirements']}\n"
        f"风暴轮次：{state.get('current_round', 1)}\n"
        f"参与创意总数：{len(state.get('raw_ideas', []))}\n"
        f"\n以下是经过评审和优化的最终方案：\n{ideas_text}"
    )

    response = call_llm(REPORTER_SYSTEM_PROMPT, user_prompt, Config.REPORTER_TEMPERATURE)

    print("  ✅ 报告生成完成")

    return {
        "final_report": response,
        "current_agent": "reporter",
    }


# ============================================================
# 测试所有 Agent
# ============================================================

if __name__ == "__main__":
    Config.validate()

    print("=== 测试创意 Agent（技术视角）===")
    test_state = BrainstormState(
        topic="AI 智能课程推荐系统",
        requirements="面向高职院校",
        messages=[], raw_ideas=[], evaluated_ideas=[],
        refined_ideas=[], current_round=1,
        current_agent="", final_report="",
    )
    result = tech_creative_node(test_state)
    for idea in result["raw_ideas"]:
        print(f"  💡 {idea['title']}")
