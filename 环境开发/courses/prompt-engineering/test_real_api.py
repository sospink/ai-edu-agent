#!/usr/bin/env python3
"""
测试真实API调用
用于验证通义千问API是否正常工作
"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 导入生成器
from example import ContentGenerator


def test_api_connection():
    """测试API连接"""
    print("=" * 60)
    print("测试 API 连接")
    print("=" * 60)
    print()
    
    # 检查配置
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "qwen-turbo")
    
    if not api_key:
        print("❌ 错误: 未配置 OPENAI_API_KEY")
        print("请在 .env 文件中配置 API Key")
        return False
    
    if api_key == "sk-your-api-key-here":
        print("❌ 错误: 请替换 .env 中的 API Key 为真实值")
        return False
    
    print(f"✓ API Key: {api_key[:20]}...")
    print(f"✓ Base URL: {base_url}")
    print(f"✓ Model: {model}")
    print()
    
    return True


def test_dry_run():
    """测试 Dry Run 模式"""
    print("=" * 60)
    print("测试 Dry Run 模式（不调用API）")
    print("=" * 60)
    print()
    
    generator = ContentGenerator()
    
    result = generator.generate(
        topic="测试主题",
        tone="casual",
        platform="xiaohongshu",
        length=100,
        dry_run=True
    )
    
    if result["dry_run"]:
        print("✓ Dry Run 模式正常")
        print()
        print("生成的提示词:")
        print("-" * 60)
        print(result["prompt"][:200] + "...")
        print("-" * 60)
        print()
        return True
    else:
        print("❌ Dry Run 模式异常")
        return False


def test_real_api_call():
    """测试真实API调用"""
    print("=" * 60)
    print("测试真实 API 调用")
    print("=" * 60)
    print()
    
    generator = ContentGenerator()
    
    print("📝 生成文案中...")
    print("主题: 周末去哪里玩")
    print("风格: 小红书 + 轻松语气")
    print()
    
    result = generator.generate(
        topic="周末去哪里玩",
        tone="casual",
        platform="xiaohongshu",
        length=100,
        keywords=["放松", "美食"],
        dry_run=False  # 真实调用API
    )
    
    if "error" in result:
        print(f"❌ API 调用失败")
        print(f"错误信息: {result['content']}")
        print()
        print("可能的原因:")
        print("  1. API Key 无效或过期")
        print("  2. 网络连接问题")
        print("  3. API 配额用完")
        print("  4. Base URL 配置错误")
        return False
    else:
        print("✅ API 调用成功!")
        print()
        print("生成的文案:")
        print("=" * 60)
        print(result['content'])
        print("=" * 60)
        print()
        
        # 显示元数据
        print("元数据:")
        print(f"  - 版本: {result['metadata']['version']}")
        print(f"  - 主题: {result['metadata']['topic']}")
        print(f"  - 语气: {result['metadata']['tone']}")
        print(f"  - 平台: {result['metadata']['platform']}")
        if result.get('tokens_used'):
            print(f"  - Token使用: {result['tokens_used']}")
        print()
        
        return True


def test_multiple_scenarios():
    """测试多个场景"""
    print("=" * 60)
    print("测试多个场景")
    print("=" * 60)
    print()
    
    generator = ContentGenerator()
    
    scenarios = [
        {
            "name": "专业风格 - 微信公众号",
            "topic": "人工智能的未来",
            "tone": "professional",
            "platform": "wechat",
            "length": 150
        },
        {
            "name": "幽默风格 - 微博",
            "topic": "程序员的日常",
            "tone": "humorous",
            "platform": "weibo",
            "length": 100
        }
    ]
    
    success_count = 0
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"场景 {i}: {scenario['name']}")
        print("-" * 60)
        
        result = generator.generate(
            topic=scenario['topic'],
            tone=scenario['tone'],
            platform=scenario['platform'],
            length=scenario['length'],
            dry_run=False
        )
        
        if "error" not in result:
            print("✓ 生成成功")
            print(f"内容: {result['content'][:80]}...")
            success_count += 1
        else:
            print(f"✗ 生成失败: {result['content']}")
        
        print()
    
    print(f"成功率: {success_count}/{len(scenarios)}")
    print()
    
    return success_count == len(scenarios)


def main():
    """主测试流程"""
    print()
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "提示词工程 - API 测试工具" + " " * 20 + "║")
    print("╚" + "=" * 58 + "╝")
    print()
    
    # 测试步骤
    tests = [
        ("API 连接", test_api_connection),
        ("Dry Run 模式", test_dry_run),
        ("真实 API 调用", test_real_api_call),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ 测试异常: {e}")
            results.append((name, False))
        
        print()
    
    # 显示测试结果
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status:10} - {name}")
    print()
    
    # 判断是否全部通过
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("🎉 所有测试通过！")
        print()
        print("下一步:")
        print("  - 可以开始使用示例代码")
        print("  - 尝试修改参数生成不同风格的文案")
        print("  - 测试其他课程的示例代码")
        return 0
    else:
        print("⚠️  部分测试失败")
        print()
        print("请检查:")
        print("  1. API Key 是否正确配置")
        print("  2. 网络连接是否正常")
        print("  3. API 配额是否充足")
        return 1


if __name__ == "__main__":
    sys.exit(main())
