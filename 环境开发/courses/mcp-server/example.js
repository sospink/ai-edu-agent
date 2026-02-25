#!/usr/bin/env node
/**
 * 课程2: MCP Server 开发 - 今日运势
 * 演示 MCP 三大能力：Tools、Resources、Prompts
 */

// 注意：这是一个简化的示例，实际需要安装 @modelcontextprotocol/sdk
// npm install @modelcontextprotocol/sdk

/**
 * MCP Server 示例：今日运势
 * 
 * 三大能力：
 * 1. Tools - 可执行的功能（如：获取运势、解梦）
 * 2. Resources - 可读取的资源（如：星座数据、运势历史）
 * 3. Prompts - 预定义的提示词模板（如：运势解读模板）
 */

class FortuneServer {
  constructor() {
    this.name = "fortune-teller";
    this.version = "1.0.0";
    
    // 星座数据（Resources 示例）
    this.zodiacData = {
      "aries": { name: "白羊座", element: "火", dates: "3/21-4/19" },
      "taurus": { name: "金牛座", element: "土", dates: "4/20-5/20" },
      "gemini": { name: "双子座", element: "风", dates: "5/21-6/21" },
      "cancer": { name: "巨蟹座", element: "水", dates: "6/22-7/22" },
      "leo": { name: "狮子座", element: "火", dates: "7/23-8/22" },
      "virgo": { name: "处女座", element: "土", dates: "8/23-9/22" },
      "libra": { name: "天秤座", element: "风", dates: "9/23-10/23" },
      "scorpio": { name: "天蝎座", element: "水", dates: "10/24-11/22" },
      "sagittarius": { name: "射手座", element: "火", dates: "11/23-12/21" },
      "capricorn": { name: "摩羯座", element: "土", dates: "12/22-1/19" },
      "aquarius": { name: "水瓶座", element: "风", dates: "1/20-2/18" },
      "pisces": { name: "双鱼座", element: "水", dates: "2/19-3/20" }
    };
    
    // 运势历史（Resources 示例）
    this.fortuneHistory = [];
  }
  
  /**
   * 能力1: Tools - 获取今日运势
   * 这是一个可执行的工具函数
   */
  async getTodayFortune(zodiac) {
    const data = this.zodiacData[zodiac.toLowerCase()];
    if (!data) {
      throw new Error(`未知星座: ${zodiac}`);
    }
    
    // 生成随机运势（实际应该调用 AI 或数据库）
    const fortune = {
      zodiac: data.name,
      date: new Date().toLocaleDateString('zh-CN'),
      overall: this._randomScore(),
      love: this._randomScore(),
      career: this._randomScore(),
      wealth: this._randomScore(),
      health: this._randomScore(),
      luckyColor: this._randomColor(),
      luckyNumber: Math.floor(Math.random() * 100),
      advice: this._generateAdvice(data.element)
    };
    
    // 保存到历史
    this.fortuneHistory.push(fortune);
    
    return fortune;
  }
  
  /**
   * 能力1: Tools - 解梦工具
   */
  async interpretDream(dream) {
    // 这里应该调用 AI 进行解梦
    return {
      dream: dream,
      interpretation: `关于"${dream}"的梦境解析...（需要接入 AI）`,
      symbols: ["象征1", "象征2"],
      advice: "建议..."
    };
  }
  
  /**
   * 能力2: Resources - 获取星座信息
   * 这是一个可读取的资源
   */
  async getZodiacResource(zodiac) {
    const data = this.zodiacData[zodiac.toLowerCase()];
    if (!data) {
      throw new Error(`未知星座: ${zodiac}`);
    }
    
    return {
      uri: `fortune://zodiac/${zodiac}`,
      mimeType: "application/json",
      content: JSON.stringify(data, null, 2)
    };
  }
  
  /**
   * 能力2: Resources - 获取运势历史
   */
  async getFortuneHistory() {
    return {
      uri: "fortune://history",
      mimeType: "application/json",
      content: JSON.stringify(this.fortuneHistory, null, 2)
    };
  }
  
  /**
   * 能力3: Prompts - 运势解读提示词模板
   * 这是一个预定义的提示词，可以被 AI 使用
   */
  getFortunePromptTemplate() {
    return {
      name: "fortune-interpretation",
      description: "解读今日运势的提示词模板",
      arguments: [
        {
          name: "zodiac",
          description: "星座名称",
          required: true
        },
        {
          name: "fortune_data",
          description: "运势数据（JSON格式）",
          required: true
        }
      ],
      template: `你是一位专业的占星师。请根据以下信息，为{{zodiac}}提供今日运势解读：

运势数据：
{{fortune_data}}

请提供：
1. 整体运势分析
2. 各方面运势详解（爱情、事业、财运、健康）
3. 今日建议
4. 幸运提示

语气要温暖、专业，给人信心和指引。`
    };
  }
  
  /**
   * 能力3: Prompts - 解梦提示词模板
   */
  getDreamPromptTemplate() {
    return {
      name: "dream-interpretation",
      description: "解梦的提示词模板",
      arguments: [
        {
          name: "dream_content",
          description: "梦境内容描述",
          required: true
        }
      ],
      template: `你是一位心理学和梦境分析专家。请分析以下梦境：

梦境内容：
{{dream_content}}

请提供：
1. 梦境象征意义
2. 可能的心理状态
3. 潜意识信息
4. 建议和启示

分析要专业、客观，避免迷信色彩。`
    };
  }
  
  /**
   * MCP Server 能力列表
   * 这是 MCP 协议要求的接口
   */
  listCapabilities() {
    return {
      tools: [
        {
          name: "get_today_fortune",
          description: "获取指定星座的今日运势",
          inputSchema: {
            type: "object",
            properties: {
              zodiac: {
                type: "string",
                description: "星座英文名（如：aries, taurus）",
                enum: Object.keys(this.zodiacData)
              }
            },
            required: ["zodiac"]
          }
        },
        {
          name: "interpret_dream",
          description: "解析梦境含义",
          inputSchema: {
            type: "object",
            properties: {
              dream: {
                type: "string",
                description: "梦境内容描述"
              }
            },
            required: ["dream"]
          }
        }
      ],
      resources: [
        {
          uri: "fortune://zodiac/{zodiac}",
          name: "星座信息",
          description: "获取指定星座的详细信息",
          mimeType: "application/json"
        },
        {
          uri: "fortune://history",
          name: "运势历史",
          description: "获取历史运势记录",
          mimeType: "application/json"
        }
      ],
      prompts: [
        {
          name: "fortune-interpretation",
          description: "运势解读提示词模板"
        },
        {
          name: "dream-interpretation",
          description: "解梦提示词模板"
        }
      ]
    };
  }
  
  // 辅助方法
  _randomScore() {
    const scores = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];
    return scores[Math.floor(Math.random() * scores.length)];
  }
  
  _randomColor() {
    const colors = ["红色", "橙色", "黄色", "绿色", "蓝色", "紫色", "粉色"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  _generateAdvice(element) {
    const advices = {
      "火": "保持热情，但注意控制情绪",
      "土": "脚踏实地，稳步前进",
      "风": "保持灵活，善于沟通",
      "水": "倾听内心，关注情感"
    };
    return advices[element] || "顺其自然，保持平和";
  }
}

// 示例使用
async function main() {
  console.log("=".repeat(60));
  console.log("课程2: MCP Server 开发 - 今日运势");
  console.log("=".repeat(60));
  console.log();
  
  const server = new FortuneServer();
  
  // 展示 MCP 三大能力
  console.log("📋 MCP Server 能力列表");
  console.log("-".repeat(60));
  const capabilities = server.listCapabilities();
  console.log("Tools:", capabilities.tools.length, "个");
  console.log("Resources:", capabilities.resources.length, "个");
  console.log("Prompts:", capabilities.prompts.length, "个");
  console.log();
  
  // 示例1: 使用 Tool - 获取运势
  console.log("🔧 示例1: Tool - 获取今日运势");
  console.log("-".repeat(60));
  const fortune = await server.getTodayFortune("leo");
  console.log(JSON.stringify(fortune, null, 2));
  console.log();
  
  // 示例2: 使用 Resource - 读取星座信息
  console.log("📚 示例2: Resource - 读取星座信息");
  console.log("-".repeat(60));
  const resource = await server.getZodiacResource("leo");
  console.log(`URI: ${resource.uri}`);
  console.log(`Content:\n${resource.content}`);
  console.log();
  
  // 示例3: 使用 Prompt - 获取提示词模板
  console.log("💬 示例3: Prompt - 运势解读模板");
  console.log("-".repeat(60));
  const prompt = server.getFortunePromptTemplate();
  console.log(`Name: ${prompt.name}`);
  console.log(`Description: ${prompt.description}`);
  console.log(`Template:\n${prompt.template}`);
  console.log();
  
  console.log("💡 提示:");
  console.log("1. Tools: 可执行的功能（如获取运势）");
  console.log("2. Resources: 可读取的数据（如星座信息）");
  console.log("3. Prompts: 提示词模板（如运势解读）");
  console.log("4. 三者配合使用，构建完整的 MCP Server");
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

module.exports = FortuneServer;
