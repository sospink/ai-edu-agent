"""
config.py - 配置管理模块
负责加载环境变量和多 Agent 系统配置
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
    MODEL_NAME = os.getenv("LLM_MODEL", "glm-4-flash")
    REQUEST_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))

    # === 多 Agent 专属配置 ===
    # 不同角色使用不同的 temperature
    CREATIVE_TEMPERATURE = 0.9   # 创意 Agent：高发散
    CRITIC_TEMPERATURE = 0.3     # 评审 Agent：高确定性
    REFINER_TEMPERATURE = 0.5    # 优化 Agent：平衡
    REPORTER_TEMPERATURE = 0.3   # 汇报 Agent：高确定性

    MAX_TOKENS = 2048

    # === 创意风暴流程配置 ===
    MAX_BRAINSTORM_ROUNDS = 2    # 最大风暴轮次
    TOP_K_IDEAS = 3              # 每轮保留 Top-K 创意
    CREATIVE_PERSPECTIVES = [    # 创意视角
        "技术可行性",
        "商业价值",
        "用户体验",
    ]

    @classmethod
    def validate(cls):
        """验证必要配置"""
        if not cls.ZHIPUAI_API_KEY:
            raise ValueError("请设置 ZHIPUAI_API_KEY 环境变量")
        print("✅ 配置验证通过")


# 验证配置
if __name__ == "__main__":
    Config.validate()
    print(f"模型: {Config.MODEL_NAME}")
    print(f"创意视角: {Config.CREATIVE_PERSPECTIVES}")
    print(f"最大轮次: {Config.MAX_BRAINSTORM_ROUNDS}")
