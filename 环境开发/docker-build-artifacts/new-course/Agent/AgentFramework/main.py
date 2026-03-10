"""
main.py - 主程序入口
提供命令行交互界面
"""

import argparse
from agent import GordonAgent, SimpleGordonAgent


def print_banner():
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
    print_banner()

    if use_simple:
        print("📌 使用简化版 Agent（无工具调用）")
        agent = SimpleGordonAgent()
    else:
        print("📌 使用完整版 Agent（带工具调用）")
        agent = GordonAgent()

    print("\n准备就绪！开始和 Gordon 聊天吧...\n")

    while True:
        try:
            user_input = input("👤 你: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["quit", "exit", "退出"]:
                print("\n🔥 Gordon: 走吧走吧，记得多练习！下次别让我失望！")
                break

            if user_input.lower() == "clear":
                agent.clear_memory()
                print("✅ 对话记忆已清空")
                continue

            if user_input.lower() == "history":
                print("\n📜 对话历史:")
                print(agent.get_conversation_history()
                      if hasattr(agent, "get_conversation_history")
                      else agent.memory.get_history_string())
                print()
                continue

            response = agent.chat(user_input)
            print(f"\n🔥 Gordon: {response}\n")

        except KeyboardInterrupt:
            print("\n\n🔥 Gordon: 什么？你要跑？胆小鬼！")
            break
        except Exception as e:
            print(f"\n❌ 发生错误: {e}")
            print("请重试...\n")


def demo():
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
