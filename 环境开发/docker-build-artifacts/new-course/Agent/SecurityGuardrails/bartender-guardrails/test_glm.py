"""
测试 GLM-4 API 连接
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def test_glm_api():
    """测试智谱AI GLM-4 API连接"""

    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")

    print(f"API Key: {api_key[:20]}..." if api_key else "API Key not found")
    print(f"Base URL: {base_url}")

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    try:
        # 测试简单的问候
        response = client.chat.completions.create(
            model="glm-4-flash",
            messages=[
                {
                    "role": "system",
                    "content": "你是 AI 酒吧的首席调酒师\"小酒\"，一位热情、专业、风趣的饮品专家。"
                },
                {
                    "role": "user",
                    "content": "你好！给我推荐一杯适合夏天的鸡尾酒。"
                }
            ],
            temperature=0.7,
        )

        print("\n" + "=" * 50)
        print("🍸 GLM-4 API 测试成功！")
        print("=" * 50)
        print(f"\n回复内容：\n{response.choices[0].message.content}")
        print(f"\n使用模型: {response.model}")
        print(f"使用 Token: {response.usage.total_tokens}")

        return True

    except Exception as e:
        print(f"\n❌ API 调用失败: {e}")
        return False


if __name__ == "__main__":
    test_glm_api()
