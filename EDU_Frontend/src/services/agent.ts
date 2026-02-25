import { API_BASE_URL } from '@/config';
import { api } from './api';

// 类型定义
export interface AgentManual {
  id: number;
  title: string;
  description: string;
  steps: AgentStepData[];
}

export interface AgentStepData {
  id: number;
  title: string;
  content: ContentBlock[];
  quickQuestions: string[];
  verification: Verification | null;
}

export interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean;
}

export interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  path?: string;
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  port?: number;
  script?: string;
}

export interface VerifyResult {
  success: boolean;
  message: string;
  details?: string;
  checkItems?: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
}

export interface UserProgress {
  currentStep: number;
  completedSteps: number[];
  chatHistory: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// 获取手册
export async function getManual(sourceType: number, sourceId: number): Promise<AgentManual | null> {
  const res = await api.get<AgentManual>(`/agent/manual/${sourceType}/${sourceId}`);
  if (res.error) {
    console.error('[AgentService] getManual error:', res.error);
    return null;
  }
  return res as unknown as AgentManual;
}

// 验证步骤
export async function verifyStep(
  manualId: number,
  stepOrder: number,
  containerId: string
): Promise<VerifyResult> {
  const res = await api.post<VerifyResult>('/agent/verify', { manualId, stepOrder, containerId });
  if (res.error) {
    return { success: false, message: res.error };
  }
  return res as unknown as VerifyResult;
}

// AI 问答（非流式）
export async function chat(
  question: string,
  stepContext?: string,
  chatHistory?: ChatMessage[]
): Promise<{ answer: string }> {
  const res = await api.post<{ answer: string }>('/agent/chat', { question, stepContext, chatHistory });
  if (res.error) {
    throw new Error(res.error);
  }
  return res as unknown as { answer: string };
}

// AI 问答（流式 SSE）
export async function chatStream(
  question: string,
  stepContext?: string,
  chatHistory?: ChatMessage[],
  onChunk?: (content: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  const token = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${API_BASE_URL}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ question, stepContext, chatHistory }),
    });

    if (!response.ok) {
      const error = await response.json();
      onError?.(error.error || 'AI 服务暂时不可用');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('无法读取响应流');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onChunk?.(parsed.content);
            }
            if (parsed.error) {
              onError?.(parsed.error);
              return;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    onDone?.();
  } catch (error: any) {
    onError?.(error.message || 'AI 服务暂时不可用');
  }
}

// 代码解释
export async function explainCode(code: string, language: string): Promise<string> {
  const res = await api.post<{ explanation: string }>('/agent/explain', { code, language });
  if (res.error) {
    throw new Error(res.error);
  }
  return (res as unknown as { explanation: string }).explanation;
}

// 获取用户进度
export async function getProgress(sourceType: number, sourceId: number): Promise<UserProgress> {
  const res = await api.get<UserProgress>(`/agent/progress/${sourceType}/${sourceId}`);
  if (res.error) {
    return { currentStep: 0, completedSteps: [], chatHistory: [] };
  }
  return res as unknown as UserProgress;
}

// 更新用户进度
export async function updateProgress(
  sourceType: number,
  sourceId: number,
  data: Partial<UserProgress>
): Promise<void> {
  await api.post('/agent/progress', { sourceType, sourceId, ...data });
}

// 获取 AI 验证建议
export async function getVerificationSuggestion(data: {
  stepTitle?: string;
  stepContext?: string;
  verificationType?: string;
  errorMessage: string;
  errorDetails?: string;
}): Promise<string> {
  const res = await api.post<{ suggestion: string }>('/agent/suggestion', data);
  if (res.error) {
    throw new Error(res.error);
  }
  return (res as unknown as { suggestion: string }).suggestion;
}
