"""
tools.py - 自定义工具模块
定义 Agent 可调用的外部工具
"""

from langchain.tools import tool
from typing import Optional


@tool
def get_nutrition_info(dish_name: str) -> str:
    """
    获取指定菜品的营养信息。
    当用户询问某道菜的营养成分、热量、是否健康时使用此工具。
    """
    nutrition_db = {
        "宫保鸡丁": {
            "calories": "180 kcal/100g",
            "protein": "15g",
            "fat": "10g",
            "carbs": "8g",
            "评价": "蛋白质丰富，但油脂偏高"
        },
        "红烧肉": {
            "calories": "320 kcal/100g",
            "protein": "12g",
            "fat": "28g",
            "carbs": "5g",
            "评价": "高脂肪高热量，偶尔解馋可以"
        },
        "清蒸鲈鱼": {
            "calories": "105 kcal/100g",
            "protein": "18g",
            "fat": "3g",
            "carbs": "0g",
            "评价": "低脂高蛋白，非常健康的选择"
        },
        "麻婆豆腐": {
            "calories": "130 kcal/100g",
            "protein": "8g",
            "fat": "9g",
            "carbs": "6g",
            "评价": "植物蛋白来源，但油脂和钠偏高"
        },
        "番茄炒蛋": {
            "calories": "95 kcal/100g",
            "protein": "6g",
            "fat": "6g",
            "carbs": "5g",
            "评价": "家常菜，营养均衡"
        }
    }

    for key in nutrition_db:
        if key in dish_name or dish_name in key:
            info = nutrition_db[key]
            return (
                f"\n【{key} 营养信息】\n"
                f"- 热量: {info['calories']}\n"
                f"- 蛋白质: {info['protein']}\n"
                f"- 脂肪: {info['fat']}\n"
                f"- 碳水化合物: {info['carbs']}\n"
                f"- 营养评价: {info['评价']}\n"
            )

    return f"未找到【{dish_name}】的详细营养数据，建议控制油盐用量，注意营养均衡。"


@tool
def get_cooking_tips(dish_name: str, aspect: Optional[str] = None) -> str:
    """
    获取菜品的专业烹饪技巧和常见错误。
    当需要给出专业的烹饪建议或指出常见烹饪错误时使用。
    """
    tips_db = {
        "炒菜": {
            "火候": "大火快炒是关键，锅要烧热冒烟再下油，油热再下菜",
            "调味": "盐要最后放，否则会出水；糖可以提鲜去腥",
            "食材处理": "肉类要提前腌制，蔬菜要保持干燥",
            "常见错误": "冷锅下菜、翻炒过于频繁、一次下太多食材导致锅温下降"
        },
        "红烧": {
            "火候": "先大火煸炒上色，后小火慢炖收汁",
            "调味": "生抽调味，老抽上色，比例要控制好",
            "食材处理": "肉类要焯水去腥，切块大小要均匀",
            "常见错误": "糖色炒过头发苦、炖的时间不够肉不烂、收汁太急导致糊底"
        },
        "清蒸": {
            "火候": "水开后再放鱼，大火蒸8-10分钟，不要超时",
            "调味": "蒸鱼豉油要浇热油激香，葱姜去腥",
            "食材处理": "鱼要新鲜，内脏清理干净，划几刀方便入味",
            "常见错误": "蒸的时间太长肉质变老、没有铺垫导致鱼皮粘盘、调味料放太早"
        },
        "炸": {
            "火候": "油温180度左右，筷子放入有密集气泡说明温度合适",
            "调味": "腌制要入味，裹粉要均匀",
            "食材处理": "食材表面水分要擦干，否则容易炸油",
            "常见错误": "油温太低导致吸油、一次放太多导致油温骤降、炸的时间太长"
        }
    }

    for method, tips in tips_db.items():
        if method in dish_name:
            if aspect and aspect in tips:
                return f"【{dish_name} - {aspect}技巧】\n{tips[aspect]}"
            result = f"【{dish_name} 烹饪技巧】\n"
            for k, v in tips.items():
                result += f"- {k}: {v}\n"
            return result

    return (
        "\n【通用烹饪建议】\n"
        "- 食材要新鲜，处理要到位\n"
        "- 火候是中餐的灵魂，该大火大火，该小火小火\n"
        "- 调味要分层次，盐最后放\n"
        "- 装盘要讲究，色香味俱全\n"
    )


@tool
def generate_score(appearance: int, taste_description: str, technique: str) -> str:
    """
    根据菜品的外观、口味描述和烹饪技法生成 Gordon 风格的评分。
    当需要给菜品打一个综合分数时使用。
    """
    taste_scores = {
        "完美": 10, "鲜美": 9, "美味": 8, "不错": 7,
        "一般": 5, "普通": 5, "太咸": 3, "太淡": 3,
        "油腻": 3, "难吃": 1, "糟糕": 1
    }

    technique_scores = {
        "完美": 10, "到位": 8, "不错": 7, "合格": 6,
        "一般": 5, "欠佳": 4, "过火": 3, "生了": 2, "糟糕": 1
    }

    taste_score = 5
    for key, score in taste_scores.items():
        if key in taste_description:
            taste_score = score
            break

    tech_score = 5
    for key, score in technique_scores.items():
        if key in technique:
            tech_score = score
            break

    final_score = round(appearance * 0.2 + taste_score * 0.5 + tech_score * 0.3, 1)

    if final_score >= 8:
        comment = "Finally! 这才是我想看到的水准！继续保持！"
    elif final_score >= 6:
        comment = "还行，但别太得意。还有很大提升空间。"
    elif final_score >= 4:
        comment = "这...你确定这是给人吃的？回去多练练！"
    else:
        comment = "Oh my God! 这简直是对食材的侮辱！我的奶奶都做得比这好！"

    return (
        "\n【Gordon 评分卡】\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 外观分: {appearance}/10\n"
        f"🍽️ 口味分: {taste_score}/10 ({taste_description})\n"
        f"👨‍🍳 技法分: {tech_score}/10 ({technique})\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏆 综合评分: {final_score}/10\n\n"
        f"💬 Gordon 说: {comment}\n"
    )


def get_all_tools():
    """返回所有可用工具的列表"""
    return [
        get_nutrition_info,
        get_cooking_tips,
        generate_score
    ]


if __name__ == "__main__":
    print("=== 测试营养信息工具 ===")
    print(get_nutrition_info.invoke({"dish_name": "红烧肉"}))

    print("\n=== 测试烹饪技巧工具 ===")
    print(get_cooking_tips.invoke({"dish_name": "清蒸鱼", "aspect": "火候"}))

    print("\n=== 测试评分工具 ===")
    print(generate_score.invoke({
        "appearance": 7,
        "taste_description": "有点太咸",
        "technique": "火候到位"
    }))
