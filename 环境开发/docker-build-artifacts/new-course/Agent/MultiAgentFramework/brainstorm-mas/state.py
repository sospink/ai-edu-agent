"""
state.py - 共享状态定义模块
定义多 Agent 系统中流转的全局状态

设计说明：
1. State 是所有 Agent 的"数据契约"
2. 每个 Agent 读取 State 获取输入，写入 State 传递输出
3. 区分"过程数据"和"控制流"是良好的工程实践
"""

from typing import TypedDict, Annotated, List, Optional
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class IdeaItem(TypedDict):
    """单条创意数据结构"""
    id: str                    # 创意编号
    perspective: str           # 来源视角（技术/商业/用户）
    title: str                 # 创意标题
    description: str           # 创意描述
    score: Optional[float]     # 评审分数（0-10）
    feedback: Optional[str]    # 评审反馈


class BrainstormState(TypedDict):
    """
    创意风暴全局状态 - 所有 Agent 共享

    类比：这就像会议室的白板，
    每个参会者（Agent）都可以在上面写东西、看别人写的东西
    """

    # --- 输入 ---
    topic: str                                  # 创意主题
    requirements: str                           # 补充需求

    # --- 过程数据 ---
    messages: Annotated[list[BaseMessage], add_messages]  # 对话历史（自动累加）
    raw_ideas: List[IdeaItem]                   # 原始创意池
    evaluated_ideas: List[IdeaItem]             # 评审后的创意（含分数）
    refined_ideas: List[IdeaItem]               # 优化后的创意

    # --- 控制流 ---
    current_round: int                          # 当前轮次
    current_agent: str                          # 当前执行的 Agent

    # --- 输出 ---
    final_report: str                           # 最终报告


# 测试状态结构
if __name__ == "__main__":
    # 创建一个示例状态
    test_state = BrainstormState(
        topic="AI 驱动的个性化教育平台",
        requirements="面向高职院校学生",
        messages=[],
        raw_ideas=[],
        evaluated_ideas=[],
        refined_ideas=[],
        current_round=1,
        current_agent="",
        final_report="",
    )
    print("✅ 状态结构定义正确")
    print(f"主题: {test_state['topic']}")
