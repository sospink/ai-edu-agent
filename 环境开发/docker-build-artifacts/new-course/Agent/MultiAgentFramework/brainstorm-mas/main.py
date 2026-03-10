"""
main.py - 主程序入口
提供命令行交互界面和 API 服务两种启动方式

使用方法：
    python main.py           # 命令行交互模式
    python main.py --api     # 启动 FastAPI 服务
    python main.py --demo    # 运行演示（使用默认主题）
"""

import sys
import argparse
from config import Config
from workflow import build_brainstorm_graph


def print_banner():
    """打印欢迎横幅"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🧠 创意风暴 - 多 Agent 协作系统 🧠                         ║
║                                                              ║
║   "一个人的灵感有限，一群 Agent 的创意无限"                   ║
║                                                              ║
║   角色阵容：                                                  ║
║   🔧 技术创意 Agent    💰 商业创意 Agent    🎨 用户体验 Agent ║
║   📝 评审 Agent        ✨ 优化 Agent        📊 汇报 Agent    ║
║                                                              ║
║   命令：                                                      ║
║   - 输入创意主题，系统将自动完成多轮风暴                      ║
║   - 输入 'quit' 或 'exit' 退出                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def run_brainstorm(topic: str, requirements: str = ""):
    """
    执行一次完整的创意风暴（命令行版）
    """
    # 初始化状态
    initial_state = {
        "topic": topic,
        "requirements": requirements,
        "messages": [],
        "raw_ideas": [],
        "evaluated_ideas": [],
        "refined_ideas": [],
        "current_round": 1,
        "current_agent": "",
        "final_report": "",
    }

    # 编译工作流
    graph = build_brainstorm_graph()

    # 流式执行，实时观察每个 Agent 的工作
    print(f"\n{'='*60}")
    print(f"🚀 主题：{topic}")
    print(f"📋 需求：{requirements or '无'}")
    print(f"{'='*60}")

    step_emojis = {
        "creative_tech": "🔧 技术创意",
        "creative_biz":  "💰 商业创意",
        "creative_ux":   "🎨 用户体验",
        "critic":        "📝 评审打分",
        "refiner":       "✨ 方案优化",
        "reporter":      "📊 报告生成",
        "next_round":    "🔄 新一轮",
    }

    final_state = None

    for event in graph.stream(initial_state):
        for node_name, node_output in event.items():
            label = step_emojis.get(node_name, f"⚙️ {node_name}")
            print(f"\n{'─'*40}")
            print(f"  {label} 完成")

            # 打印关键信息
            if "raw_ideas" in node_output and node_output["raw_ideas"]:
                for idea in node_output["raw_ideas"][-3:]:
                    print(f"    💡 {idea.get('title', '?')}")

            if "evaluated_ideas" in node_output:
                for idea in node_output["evaluated_ideas"][:3]:
                    print(f"    ⭐ {idea.get('title', '?')} — {idea.get('score', '?')}分")

            if "final_report" in node_output:
                final_state = node_output

    # 输出最终报告
    if final_state and final_state.get("final_report"):
        print(f"\n{'='*60}")
        print("📊 最终创意报告")
        print(f"{'='*60}")
        print(final_state["final_report"])

    print(f"\n{'='*60}")
    print("✅ 创意风暴完成！")
    print(f"{'='*60}")


def main():
    """命令行交互主函数"""
    print_banner()
    Config.validate()

    print("\n准备就绪！输入创意主题开始风暴...\n")

    while True:
        try:
            topic = input("📌 创意主题: ").strip()

            if not topic:
                continue

            if topic.lower() in ['quit', 'exit', '退出']:
                print("\n🧠 创意不灭，下次再来！")
                break

            requirements = input("📋 补充需求（回车跳过）: ").strip()

            run_brainstorm(topic, requirements)
            print()

        except KeyboardInterrupt:
            print("\n\n🧠 创意风暴中断，下次继续！")
            break
        except Exception as e:
            print(f"\n❌ 发生错误: {e}")
            print("请重试...\n")


def demo():
    """演示模式 - 使用默认主题自动运行"""
    print_banner()
    Config.validate()

    print("🎬 演示模式 - 使用默认主题自动运行\n")

    run_brainstorm(
        topic="基于 AI Agent 的智能课程推荐系统",
        requirements="面向高职院校学生，需要考虑个性化学习路径",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创意风暴 - 多 Agent 协作系统")
    parser.add_argument("--api", action="store_true", help="启动 FastAPI 服务")
    parser.add_argument("--demo", action="store_true", help="运行演示模式")

    args = parser.parse_args()

    if args.api:
        import uvicorn
        print("🌐 启动 FastAPI 服务...")
        uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
    elif args.demo:
        demo()
    else:
        main()
