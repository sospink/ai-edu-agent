# MCP Server 开发指南

## 课程定位

本课程讲授 **MCP（Model Context Protocol，模型上下文协议）Server 开发**，帮助开发者为 AI 模型扩展能力，让 AI 能够访问外部工具、数据和模板。

---

## 什么是 MCP？

MCP 是 Anthropic 于 2024 年 11 月发布的开放标准协议，专门解决 AI 模型与外部系统的连接问题。

**一句话理解：MCP 就是 AI 世界的 USB 接口**

就像 USB 统一了各种外设的连接方式，MCP 统一了 AI 模型连接各种外部服务的方式。

### 为什么需要 MCP？

在 MCP 出现之前：
- 每个 AI 应用都需要单独开发工具集成
- 不同应用之间无法复用工具
- 维护成本高，碎片化严重

有了 MCP 之后：
- 标准化的接口，一次开发，处处可用
- MCP Server 可以被任何支持 MCP 的客户端调用
- 形成生态：开发者可以共享 MCP Server

---

## MCP 的三大核心能力

MCP Server 提供三种类型的能力，简单记忆：**"Tools动手干，Resources用眼看，Prompts是快捷键"**

### 能力一：Tools（工具）

AI 可以**调用**的函数，执行具体操作。

**核心特征：**
- 由 **AI 主动触发**（AI 决定什么时候调用）
- **可以有副作用**（修改数据、发送消息、写文件等）
- 可以访问外部 API 和服务

**典型用途：**
- 搜索网页
- 发送邮件
- 查询数据库
- 执行代码
- 调用第三方 API

**代码示例：**
```python
from mcp.server import Server
from mcp.types import Tool

server = Server("my-server")

@server.tool()
async def get_weather(city: str) -> str:
    """
    获取指定城市的天气信息

    Args:
        city: 城市名称
    Returns:
        天气信息字符串
    """
    # 调用天气 API
    weather_data = await weather_api.get(city)
    return f"{city}当前天气：{weather_data['desc']}，气温 {weather_data['temp']}°C"
```

---

### 能力二：Resources（资源）

AI 可以**读取**的数据，只读不写。

**核心特征：**
- 由**应用程序控制**（宿主应用决定提供哪些资源）
- **只读，无副作用**
- 通过 URI 标识（类似文件路径或 URL）

**典型用途：**
- 读取本地文件内容
- 获取数据库记录
- 读取配置信息
- 访问文档内容

**Resources vs Tools 对比：**

| 维度 | Tools | Resources |
|------|-------|-----------|
| 触发方 | AI 主动触发 | 应用程序控制 |
| 是否只读 | 可以修改数据 | 只读 |
| 副作用 | 有 | 无 |
| 标识方式 | 函数名+参数 | URI |
| 典型用途 | 搜索、发邮件 | 读文件、读数据库 |

**代码示例：**
```python
@server.resource("file:///{path}")
async def read_file(path: str) -> str:
    """读取指定路径的文件内容"""
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

@server.resource("db://users/{user_id}")
async def get_user(user_id: str) -> dict:
    """获取用户信息"""
    return await db.query(f"SELECT * FROM users WHERE id = {user_id}")
```

---

### 能力三：Prompts（提示模板）

可供用户**选择**的预设提示词模板。

**核心特征：**
- 由**用户主动选择**（出现在 UI 界面供用户选择）
- **可参数化**（模板中包含变量，用户填入具体值）
- 封装最佳实践，降低使用门槛

**典型用途：**
- 代码审查模板
- 文档生成模板
- 数据分析模板
- 角色扮演设定

**代码示例：**
```python
@server.prompt()
async def code_review_template(language: str, code: str) -> str:
    """代码审查提示模板"""
    return f"""请审查以下 {language} 代码：

```{language}
{code}
```

请从以下维度进行审查：
1. 代码规范性
2. 潜在 Bug
3. 性能问题
4. 安全隐患
5. 改进建议"""
```

---

## MCP 架构

```
┌─────────────────────────────────┐
│         MCP 客户端              │
│  (Claude Desktop / Cursor / ... )│
└──────────────┬──────────────────┘
               │ MCP Protocol
               │ (JSON-RPC over stdio/HTTP)
┌──────────────▼──────────────────┐
│         MCP Server              │
│  ┌─────────┬──────────┬───────┐ │
│  │  Tools  │Resources │Prompts│ │
│  └────┬────┴─────┬────┴───┬───┘ │
└───────┼──────────┼────────┼─────┘
        ↓          ↓        ↓
   外部 API    本地文件    数据库
```

---

## 实战项目：今日运势 MCP Server

本课程的核心实战项目：开发一个提供运势预测功能的 MCP Server。

### 功能设计

**Tools（工具）：**
- `get_fortune(name, birth_date)` — 根据姓名和生日计算今日运势
- `get_lucky_color(date)` — 获取今日幸运色
- `get_lucky_number(date)` — 获取今日幸运数字

**Resources（资源）：**
- `fortune://zodiac/{sign}` — 读取各星座的基础性格描述
- `fortune://calendar/{date}` — 读取特定日期的黄历信息

**Prompts（提示模板）：**
- `fortune_reading_template` — 运势解读的标准模板

### 完整实现

```python
import asyncio
from datetime import date
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent

server = Server("fortune-server")

# ============ Tools ============

@server.tool()
async def get_fortune(name: str, birth_date: str) -> str:
    """
    获取今日运势预测

    Args:
        name: 用户姓名
        birth_date: 生日，格式 YYYY-MM-DD
    Returns:
        今日运势描述
    """
    today = date.today()
    # 基于姓名和生日生成运势（示例逻辑）
    fortune_score = (sum(ord(c) for c in name) + today.day) % 5
    fortunes = ["大吉", "吉", "平", "小凶", "凶"]
    fortune = fortunes[fortune_score]

    return f"✨ {name} 今日（{today}）运势：{fortune}\n今日宜：学习、社交\n今日忌：冲动决策"

@server.tool()
async def get_lucky_color(date_str: str = None) -> str:
    """
    获取今日幸运色

    Args:
        date_str: 日期字符串，默认为今天
    Returns:
        幸运颜色名称
    """
    today = date.today() if date_str is None else date.fromisoformat(date_str)
    colors = ["红色", "橙色", "黄色", "绿色", "蓝色", "紫色", "白色"]
    lucky_color = colors[today.day % len(colors)]
    return f"今日幸运色：{lucky_color} 🎨"

# ============ Resources ============

ZODIAC_DATA = {
    "aries": "白羊座（3.21-4.19）：热情、冲动、勇敢，天生的领导者...",
    "taurus": "金牛座（4.20-5.20）：稳重、务实、享受生活，对美食和舒适有极高要求...",
    # ... 其他星座
}

@server.resource("fortune://zodiac/{sign}")
async def get_zodiac_info(sign: str) -> str:
    """获取星座基础信息"""
    return ZODIAC_DATA.get(sign, f"未找到星座：{sign}")

# ============ Prompts ============

@server.prompt()
async def fortune_reading_template(user_name: str, fortune_result: str) -> str:
    """运势解读标准模板"""
    return f"""你是一位温柔神秘的占卜师，请用诗意的语言为 {user_name} 解读今日运势。

运势数据：
{fortune_result}

请提供：
1. 整体运势解读（2-3句话，充满意境）
2. 一个具体的今日建议
3. 一句鼓励的话

风格要求：温暖、正能量、略带神秘感，避免使用"大吉大利"等俗气词汇。"""

# ============ 启动服务 ============

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
```

### 配置到 Claude Desktop

```json
{
  "mcpServers": {
    "fortune": {
      "command": "python",
      "args": ["/path/to/fortune_server.py"]
    }
  }
}
```

---

## 常见问题

**Q: Tools 和 Functions（函数调用）有什么区别？**
A: Functions 是 OpenAI 等模型的专有概念，MCP Tools 是标准化的跨模型、跨客户端的工具协议，更通用。

**Q: Resources 必须是文件吗？**
A: 不是，Resources 可以是任何只读数据源：文件、数据库记录、API 响应等，关键是通过 URI 标识且不修改数据。

**Q: MCP Server 支持哪些传输协议？**
A: 目前支持两种：stdio（标准输入输出，适合本地）和 HTTP+SSE（适合远程服务）。

**Q: 如何调试 MCP Server？**
A: 可以使用 MCP Inspector 工具，或者直接查看 Claude Desktop 的日志文件。

---

## 总结

MCP 的三大能力记忆口诀：
- **Tools**：AI 动手干活，可以改变世界（有副作用）
- **Resources**：AI 用眼看数据，只读不写（无副作用）
- **Prompts**：用户的快捷键，预设最佳提示词模板

MCP 的价值：用统一标准连接 AI 与世界，让能力可复用、可共享。
