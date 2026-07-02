import { API_BASE_URL } from '@/config';
import i18n, { getCurrentLocale } from '@/i18n';
import { api } from './api';

const directOrData = <T,>(res: unknown): T | undefined => {
  const anyRes = res as { data?: T; error?: string };
  return anyRes?.data ?? (res as T);
};

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const rawText = await response.text().catch(() => '');
  if (!rawText.trim()) return `${fallback}（HTTP ${response.status}）`;
  try {
    const data = JSON.parse(rawText) as { error?: string; message?: string; details?: string };
    return data.error || data.message || data.details || fallback;
  } catch {
    return rawText.slice(0, 200) || fallback;
  }
};

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

export interface CoachMeta {
  hintLevel: 1 | 2 | 3;
  failureCount: number;
}

export interface CoachStreamRequest {
  manualId: number;
  stepOrder: number;
  question: string;
  labSessionId?: number;
  chatHistory?: ChatMessage[];
  escalate?: boolean;
  troubleshootMode?: boolean;
}

export interface AgentFAQItem {
  id: number;
  manualId: number;
  classId: number;
  stepId: number;
  stepOrder: number;
  question: string;
  answer: string;
  status: string;
  publishedAt?: string | null;
}

export interface AgentInterventionRecord {
  id: number;
  manualId: number;
  classId: number;
  stepId: number;
  studentId: number;
  teacherId: number;
  actionType: 'student_reminder' | 'class_broadcast' | 'material_note';
  title: string;
  content: string;
  status: 'pending' | 'read' | 'archived';
  readAt?: string | null;
  createdAt: string;
}

export interface AgentReflectionCard {
  id: number;
  userId: number;
  manualId: number;
  summary: string;
  strengths?: { items?: string[] };
  stuckPoints?: { items?: string[] };
  reviewSuggestions?: { items?: string[] };
  evidence?: Record<string, unknown>;
  status: 'draft' | 'viewed';
  createdAt: string;
  updatedAt: string;
}

export type AgentEventType =
  | 'widget_open'
  | 'chat_sent'
  | 'hint_requested'
  | 'verify_triggered'
  | 'verify_failed'
  | 'verify_passed'
  | 'step_completed'
  | 'troubleshoot_click';

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
        'X-Locale': getCurrentLocale(),
      },
      body: JSON.stringify({ question, stepContext, chatHistory }),
    });

    if (!response.ok) {
      onError?.(await readErrorMessage(response, i18n.t('errors:AI_UNAVAILABLE')));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.(i18n.t('errors:STREAM_UNREADABLE'));
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
    onError?.(error.message || i18n.t('errors:AI_UNAVAILABLE'));
  }
}

export async function coachStream(
  data: CoachStreamRequest,
  onMeta?: (meta: CoachMeta) => void,
  onChunk?: (content: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch(`${API_BASE_URL}/agent/coach/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Locale': getCurrentLocale(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      onError?.(await readErrorMessage(response, i18n.t('errors:AI_UNAVAILABLE')));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.(i18n.t('errors:STREAM_UNREADABLE'));
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
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') {
          onDone?.();
          return;
        }
        if (payload.startsWith('[META]')) {
          try {
            onMeta?.(JSON.parse(payload.slice(6)) as CoachMeta);
          } catch {
            // 忽略无效 metadata
          }
          continue;
        }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.content) onChunk?.(parsed.content);
          if (parsed.error) {
            onError?.(parsed.error);
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    onDone?.();
  } catch (error: any) {
    onError?.(error.message || i18n.t('errors:AI_UNAVAILABLE'));
  }
}

export async function recordEvent(data: {
  manualId: number;
  stepOrder: number;
  eventType: AgentEventType;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await api.post('/agent/events', data);
}

export async function getCoachHistory(manualId: number, stepOrder: number): Promise<ChatMessage[]> {
  const res = await api.get<{ items: ChatMessage[] }>(`/agent/coach/history?manualId=${manualId}&stepOrder=${stepOrder}`);
  if (res.error) return [];
  return directOrData<{ items: ChatMessage[] }>(res)?.items || [];
}

export async function getFAQ(manualId: number, stepOrder: number, classId: number): Promise<AgentFAQItem[]> {
  const params = new URLSearchParams({ manualId: String(manualId), stepOrder: String(stepOrder), classId: String(classId) });
  const res = await api.get<{ items: AgentFAQItem[] }>(`/agent/faq?${params.toString()}`);
  if (res.error) return [];
  return directOrData<{ items: AgentFAQItem[] }>(res)?.items || [];
}

export async function getPendingInterventions(manualId: number): Promise<AgentInterventionRecord[]> {
  const res = await api.get<{ items: AgentInterventionRecord[] }>(`/agent/pending-interventions?manualId=${manualId}`);
  if (res.error) return [];
  return directOrData<{ items: AgentInterventionRecord[] }>(res)?.items || [];
}

export async function markInterventionRead(id: number): Promise<AgentInterventionRecord | null> {
  const res = await api.post<AgentInterventionRecord>(`/agent/interventions/${id}/read`, {});
  if (res.error) return null;
  return directOrData<AgentInterventionRecord>(res) || null;
}

export async function reflect(manualId: number): Promise<AgentReflectionCard | null> {
  const res = await api.post<AgentReflectionCard>('/agent/reflect', { manualId });
  if (res.error) throw new Error(res.error);
  return directOrData<AgentReflectionCard>(res) || null;
}

export async function markReflectionViewed(id: number): Promise<AgentReflectionCard | null> {
  const res = await api.post<AgentReflectionCard>(`/agent/reflections/${id}/viewed`, {});
  if (res.error) return null;
  return directOrData<AgentReflectionCard>(res) || null;
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
