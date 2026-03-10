"""
memory.py - 记忆系统模块
实现对话历史管理，保持上下文连贯性
"""

from langchain_classic.memory import ConversationBufferWindowMemory
from langchain_core.messages import HumanMessage, AIMessage
from typing import List, Dict, Any


class GordonMemory:
    """
    Gordon Agent 的记忆管理类

    使用滑动窗口策略，只保留最近 k 轮对话
    """

    def __init__(self, window_size: int = 5):
        self.window_size = window_size
        self.conversation_history: List[Dict[str, str]] = []
        self.memory = ConversationBufferWindowMemory(
            k=window_size,
            return_messages=True,
            memory_key="chat_history"
        )

    def add_user_message(self, message: str):
        self.conversation_history.append({
            "role": "user",
            "content": message
        })
        self.memory.chat_memory.add_user_message(message)
        self._trim_history()

    def add_ai_message(self, message: str):
        self.conversation_history.append({
            "role": "assistant",
            "content": message
        })
        self.memory.chat_memory.add_ai_message(message)
        self._trim_history()

    def _trim_history(self):
        max_messages = self.window_size * 2
        if len(self.conversation_history) > max_messages:
            self.conversation_history = self.conversation_history[-max_messages:]

    def get_history(self) -> List[Dict[str, str]]:
        return self.conversation_history.copy()

    def get_history_string(self) -> str:
        if not self.conversation_history:
            return "暂无对话历史"

        history_str = ""
        for msg in self.conversation_history:
            role = "用户" if msg["role"] == "user" else "Gordon"
            history_str += f"{role}: {msg['content']}\n"
        return history_str.strip()

    def get_messages(self) -> List:
        messages = []
        for msg in self.conversation_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        return messages

    def clear(self):
        self.conversation_history = []
        self.memory.clear()
        print("🧹 记忆已清空")

    def get_context_summary(self) -> str:
        if not self.conversation_history:
            return "这是新对话的开始。"

        user_messages = [m for m in self.conversation_history if m["role"] == "user"]

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
    """

    def __init__(self):
        self.messages: List[Dict[str, Any]] = []
        self.current_input: str = ""
        self.tool_calls: List[Dict[str, Any]] = []
        self.final_response: str = ""
        self.iteration_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "messages": self.messages,
            "current_input": self.current_input,
            "tool_calls": self.tool_calls,
            "final_response": self.final_response,
            "iteration_count": self.iteration_count
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationState":
        state = cls()
        state.messages = data.get("messages", [])
        state.current_input = data.get("current_input", "")
        state.tool_calls = data.get("tool_calls", [])
        state.final_response = data.get("final_response", "")
        state.iteration_count = data.get("iteration_count", 0)
        return state


if __name__ == "__main__":
    memory = GordonMemory(window_size=3)

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
