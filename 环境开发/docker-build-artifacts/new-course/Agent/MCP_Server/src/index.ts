import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import path from "path";
import { z } from "zod";

type PolicyType = "expense" | "leave";

type ContactInfo = {
  name: string;
  email: string;
  phone: string;
};

type KnowledgeData = {
  policies: Record<PolicyType, { title: string; content: string }>;
  contacts: Record<string, ContactInfo>;
};

type ZodiacInfo = {
  name: string;
  date: string;
  element: string;
  traits: string;
  lucky_color: string;
  lucky_number: number[];
  compatible: string[];
};

type ZodiacData = Record<string, ZodiacInfo>;

const server = new McpServer({
  name: "mcp-glm-server",
  version: "1.0.0",
});

function loadJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function getTemplateVariable(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? "";
  }
  return "";
}

const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");
const zodiacPath = path.join(process.cwd(), "data", "zodiac.json");

const knowledgeData = loadJson<KnowledgeData>(knowledgePath);
const zodiacData = loadJson<ZodiacData>(zodiacPath);

// ========== Tools ==========

server.tool(
  "calculate",
  "执行数学计算，支持加减乘除、幂运算、括号。当用户需要进行数学计算时调用此工具。",
  {
    expression: z
      .string()
      .describe("数学表达式，例如: 2+3*4, (10+5)/3, 2^8"),
  },
  async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().\s^]/g, "");
      if (!sanitized.trim()) {
        throw new Error("表达式为空或不合法");
      }
      const normalized = sanitized.replace(/\^/g, "**");
      const result = new Function(`\"use strict\"; return (${normalized});`)();
      return {
        content: [
          {
            type: "text",
            text: `计算结果: ${expression} = ${result}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `计算错误: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_current_time",
  "获取当前日期和时间。当用户询问现在几点、今天日期、当前时间时调用此工具。",
  {
    timezone: z
      .string()
      .optional()
      .describe("时区，如: Asia/Shanghai, America/New_York，默认为上海时区"),
  },
  async ({ timezone }) => {
    const targetTimezone = timezone ?? "Asia/Shanghai";
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: targetTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
    };
    const formatter = new Intl.DateTimeFormat("zh-CN", options);

    return {
      content: [
        {
          type: "text",
          text: `当前时间 (${targetTimezone}): ${formatter.format(now)}`,
        },
      ],
    };
  }
);

function calculateFortune(zodiac: string, date: Date) {
  const seed =
    date.getFullYear() * 10000 +
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

server.tool(
  "get_fortune",
  "获取指定星座的今日运势评分。当用户询问星座运势、今日运势时调用此工具。",
  {
    zodiac: z
      .string()
      .describe(
        "星座英文名: aries(白羊)/taurus(金牛)/gemini(双子)/cancer(巨蟹)/leo(狮子)/virgo(处女)/libra(天秤)/scorpio(天蝎)/sagittarius(射手)/capricorn(摩羯)/aquarius(水瓶)/pisces(双鱼)"
      ),
    date: z.string().optional().describe("日期，格式YYYY-MM-DD，默认今天"),
  },
  async ({ zodiac, date }) => {
    const targetDate = date ? new Date(date) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return {
        content: [{ type: "text", text: `日期格式错误: ${date}` }],
        isError: true,
      };
    }

    const info = zodiacData[zodiac];
    if (!info) {
      return {
        content: [{ type: "text", text: `未知星座: ${zodiac}` }],
        isError: true,
      };
    }

    const fortune = calculateFortune(zodiac, targetDate);
    const dateStr = targetDate.toISOString().split("T")[0];

    return {
      content: [
        {
          type: "text",
          text:
            `【${info.name}】${dateStr} 运势\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `✨ 综合运势: ${fortune.overall}分\n` +
            `💕 爱情运势: ${fortune.love}分\n` +
            `💼 事业运势: ${fortune.career}分\n` +
            `💰 财富运势: ${fortune.wealth}分\n` +
            `🏃 健康运势: ${fortune.health}分`,
        },
      ],
    };
  }
);

server.tool(
  "get_lucky_number",
  "根据出生日期计算今日幸运数字。",
  {
    birthday: z.string().describe("出生日期，格式 YYYY-MM-DD 或 MM-DD"),
  },
  async ({ birthday }) => {
    const parts = birthday
      .split("-")
      .map((part) => Number(part))
      .filter((n: number) => !Number.isNaN(n));

    if (parts.length === 0) {
      return {
        content: [{ type: "text", text: `生日格式错误: ${birthday}` }],
        isError: true,
      };
    }

    const sum = parts.reduce((a: number, b: number) => a + b, 0);
    const today = new Date();
    const todaySum = today.getMonth() + 1 + today.getDate();
    const lucky = ((sum + todaySum) % 9) + 1;

    return {
      content: [
        {
          type: "text",
          text: `🎯 根据生日 ${birthday} 计算\n今日幸运数字是: ${lucky}`,
        },
      ],
    };
  }
);

server.tool(
  "query_company_policy",
  "查询公司规章制度，包括报销制度、请假制度等。当用户询问公司政策、报销标准、请假流程、出差补贴时调用此工具。",
  {
    policy_type: z
      .string()
      .describe("制度类型: expense(报销制度) / leave(请假制度)"),
  },
  async ({ policy_type }) => {
    const policies: Record<PolicyType, string> = {
      expense: `【报销管理制度】\n${knowledgeData.policies.expense.content}`,
      leave: `【请假管理制度】\n${knowledgeData.policies.leave.content}`,
    };

    if (policy_type === "expense" || policy_type === "leave") {
      return {
        content: [{ type: "text", text: policies[policy_type] }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `未找到制度类型: ${policy_type}，可选: expense(报销制度) / leave(请假制度)`,
        },
      ],
      isError: true,
    };
  }
);

server.tool(
  "query_department_contact",
  "查询公司部门联系方式，包括电话、邮箱等。当用户询问某个部门的联系方式、电话、邮箱时调用此工具。",
  {
    department: z
      .string()
      .describe("部门名称: hr(人力资源部) / it(技术支持部) / finance(财务部)"),
  },
  async ({ department }) => {
    const contact = knowledgeData.contacts[department];
    if (!contact) {
      return {
        content: [
          {
            type: "text",
            text: `未找到部门: ${department}，可选: hr(人力资源部) / it(技术支持部) / finance(财务部)`,
          },
        ],
        isError: true,
      };
    }

    const text =
      `【${contact.name}】联系方式\n` +
      `📧 邮箱: ${contact.email}\n` +
      `📞 电话: ${contact.phone}`;

    return {
      content: [{ type: "text", text }],
    };
  }
);

// ========== Resources ==========

server.resource("policy-expense", "knowledge://policy/expense", async () => ({
  contents: [
    {
      uri: "knowledge://policy/expense",
      mimeType: "text/plain",
      text: knowledgeData.policies.expense.content,
    },
  ],
}));

server.resource("policy-leave", "knowledge://policy/leave", async () => ({
  contents: [
    {
      uri: "knowledge://policy/leave",
      mimeType: "text/plain",
      text: knowledgeData.policies.leave.content,
    },
  ],
}));

server.resource(
  "department-contacts",
  new ResourceTemplate("knowledge://contacts/{department}", {
    list: undefined,
    complete: {
      department: async (value: string) =>
        Object.keys(knowledgeData.contacts).filter((dep) => dep.startsWith(value)),
    },
  }),
  async (_uri, variables) => {
    const department = getTemplateVariable(variables.department);
    const contact = knowledgeData.contacts[department];

    if (!contact) {
      return {
        contents: [
          {
            uri: `knowledge://contacts/${department}`,
            mimeType: "text/plain",
            text: `未找到部门: ${department}，可选: hr, it, finance`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: `knowledge://contacts/${department}`,
          mimeType: "application/json",
          text: JSON.stringify(contact, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "zodiac-info",
  new ResourceTemplate("zodiac://{sign}", {
    list: undefined,
    complete: {
      sign: async (value: string) =>
        Object.keys(zodiacData).filter((sign) => sign.startsWith(value)),
    },
  }),
  async (_uri, variables) => {
    const sign = getTemplateVariable(variables.sign);
    const info = zodiacData[sign];

    if (!info) {
      return {
        contents: [
          {
            uri: `zodiac://${sign}`,
            mimeType: "text/plain",
            text: `未找到星座: ${sign}`,
          },
        ],
      };
    }

    const compatibleNames = info.compatible
      .map((c: string) => zodiacData[c]?.name ?? c)
      .join("、");

    const text =
      `【${info.name}】\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📅 日期范围: ${info.date}\n` +
      `🔥 元素属性: ${info.element}\n` +
      `💫 性格特点: ${info.traits}\n` +
      `🎨 幸运颜色: ${info.lucky_color}\n` +
      `🔢 幸运数字: ${info.lucky_number.join("、")}\n` +
      `💑 最佳配对: ${compatibleNames}`;

    return {
      contents: [
        {
          uri: `zodiac://${sign}`,
          mimeType: "text/plain",
          text,
        },
      ],
    };
  }
);

// ========== Prompts ==========

server.prompt(
  "code_review",
  "专业代码审查，检查安全性、性能、代码规范",
  {
    code: z.string().describe("需要审查的代码"),
    language: z.string().describe("编程语言，如 javascript, python, java"),
    focus: z.string().optional().describe("审查重点: security/performance/style/all"),
  },
  async ({ code, language, focus = "all" }) => {
    const focusMap: Record<string, string> = {
      security: "重点检查安全漏洞（SQL注入、XSS、敏感信息泄露等）",
      performance: "重点检查性能问题（内存泄漏、算法复杂度、资源占用等）",
      style: "重点检查代码规范（命名规范、注释完整性、代码结构等）",
      all: "全面审查安全性、性能和代码规范",
    };
    const fence = "```";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请对以下 ${language} 代码进行专业审查。\n\n` +
              `审查要求：${focusMap[focus] ?? focusMap.all}\n\n` +
              `请按以下格式输出：\n` +
              `1. 【问题摘要】问题数量和严重程度\n` +
              `2. 【详细问题】位置、原因、风险\n` +
              `3. 【修改建议】具体修改代码\n` +
              `4. 【优化建议】可选优化方向\n\n` +
              `待审查代码：\n\n${fence}${language}\n${code}\n${fence}`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "weekly_report",
  "根据工作内容生成结构化周报",
  {
    tasks: z.string().describe("本周完成的工作，用分号分隔"),
    issues: z.string().optional().describe("遇到的问题（可选）"),
    next_week: z.string().optional().describe("下周计划（可选）"),
  },
  async ({ tasks, issues, next_week }) => {
    let prompt = "请根据以下信息生成一份专业的工作周报。\n\n";
    prompt += `本周完成工作：\n${tasks}\n\n`;
    if (issues) prompt += `遇到的问题：\n${issues}\n\n`;
    if (next_week) prompt += `下周计划：\n${next_week}\n\n`;
    prompt += "要求：使用清晰结构，突出重点成果，语言简洁专业";

    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: prompt },
        },
      ],
    };
  }
);

server.prompt(
  "daily_fortune",
  "生成详细的每日星座运势报告",
  {
    zodiac: z.string().describe("星座英文名"),
  },
  async ({ zodiac }) => {
    const info = zodiacData[zodiac];
    const name = info?.name ?? zodiac;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请为${name}生成今日运势报告。\n\n` +
              `请先使用 get_fortune 工具获取运势评分，然后生成详细解读。\n\n` +
              `报告格式：\n` +
              `1. 【今日概述】一句话总结\n` +
              `2. 【运势详解】爱情/事业/财富/健康各项建议\n` +
              `3. 【幸运提示】幸运颜色、数字、方位\n` +
              `4. 【温馨提醒】今日注意事项`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "compatibility",
  "分析两个星座的配对指数",
  {
    zodiac1: z.string().describe("第一个星座"),
    zodiac2: z.string().describe("第二个星座"),
  },
  async ({ zodiac1, zodiac2 }) => {
    const name1 = zodiacData[zodiac1]?.name ?? zodiac1;
    const name2 = zodiacData[zodiac2]?.name ?? zodiac2;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请分析${name1}和${name2}的配对情况。\n\n` +
              `请给出：\n` +
              `1. 【配对指数】1-100分\n` +
              `2. 【性格互补】互补点分析\n` +
              `3. 【潜在摩擦】可能的矛盾\n` +
              `4. 【相处建议】如何更好相处`,
          },
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server for GLM-4.7 started");
}

main().catch(console.error);
