# MCP Server 开发实操课 —— 智能体技术应用专业核心课程 · 第二节

> 本实训手册指导你完成 MCP Server 项目的创建与配置，掌握 Tools、Resources、Prompts 三大能力开发，完成综合案例「今日运势MCP」，并使用 GLM-4.7 Function Calling 验证 MCP Server。课程时长90分钟，集成平台为智谱AI GLM-4.7。

## 步骤 0: 进入课程目录并确认环境

> 本手册所有命令均按 `/root/MCP_Server` 目录编排，建议先执行以下命令。

```bash
cd /root/MCP_Server
pwd
ls
```

预期看到当前目录为 `/root/MCP_Server`，并可继续创建 `mcp-glm-server` 子目录。

<!-- verify: command:cd /root/MCP_Server && pwd|contains|/root/MCP_Server -->
<!-- questions: 为什么要先固定工作目录|如果不在/root/MCP_Server会有什么问题 -->

## 步骤 1: 了解课程目标与技术栈

本节课的学习目标：

- 掌握 MCP Server 项目的创建与配置
- 理解 MCP 与智谱AI GLM-4.7 的集成方式
- 独立实现 Tools、Resources、Prompts 三大能力
- 完成综合案例「今日运势MCP」的开发
- 使用 GLM-4.7 Function Calling 验证 MCP Server

### 技术栈说明

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| MCP Server | TypeScript + @modelcontextprotocol/sdk | MCP官方SDK |
| 大模型 | 智谱AI GLM-4.7 | 支持Function Calling的国产大模型 |
| 运行时 | Node.js 18+ | JavaScript运行环境 |
| 测试工具 | MCP Inspector / Python脚本 | 调试和验证 |

### 环境要求

| 环境 | 要求 |
|------|------|
| Node.js | v18.0.0 或更高版本 |
| Python | 3.8+ （用于GLM-4.7测试脚本） |
| 智谱AI账号 | 注册并获取API Key |
| 代码编辑器 | VS Code（推荐） |

<!-- questions: MCP Server的三大能力是什么|GLM-4.7的Function Calling与MCP有什么关系|本课程需要哪些环境 -->

## 步骤 2: 环境检查

运行以下命令检查环境是否就绪：

```bash
# 检查 Node.js 版本
node --version
# 输出应为 v18.x.x 或更高

# 检查 Python 版本
python3 --version
# 输出应为 Python 3.8+

# 检查 pip
python3 -m pip --version
```

<!-- verify: command:node --version|not_empty -->
<!-- questions: 如果Node.js版本过低怎么办|为什么需要Python环境 -->

## 步骤 3: 获取智谱AI API Key

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 进入「API Keys」页面
4. 创建新的 API Key 并妥善保存

<!-- questions: 如何获取智谱AI API Key|API Key应该如何保管 -->

## 步骤 4: 安装智谱AI Python SDK

```bash
# 安装智谱AI SDK
python3 -m pip install zhipuai

# 或使用新版SDK
python3 -m pip install zai
```

<!-- verify: command:python3 -m pip show zhipuai|contains|Name: zhipuai -->
<!-- questions: zhipuai和zai有什么区别 -->

## 步骤 5: 验证API连接

创建 `test_glm.py` 测试文件：

```python
from zhipuai import ZhipuAI

# 初始化客户端
client = ZhipuAI(api_key="your-api-key")  # 替换为你的API Key

# 测试基本对话
response = client.chat.completions.create(
    model="glm-4.7",
    messages=[
        {"role": "user", "content": "你好，请介绍一下你自己"}
    ]
)

print(response.choices[0].message.content)
```

运行测试：

```bash
cd /root/MCP_Server && python3 test_glm.py
```

<!-- verify: file_exists:/root/MCP_Server/test_glm.py -->
<!-- questions: 如何验证API Key是否有效|测试脚本运行失败怎么排查 -->

## 步骤 6: 了解GLM-4.7 Function Calling基础

以下示例展示了 GLM-4.7 的 Function Calling 能力：

```python
from zhipuai import ZhipuAI
import json

client = ZhipuAI(api_key="your-api-key")

# 定义工具（函数）
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，例如：北京、上海"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 发起带工具的对话
response = client.chat.completions.create(
    model="glm-4.7",
    messages=[
        {"role": "user", "content": "北京今天天气怎么样？"}
    ],
    tools=tools,
    tool_choice="auto"
)

# 检查是否调用了工具
message = response.choices[0].message
if message.tool_calls:
    for tool_call in message.tool_calls:
        print(f"调用工具: {tool_call.function.name}")
        print(f"参数: {tool_call.function.arguments}")
```

> 💡 **重点理解**：GLM-4.7 的 Function Calling 与 MCP 的 Tools 概念完全对应！MCP Server 定义的 Tools 最终会被转换为 Function Calling 格式供大模型调用。

<!-- questions: Function Calling的工作原理是什么|MCP Tools和Function Calling的对应关系是什么|tool_choice参数的作用是什么 -->

## 步骤 7: 创建MCP Server项目目录

```bash
# 创建项目文件夹
mkdir -p /root/MCP_Server/mcp-glm-server
cd /root/MCP_Server/mcp-glm-server

# 初始化 npm 项目
npm init -y
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/package.json -->
<!-- questions: npm init -y做了什么 -->

## 步骤 8: 安装项目依赖

```bash
cd /root/MCP_Server/mcp-glm-server

# 安装 MCP TypeScript SDK
npm install @modelcontextprotocol/sdk

# 安装 TypeScript 相关依赖
npm install typescript @types/node tsx --save-dev
```

<!-- verify: command:ls /root/MCP_Server/mcp-glm-server/node_modules/@modelcontextprotocol|not_empty -->
<!-- questions: @modelcontextprotocol/sdk是什么|tsx的作用是什么 -->

## 步骤 9: 配置TypeScript

创建 `tsconfig.json` 文件：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/tsconfig.json -->
<!-- questions: tsconfig.json中各选项的含义是什么|为什么target设为ES2022 -->

## 步骤 10: 配置package.json并搭建项目结构

更新 `package.json` 配置：

```json
{
  "name": "mcp-glm-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

最终项目结构如下：

```
mcp-glm-server/
├── src/
│   └── index.ts              # MCP Server 主入口
├── data/
│   ├── knowledge.json        # 公司知识库数据
│   └── zodiac.json           # 星座数据
├── test/
│   ├── test_with_glm.py      # GLM-4.7 集成测试
├── package.json
├── tsconfig.json
├── .env                      # 环境变量（API Key）
└── .gitignore
```

```bash
# 创建目录结构
mkdir -p /root/MCP_Server/mcp-glm-server/src /root/MCP_Server/mcp-glm-server/data /root/MCP_Server/mcp-glm-server/test
ls -ld /root/MCP_Server/mcp-glm-server/src
```

<!-- verify: command:test -d /root/MCP_Server/mcp-glm-server/src && echo OK|contains|OK -->
<!-- questions: "type": "module"的作用是什么|dev和start脚本的区别是什么 -->

## 步骤 11: 创建MCP Server基础框架

创建 `src/index.ts`：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from 'fs';
import path from 'path';

// 创建 MCP Server 实例
const server = new McpServer({
  name: "mcp-glm-server",
  version: "1.0.0",
});

// ============================================
// === 在这里添加 Tools / Resources / Prompts ===
// ============================================

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server for GLM-4.7 started");
}

main().catch(console.error);
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/src/index.ts -->
<!-- questions: McpServer的构造参数有哪些|StdioServerTransport是什么传输方式|为什么用console.error而不是console.log -->

## 步骤 12: 案例一 —— 智能计算器Tool开发

**🎯 学习目标：掌握 Tool 的定义，理解其与 GLM-4.7 Function Calling 的对应关系**

### MCP Tool 与 GLM Function Calling 对照

| MCP Tool 属性 | GLM Function 属性 | 说明 |
|--------------|-------------------|------|
| `name` | `function.name` | 工具/函数名称 |
| `description` | `function.description` | 功能描述 |
| `inputSchema` | `function.parameters` | 参数定义 |
| `handler` | (本地实现) | 执行逻辑 |

在 `src/index.ts` 中添加计算器工具：

```typescript
// ========== Tools ==========

/**
 * 计算器工具
 * 对应 GLM-4.7 Function Calling 中的函数定义
 */
server.tool(
  "calculate",
  "执行数学计算，支持加减乘除、幂运算、括号。当用户需要进行数学计算时调用此工具。",
  {
    expression: {
      type: "string",
      description: "数学表达式，例如: 2+3*4, (10+5)/3, 2^8"
    }
  },
  async ({ expression }) => {
    try {
      // 安全校验：只允许数字和基本运算符
      const sanitized = expression.replace(/[^0-9+\-*/().\s^]/g, "");
      
      // 将 ^ 转换为 ** (幂运算)
      const normalized = sanitized.replace(/\^/g, "**");
      
      // 使用 Function 构造器安全计算
      const result = new Function(`return ${normalized}`)();
      
      return {
        content: [{
          type: "text",
          text: `计算结果: ${expression} = ${result}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `计算错误: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

<!-- questions: Tool的description为什么要写得详细|isError:true的作用是什么|安全校验为什么重要 -->

## 步骤 13: 添加时间查询Tool

继续在 `src/index.ts` 中添加：

```typescript
/**
 * 时间查询工具
 */
server.tool(
  "get_current_time",
  "获取当前日期和时间。当用户询问现在几点、今天日期、当前时间时调用此工具。",
  {
    timezone: {
      type: "string",
      description: "时区，如: Asia/Shanghai, America/New_York，默认为上海时区"
    }
  },
  async ({ timezone = "Asia/Shanghai" }) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long'
    };
    const formatter = new Intl.DateTimeFormat('zh-CN', options);
    
    return {
      content: [{
        type: "text",
        text: `当前时间 (${timezone}): ${formatter.format(now)}`
      }]
    };
  }
);
```

### GLM-4.7 调用 MCP Tools 的流程

```
用户提问 → GLM-4.7 分析 → 决定调用工具 → MCP Server 执行 → 返回结果 → GLM-4.7 生成回答
     │                        │                    │                    │
     │    "帮我算 127*389"    │  tool_call:        │  执行 calculate    │
     │                        │  calculate         │  返回 49403        │
     └────────────────────────┴────────────────────┴────────────────────┘
```

### Tool 开发要点

> 💡 **关键点1**：`description` 必须清晰描述功能和使用场景，GLM-4.7 根据此描述决定是否调用

> 💡 **关键点2**：参数的 `description` 同样重要，帮助模型正确填充参数

> 💡 **关键点3**：做好错误处理，返回 `isError: true` 让模型知道调用失败

<!-- questions: GLM-4.7调用MCP Tools的完整流程是什么|Tool开发有哪些关键要点|参数默认值如何设置 -->

## 步骤 14: 案例二 —— 准备公司知识库数据

**🎯 学习目标：掌握 Resource 的 URI 设计和数据提供方式**

创建 `data/knowledge.json`：

```json
{
  "policies": {
    "expense": {
      "title": "报销管理制度",
      "content": "1. 差旅费：飞机经济舱、高铁二等座\n2. 住宿：一线城市500元/晚，其他350元/晚\n3. 餐饮补贴：100元/天\n4. 报销时限：30天内提交"
    },
    "leave": {
      "title": "请假管理制度",
      "content": "1. 年假：满1年5天，每年+1天，上限15天\n2. 病假：需医院证明\n3. 事假：提前3天申请\n4. 审批：3天内主管批，超过需部门经理"
    }
  },
  "contacts": {
    "hr": {"name": "人力资源部", "email": "hr@example.com", "phone": "010-12345678"},
    "it": {"name": "技术支持部", "email": "it@example.com", "phone": "010-12345679"},
    "finance": {"name": "财务部", "email": "finance@example.com", "phone": "010-12345680"}
  }
}
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/data/knowledge.json -->
<!-- questions: 知识库数据为什么用JSON格式|URI设计有什么规律 -->

## 步骤 15: 实现Resources —— 公司知识库

在 `src/index.ts` 中添加 Resources 代码：

```typescript
// 加载知识库数据
const knowledgePath = path.join(process.cwd(), 'data/knowledge.json');
const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8'));

// ========== Resources ==========

// 静态资源：报销制度
server.resource(
  "knowledge://policy/expense",
  "公司报销管理制度",
  async () => ({
    contents: [{
      uri: "knowledge://policy/expense",
      mimeType: "text/plain",
      text: knowledgeData.policies.expense.content
    }]
  })
);

// 静态资源：请假制度
server.resource(
  "knowledge://policy/leave",
  "公司请假管理制度",
  async () => ({
    contents: [{
      uri: "knowledge://policy/leave",
      mimeType: "text/plain",
      text: knowledgeData.policies.leave.content
    }]
  })
);

// 动态资源模板：部门联系方式
server.resourceTemplate(
  "knowledge://contacts/{department}",
  "部门联系方式查询",
  async ({ department }) => {
    const contact = knowledgeData.contacts[department];
    
    if (!contact) {
      return {
        contents: [{
          uri: `knowledge://contacts/${department}`,
          mimeType: "text/plain",
          text: `未找到部门: ${department}，可选: hr, it, finance`
        }]
      };
    }
    
    return {
      contents: [{
        uri: `knowledge://contacts/${department}`,
        mimeType: "application/json",
        text: JSON.stringify(contact, null, 2)
      }]
    };
  }
);
```

<!-- questions: 静态资源和动态资源模板的区别是什么|Resource的URI如何设计|mimeType的作用是什么 -->

## 步骤 16: 补充知识库相关Tools

> 说明：测试脚本会调用 `query_company_policy` 与 `query_department_contact`，因此需要在 MCP Server 中补充这两个工具。

```typescript
// 查询公司规章制度
server.tool(
  "query_company_policy",
  "查询公司规章制度，包括报销制度、请假制度等。当用户询问公司政策、报销标准、请假流程、出差补贴时调用此工具。",
  {
    policy_type: {
      type: "string",
      description: "制度类型: expense(报销制度) / leave(请假制度)"
    }
  },
  async ({ policy_type }) => {
    const policies: Record<string, string> = {
      expense: `【报销管理制度】\n${knowledgeData.policies.expense.content}`,
      leave: `【请假管理制度】\n${knowledgeData.policies.leave.content}`
    };
    if (policy_type in policies) {
      return {
        content: [{ type: "text", text: policies[policy_type] }]
      };
    }
    return {
      content: [{
        type: "text",
        text: `未找到制度类型: ${policy_type}，可选: expense(报销制度) / leave(请假制度)`
      }],
      isError: true
    };
  }
);

// 查询部门联系方式
server.tool(
  "query_department_contact",
  "查询公司部门联系方式，包括电话、邮箱等。当用户询问某个部门的联系方式、电话、邮箱时调用此工具。",
  {
    department: {
      type: "string",
      description: "部门名称: hr(人力资源部) / it(技术支持部) / finance(财务部)"
    }
  },
  async ({ department }) => {
    const contact = knowledgeData.contacts[department];
    if (!contact) {
      return {
        content: [{
          type: "text",
          text: `未找到部门: ${department}，可选: hr(人力资源部) / it(技术支持部) / finance(财务部)`
        }],
        isError: true
      };
    }

    const text = `【${contact.name}】联系方式\n` +
      `📧 邮箱: ${contact.email}\n` +
      `📞 电话: ${contact.phone}`;

    return {
      content: [{ type: "text", text }]
    };
  }
);
```

<!-- questions: 为什么Resources和Tools都需要实现知识库查询|Tools和Resources的使用场景有什么区别 -->

## 步骤 17: 案例三 —— 代码审查助手Prompt开发

**🎯 学习目标：掌握 Prompt 模板的设计和参数化**

在 `src/index.ts` 中添加 Prompts 代码：

```typescript
// ========== Prompts ==========

server.prompt(
  "code_review",
  "专业代码审查，检查安全性、性能、代码规范",
  {
    code: {
      type: "string",
      description: "需要审查的代码",
      required: true
    },
    language: {
      type: "string",
      description: "编程语言，如 javascript, python, java",
      required: true
    },
    focus: {
      type: "string",
      description: "审查重点: security/performance/style/all",
      required: false
    }
  },
  async ({ code, language, focus = "all" }) => {
    const focusMap: Record<string, string> = {
      security: "重点检查安全漏洞（SQL注入、XSS、敏感信息泄露等）",
      performance: "重点检查性能问题（内存泄漏、算法复杂度、资源占用等）",
      style: "重点检查代码规范（命名规范、注释完整性、代码结构等）",
      all: "全面审查安全性、性能和代码规范"
    };
    
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请对以下 ${language} 代码进行专业审查。

审查要求：${focusMap[focus] || focusMap.all}

请按以下格式输出：
1. 【问题摘要】问题数量和严重程度
2. 【详细问题】位置、原因、风险
3. 【修改建议】具体修改代码
4. 【优化建议】可选优化方向

待审查代码：
\`\`\`${language}
${code}
\`\`\``
        }
      }]
    };
  }
);
```

<!-- questions: Prompt和Tool有什么区别|focus参数的默认值如何实现|Prompt模板的设计要点是什么 -->

## 步骤 18: 实现周报生成Prompt

```typescript
server.prompt(
  "weekly_report",
  "根据工作内容生成结构化周报",
  {
    tasks: {
      type: "string",
      description: "本周完成的工作，用分号分隔",
      required: true
    },
    issues: {
      type: "string",
      description: "遇到的问题（可选）",
      required: false
    },
    next_week: {
      type: "string",
      description: "下周计划（可选）",
      required: false
    }
  },
  async ({ tasks, issues, next_week }) => {
    let prompt = `请根据以下信息生成一份专业的工作周报。\n\n`;
    prompt += `本周完成工作：\n${tasks}\n\n`;
    if (issues) prompt += `遇到的问题：\n${issues}\n\n`;
    if (next_week) prompt += `下周计划：\n${next_week}\n\n`;
    prompt += `要求：使用清晰结构，突出重点成果，语言简洁专业`;
    
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: prompt }
      }]
    };
  }
);
```

<!-- questions: 可选参数如何处理|Prompt返回的messages结构是什么 -->

## 步骤 19: 综合实战 —— 今日运势MCP功能规划

**🎯 综合运用 Tools、Resources、Prompts 三大能力**

| 能力类型 | 名称 | 功能 |
|----------|------|------|
| Tool | `get_fortune` | 计算星座今日运势 |
| Tool | `get_lucky_number` | 计算幸运数字 |
| Resource | `zodiac://{sign}` | 星座基础知识 |
| Prompt | `daily_fortune` | 生成运势报告 |
| Prompt | `compatibility` | 星座配对分析 |

<!-- questions: 今日运势MCP包含哪些能力|为什么要综合使用三种能力类型 -->

## 步骤 20: 准备星座数据

创建 `data/zodiac.json`：

```json
{
  "aries": {
    "name": "白羊座", "date": "3.21-4.19", "element": "火象",
    "traits": "热情、冲动、勇敢、直接",
    "lucky_color": "红色", "lucky_number": [1, 9],
    "compatible": ["leo", "sagittarius"]
  },
  "taurus": {
    "name": "金牛座", "date": "4.20-5.20", "element": "土象",
    "traits": "稳重、务实、固执、忠诚",
    "lucky_color": "绿色", "lucky_number": [2, 6],
    "compatible": ["virgo", "capricorn"]
  },
  "gemini": {
    "name": "双子座", "date": "5.21-6.21", "element": "风象",
    "traits": "机智、善变、好奇、社交",
    "lucky_color": "黄色", "lucky_number": [3, 5],
    "compatible": ["libra", "aquarius"]
  },
  "cancer": {
    "name": "巨蟹座", "date": "6.22-7.22", "element": "水象",
    "traits": "敏感、顾家、情绪化、保护欲强",
    "lucky_color": "白色", "lucky_number": [2, 7],
    "compatible": ["scorpio", "pisces"]
  },
  "leo": {
    "name": "狮子座", "date": "7.23-8.22", "element": "火象",
    "traits": "自信、慷慨、骄傲、领导力",
    "lucky_color": "金色", "lucky_number": [1, 4],
    "compatible": ["aries", "sagittarius"]
  },
  "virgo": {
    "name": "处女座", "date": "8.23-9.22", "element": "土象",
    "traits": "完美主义、细心、挑剔、务实",
    "lucky_color": "灰色", "lucky_number": [5, 6],
    "compatible": ["taurus", "capricorn"]
  },
  "libra": {
    "name": "天秤座", "date": "9.23-10.23", "element": "风象",
    "traits": "优雅、公正、犹豫、社交",
    "lucky_color": "粉色", "lucky_number": [6, 9],
    "compatible": ["gemini", "aquarius"]
  },
  "scorpio": {
    "name": "天蝎座", "date": "10.24-11.22", "element": "水象",
    "traits": "神秘、专注、占有欲、洞察力",
    "lucky_color": "深红色", "lucky_number": [3, 9],
    "compatible": ["cancer", "pisces"]
  },
  "sagittarius": {
    "name": "射手座", "date": "11.23-12.21", "element": "火象",
    "traits": "乐观、自由、冒险、直率",
    "lucky_color": "紫色", "lucky_number": [3, 7],
    "compatible": ["aries", "leo"]
  },
  "capricorn": {
    "name": "摩羯座", "date": "12.22-1.19", "element": "土象",
    "traits": "务实、野心、严肃、自律",
    "lucky_color": "黑色", "lucky_number": [4, 8],
    "compatible": ["taurus", "virgo"]
  },
  "aquarius": {
    "name": "水瓶座", "date": "1.20-2.18", "element": "风象",
    "traits": "独立、创新、叛逆、人道主义",
    "lucky_color": "蓝色", "lucky_number": [4, 7],
    "compatible": ["gemini", "libra"]
  },
  "pisces": {
    "name": "双鱼座", "date": "2.19-3.20", "element": "水象",
    "traits": "浪漫、敏感、直觉、艺术",
    "lucky_color": "海蓝色", "lucky_number": [3, 7],
    "compatible": ["cancer", "scorpio"]
  }
}
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/data/zodiac.json -->
<!-- questions: 星座数据中compatible字段的用途是什么 -->

## 步骤 21: 实现运势Tools

在 `src/index.ts` 中添加运势相关工具：

```typescript
// 加载星座数据
const zodiacPath = path.join(process.cwd(), 'data/zodiac.json');
const zodiacData = JSON.parse(fs.readFileSync(zodiacPath, 'utf-8'));

// 运势计算函数
function calculateFortune(zodiac: string, date: Date) {
  const seed = date.getFullYear() * 10000 + 
               (date.getMonth() + 1) * 100 + 
               date.getDate();
  const idx = Object.keys(zodiacData).indexOf(zodiac);
  const hash = (seed + idx * 1000) % 100;
  
  return {
    overall: 60 + (hash % 40),
    love: 50 + ((hash * 7) % 50),
    career: 55 + ((hash * 13) % 45),
    wealth: 50 + ((hash * 17) % 50),
    health: 60 + ((hash * 23) % 40),
  };
}

// 运势查询工具
server.tool(
  "get_fortune",
  "获取指定星座的今日运势评分。当用户询问星座运势、今日运势时调用此工具。",
  {
    zodiac: {
      type: "string",
      description: "星座英文名: aries(白羊)/taurus(金牛)/gemini(双子)/cancer(巨蟹)/leo(狮子)/virgo(处女)/libra(天秤)/scorpio(天蝎)/sagittarius(射手)/capricorn(摩羯)/aquarius(水瓶)/pisces(双鱼)"
    },
    date: {
      type: "string",
      description: "日期，格式YYYY-MM-DD，默认今天"
    }
  },
  async ({ zodiac, date }) => {
    const targetDate = date ? new Date(date) : new Date();
    const info = zodiacData[zodiac];
    
    if (!info) {
      return {
        content: [{ type: "text", text: `未知星座: ${zodiac}` }],
        isError: true
      };
    }
    
    const fortune = calculateFortune(zodiac, targetDate);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    return {
      content: [{
        type: "text",
        text: `【${info.name}】${dateStr} 运势\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `✨ 综合运势: ${fortune.overall}分\n` +
              `💕 爱情运势: ${fortune.love}分\n` +
              `💼 事业运势: ${fortune.career}分\n` +
              `💰 财富运势: ${fortune.wealth}分\n` +
              `🏃 健康运势: ${fortune.health}分`
      }]
    };
  }
);

// 幸运数字工具
server.tool(
  "get_lucky_number",
  "根据出生日期计算今日幸运数字。",
  {
    birthday: {
      type: "string",
      description: "出生日期，格式 YYYY-MM-DD 或 MM-DD"
    }
  },
  async ({ birthday }) => {
    const parts = birthday.split('-').map(Number);
    const sum = parts.reduce((a, b) => a + b, 0);
    const today = new Date();
    const todaySum = today.getMonth() + 1 + today.getDate();
    const lucky = ((sum + todaySum) % 9) + 1;
    
    return {
      content: [{
        type: "text",
        text: `🎯 根据生日 ${birthday} 计算\n今日幸运数字是: ${lucky}`
      }]
    };
  }
);
```

<!-- questions: 运势计算函数的seed设计原理是什么|为什么幸运数字要结合今日日期计算 -->

## 步骤 22: 实现星座Resource

```typescript
// 星座知识资源模板
server.resourceTemplate(
  "zodiac://{sign}",
  "星座详细信息",
  async ({ sign }) => {
    const info = zodiacData[sign];
    
    if (!info) {
      return {
        contents: [{
          uri: `zodiac://${sign}`,
          mimeType: "text/plain",
          text: `未找到星座: ${sign}`
        }]
      };
    }
    
    const compatibleNames = info.compatible
      .map((c: string) => zodiacData[c]?.name || c)
      .join('、');
    
    const text = `【${info.name}】
━━━━━━━━━━━━━━━━━━
📅 日期范围: ${info.date}
🔥 元素属性: ${info.element}
💫 性格特点: ${info.traits}
🎨 幸运颜色: ${info.lucky_color}
🔢 幸运数字: ${info.lucky_number.join('、')}
💑 最佳配对: ${compatibleNames}`;
    
    return {
      contents: [{
        uri: `zodiac://${sign}`,
        mimeType: "text/plain",
        text
      }]
    };
  }
);
```

<!-- questions: resourceTemplate和resource的区别是什么|URI中的{sign}参数如何传递 -->

## 步骤 23: 实现运势Prompts

```typescript
// 每日运势报告
server.prompt(
  "daily_fortune",
  "生成详细的每日星座运势报告",
  {
    zodiac: {
      type: "string",
      description: "星座英文名",
      required: true
    }
  },
  async ({ zodiac }) => {
    const info = zodiacData[zodiac];
    const name = info?.name || zodiac;
    
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请为${name}生成今日运势报告。

请先使用 get_fortune 工具获取运势评分，然后生成详细解读。

报告格式：
1. 【今日概述】一句话总结
2. 【运势详解】爱情/事业/财富/健康各项建议
3. 【幸运提示】幸运颜色、数字、方位
4. 【温馨提醒】今日注意事项`
        }
      }]
    };
  }
);

// 星座配对分析
server.prompt(
  "compatibility",
  "分析两个星座的配对指数",
  {
    zodiac1: { type: "string", description: "第一个星座", required: true },
    zodiac2: { type: "string", description: "第二个星座", required: true }
  },
  async ({ zodiac1, zodiac2 }) => {
    const name1 = zodiacData[zodiac1]?.name || zodiac1;
    const name2 = zodiacData[zodiac2]?.name || zodiac2;
    
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `请分析${name1}和${name2}的配对情况。

请给出：
1. 【配对指数】1-100分
2. 【性格互补】互补点分析
3. 【潜在摩擦】可能的矛盾
4. 【相处建议】如何更好相处`
        }
      }]
    };
  }
);
```

<!-- questions: daily_fortune为什么要在Prompt中指导Agent先调用Tool|配对分析Prompt的参数设计有什么考虑 -->

## 步骤 24: 创建GLM-4.7集成测试脚本

创建 `test/test_with_glm.py`：

```python
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
```

<!-- verify: file_exists:/root/MCP_Server/mcp-glm-server/test/test_with_glm.py -->
<!-- questions: 测试脚本中execute_tool函数的作用是什么|为什么需要限流和重试机制|chat_with_tools的二次调用是什么意思 -->

## 步骤 25: 运行集成测试

```bash
cd /root/MCP_Server/mcp-glm-server

# 安装依赖
python3 -m pip install zhipuai pytz

# 配置 API Key（.env 与脚本同级）
echo "ZHIPU_API_KEY=your-api-key" > .env

# 运行测试
python3 test/test_with_glm.py
```

### 分批测试与限流配置（重要）

为了避免触发 429 限流，脚本支持"分批 + 节流 + 重试"：

**分批执行（推荐）：**

```bash
# 从第 0 条开始跑 2 条
GLM_TEST_START=0 GLM_TEST_COUNT=2 python3 test/test_with_glm.py

# 从第 6 条开始跑 3 条
GLM_TEST_START=6 GLM_TEST_COUNT=3 python3 test/test_with_glm.py
```

**限流与重试参数：**

```bash
# 用更保守的节流与重试
GLM_REQUEST_DELAY_SEC=6 GLM_RETRY_DELAY_SEC=10 GLM_MAX_RETRIES=4 \
python3 test/test_with_glm.py
```

参数说明：
- `GLM_TEST_START`：从第几条开始（0-based）
- `GLM_TEST_COUNT`：本批执行条数
- `GLM_REQUEST_DELAY_SEC`：批次内相邻调用间隔（秒）
- `GLM_RETRY_DELAY_SEC`：触发限流后的基础等待（秒）
- `GLM_MAX_RETRIES`：限流最大重试次数

<!-- verify: command:cat /root/MCP_Server/mcp-glm-server/.env|contains|ZHIPU_API_KEY -->
<!-- questions: 为什么要分批测试|429限流是什么|如何调整限流参数 -->

## 步骤 26: 查看预期测试输出

> ⚠️ 模型生成的最终回答会有波动，以下示例仅展示"工具调用与工具结果"的典型格式。

**测试1：计算器工具**
```
==================================================
用户: 帮我计算一下 127 乘以 389 等于多少
==================================================

[GLM-4.7 决定调用工具]
  → 工具: calculate
  → 参数: {'expression': '127 * 389'}
  → 结果: 计算结果: 127 * 389 = 49403

[GLM-4.7 最终回答]
127 乘以 389 的结果是 **49403**。
```

**测试2：时间查询工具**
```
==================================================
用户: 现在几点了？
==================================================

[GLM-4.7 决定调用工具]
  → 工具: get_current_time
  → 参数: {}
  → 结果: 当前时间 (Asia/Shanghai): 2026年01月28日 10:19:00 Wednesday

[GLM-4.7 最终回答]
现在是2026年1月28日，星期三，上午10点19分（上海时间）。
```

**测试3：星座运势工具**
```
==================================================
用户: 我是狮子座的，帮我看看今天运势怎么样
==================================================

[GLM-4.7 决定调用工具]
  → 工具: get_fortune
  → 参数: {'zodiac': 'leo'}
  → 结果: 【狮子座】今日运势
          综合: 82分
          爱情: 81分
          事业: 70分

[GLM-4.7 最终回答]
（模型生成内容略）
```

**测试9：复合问题（运势+计算）**
```
==================================================
用户: 我想知道天蝎座今天的运势，顺便帮我算一下 2的10次方
==================================================

[GLM-4.7 决定调用工具]
  → 工具: get_fortune
  → 参数: {'zodiac': 'scorpio'}
  → 结果: 【天蝎座】今日运势 ...

  → 工具: calculate
  → 参数: {'expression': '2^10'}
  → 结果: 计算结果: 2^10 = 1024

[GLM-4.7 最终回答]
（模型生成内容略）
```

<!-- questions: 复合问题GLM-4.7会如何处理|模型的最终回答为什么会有波动|如何判断工具调用是否正确 -->

## 步骤 27: 课程总结

### MCP 与 GLM-4.7 集成要点

| MCP 概念 | GLM-4.7 对应 | 说明 |
|----------|-------------|------|
| Tools | Function Calling | 模型可调用的函数 |
| Resources | (上下文注入) | 预加载的知识数据 |
| Prompts | (消息模板) | 标准化的交互模板 |

### 最佳实践

✅ Tool 的 description 要清晰描述功能和触发条件
✅ 参数描述要详细，帮助模型正确填充
✅ 错误处理要完善，返回有意义的错误信息
✅ Resource 的 URI 设计要有规律
✅ Prompt 参数要精简，有合理默认值

### 课后作业

1. 为今日运势MCP添加 `get_lucky_color` Tool
2. 添加 `zodiac://all` Resource，返回所有星座列表
3. 使用 GLM-4.7 测试新增功能
4. 尝试将 MCP Server 配置到 Claude Desktop 或其他支持 MCP 的Client客户端

### 扩展资源

- [智谱AI开放平台文档](https://docs.bigmodel.cn/)
- [MCP官方规范](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

> 🎉 **恭喜完成 MCP Server 开发实操课！** 你已经掌握了 MCP Server 开发和智谱AI GLM-4.7 集成的核心技能。

<!-- questions: MCP的三大概念分别对应GLM-4.7的什么|课后作业中get_lucky_color应该如何设计|如何将MCP Server配置到Claude Desktop -->
