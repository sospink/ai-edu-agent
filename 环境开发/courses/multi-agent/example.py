#!/usr/bin/env python3
"""
课程5: 智能体框架与开发 - 创意风暴
演示多 Agent 协作：LangGraph + 多 Agent 系统 (MAS)
"""

import os
from typing import List, Dict, TypedDict, Annotated
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# 定义状态类型
class BrainstormState(TypedDict):
    """头脑风暴的状态"""
    topic: str
    ideas: List[Dict[str, str]]
    critiques: List[Dict[str, str]]
    refined_ideas: List[Dict[str, str]]
    final_report: str
    current_step: str


class CreativeAgent:
    """创意生成 Agent - 负责产生创意想法"""
    
    def __init__(self, name: str = "Creative"):
        self.name = name
        self.role = "创意生成者"
        
        # 初始化 API 客户端
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
            except ImportError:
                pass
    
    def generate_ideas(self, topic: str, count: int = 3) -> List[Dict[str, str]]:
        """
        生成创意想法
        
        Args:
            topic: 头脑风暴主题
            count: 生成想法数量
            
        Returns:
            创意想法列表
        """
        print(f"[{self.name}] 正在为主题 '{topic}' 生成 {count} 个创意...")
        
        ideas = []
        
        if self.client:
            try:
                # 调用真实 API 生成创意
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "你是一位富有创造力的创意专家，擅长头脑风暴和创新思维。"
                        },
                        {
                            "role": "user",
                            "content": f"请为主题「{topic}」生成{count}个创新的想法，每个想法用一句话描述。"
                        }
                    ],
                    temperature=0.9,
                    max_tokens=300
                )
                
                # 解析 API 返回的创意
                content = response.choices[0].message.content
                lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
                
                for i, line in enumerate(lines[:count], 1):
                    # 移除序号前缀
                    clean_line = line
                    for prefix in [f"{i}.", f"{i}、", f"**{i}.**", f"**{i}、**"]:
                        if clean_line.startswith(prefix):
                            clean_line = clean_line[len(prefix):].strip()
                    
                    ideas.append({
                        "id": f"idea_{i}",
                        "content": clean_line,
                        "author": self.name,
                        "timestamp": datetime.now().isoformat()
                    })
                
                # 如果解析的创意不够，补充模拟数据
                while len(ideas) < count:
                    i = len(ideas) + 1
                    ideas.append({
                        "id": f"idea_{i}",
                        "content": f"关于 '{topic}' 的创意想法 #{i}",
                        "author": self.name,
                        "timestamp": datetime.now().isoformat()
                    })
                
                return ideas[:count]
                
            except Exception as e:
                print(f"⚠️  API 调用失败: {e}，使用模拟数据")
        
        # 模拟数据（当 API 不可用时）
        for i in range(count):
            ideas.append({
                "id": f"idea_{i+1}",
                "content": f"关于 '{topic}' 的创意想法 #{i+1}",
                "author": self.name,
                "timestamp": datetime.now().isoformat()
            })
        
        return ideas


class CriticAgent:
    """批评家 Agent - 负责评估和批评想法"""
    
    def __init__(self, name: str = "Critic"):
        self.name = name
        self.role = "批评家"
    
    def critique_ideas(self, ideas: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        评估创意想法
        
        Args:
            ideas: 待评估的想法列表
            
        Returns:
            批评意见列表
        """
        print(f"[{self.name}] 正在评估 {len(ideas)} 个创意...")
        
        critiques = []
        for idea in ideas:
            critiques.append({
                "idea_id": idea["id"],
                "critique": f"对 {idea['id']} 的批评：需要更具体的实施方案",
                "score": 7,  # 1-10 分
                "author": self.name,
                "timestamp": datetime.now().isoformat()
            })
        
        return critiques


class RefinerAgent:
    """优化者 Agent - 负责改进和优化想法"""
    
    def __init__(self, name: str = "Refiner"):
        self.name = name
        self.role = "优化者"
    
    def refine_ideas(
        self,
        ideas: List[Dict[str, str]],
        critiques: List[Dict[str, str]]
    ) -> List[Dict[str, str]]:
        """
        根据批评意见优化想法
        
        Args:
            ideas: 原始想法列表
            critiques: 批评意见列表
            
        Returns:
            优化后的想法列表
        """
        print(f"[{self.name}] 正在优化 {len(ideas)} 个创意...")
        
        refined = []
        for idea in ideas:
            # 找到对应的批评
            critique = next(
                (c for c in critiques if c["idea_id"] == idea["id"]),
                None
            )
            
            refined.append({
                "id": idea["id"],
                "original": idea["content"],
                "refined": f"{idea['content']} (已优化：增加了具体实施方案)",
                "improvements": ["增加可行性", "细化步骤", "考虑资源"],
                "author": self.name,
                "timestamp": datetime.now().isoformat()
            })
        
        return refined


class SummarizerAgent:
    """总结者 Agent - 负责生成最终报告"""
    
    def __init__(self, name: str = "Summarizer"):
        self.name = name
        self.role = "总结者"
    
    def generate_report(self, state: BrainstormState) -> str:
        """
        生成头脑风暴报告
        
        Args:
            state: 完整的头脑风暴状态
            
        Returns:
            最终报告
        """
        print(f"[{self.name}] 正在生成最终报告...")
        
        report = f"""
# 头脑风暴报告

## 主题
{state['topic']}

## 原始创意 ({len(state['ideas'])} 个)
"""
        for idea in state['ideas']:
            report += f"- {idea['content']}\n"
        
        report += f"\n## 批评意见 ({len(state['critiques'])} 条)\n"
        for critique in state['critiques']:
            report += f"- {critique['critique']} (评分: {critique['score']}/10)\n"
        
        report += f"\n## 优化后的创意 ({len(state['refined_ideas'])} 个)\n"
        for refined in state['refined_ideas']:
            report += f"- {refined['refined']}\n"
            report += f"  改进点: {', '.join(refined['improvements'])}\n"
        
        report += f"\n## 总结\n"
        report += f"通过多 Agent 协作，我们从 {len(state['ideas'])} 个初始创意出发，"
        report += f"经过批评和优化，得到了 {len(state['refined_ideas'])} 个高质量的方案。\n"
        
        return report


class BrainstormOrchestrator:
    """
    头脑风暴编排器 - 使用 LangGraph 风格的状态机
    协调多个 Agent 的工作流程
    """
    
    def __init__(self):
        # 创建各个 Agent
        self.creative = CreativeAgent()
        self.critic = CriticAgent()
        self.refiner = RefinerAgent()
        self.summarizer = SummarizerAgent()
        
        # 定义工作流程图
        self.workflow = {
            "start": "generate_ideas",
            "generate_ideas": "critique_ideas",
            "critique_ideas": "refine_ideas",
            "refine_ideas": "generate_report",
            "generate_report": "end"
        }
    
    def run(self, topic: str) -> str:
        """
        运行完整的头脑风暴流程
        
        Args:
            topic: 头脑风暴主题
            
        Returns:
            最终报告
        """
        print("=" * 60)
        print(f"开始头脑风暴: {topic}")
        print("=" * 60)
        print()
        
        # 初始化状态
        state: BrainstormState = {
            "topic": topic,
            "ideas": [],
            "critiques": [],
            "refined_ideas": [],
            "final_report": "",
            "current_step": "start"
        }
        
        # 执行工作流
        while state["current_step"] != "end":
            current_step = state["current_step"]
            next_step = self.workflow[current_step]
            
            print(f"\n{'='*60}")
            print(f"步骤: {current_step} → {next_step}")
            print(f"{'='*60}\n")
            
            # 执行对应的步骤
            if next_step == "generate_ideas":
                state["ideas"] = self.creative.generate_ideas(state["topic"])
                state["current_step"] = next_step
                
            elif next_step == "critique_ideas":
                state["critiques"] = self.critic.critique_ideas(state["ideas"])
                state["current_step"] = next_step
                
            elif next_step == "refine_ideas":
                state["refined_ideas"] = self.refiner.refine_ideas(
                    state["ideas"],
                    state["critiques"]
                )
                state["current_step"] = next_step
                
            elif next_step == "generate_report":
                state["final_report"] = self.summarizer.generate_report(state)
                state["current_step"] = next_step
                
            elif next_step == "end":
                state["current_step"] = "end"
        
        print("\n" + "=" * 60)
        print("头脑风暴完成!")
        print("=" * 60)
        
        return state["final_report"]
    
    def visualize_workflow(self) -> str:
        """可视化工作流程"""
        viz = """
工作流程图 (LangGraph 风格):

    [Start]
       ↓
[Creative Agent]  ← 生成创意
       ↓
[Critic Agent]    ← 评估批评
       ↓
[Refiner Agent]   ← 优化改进
       ↓
[Summarizer Agent] ← 生成报告
       ↓
    [End]

Agent 协作模式:
- Sequential (顺序): 一个接一个执行
- Parallel (并行): 可以同时执行多个 Agent
- Conditional (条件): 根据结果决定下一步
- Loop (循环): 可以重复某些步骤
"""
        return viz


def main():
    """示例使用"""
    print("=" * 60)
    print("课程5: 智能体框架与开发 - 创意风暴")
    print("=" * 60)
    print()
    
    # 创建编排器
    orchestrator = BrainstormOrchestrator()
    
    # 可视化工作流
    print(orchestrator.visualize_workflow())
    print()
    
    # 运行头脑风暴
    topic = "如何提高团队协作效率"
    report = orchestrator.run(topic)
    
    # 输出最终报告
    print("\n" + "=" * 60)
    print("最终报告")
    print("=" * 60)
    print(report)
    
    print("\n💡 提示:")
    print("1. 多 Agent 系统 (MAS): 多个 Agent 协作完成任务")
    print("2. LangGraph: 使用状态机编排 Agent 工作流")
    print("3. 协作模式: Sequential, Parallel, Conditional, Loop")
    print("4. 状态管理: 使用 TypedDict 定义状态结构")
    print("5. 实际应用: 需要接入 LLM API 生成真实内容")


if __name__ == "__main__":
    main()
