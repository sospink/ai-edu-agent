#!/usr/bin/env python3
"""
课程1: 提示词工程 - 万能文案生成器
演示五大工程化原则：模块化、参数化、版本化、可测试、可观测
"""

import os
from typing import Dict, List
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class ContentGenerator:
    """万能文案生成器 - 展示提示词工程化原则"""
    
    # 版本化 (Versioning)
    VERSION = "1.0.0"
    
    # 模块化 (Modularity) - 将提示词拆分为可复用的模块
    TONE_MODULES = {
        "professional": "使用专业、正式的语气",
        "casual": "使用轻松、随意的语气",
        "humorous": "使用幽默、风趣的语气",
        "emotional": "使用感性、温暖的语气"
    }
    
    PLATFORM_MODULES = {
        "xiaohongshu": "小红书风格：使用emoji、分段清晰、标题吸睛",
        "weibo": "微博风格：简洁有力、话题标签、互动性强",
        "wechat": "微信公众号风格：段落分明、逻辑清晰、引导关注",
        "douyin": "抖音风格：短句、节奏感、视觉化描述"
    }
    
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        """
        初始化生成器
        
        Args:
            api_key: API Key，如果不提供则从环境变量读取
            base_url: API Base URL，支持 OpenAI 兼容接口
            model: 模型名称
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
        if not self.api_key:
            print("⚠️  警告: 未设置 OPENAI_API_KEY，请在 /workspace/.env 中配置")
        else:
            print(f"✓ API 配置成功")
            print(f"  Base URL: {self.base_url}")
            print(f"  Model: {self.model}")
    
    def build_prompt(
        self,
        topic: str,
        tone: str = "professional",
        platform: str = "wechat",
        length: int = 200,
        keywords: List[str] = None
    ) -> str:
        """
        参数化 (Parameterization) - 通过参数控制生成内容
        
        Args:
            topic: 文案主题
            tone: 语气风格
            platform: 平台风格
            length: 目标字数
            keywords: 必须包含的关键词
            
        Returns:
            构建好的提示词
        """
        # 获取模块
        tone_instruction = self.TONE_MODULES.get(tone, self.TONE_MODULES["professional"])
        platform_instruction = self.PLATFORM_MODULES.get(platform, self.PLATFORM_MODULES["wechat"])
        
        # 组装提示词
        prompt = f"""你是一位专业的文案撰写专家。

【任务】
为以下主题创作一篇文案：{topic}

【要求】
1. 语气风格：{tone_instruction}
2. 平台风格：{platform_instruction}
3. 目标字数：约{length}字
"""
        
        if keywords:
            prompt += f"4. 必须包含关键词：{', '.join(keywords)}\n"
        
        prompt += """
【输出格式】
直接输出文案内容，不需要额外说明。
"""
        
        return prompt
    
    def generate(
        self,
        topic: str,
        tone: str = "professional",
        platform: str = "wechat",
        length: int = 200,
        keywords: List[str] = None,
        dry_run: bool = False
    ) -> Dict:
        """
        生成文案
        
        Args:
            topic: 文案主题
            tone: 语气风格
            platform: 平台风格
            length: 目标字数
            keywords: 必须包含的关键词
            dry_run: 是否仅返回提示词而不调用 API
            
        Returns:
            包含生成结果和元数据的字典
        """
        # 可观测 (Observability) - 记录生成过程的关键信息
        metadata = {
            "version": self.VERSION,
            "topic": topic,
            "tone": tone,
            "platform": platform,
            "length": length,
            "keywords": keywords
        }
        
        # 构建提示词
        prompt = self.build_prompt(topic, tone, platform, length, keywords)
        
        if dry_run:
            return {
                "prompt": prompt,
                "content": None,
                "metadata": metadata,
                "dry_run": True
            }
        
        # 调用真实API
        if not self.api_key:
            content = f"[错误] 未配置 OPENAI_API_KEY，请在 /workspace/.env 中配置"
            return {
                "prompt": prompt,
                "content": content,
                "metadata": metadata,
                "error": "missing_api_key"
            }
        
        try:
            # 使用 OpenAI 兼容接口调用通义千问
            from openai import OpenAI
            
            client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            
            return {
                "prompt": prompt,
                "content": content,
                "metadata": metadata,
                "dry_run": False,
                "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') else None
            }
            
        except Exception as e:
            content = f"[错误] API 调用失败: {str(e)}"
            return {
                "prompt": prompt,
                "content": content,
                "metadata": metadata,
                "error": str(e)
            }
    
    def test_generation(self, topic: str) -> bool:
        """
        可测试 (Testability) - 提供测试接口
        
        Args:
            topic: 测试主题
            
        Returns:
            测试是否通过
        """
        try:
            # 测试不同参数组合
            result1 = self.generate(topic, tone="professional", platform="wechat", dry_run=True)
            result2 = self.generate(topic, tone="casual", platform="xiaohongshu", dry_run=True)
            
            # 验证提示词是否包含必要元素
            assert "专业" in result1["prompt"]
            assert "小红书" in result2["prompt"]
            
            print("✅ 测试通过")
            return True
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False


def main():
    """示例使用"""
    print("=" * 60)
    print("课程1: 提示词工程 - 万能文案生成器")
    print("=" * 60)
    print()
    
    # 创建生成器
    generator = ContentGenerator()
    
    # 示例1: 生成小红书风格文案
    print("📝 示例1: 小红书风格 - 产品推广")
    print("-" * 60)
    result = generator.generate(
        topic="智能手表新品发布",
        tone="casual",
        platform="xiaohongshu",
        length=150,
        keywords=["健康监测", "时尚"],
        dry_run=True  # 仅查看提示词
    )
    print(result["prompt"])
    print()
    
    # 示例2: 生成微信公众号风格文案
    print("📝 示例2: 微信公众号风格 - 知识分享")
    print("-" * 60)
    result = generator.generate(
        topic="如何提高工作效率",
        tone="professional",
        platform="wechat",
        length=300,
        keywords=["时间管理", "专注力"],
        dry_run=True
    )
    print(result["prompt"])
    print()
    
    # 运行测试
    print("🧪 运行测试")
    print("-" * 60)
    generator.test_generation("测试主题")
    print()
    
    print("💡 提示:")
    print("1. 在 /workspace/.env 中配置 OPENAI_API_KEY")
    print("2. 将 dry_run=False 以实际调用 API")
    print("3. 尝试不同的 tone 和 platform 组合")


if __name__ == "__main__":
    main()
