"""
config.py - 配置管理模块
负责加载环境变量和模型配置
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class Config:
    """应用配置类"""

    # 智谱AI配置
    ZHIPUAI_API_KEY = os.getenv("ZHIPUAI_API_KEY")

    # 模型配置
    MODEL_NAME = "glm-4"  # 使用 GLM-4 模型
    TEMPERATURE = 0.7     # 控制创造性，0.7 适合有个性的回复
    MAX_TOKENS = 2048     # 最大输出长度
    REQUEST_TIMEOUT = float(os.getenv("ZHIPUAI_TIMEOUT", "30"))
    MAX_RETRIES = int(os.getenv("ZHIPUAI_MAX_RETRIES", "2"))

    # Agent配置
    MAX_ITERATIONS = 5    # 最大推理迭代次数

    @classmethod
    def validate(cls):
        """验证必要配置"""
        if not cls.ZHIPUAI_API_KEY:
            raise ValueError("请设置 ZHIPUAI_API_KEY 环境变量")
        print("✅ 配置验证通过")


if __name__ == "__main__":
    Config.validate()
