"""
workflow.py - LangGraph 工作流编排模块
将所有 Agent 编排为可执行的状态图

工作流设计说明：
1. 创意生成阶段：三个创意 Agent 顺序执行（技术→商业→用户体验）
2. 评审阶段：评审 Agent 对所有创意评分
3. 决策分支：根据轮次决定是"继续风暴"还是"进入优化"
4. 优化阶段：优化 Agent 深化 Top-K 创意
5. 汇报阶段：汇报 Agent 生成最终报告

关键概念：
- Node = Agent 节点（执行具体逻辑的函数）
- Edge = 固定连接（A 一定到 B）
- Conditional Edge = 条件分支（根据状态决定去 B 还是 C）
"""

from langgraph.graph import StateGraph, END
from state import BrainstormState
from agents import (
    tech_creative_node,
    biz_creative_node,
    ux_creative_node,
    critic_node,
    refiner_node,
    reporter_node,
)
from config import Config


# ============================================================
# 轮次控制节点
# ============================================================

def next_round_node(state: BrainstormState) -> dict:
    """
    轮次递增节点

    当评审完成且还有剩余轮次时，重置状态进入下一轮创意生成
    保留 evaluated_ideas 作为参考，清空 raw_ideas 重新收集
    """
    new_round = state.get("current_round", 1) + 1
    print(f"\n  🔄 进入第 {new_round} 轮创意风暴...")

    return {
        "current_round": new_round,
        "current_agent": "next_round",
        "raw_ideas": [],  # 清空原始池，保留 evaluated 作为参考
    }


# ============================================================
# 构建工作流图
# ============================================================

def build_brainstorm_graph():
    """
    构建创意风暴工作流图

    流程：
    START → [创意生成×3] → 评审 → (循环 or 优化) → 汇报 → END

    ┌──────────────────────────────────────────┐
    │           创意风暴工作流                    │
    ├──────────────────────────────────────────┤
    │                                          │
    │  [START]                                 │
    │     │                                    │
    │     ▼                                    │
    │  [creative_tech] ──→ [creative_biz]      │
    │                          │               │
    │                          ▼               │
    │                    [creative_ux]          │
    │                          │               │
    │                          ▼               │
    │                      [critic]            │
    │                       ╱    ╲             │
    │          round < max ╱      ╲ else       │
    │                    ╱          ╲           │
    │           [next_round]    [refiner]       │
    │               │               │          │
    │               └──→ loop      ▼           │
    │                         [reporter]       │
    │                              │           │
    │                              ▼           │
    │                            [END]         │
    └──────────────────────────────────────────┘
    """

    # 1. 创建 StateGraph，传入状态类型
    graph = StateGraph(BrainstormState)

    # 2. 添加所有节点（每个 Agent 是一个节点）
    graph.add_node("creative_tech", tech_creative_node)
    graph.add_node("creative_biz", biz_creative_node)
    graph.add_node("creative_ux", ux_creative_node)
    graph.add_node("critic", critic_node)
    graph.add_node("refiner", refiner_node)
    graph.add_node("reporter", reporter_node)
    graph.add_node("next_round", next_round_node)

    # 3. 设置入口点
    graph.set_entry_point("creative_tech")

    # 4. 添加固定边（确定性流转）
    graph.add_edge("creative_tech", "creative_biz")     # 技术 → 商业
    graph.add_edge("creative_biz", "creative_ux")       # 商业 → 用户体验
    graph.add_edge("creative_ux", "critic")             # 用户体验 → 评审

    # 5. 添加条件边（Supervisor 决策点！）
    #    这是多 Agent 系统的灵魂 —— 动态路由
    graph.add_conditional_edges(
        "critic",  # 从评审节点出发
        lambda state: "next_round"
            if state.get("current_round", 1) < Config.MAX_BRAINSTORM_ROUNDS
            else "refiner",
        {
            "next_round": "next_round",  # 还有轮次 → 继续
            "refiner": "refiner",        # 轮次用完 → 优化
        }
    )

    # 6. 循环回路：新一轮从技术创意开始
    graph.add_edge("next_round", "creative_tech")

    # 7. 收尾流程
    graph.add_edge("refiner", "reporter")   # 优化 → 汇报
    graph.add_edge("reporter", END)         # 汇报 → 结束

    # 8. 编译图（从定义态变为可执行态）
    compiled = graph.compile()

    return compiled


# 测试工作流构建
if __name__ == "__main__":
    graph = build_brainstorm_graph()
    print("✅ 工作流图构建成功")
    print(f"节点列表: {list(graph.get_graph().nodes.keys())}")
