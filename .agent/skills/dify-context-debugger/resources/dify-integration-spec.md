# Dify 课时上下文集成规范

## 集成架构

```
前端理论课页面（/lesson/:id）
    ↓ 获取当前课程/课时信息
    ↓
构建 conversation_inputs 对象
    ↓
通过 Dify Chatbot iframe 或 API 传递上下文
    ↓
Dify 工作流接收变量
    ↓
生成课时专属开场内容 → 展示在右侧助教面板
```

## 前端调用示例（TypeScript）

```typescript
// 理论课页面进入时
const buildDifyContext = (courseId: string, lessonId: string, user: User) => {
  return {
    course_id: courseId,
    lesson_id: lessonId,
    user_id: user?.id ?? 'anonymous',
    lesson_title: currentLesson?.title ?? '',
    course_title: currentCourse?.title ?? '',
  };
};

// 传递给 Dify iframe URL 参数
const difyUrl = `${import.meta.env.VITE_DIFY_BASE_URL}/chatbot/${import.meta.env.VITE_DIFY_CHATBOT_TOKEN}`;
```

## Dify 工作流推荐变量配置

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `course_id` | string | 课程唯一标识 |
| `lesson_id` | string | 课时唯一标识 |
| `lesson_title` | string | 课时标题（用于更友好的开场） |
| `user_id` | string | 用户 ID（可用于个性化） |

## 推荐系统提示词模板

```
你是 Agent EDU Lab 平台的 AI 教学助手。
当前学生正在学习：【{{course_title}}】课程中的【{{lesson_title}}】课时。

你的职责：
1. 用 2-3 句话介绍本课时的学习目标
2. 围绕当前课时内容精准回答学生问题
3. 不回答与本课时无关的内容
4. 鼓励学生主动提问和动手实践

课时 ID：{{lesson_id}}
课程 ID：{{course_id}}
```

## 环境变量清单

```bash
# EDU_Frontend/.env
VITE_DIFY_BASE_URL=https://api.dify.ai      # 或自托管地址
VITE_DIFY_CHATBOT_TOKEN=your-chatbot-token  # Dify 应用 Token
VITE_API_BASE_URL=http://localhost:3000      # 后端 API 地址
```
