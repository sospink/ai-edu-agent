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
