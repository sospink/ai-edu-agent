---
name: dify-context-debugger
description: 调试和配置 Agent EDU Lab 中的 Dify 课时上下文集成。当用户遇到 Dify 助教不响应、开场内容不随课时变化、conversation_inputs 参数配置问题、Dify API 连接故障时触发。帮助开发者排查 Dify chatbot 嵌入与课时上下文传递问题。
---

# Dify 课时上下文调试指南

## 目标

诊断并修复 Agent EDU Lab 中 Dify AI 助教的上下文感知问题，确保不同课时展示不同的专属开场内容。

## 核心机制说明

读取参考文档了解集成架构：
→ 参见 `resources/dify-integration-spec.md`

## 诊断流程

### Step 1：确认环境变量

检查 `EDU_Frontend/.env` 文件中以下配置项：

```
VITE_DIFY_BASE_URL=<你的 Dify 服务地址，如 https://api.dify.ai>
VITE_DIFY_CHATBOT_TOKEN=<你的 Chatbot Token>
```

验证命令（在浏览器控制台执行）：
```javascript
console.log(import.meta.env.VITE_DIFY_BASE_URL)
console.log(import.meta.env.VITE_DIFY_CHATBOT_TOKEN)
```

### Step 2：检查上下文参数传递

定位前端代码中传递上下文的位置，确认 `conversation_inputs` 包含以下字段：

```typescript
const context = {
  course_id: currentCourseId,       // 课程 ID（必填）
  lesson_id: currentLessonId,       // 课时 ID（必填）
  user_id: currentUser?.id,         // 用户 ID（可选）
  lesson_title: currentLesson?.title, // 课时标题（推荐）
};
```

### Step 3：验证 Dify API 连通性

在终端执行以下 curl 测试：

```bash
curl -X POST "${VITE_DIFY_BASE_URL}/v1/chat-messages" \
  -H "Authorization: Bearer ${VITE_DIFY_CHATBOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {"course_id": "test-001", "lesson_id": "lesson-001"},
    "query": "你好",
    "response_mode": "blocking",
    "user": "debug-user"
  }'
```

期望响应：HTTP 200，包含 `answer` 字段

### Step 4：检查 Dify 工作流配置

确认 Dify 应用侧：
1. 工作流已启用 `course_id` 和 `lesson_id` 作为输入变量
2. 开场提示词引用了这两个变量：`当前课程：{{course_id}}，课时：{{lesson_id}}`
3. 应用类型为 **Chatbot**（非 Workflow）

### Step 5：排查 CORS 问题

如果浏览器控制台出现 CORS 错误：
1. 检查 Dify 服务的 CORS 配置是否允许前端域名
2. 或在 `EDU_Backend` 中配置代理转发，避免前端直接调用 Dify

## 常见错误与解决方案

| 错误现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 助教无响应 | Token 无效或过期 | 重新生成 Dify Chatbot Token |
| 所有课时开场相同 | `conversation_inputs` 未正确传递 | 检查前端上下文传递代码 |
| 401 Unauthorized | Token 格式错误 | 确认 `Bearer ` 前缀存在 |
| 404 Not Found | BASE_URL 路径错误 | 确认 URL 不包含尾部斜杠 |
| 助教回答偏题 | Dify 工作流未配置上下文约束 | 在 Dify 系统提示词中加入课时内容限制 |
| iFrame 不加载 | CSP 内容安全策略限制 | 在前端 `index.html` 添加 Dify 域名到 frame-src |

## 调试最佳实践

1. **分步测试**：先测试 API 连通，再测试上下文传递，最后测试前端展示
2. **不同课时对比**：进入课时 A 和课时 B，验证开场内容是否不同
3. **开发者工具 Network 面板**：监控向 Dify 发出的请求，确认 `inputs` 参数正确
4. **Dify 应用日志**：在 Dify 控制台查看对话日志，确认收到的变量值
