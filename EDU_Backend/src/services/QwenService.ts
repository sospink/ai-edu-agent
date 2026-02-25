import OpenAI from 'openai';
import { Response } from 'express';

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const MODEL = process.env.QWEN_MODEL || 'qwen3-max';

interface ChatRequest {
  question: string;
  stepContext?: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// 构建系统提示词
function buildSystemPrompt(stepContext?: string): string {
  let prompt = `你是一个专业的编程教学助手，帮助学生学习编程知识。
请用简洁、清晰的语言回答问题，必要时提供代码示例。
回答要有条理，适合初学者理解。`;

  if (stepContext) {
    prompt += `\n\n当前学习内容：\n${stepContext}`;
  }

  return prompt;
}

// 非流式问答
export async function chat(req: ChatRequest): Promise<{ answer: string }> {
  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(req.stepContext) },
    ];

    // 添加历史消息
    if (req.chatHistory) {
      for (const msg of req.chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 添加当前问题
    messages.push({ role: 'user', content: req.question });

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
    });

    return { answer: completion.choices[0]?.message?.content || '抱歉，我无法回答这个问题。' };
  } catch (error: any) {
    console.error('[QwenService] Chat error:', error);
    throw new Error('AI 服务暂时不可用，请稍后再试');
  }
}

// 流式问答 (SSE)
export async function chatStream(req: ChatRequest, res: Response): Promise<void> {
  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(req.stepContext) },
    ];

    if (req.chatHistory) {
      for (const msg of req.chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: req.question });

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await client.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[QwenService] Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: 'AI 服务暂时不可用' })}\n\n`);
    res.end();
  }
}

// 代码解释
export async function explainCode(code: string, language: string): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: '你是一个编程教学助手，请用简洁易懂的语言解释代码，适合初学者理解。',
        },
        {
          role: 'user',
          content: `请解释这段 ${language} 代码：\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
    });

    return completion.choices[0]?.message?.content || '无法解释这段代码。';
  } catch (error: any) {
    console.error('[QwenService] Explain error:', error);
    throw new Error('AI 服务暂时不可用，请稍后再试');
  }
}

// 验证失败 AI 建议
interface VerificationHelpRequest {
  stepTitle?: string;
  stepContext?: string;
  verificationType?: string;
  errorMessage: string;
  errorDetails?: string;
}

export async function getVerificationHelp(req: VerificationHelpRequest): Promise<string> {
  try {
    let prompt = `学生在完成编程实验时遇到了验证失败的问题，请帮助分析原因并给出解决建议。

验证错误信息: ${req.errorMessage}`;

    if (req.errorDetails) {
      prompt += `\n详细信息: ${req.errorDetails}`;
    }
    if (req.stepTitle) {
      prompt += `\n当前步骤: ${req.stepTitle}`;
    }
    if (req.verificationType) {
      prompt += `\n验证类型: ${req.verificationType}`;
    }
    if (req.stepContext) {
      prompt += `\n步骤内容摘要: ${req.stepContext}`;
    }

    prompt += `\n\n请用简洁的语言分析可能的原因，并给出具体的解决步骤。`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: '你是一个编程教学助手，帮助学生排查实验中遇到的问题。请给出简洁、实用的建议。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return completion.choices[0]?.message?.content || '暂时无法提供建议，请检查操作步骤是否正确。';
  } catch (error: any) {
    console.error('[QwenService] VerificationHelp error:', error);
    throw new Error('AI 服务暂时不可用');
  }
}
