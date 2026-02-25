#!/usr/bin/env python3
"""
课程4: 智能体框架与开发 - 毒舌 Gordon
演示单 Agent 完整架构：PRA Loop、ReAct、工具调用、记忆系统
"""

import os
import json
from typing import List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class GordonAgent:
    """
    毒舌美食评论 Agent - Gordon Ramsay 风格
    
    架构组件：
    1. Perception (感知) - 接收用户输入
    2. Reasoning (推理) - ReAct 循环
    3. Action (行动) - 工具调用
    4. Memory (记忆) - 对话历史
    """
    
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "qwen-turbo")
        
        # 初始化 OpenAI 客户端（用于调用通义千问）
        self.client = None
        if self.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url
                )
                print(f"✓ API 配置成功")
                print(f"  Base URL: {self.base_url}")
                print(f"  Model: {self.model}")
            except ImportError:
                print("⚠️  未安装 openai 包，将使用模拟数据")
                print("   安装命令: pip install openai")
        else:
            print("⚠️  未配置 API Key，将使用模拟数据")
            print("   请在 /workspace/.env 中配置 OPENAI_API_KEY")
        
        # 记忆系统 (Memory System)
        self.conversation_history = []
        self.restaurant_database = {}
        
        # 工具注册表 (Tool Registry)
        self.tools = {
            "search_restaurant": self.search_restaurant,
            "rate_dish": self.rate_dish,
            "compare_restaurants": self.compare_restaurants,
            "get_recommendation": self.get_recommendation
        }
        
        # Gordon 的性格设定
        self.personality = """你是 Gordon Ramsay，世界著名的米其林三星厨师。
你以毒舌、直率、追求完美而闻名。
评价美食时：
- 对优秀的菜品不吝赞美
- 对平庸的菜品直言不讳
- 对糟糕的菜品毫不留情
- 总是给出专业的改进建议
"""
    
    def perceive(self, user_input: str) -> Dict[str, Any]:
        """
        感知阶段 (Perception)
        解析用户输入，识别意图和实体
        
        Args:
            user_input: 用户输入的文本
            
        Returns:
            感知结果，包含意图和实体
        """
        # 简化的意图识别（实际应该用 NLU）
        perception = {
            "raw_input": user_input,
            "timestamp": datetime.now().isoformat(),
            "intent": None,
            "entities": {}
        }
        
        # 识别意图
        if "评价" in user_input or "怎么样" in user_input:
            perception["intent"] = "rate_dish"
        elif "推荐" in user_input:
            perception["intent"] = "get_recommendation"
        elif "比较" in user_input:
            perception["intent"] = "compare_restaurants"
        elif "搜索" in user_input or "查找" in user_input:
            perception["intent"] = "search_restaurant"
        else:
            perception["intent"] = "chat"
        
        return perception
    
    def reason(self, perception: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        推理阶段 (Reasoning) - ReAct 模式
        Reasoning (推理) + Acting (行动) 交替进行
        
        Args:
            perception: 感知结果
            
        Returns:
            行动计划列表
        """
        intent = perception["intent"]
        actions = []
        
        # ReAct: 根据意图规划行动
        if intent == "rate_dish":
            # Thought: 需要评价菜品
            actions.append({
                "type": "thought",
                "content": "用户想要我评价一道菜，我需要了解菜品详情"
            })
            actions.append({
                "type": "tool_call",
                "tool": "rate_dish",
                "args": {"dish_name": perception["raw_input"]}
            })
            
        elif intent == "get_recommendation":
            # Thought: 需要推荐餐厅
            actions.append({
                "type": "thought",
                "content": "用户需要餐厅推荐，我应该基于他们的偏好"
            })
            actions.append({
                "type": "tool_call",
                "tool": "get_recommendation",
                "args": {"preferences": perception["raw_input"]}
            })
            
        elif intent == "compare_restaurants":
            # Thought: 需要比较餐厅
            actions.append({
                "type": "thought",
                "content": "用户想比较餐厅，我需要获取两家餐厅的信息"
            })
            actions.append({
                "type": "tool_call",
                "tool": "compare_restaurants",
                "args": {"query": perception["raw_input"]}
            })
            
        else:
            # 普通对话
            actions.append({
                "type": "response",
                "content": "直接回复用户"
            })
        
        return actions
    
    def act(self, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        行动阶段 (Action)
        执行规划的行动，包括工具调用
        
        Args:
            actions: 行动计划列表
            
        Returns:
            行动结果列表
        """
        results = []
        
        for action in actions:
            if action["type"] == "thought":
                # 记录思考过程
                results.append({
                    "type": "thought",
                    "content": action["content"]
                })
                
            elif action["type"] == "tool_call":
                # 调用工具
                tool_name = action["tool"]
                tool_args = action["args"]
                
                if tool_name in self.tools:
                    tool_result = self.tools[tool_name](**tool_args)
                    results.append({
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": tool_result
                    })
                else:
                    results.append({
                        "type": "error",
                        "message": f"工具 {tool_name} 不存在"
                    })
                    
            elif action["type"] == "response":
                # 生成回复（这里应该调用 LLM）
                results.append({
                    "type": "response",
                    "content": "Hello! I'm Gordon Ramsay. What can I help you with?"
                })
        
        return results
    
    def update_memory(self, perception: Dict, actions: List[Dict], results: List[Dict]):
        """
        更新记忆系统 (Memory System)
        保存对话历史，用于上下文理解
        
        Args:
            perception: 感知结果
            actions: 行动计划
            results: 行动结果
        """
        memory_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_input": perception["raw_input"],
            "intent": perception["intent"],
            "actions": actions,
            "results": results
        }
        
        self.conversation_history.append(memory_entry)
        
        # 保持记忆窗口大小（最近10轮对话）
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]
    
    def run(self, user_input: str) -> str:
        """
        完整的 PRA Loop
        Perception → Reasoning → Action → Memory Update
        
        Args:
            user_input: 用户输入
            
        Returns:
            Agent 的回复
        """
        # 1. Perception (感知)
        perception = self.perceive(user_input)
        print(f"[Perception] Intent: {perception['intent']}")
        
        # 2. Reasoning (推理)
        actions = self.reason(perception)
        print(f"[Reasoning] Planned {len(actions)} actions")
        
        # 3. Action (行动)
        results = self.act(actions)
        print(f"[Action] Executed {len(results)} actions")
        
        # 4. Memory Update (记忆更新)
        self.update_memory(perception, actions, results)
        print(f"[Memory] Updated (Total: {len(self.conversation_history)} entries)")
        
        # 生成最终回复
        response = self._generate_response(results)
        return response
    
    def _generate_response(self, results: List[Dict]) -> str:
        """根据行动结果生成回复"""
        response_parts = []
        
        for result in results:
            if result["type"] == "thought":
                response_parts.append(f"💭 {result['content']}")
            elif result["type"] == "tool_result":
                response_parts.append(f"🔧 {result['tool']}: {result['result']}")
            elif result["type"] == "response":
                response_parts.append(result["content"])
            elif result["type"] == "error":
                response_parts.append(f"❌ {result['message']}")
        
        return "\n".join(response_parts)
    
    # ========== 工具函数 (Tools) ==========
    
    def search_restaurant(self, query: str) -> str:
        """搜索餐厅"""
        return f"搜索餐厅: {query} (模拟结果)"
    
    def rate_dish(self, dish_name: str) -> str:
        """评价菜品 - Gordon 风格"""
        # 提取菜品名称
        dish_to_rate = dish_name
        if "评价" in dish_name:
            # 从"评价一下这道意大利面"中提取"意大利面"
            parts = dish_name.split("评价")
            if len(parts) > 1:
                dish_to_rate = parts[-1].replace("一下", "").replace("这道", "").strip()
        
        if self.client:
            try:
                # 调用真实 API 生成 Gordon 风格的评价
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": self.personality
                        },
                        {
                            "role": "user",
                            "content": f"请评价这道菜：{dish_to_rate}"
                        }
                    ],
                    temperature=0.9,
                    max_tokens=200
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"⚠️  API 调用失败: {e}")
                print("   使用模拟数据...")
        
        # 模拟数据（当 API 不可用时）
        ratings = [
            f"Bloody hell! This {dish_to_rate} is absolutely DISGUSTING!",
            f"This {dish_to_rate} is RAW! It's still moving!",
            f"Finally, some good food! This {dish_to_rate} is delicious!",
            f"This {dish_to_rate} is bland, boring, and utterly disappointing."
        ]
        import random
        return random.choice(ratings)
    
    def compare_restaurants(self, query: str) -> str:
        """比较餐厅"""
        return f"比较餐厅: {query} (模拟结果)"
    
    def get_recommendation(self, preferences: str) -> str:
        """获取推荐"""
        return f"基于偏好 '{preferences}' 的推荐 (模拟结果)"


def main():
    """示例使用"""
    print("=" * 60)
    print("课程4: 智能体框架与开发 - 毒舌 Gordon")
    print("=" * 60)
    print()
    
    # 创建 Agent
    gordon = GordonAgent()
    
    # 示例对话
    test_inputs = [
        "评价一下这道意大利面",
        "推荐一家好的法餐厅",
        "比较一下海底捞和呷哺呷哺"
    ]
    
    for i, user_input in enumerate(test_inputs, 1):
        print(f"\n{'='*60}")
        print(f"示例 {i}: {user_input}")
        print(f"{'='*60}\n")
        
        response = gordon.run(user_input)
        print(f"\n[Gordon]: {response}\n")
    
    # 展示记忆系统
    print("\n" + "=" * 60)
    print("记忆系统 (Conversation History)")
    print("=" * 60)
    print(json.dumps(gordon.conversation_history, indent=2, ensure_ascii=False))
    
    print("\n💡 提示:")
    print("1. PRA Loop: Perception → Reasoning → Action")
    print("2. ReAct: Reasoning 和 Acting 交替进行")
    print("3. 工具调用: Agent 可以调用外部工具")
    print("4. 记忆系统: 保存对话历史，提供上下文")


if __name__ == "__main__":
    main()
