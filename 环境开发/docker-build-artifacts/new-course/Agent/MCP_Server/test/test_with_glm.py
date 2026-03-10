"""
使用 GLM-4.7 Function Calling 测试 MCP Server 的 Tools
"""

from zhipuai import ZhipuAI
from zhipuai.core._errors import APIReachLimitError
from datetime import datetime
import json
import os
from pathlib import Path
import time


def load_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env()

api_key = os.getenv("ZHIPU_API_KEY")
if not api_key:
    raise RuntimeError("缺少 ZHIPU_API_KEY，请在 .env 或环境变量中设置")

# 调用节流配置（秒）
REQUEST_DELAY_SEC = float(os.getenv("GLM_REQUEST_DELAY_SEC", "3.0"))
RETRY_DELAY_SEC = float(os.getenv("GLM_RETRY_DELAY_SEC", "5.0"))
MAX_RETRIES = int(os.getenv("GLM_MAX_RETRIES", "3"))

# 初始化智谱AI客户端
client = ZhipuAI(api_key=api_key)

# 定义与 MCP Server 对应的 Tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "执行数学计算，支持加减乘除、幂运算、括号。当用户需要进行数学计算时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，例如: 2+3*4, (10+5)/3, 2^8"
                    }
                },
                "required": ["expression"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前日期和时间。当用户询问现在几点、今天日期时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "时区，如: Asia/Shanghai"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_fortune",
            "description": "获取指定星座的今日运势评分。当用户询问星座运势时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "zodiac": {
                        "type": "string",
                        "description": "星座英文名: aries/taurus/gemini/cancer/leo/virgo/libra/scorpio/sagittarius/capricorn/aquarius/pisces"
                    },
                    "date": {
                        "type": "string",
                        "description": "日期，格式YYYY-MM-DD，默认今天"
                    }
                },
                "required": ["zodiac"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_lucky_number",
            "description": "根据出生日期计算今日幸运数字。",
            "parameters": {
                "type": "object",
                "properties": {
                    "birthday": {
                        "type": "string",
                        "description": "出生日期，格式 YYYY-MM-DD 或 MM-DD"
                    }
                },
                "required": ["birthday"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_company_policy",
            "description": "查询公司规章制度，包括报销制度、请假制度等。当用户询问公司政策、报销标准、请假流程、出差补贴时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "policy_type": {
                        "type": "string",
                        "description": "制度类型: expense(报销制度) / leave(请假制度)"
                    }
                },
                "required": ["policy_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_department_contact",
            "description": "查询公司部门联系方式，包括电话、邮箱等。当用户询问某个部门的联系方式、电话、邮箱时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {
                        "type": "string",
                        "description": "部门名称: hr(人力资源部) / it(技术支持部) / finance(财务部)"
                    }
                },
                "required": ["department"]
            }
        }
    }
]

# 模拟工具执行（实际应用中会调用 MCP Server）
def execute_tool(name: str, arguments: dict) -> str:
    """模拟执行工具，实际应用中会通过 MCP 协议调用 Server"""
    if name == "calculate":
        try:
            expr = arguments.get("expression", "")
            sanitized = "".join(c for c in expr if c in "0123456789+-*/().^ ")
            normalized = sanitized.replace("^", "**")
            result = eval(normalized)
            return f"计算结果: {expr} = {result}"
        except Exception as e:
            return f"计算错误: {str(e)}"

    if name == "get_current_time":
        import pytz
        tz = arguments.get("timezone", "Asia/Shanghai")
        try:
            timezone = pytz.timezone(tz)
            now = datetime.now(timezone)
            return f"当前时间 ({tz}): {now.strftime('%Y年%m月%d日 %H:%M:%S %A')}"
        except Exception:
            now = datetime.now()
            return f"当前时间: {now.strftime('%Y年%m月%d日 %H:%M:%S')}"

    if name == "get_fortune":
        zodiac = arguments.get("zodiac", "")
        zodiac_names = {
            "aries": "白羊座", "taurus": "金牛座", "gemini": "双子座",
            "cancer": "巨蟹座", "leo": "狮子座", "virgo": "处女座",
            "libra": "天秤座", "scorpio": "天蝎座", "sagittarius": "射手座",
            "capricorn": "摩羯座", "aquarius": "水瓶座", "pisces": "双鱼座"
        }
        name_cn = zodiac_names.get(zodiac, zodiac)
        import random
        random.seed(hash(zodiac + str(datetime.now().date())))
        return (
            f"【{name_cn}】今日运势\n"
            f"综合: {random.randint(70,95)}分\n"
            f"爱情: {random.randint(60,95)}分\n"
            f"事业: {random.randint(65,95)}分"
        )

    if name == "get_lucky_number":
        birthday = arguments.get("birthday", "")
        parts = [int(x) for x in birthday.split("-") if x.isdigit()]
        lucky = (sum(parts) % 9) + 1
        return f"根据生日 {birthday}，今日幸运数字是: {lucky}"

    if name == "query_company_policy":
        policy_type = arguments.get("policy_type", "")
        policies = {
            "expense": """【报销管理制度】
1. 差旅费标准：
   - 交通：飞机经济舱、高铁二等座
   - 住宿：一线城市500元/晚，其他城市350元/晚
   - 餐饮补贴：100元/天
2. 报销时限：费用发生后30天内提交
3. 审批流程：5000元以内主管审批，超过需部门经理审批
4. 所需材料：发票原件、行程单、审批单""",
            "leave": """【请假管理制度】
1. 年假：工作满1年享有5天，每增加1年加1天，上限15天
2. 病假：需提供医院证明，3天以上需提供诊断书
3. 事假：需提前3天申请，紧急情况除外
4. 审批流程：3天以内主管审批，超过3天需部门经理审批
5. 请假方式：通过OA系统提交申请""",
        }
        if policy_type in policies:
            return policies[policy_type]
        return f"未找到制度类型: {policy_type}，可选: expense(报销制度) / leave(请假制度)"

    if name == "query_department_contact":
        department = arguments.get("department", "")
        contacts = {
            "hr": {
                "name": "人力资源部",
                "email": "hr@example.com",
                "phone": "010-12345678",
                "location": "总部大楼3层",
                "working_hours": "周一至周五 9:00-18:00",
            },
            "it": {
                "name": "技术支持部",
                "email": "it@example.com",
                "phone": "010-12345679",
                "location": "总部大楼5层",
                "working_hours": "7x24小时（紧急）/ 周一至周五 9:00-18:00（常规）",
            },
            "finance": {
                "name": "财务部",
                "email": "finance@example.com",
                "phone": "010-12345680",
                "location": "总部大楼2层",
                "working_hours": "周一至周五 9:00-17:30",
            },
        }
        if department in contacts:
            c = contacts[department]
            return (
                f"【{c['name']}】联系方式\n"
                f"📧 邮箱: {c['email']}\n"
                f"📞 电话: {c['phone']}\n"
                f"📍 地址: {c['location']}\n"
                f"🕐 工作时间: {c['working_hours']}"
            )
        return f"未找到部门: {department}，可选: hr(人力资源部) / it(技术支持部) / finance(财务部)"

    return f"未知工具: {name}"


def chat_with_tools(user_message: str):
    """与 GLM-4.7 进行带工具的对话"""
    print(f"\n{'='*50}")
    print(f"用户: {user_message}")
    print('='*50)

    messages = [{"role": "user", "content": user_message}]

    def call_glm(payload: dict, stage: str):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                return client.chat.completions.create(**payload)
            except APIReachLimitError as exc:
                if attempt >= MAX_RETRIES:
                    raise
                wait_sec = RETRY_DELAY_SEC * attempt
                print(f"[{stage}] 触发限流，{wait_sec:.1f}s 后重试（第 {attempt}/{MAX_RETRIES} 次）")
                time.sleep(wait_sec)
            except Exception:
                raise

    response = call_glm(
        {
            "model": "glm-4.7",
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        },
        "初次调用",
    )

    message = response.choices[0].message

    if message.tool_calls:
        print("\n[GLM-4.7 决定调用工具]")
        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)

            print(f"  → 工具: {func_name}")
            print(f"  → 参数: {func_args}")

            result = execute_tool(func_name, func_args)
            print(f"  → 结果: {result}")

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        final_response = call_glm(
            {
                "model": "glm-4.7",
                "messages": messages,
            },
            "二次调用",
        )

        final_message = final_response.choices[0].message.content
        print("\n[GLM-4.7 最终回答]")
        print(final_message)
    else:
        print("\n[GLM-4.7 直接回答]")
        print(message.content)


if __name__ == "__main__":
    print("=" * 60)
    print("GLM-4.7 Function Calling 与 MCP Tools 集成测试")
    print("=" * 60)

    cases = [
        "帮我计算一下 127 乘以 389 等于多少",
        "现在几点了？",
        "我是狮子座的，帮我看看今天运势怎么样",
        "我是1990年5月15日出生的，今天的幸运数字是多少？",
        "公司出差住宿标准是多少？报销流程是怎样的？",
        "我想请假，需要提前几天申请？年假有多少天？",
        "我想咨询社保问题，人力资源部的电话是多少？",
        "电脑坏了找谁？技术支持部怎么联系？",
        "我想知道天蝎座今天的运势，顺便帮我算一下 2的10次方",
        "我想了解报销制度，另外财务部的邮箱是什么？",
    ]

    start = int(os.getenv("GLM_TEST_START", "0"))
    count = int(os.getenv("GLM_TEST_COUNT", "2"))
    end = min(start + count, len(cases))

    if start < 0 or start >= len(cases):
        raise ValueError(f"GLM_TEST_START 超出范围: {start}")

    print(f"本次批次: {start + 1} - {end} / 共 {len(cases)} 条")

    for idx in range(start, end):
        chat_with_tools(cases[idx])
        if idx < end - 1:
            time.sleep(REQUEST_DELAY_SEC)
