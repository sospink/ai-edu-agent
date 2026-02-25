# MCP Server 开发 - 知识手册

## 📚 课程概述

Model Context Protocol (MCP) 是一个开放协议，用于在AI应用和外部数据源、工具之间建立标准化的连接。本课程将教你如何开发MCP Server，让AI能够访问和使用你的服务。

### 学习目标

- 理解MCP协议的核心概念
- 掌握MCP Server的开发流程
- 学会设计和实现MCP工具
- 了解MCP在AI应用中的作用

---

## 🎯 什么是MCP？

### 基本概念

**MCP (Model Context Protocol)** 是由Anthropic提出的开放协议，旨在解决AI应用与外部系统集成的标准化问题。

**核心思想**：
- AI模型不需要知道如何访问每个具体的数据源
- 数据源通过标准协议暴露能力
- 中间层（MCP Server）负责协议转换

### MCP的三个角色

1. **MCP Host**：AI应用（如Claude Desktop、IDE插件）
2. **MCP Client**：连接到Server的客户端
3. **MCP Server**：提供工具和资源的服务端

### 为什么需要MCP？

**传统方式的问题**：
- 每个AI应用需要单独集成每个数据源
- 没有统一的接口标准
- 维护成本高，扩展性差

**MCP的优势**：
- 标准化的协议
- 一次开发，多处使用
- 易于扩展和维护
- 社区生态丰富

---

## 🏗️ MCP架构

### 整体架构

```
┌─────────────┐
│  MCP Host   │  (AI应用)
│  (Claude)   │
└──────┬──────┘
       │
       │ MCP Protocol
       │
┌──────┴──────┐
│ MCP Client  │  (连接层)
└──────┬──────┘
       │
       │ JSON-RPC
       │
┌──────┴──────┐
│ MCP Server  │  (你开发的服务)
└──────┬──────┘
       │
       │
┌──────┴──────┐
│  Resources  │  (数据、工具、提示词)
└─────────────┘
```

### 通信协议

MCP使用**JSON-RPC 2.0**作为底层通信协议：

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_fortune",
    "arguments": {}
  },
  "id": 1
}
```

### 传输方式

MCP支持多种传输方式：
- **stdio**：标准输入输出（最常用）
- **HTTP/SSE**：HTTP + Server-Sent Events
- **WebSocket**：双向通信

---

## 🔧 MCP Server的核心概念

### 1. Resources（资源）

Resources是MCP Server提供的数据源，可以是：
- 文件内容
- 数据库记录
- API响应
- 实时数据流

**特点**：
- 只读访问
- 支持URI定位
- 可以是静态或动态的

### 2. Tools（工具）

Tools是MCP Server提供的可执行功能，可以是：
- 数据查询
- 计算操作
- 外部API调用
- 系统命令执行

**特点**：
- 可以修改状态
- 需要定义输入参数
- 返回执行结果

### 3. Prompts（提示词）

Prompts是预定义的提示词模板，可以：
- 提供常用的提示词
- 支持参数化
- 帮助用户快速开始

---

## 💡 开发MCP Server的步骤

### 1. 安装SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 2. 创建Server实例

```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "my-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
```

### 3. 注册工具

```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "my_tool",
        description: "工具描述",
        inputSchema: {
          type: "object",
          properties: {
            param1: {
              type: "string",
              description: "参数描述",
            },
          },
          required: ["param1"],
        },
      },
    ],
  };
});
```

### 4. 实现工具逻辑

```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "my_tool") {
    const { param1 } = request.params.arguments;
    
    // 执行工具逻辑
    const result = doSomething(param1);
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }
});
```

### 5. 启动Server

```javascript
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 🎨 实际应用场景

### 1. 数据访问

**场景**：让AI访问数据库、文件系统、API

**示例**：
- 查询数据库记录
- 读取配置文件
- 调用第三方API

### 2. 工具集成

**场景**：为AI提供实用工具

**示例**：
- 计算器
- 单位转换
- 日期时间处理

### 3. 系统操作

**场景**：让AI执行系统命令

**示例**：
- 文件操作
- 进程管理
- 网络请求

### 4. 业务逻辑

**场景**：封装业务功能

**示例**：
- 订单处理
- 用户管理
- 数据分析

---

## 📊 MCP工具设计原则

### 1. 单一职责

每个工具只做一件事，做好一件事。

❌ 错误：
```javascript
{
  name: "manage_user",
  description: "创建、更新、删除用户"
}
```

✅ 正确：
```javascript
{
  name: "create_user",
  description: "创建新用户"
},
{
  name: "update_user",
  description: "更新用户信息"
}
```

### 2. 清晰的输入输出

明确定义参数类型和返回格式。

```javascript
inputSchema: {
  type: "object",
  properties: {
    user_id: {
      type: "string",
      description: "用户ID，格式：UUID"
    },
    name: {
      type: "string",
      description: "用户名，2-20个字符"
    }
  },
  required: ["user_id", "name"]
}
```

### 3. 错误处理

提供友好的错误信息。

```javascript
if (!isValidUserId(user_id)) {
  throw new Error("无效的用户ID格式");
}
```

### 4. 幂等性

相同的输入应该产生相同的输出。

```javascript
// 查询操作天然幂等
function getUser(id) {
  return database.findById(id);
}
```

---

## ⚠️ 安全注意事项

### 1. 输入验证

**永远不要信任用户输入！**

```javascript
// 验证参数
if (typeof param !== 'string') {
  throw new Error("参数必须是字符串");
}

// 限制长度
if (param.length > 1000) {
  throw new Error("参数过长");
}

// 过滤特殊字符
const sanitized = param.replace(/[<>]/g, '');
```

### 2. 权限控制

```javascript
// 检查权限
if (!hasPermission(user, 'read_data')) {
  throw new Error("权限不足");
}
```

### 3. 速率限制

```javascript
// 限制调用频率
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000 // 1分钟
});
```

### 4. 敏感信息

```javascript
// 不要返回敏感信息
return {
  user_id: user.id,
  name: user.name,
  // ❌ 不要返回密码
  // password: user.password
};
```

---

## 🚀 进阶技巧

### 1. 异步处理

```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // 使用 async/await
  const result = await fetchDataFromAPI();
  return { content: [{ type: "text", text: result }] };
});
```

### 2. 流式响应

```javascript
// 对于大量数据，使用流式响应
async function* streamData() {
  for (const chunk of dataChunks) {
    yield chunk;
  }
}
```

### 3. 缓存机制

```javascript
const cache = new Map();

function getCachedData(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = fetchData(key);
  cache.set(key, data);
  return data;
}
```

### 4. 日志记录

```javascript
import { Logger } from './logger.js';

const logger = new Logger('mcp-server');

logger.info('Tool called', {
  tool: request.params.name,
  args: request.params.arguments
});
```

---

## 📖 MCP生态系统

### 官方资源

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **SDK Documentation**: https://github.com/modelcontextprotocol/sdk
- **Example Servers**: https://github.com/modelcontextprotocol/servers

### 社区资源

- **Awesome MCP**: 精选的MCP资源列表
- **MCP Discord**: 官方社区讨论
- **GitHub Topics**: #mcp-server

### 常用MCP Servers

- **filesystem**: 文件系统访问
- **github**: GitHub API集成
- **postgres**: PostgreSQL数据库
- **puppeteer**: 浏览器自动化

---

## 🎓 总结

MCP是连接AI和外部世界的桥梁：

1. **标准化协议** - 统一的接口规范
2. **易于开发** - 简单的SDK和工具
3. **灵活扩展** - 支持各种数据源和工具
4. **安全可靠** - 内置安全机制

掌握MCP开发，你就能为AI应用提供强大的扩展能力！

---

**下一步**：完成实验手册中的实践任务，开发你的第一个MCP Server。

