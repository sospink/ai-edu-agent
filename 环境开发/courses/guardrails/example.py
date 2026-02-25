#!/usr/bin/env python3
"""
课程6: 安全与合规 - AI 酒吧调酒师
演示 Nemo Guardrails 框架：护栏（Guardrails）系统
"""

import os
from typing import List, Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class BartenderGuardrails:
    """
    AI 酒吧调酒师的护栏系统
    
    护栏类型：
    1. 输入护栏 (Input Rails) - 检查用户输入
    2. 输出护栏 (Output Rails) - 检查 AI 输出
    3. 对话护栏 (Dialog Rails) - 控制对话流程
    4. 检索护栏 (Retrieval Rails) - 控制知识检索
    """
    
    def __init__(self):
        self.name = "AI Bartender"
        
        # API 配置
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
        self.model = os.getenv("OPENAI_MODEL", "qwen-turbo")
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
        else:
            print("⚠️  未配置 API Key，将使用模拟数据")
        
        # 定义安全规则
        self.safety_rules = {
            "age_restriction": True,  # 年龄限制
            "alcohol_limit": True,    # 酒精限制
            "health_check": True,     # 健康检查
            "responsible_serving": True  # 负责任供酒
        }
        
        # 违禁词列表
        self.blocked_topics = [
            "过量饮酒",
            "酒驾",
            "未成年饮酒",
            "孕妇饮酒",
            "药物混合"
        ]
        
        # 对话历史
        self.conversation_history = []
        
        # 用户状态追踪
        self.user_state = {
            "age_verified": False,
            "drinks_count": 0,
            "health_concerns": []
        }
    
    def input_rail(self, user_input: str) -> Dict[str, any]:
        """
        输入护栏 (Input Rails)
        检查用户输入是否安全和合规
        
        Args:
            user_input: 用户输入
            
        Returns:
            检查结果
        """
        print(f"[Input Rail] 检查用户输入...")
        
        result = {
            "allowed": True,
            "reason": None,
            "modified_input": user_input,
            "warnings": []
        }
        
        # 检查1: 违禁话题
        for topic in self.blocked_topics:
            if topic in user_input:
                result["allowed"] = False
                result["reason"] = f"检测到违禁话题: {topic}"
                return result
        
        # 检查2: 年龄验证
        if not self.user_state["age_verified"]:
            if "岁" in user_input or "年龄" in user_input:
                # 尝试提取年龄
                import re
                age_match = re.search(r'(\d+)岁', user_input)
                if age_match:
                    age = int(age_match.group(1))
                    if age < 18:
                        result["allowed"] = False
                        result["reason"] = "未满18岁，不能提供酒精饮品"
                        return result
                    else:
                        self.user_state["age_verified"] = True
                        result["warnings"].append("年龄已验证")
        
        # 检查3: 敏感词过滤
        sensitive_words = ["醉", "喝多", "不省人事"]
        for word in sensitive_words:
            if word in user_input:
                result["warnings"].append(f"检测到敏感词: {word}")
        
        return result
    
    def output_rail(self, ai_response: str) -> Dict[str, any]:
        """
        输出护栏 (Output Rails)
        检查 AI 输出是否安全和合规
        
        Args:
            ai_response: AI 生成的回复
            
        Returns:
            检查结果
        """
        print(f"[Output Rail] 检查 AI 输出...")
        
        result = {
            "allowed": True,
            "reason": None,
            "modified_response": ai_response,
            "warnings": []
        }
        
        # 检查1: 不能鼓励过量饮酒
        dangerous_phrases = ["多喝点", "再来一杯", "喝到醉"]
        for phrase in dangerous_phrases:
            if phrase in ai_response:
                result["allowed"] = False
                result["reason"] = f"输出包含危险建议: {phrase}"
                return result
        
        # 检查2: 必须包含负责任饮酒提示
        if "酒" in ai_response or "drink" in ai_response.lower():
            if "适量" not in ai_response and "responsible" not in ai_response.lower():
                result["modified_response"] = ai_response + "\n\n⚠️ 温馨提示：请适量饮酒，理性消费。"
                result["warnings"].append("添加了负责任饮酒提示")
        
        # 检查3: 不能提供医疗建议
        medical_terms = ["治疗", "药物", "疾病"]
        for term in medical_terms:
            if term in ai_response:
                result["warnings"].append(f"检测到医疗相关内容: {term}")
        
        return result
    
    def dialog_rail(self, conversation_context: List[Dict]) -> Dict[str, any]:
        """
        对话护栏 (Dialog Rails)
        控制对话流程和状态
        
        Args:
            conversation_context: 对话上下文
            
        Returns:
            对话控制结果
        """
        print(f"[Dialog Rail] 检查对话流程...")
        
        result = {
            "allowed": True,
            "action": None,
            "reason": None
        }
        
        # 检查1: 饮酒数量限制
        if self.user_state["drinks_count"] >= 3:
            result["allowed"] = False
            result["action"] = "refuse_service"
            result["reason"] = "已达到建议饮酒量上限"
            return result
        
        # 检查2: 必须先验证年龄
        if not self.user_state["age_verified"]:
            result["action"] = "request_age_verification"
            result["reason"] = "需要验证年龄"
        
        # 检查3: 对话轮次限制（防止无限对话）
        if len(conversation_context) > 20:
            result["action"] = "suggest_end"
            result["reason"] = "对话时间较长，建议结束"
        
        return result
    
    def retrieval_rail(self, query: str, retrieved_docs: List[str]) -> Dict[str, any]:
        """
        检索护栏 (Retrieval Rails)
        控制知识库检索内容
        
        Args:
            query: 检索查询
            retrieved_docs: 检索到的文档
            
        Returns:
            检索控制结果
        """
        print(f"[Retrieval Rail] 检查检索内容...")
        
        result = {
            "allowed_docs": [],
            "blocked_docs": [],
            "reason": []
        }
        
        # 过滤不适当的内容
        for doc in retrieved_docs:
            is_safe = True
            
            # 检查是否包含违禁内容
            for topic in self.blocked_topics:
                if topic in doc:
                    is_safe = False
                    result["blocked_docs"].append(doc)
                    result["reason"].append(f"文档包含违禁话题: {topic}")
                    break
            
            if is_safe:
                result["allowed_docs"].append(doc)
        
        return result
    
    def process_request(self, user_input: str) -> str:
        """
        处理用户请求（完整的护栏流程）
        
        Args:
            user_input: 用户输入
            
        Returns:
            最终回复
        """
        print("\n" + "=" * 60)
        print(f"处理请求: {user_input}")
        print("=" * 60)
        
        # 1. 输入护栏检查
        input_check = self.input_rail(user_input)
        if not input_check["allowed"]:
            return f"❌ 抱歉，{input_check['reason']}"
        
        if input_check["warnings"]:
            print(f"⚠️  输入警告: {', '.join(input_check['warnings'])}")
        
        # 2. 对话护栏检查
        dialog_check = self.dialog_rail(self.conversation_history)
        if not dialog_check["allowed"]:
            return f"❌ {dialog_check['reason']}，今天就到这里吧。"
        
        if dialog_check["action"] == "request_age_verification":
            return "🔞 在为您服务之前，我需要确认您的年龄。请问您今年多大了？"
        
        # 3. 生成 AI 回复（这里应该调用 LLM）
        ai_response = self._generate_response(user_input)
        
        # 4. 输出护栏检查
        output_check = self.output_rail(ai_response)
        if not output_check["allowed"]:
            return f"❌ 系统检测到不当内容，无法提供此回复。"
        
        if output_check["warnings"]:
            print(f"⚠️  输出警告: {', '.join(output_check['warnings'])}")
        
        # 5. 更新对话历史
        self.conversation_history.append({
            "user": user_input,
            "assistant": output_check["modified_response"],
            "timestamp": datetime.now().isoformat()
        })
        
        return output_check["modified_response"]
    
    def _generate_response(self, user_input: str) -> str:
        """生成 AI 回复"""
        if self.client:
            try:
                # 调用真实 API 生成回复
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": """你是一位专业的酒吧调酒师。你需要：
1. 友好、专业地服务客人
2. 遵守负责任供酒的原则
3. 不鼓励过量饮酒
4. 提供专业的鸡尾酒建议"""
                        },
                        {
                            "role": "user",
                            "content": user_input
                        }
                    ],
                    temperature=0.7,
                    max_tokens=150
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"⚠️  API 调用失败: {e}，使用模拟回复")
        
        # 模拟回复（当 API 不可用时）
        if "推荐" in user_input:
            self.user_state["drinks_count"] += 1
            return "我推荐您尝试莫吉托，这是一款清爽的鸡尾酒。"
        elif "年龄" in user_input or "岁" in user_input:
            return "感谢您的配合！现在我可以为您服务了。"
        else:
            return "作为专业调酒师，我很乐意为您服务。您想了解什么？"
    
    def get_guardrails_config(self) -> str:
        """
        获取 Nemo Guardrails 配置示例
        这是实际使用 Nemo Guardrails 框架时的配置格式
        """
        config = """
# Nemo Guardrails 配置示例 (config.yml)

models:
  - type: main
    engine: openai
    model: gpt-4

rails:
  input:
    flows:
      - check age verification
      - check blocked topics
      - filter sensitive content
  
  output:
    flows:
      - check dangerous advice
      - add responsible drinking notice
      - filter medical advice
  
  dialog:
    flows:
      - enforce drink limit
      - require age verification
      - limit conversation length

# 定义对话流程 (Colang)
define flow check age verification
  if not $user_age_verified
    bot ask age
    user provide age
    if $user_age < 18
      bot refuse service
      stop
    else
      $user_age_verified = True

define flow check blocked topics
  $topics = ["过量饮酒", "酒驾", "未成年饮酒"]
  if user message contains any $topics
    bot refuse and explain
    stop

define flow enforce drink limit
  if $drinks_count >= 3
    bot suggest stop drinking
    stop
"""
        return config


def main():
    """示例使用"""
    print("=" * 60)
    print("课程6: 安全与合规 - AI 酒吧调酒师")
    print("=" * 60)
    print()
    
    # 创建护栏系统
    bartender = BartenderGuardrails()
    
    # 测试场景
    test_scenarios = [
        "你好，我想喝点酒",
        "我今年25岁",
        "推荐一款鸡尾酒",
        "再来一杯",
        "我想喝到醉",  # 应该被拦截
    ]
    
    print("🧪 测试护栏系统\n")
    
    for scenario in test_scenarios:
        response = bartender.process_request(scenario)
        print(f"\n👤 用户: {scenario}")
        print(f"🤖 调酒师: {response}")
        print()
    
    # 展示配置
    print("\n" + "=" * 60)
    print("Nemo Guardrails 配置示例")
    print("=" * 60)
    print(bartender.get_guardrails_config())
    
    print("\n💡 提示:")
    print("1. Input Rails: 检查用户输入的安全性")
    print("2. Output Rails: 检查 AI 输出的合规性")
    print("3. Dialog Rails: 控制对话流程和状态")
    print("4. Retrieval Rails: 过滤知识库检索内容")
    print("5. Nemo Guardrails: 使用 Colang 定义护栏规则")
    print("6. 实际应用: 需要安装 nemoguardrails 包")


if __name__ == "__main__":
    main()
