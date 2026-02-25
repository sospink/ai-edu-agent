#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
课程 3: ADE 配置与智能体开发 - 代码翻译官 Skill
演示如何使用 ADE (Agent Development Environment) 创建代码翻译技能
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('/workspace/.env')

def translate_code_example():
    """
    代码翻译示例
    演示如何将一种编程语言的代码翻译成另一种语言
    """
    print("=" * 50)
    print("  课程 3: ADE Skill - 代码翻译官")
    print("=" * 50)
    print()
    
    # 示例：Python 代码
    python_code = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
"""
    
    print("原始 Python 代码:")
    print("-" * 50)
    print(python_code)
    print()
    
    # 检查 API Key
    api_key = os.getenv('OPENAI_API_KEY')
    base_url = os.getenv('OPENAI_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    model = os.getenv('OPENAI_MODEL', 'qwen-turbo')
    
    javascript_code = None
    
    if api_key and api_key.startswith('sk-'):
        print("✓ 检测到 API Key，使用真实 AI 翻译...")
        print()
        
        try:
            from openai import OpenAI
            
            client = OpenAI(
                api_key=api_key,
                base_url=base_url
            )
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位专业的代码翻译专家。请将给定的代码翻译成目标语言，保持功能完全一致。只输出翻译后的代码，不要添加任何解释。"
                    },
                    {
                        "role": "user",
                        "content": f"请将以下 Python 代码翻译成 JavaScript:\n\n{python_code}"
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            javascript_code = response.choices[0].message.content
            
            # 清理代码块标记
            if javascript_code.startswith('```'):
                lines = javascript_code.split('\n')
                javascript_code = '\n'.join(lines[1:-1]) if len(lines) > 2 else javascript_code
            
        except ImportError:
            print("⚠️  未安装 openai 包，使用模拟数据")
            print("   安装命令: pip install openai")
            print()
        except Exception as e:
            print(f"⚠️  API 调用失败: {e}")
            print("   使用模拟数据...")
            print()
    else:
        print("⚠️  未配置 API Key，使用模拟翻译结果")
        print("   配置方法: 编辑 /workspace/.env 文件")
        print()
    
    # 如果 API 调用失败，使用模拟数据
    if not javascript_code:
        javascript_code = """
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n-1) + fibonacci(n-2);
}

console.log(fibonacci(10));
"""
    
    print("翻译后的 JavaScript 代码:")
    print("-" * 50)
    print(javascript_code)
    print()
    
    print("✓ 代码翻译完成！")
    print()

def main():
    """主函数"""
    try:
        translate_code_example()
        
        print("=" * 50)
        print("  ADE Skill 示例运行成功！")
        print("=" * 50)
        
    except Exception as e:
        print(f"错误: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
