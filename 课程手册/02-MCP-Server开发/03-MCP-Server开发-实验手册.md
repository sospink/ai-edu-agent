# MCP Server 开发 - 今日运势服务

> 本实验将指导您开发一个完整的 MCP (Model Context Protocol) Server，实现"今日运势"服务。您将学习 MCP 的三大核心能力：Tools（工具）、Resources（资源）、Prompts（提示词模板）。通过本实验，您将掌握如何设计和实现一个标准的 MCP Server，让 AI 能够调用您的服务。MCP 是连接 AI 和外部功能的桥梁，是构建 AI 应用的重要技术。完成本实验后，您将能够开发自己的 MCP Server，为 AI 提供各种能力扩展。

## 步骤 1: 配置 API 环境（可选）

### 关于 MCP Server 的 API 配置

MCP Server 开发主要演示协议和接口设计，本课程的示例代码使用模拟数据，**不需要真实的 API 调用**。

但是，如果您想在后续开发中集成真实的 AI 能力，可以配置 API 环境。

**查看环境配置**：

```bash
cat /workspace/.env
```

您会看到：

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

**配置说明**：
- MCP Server 示例代码**不依赖** API 配置
- 如果您想扩展功能（如智能运势解读），可以使用这些配置
- 配置方法：`nano /workspace/.env` 或 `vi /workspace/.env`

**本课程重点**：
- 理解 MCP 协议
- 学习 Tools、Resources、Prompts 设计
- 掌握接口定义和数据格式

<!-- questions: MCP Server 必须用 API 吗|如何集成真实 API|有哪些应用场景 -->

## 步骤 2: 认识 MCP 协议和实验环境

### 什么是 MCP？

MCP (Model Context Protocol) 是一个开放协议，用于连接 AI 模型和外部工具、数据源。可以把它理解为 AI 的"插件系统"。

**MCP 的三大能力**：

1. **Tools（工具）** - 可执行的功能
   - 例如：获取天气、发送邮件、查询数据库
   - AI 可以主动调用这些工具完成任务

2. **Resources（资源）** - 可读取的数据
   - 例如：文档、配置文件、数据库记录
   - AI 可以读取这些资源获取信息

3. **Prompts（提示词模板）** - 预定义的提示词
   - 例如：特定任务的提示词模板
   - AI 可以使用这些模板提高效果

### 查看实验环境

进入课程目录：

```bash
cd /workspace/courses/mcp-server
ls -la
```

您会看到：
- `example.js` - 完整的 MCP Server 示例
- `README.md` - 课程说明

### 查看示例代码结构

查看代码的前60行，了解整体结构：

```bash
head -n 60 /workspace/courses/mcp-server/example.js
```

您会看到 `FortuneServer` 类，它实现了一个完整的 MCP Server。

<!-- questions: MCP 和普通 API 有什么区别|为什么需要 MCP|MCP 的应用场景有哪些 -->

## 步骤 3: 理解 Tools（工具能力）

### 什么是 Tools？

Tools 是 MCP Server 提供的可执行功能。AI 可以像调用函数一样使用这些工具。

### 查看工具定义

查看示例中的工具函数：

```bash
grep -A 15 "getTodayFortune" /workspace/courses/mcp-server/example.js | head -n 20
```

这个工具可以获取指定星座的今日运势。

### 查看工具列表

查看 MCP Server 如何声明工具：

```bash
grep -A 20 "listCapabilities" /workspace/courses/mcp-server/example.js | head -n 25
```

注意 `tools` 数组中的定义，包含：
- `name` - 工具名称
- `description` - 工具描述
- `inputSchema` - 输入参数的 JSON Schema

这就是 MCP 的标准格式！

<!-- questions: 什么是 JSON Schema|如何设计好的工具接口|工具和函数有什么区别 -->

## 步骤 4: 运行示例程序

### 执行示例代码

运行完整的 MCP Server 示例：

```bash
cd /workspace/courses/mcp-server && node example.js
```

### 观察输出

您会看到三个示例：

1. **能力列表** - 展示 Server 提供的所有能力
2. **Tool 调用** - 获取狮子座的今日运势
3. **Resource 读取** - 读取星座信息
4. **Prompt 模板** - 展示运势解读提示词

### 理解输出结构

注意运势数据的结构：
```json
{
  "zodiac": "狮子座",
  "date": "2026/1/15",
  "overall": "⭐⭐⭐⭐",
  "love": "⭐⭐⭐",
  "career": "⭐⭐⭐⭐⭐",
  ...
}
```

这是一个结构化的数据返回，AI 可以解析和使用。

<!-- verify: command:cd /workspace/courses/mcp-server && node example.js|contains|MCP Server -->
<!-- questions: 为什么要返回结构化数据|如何设计好的数据格式|JSON 格式有什么优势 -->

## 步骤 5: 创建简化版 MCP Server

### 任务说明

现在让我们创建一个简化版的 MCP Server，实现一个"幸运数字"服务。

### 创建新文件

```bash
cd /workspace/courses/mcp-server && touch lucky-number-server.js
```

### 编写代码


使用 `cat` 命令写入代码：

```bash
cat > /workspace/courses/mcp-server/lucky-number-server.js << 'EOF'
#!/usr/bin/env node
/**
 * 简化版 MCP Server - 幸运数字服务
 * 学习 MCP 的核心概念
 */

class LuckyNumberServer {
  constructor() {
    this.name = "lucky-number";
    this.version = "1.0.0";
    
    // 存储用户的幸运数字历史
    this.history = [];
  }
  
  /**
   * Tool 1: 生成幸运数字
   */
  async generateLuckyNumber(userName) {
    const number = Math.floor(Math.random() * 100) + 1;
    const timestamp = new Date().toISOString();
    
    const result = {
      userName: userName,
      luckyNumber: number,
      date: new Date().toLocaleDateString('zh-CN'),
      message: `${userName}，您今天的幸运数字是 ${number}！`,
      timestamp: timestamp
    };
    
    // 保存到历史
    this.history.push(result);
    
    return result;
  }
  
  /**
   * Tool 2: 解读幸运数字
   */
  async interpretNumber(number) {
    const interpretations = {
      range_1_20: "代表新的开始和机遇",
      range_21_40: "代表稳定和成长",
      range_41_60: "代表变化和转折",
      range_61_80: "代表成功和收获",
      range_81_100: "代表圆满和完成"
    };
    
    let range;
    if (number <= 20) range = "range_1_20";
    else if (number <= 40) range = "range_21_40";
    else if (number <= 60) range = "range_41_60";
    else if (number <= 80) range = "range_61_80";
    else range = "range_81_100";
    
    return {
      number: number,
      interpretation: interpretations[range],
      advice: "保持积极的心态，好运会降临！"
    };
  }
  
  /**
   * Resource: 获取历史记录
   */
  async getHistory() {
    return {
      uri: "lucky://history",
      mimeType: "application/json",
      content: JSON.stringify(this.history, null, 2)
    };
  }
  
  /**
   * Prompt: 幸运数字解读模板
   */
  getInterpretationPrompt() {
    return {
      name: "lucky-number-interpretation",
      description: "解读幸运数字的提示词模板",
      arguments: [
        {
          name: "number",
          description: "幸运数字",
          required: true
        },
        {
          name: "user_name",
          description: "用户名称",
          required: true
        }
      ],
      template: `你是一位数字命理学专家。请为 {{user_name}} 解读幸运数字 {{number}}。

请提供：
1. 数字的象征意义
2. 今日运势建议
3. 幸运提示

语气要温暖、积极、给人信心。`
    };
  }
  
  /**
   * MCP 能力列表
   */
  listCapabilities() {
    return {
      tools: [
        {
          name: "generate_lucky_number",
          description: "为用户生成今日幸运数字",
          inputSchema: {
            type: "object",
            properties: {
              userName: {
                type: "string",
                description: "用户名称"
              }
            },
            required: ["userName"]
          }
        },
        {
          name: "interpret_number",
          description: "解读数字的含义",
          inputSchema: {
            type: "object",
            properties: {
              number: {
                type: "number",
                description: "要解读的数字（1-100）",
                minimum: 1,
                maximum: 100
              }
            },
            required: ["number"]
          }
        }
      ],
      resources: [
        {
          uri: "lucky://history",
          name: "幸运数字历史",
          description: "获取所有用户的幸运数字历史记录",
          mimeType: "application/json"
        }
      ],
      prompts: [
        {
          name: "lucky-number-interpretation",
          description: "幸运数字解读提示词模板"
        }
      ]
    };
  }
}

// 测试代码
async function main() {
  console.log("=".repeat(60));
  console.log("简化版 MCP Server - 幸运数字服务");
  console.log("=".repeat(60));
  console.log();
  
  const server = new LuckyNumberServer();
  
  // 1. 展示能力
  console.log("📋 Server 能力列表");
  console.log("-".repeat(60));
  const capabilities = server.listCapabilities();
  console.log(`Tools: ${capabilities.tools.length} 个`);
  console.log(`Resources: ${capabilities.resources.length} 个`);
  console.log(`Prompts: ${capabilities.prompts.length} 个`);
  console.log();
  
  // 2. 调用 Tool - 生成幸运数字
  console.log("🔧 Tool 调用: 生成幸运数字");
  console.log("-".repeat(60));
  const result1 = await server.generateLuckyNumber("小明");
  console.log(JSON.stringify(result1, null, 2));
  console.log();
  
  // 3. 调用 Tool - 解读数字
  console.log("🔧 Tool 调用: 解读数字");
  console.log("-".repeat(60));
  const result2 = await server.interpretNumber(result1.luckyNumber);
  console.log(JSON.stringify(result2, null, 2));
  console.log();
  
  // 4. 读取 Resource - 历史记录
  console.log("📚 Resource 读取: 历史记录");
  console.log("-".repeat(60));
  const history = await server.getHistory();
  console.log(`URI: ${history.uri}`);
  console.log(`Content:\n${history.content}`);
  console.log();
  
  // 5. 获取 Prompt 模板
  console.log("💬 Prompt 模板");
  console.log("-".repeat(60));
  const prompt = server.getInterpretationPrompt();
  console.log(`Name: ${prompt.name}`);
  console.log(`Template:\n${prompt.template}`);
  console.log();
  
  console.log("✅ MCP Server 测试完成！");
}

main().catch(console.error);
EOF
```

### 运行您的 MCP Server

```bash
cd /workspace/courses/mcp-server && node lucky-number-server.js
```

观察输出，您应该看到完整的 MCP Server 运行流程。

<!-- verify: file_exists:/workspace/courses/mcp-server/lucky-number-server.js -->
<!-- verify: command:cd /workspace/courses/mcp-server && node lucky-number-server.js|contains|MCP Server 测试完成 -->
<!-- questions: 如何添加新的工具|如何设计资源的 URI|提示词模板有什么用 -->

## 步骤 6: 理解 Resources（资源能力）

### 什么是 Resources？

Resources 是 MCP Server 提供的可读取数据。与 Tools 不同，Resources 是静态的数据源。

### Resources 的特点

1. **URI 标识** - 每个资源有唯一的 URI
2. **MIME 类型** - 指定资源的数据格式
3. **只读** - 资源通常是只读的

### 查看资源实现

查看示例中的资源实现：

```bash
grep -A 10 "getZodiacResource" /workspace/courses/mcp-server/example.js
```

注意资源返回的格式：
- `uri` - 资源的唯一标识符
- `mimeType` - 数据类型（如 application/json）
- `content` - 实际的数据内容

### 设计资源 URI

好的 URI 设计：
- `fortune://zodiac/leo` - 清晰的层级结构
- `lucky://history` - 简洁明了
- `weather://city/beijing/today` - 语义化

<!-- questions: Resources 和 Tools 的区别|什么时候用 Resource|如何设计好的 URI -->

## 步骤 7: 理解 Prompts（提示词模板）

### 什么是 Prompts？

Prompts 是预定义的提示词模板，AI 可以使用这些模板来完成特定任务。

### Prompts 的优势

1. **标准化** - 统一的提示词格式
2. **可复用** - 多个场景可以使用同一模板
3. **可维护** - 集中管理提示词

### 查看提示词模板

查看示例中的提示词模板：

```bash
grep -A 20 "getFortunePromptTemplate" /workspace/courses/mcp-server/example.js
```

### 模板的组成部分

一个完整的提示词模板包含：
- `name` - 模板名称
- `description` - 模板描述
- `arguments` - 模板参数定义
- `template` - 实际的提示词内容（使用 {{变量}} 占位符）

### 模板变量替换

模板中的 `{{zodiac}}` 和 `{{fortune_data}}` 会被实际值替换：

```
{{zodiac}} → "狮子座"
{{fortune_data}} → {"overall": "⭐⭐⭐⭐", ...}
```

<!-- questions: 为什么要用模板|如何设计好的提示词模板|模板和普通提示词的区别 -->

## 步骤 8: 扩展功能 - 添加新工具

### 任务说明

让我们为幸运数字服务添加一个新工具：比较两个数字。

### 修改代码

```bash
cat >> /workspace/courses/mcp-server/lucky-number-server.js << 'EOF'

// 在 LuckyNumberServer 类中添加新方法
// 注意：这里为了演示，我们创建一个新版本

console.log("\n" + "=".repeat(60));
console.log("扩展示例：添加数字比较功能");
console.log("=".repeat(60));

// 新工具：比较两个数字
function compareNumbers(num1, num2) {
  const diff = Math.abs(num1 - num2);
  let relationship;
  
  if (diff === 0) {
    relationship = "完全相同，代表和谐统一";
  } else if (diff <= 10) {
    relationship = "非常接近，代表相互吸引";
  } else if (diff <= 30) {
    relationship = "适度差异，代表互补平衡";
  } else {
    relationship = "差异较大，代表多样性";
  }
  
  return {
    number1: num1,
    number2: num2,
    difference: diff,
    relationship: relationship,
    advice: "不同的数字组合带来不同的能量"
  };
}

// 测试新工具
const result = compareNumbers(42, 58);
console.log("\n比较数字 42 和 58:");
console.log(JSON.stringify(result, null, 2));
console.log("\n✅ 新工具添加成功！");
EOF
```

### 运行扩展版本

```bash
cd /workspace/courses/mcp-server && node lucky-number-server.js
```

您会看到新增的数字比较功能。

<!-- verify: command:cd /workspace/courses/mcp-server && node lucky-number-server.js|contains|新工具添加成功 -->
<!-- questions: 如何设计工具的参数|如何处理错误情况|如何测试新工具 -->

## 步骤 9: 总结与实践建议

### 本节课学到了什么

恭喜您完成了 MCP Server 开发实验！让我们回顾关键知识点：

**MCP 三大能力**：
1. **Tools** - 可执行的功能（如生成幸运数字）
2. **Resources** - 可读取的数据（如历史记录）
3. **Prompts** - 提示词模板（如解读模板）

**核心概念**：
- MCP Server 是 AI 的能力扩展
- 使用标准的 JSON Schema 定义接口
- 结构化的数据返回便于 AI 处理
- 提示词模板提高 AI 效果

**实践技能**：
- 实现 MCP Server 的基本结构
- 定义 Tools、Resources、Prompts
- 使用 JSON Schema 描述接口
- 测试和验证 MCP Server

### MCP Server 开发最佳实践

1. **清晰的命名** - 工具名称要语义化
2. **完整的文档** - 每个能力都要有描述
3. **标准的接口** - 遵循 JSON Schema 规范
4. **错误处理** - 处理各种异常情况
5. **版本管理** - 记录 Server 版本

### 实际应用场景

MCP Server 可以用于：
- **数据查询** - 连接数据库、API
- **工具调用** - 发送邮件、创建任务
- **知识检索** - 访问文档、知识库
- **服务集成** - 连接第三方服务

### 下一步学习

在后续课程中，您将学习：
- ADE 智能体开发 - 创建代码翻译 Skill
- 单 Agent 开发 - 构建完整的 Agent 系统
- 多 Agent 协作 - 实现复杂的协作任务

### 扩展练习

尝试以下练习巩固学习：

1. **添加新工具** - 实现"幸运颜色"生成功能
2. **添加资源** - 提供"数字百科"资源
3. **优化模板** - 设计更详细的解读模板
4. **错误处理** - 添加参数验证和错误提示
5. **实际集成** - 将 MCP Server 连接到真实的 AI 应用

### 参考资源

- MCP 官方文档：https://modelcontextprotocol.io
- JSON Schema 规范：https://json-schema.org
- Node.js 文档：https://nodejs.org

继续加油！MCP 是连接 AI 和现实世界的桥梁！🚀

<!-- questions: 如何部署 MCP Server|如何调试 MCP Server|有什么开源的 MCP Server 可以参考 -->
