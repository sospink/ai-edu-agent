import { api } from './api';

export type OpenclawViewScope = 'all' | 'latest_turn';

interface ViewQueryOptions {
  scope?: OpenclawViewScope;
  sinceTs?: number;
}

export interface ThinkingViewMessage {
  id: string;
  ts: number;
  source: 'feishu';
  role: 'assistant';
  content: string;
  messageId?: string;
  msgType?: string;
  fileKey?: string;
  fileName?: string;
}

export interface ThinkingView {
  messages: ThinkingViewMessage[];
}

export interface ExecutingViewEvent {
  id: string;
  ts: number;
  title: string;
  desc: string;
  level: 'info' | 'warn' | 'error';
  source?: 'gateway_ws' | 'feishu_channel' | 'assistant' | 'system';
  kind?:
    | 'user_input'
    | 'tool_call'
    | 'tool_result'
    | 'agent_reply'
    | 'gateway_res'
    | 'feishu_inbound'
    | 'feishu_dispatch'
    | 'feishu_stream_start'
    | 'feishu_stream_end'
    | 'feishu_dispatch_complete'
    | 'assistant_output'
    | 'system';
  method?: string;
  messageId?: string;
  cardId?: string;
  sessionKey?: string;
  queuedFinal?: boolean;
  replies?: number;
}

export interface ExecutingToolchainSkill {
  id: string;
  name: string;
  active: boolean;
  state: 'ready' | 'missing' | 'disabled' | 'blocked' | 'unavailable';
  source: string;
  detail: string;
}

export interface ExecutingView {
  status: string;
  progress: number;
  currentStep: string;
  events: ExecutingViewEvent[];
  toolchain: ExecutingToolchainSkill[];
}

export interface CompletedArtifact {
  id: string;
  name: string;
  type: 'file' | 'image' | 'audio' | 'link';
  size?: string;
  url: string;
  source: 'openclaw' | 'feishu';
}

export interface CompletedFinalMessage {
  id: string;
  ts: number;
  content: string;
}

export interface CompletedView {
  summary: string;
  artifacts: CompletedArtifact[];
  finalMessages: CompletedFinalMessage[];
  steps: CompletedStep[];
  metrics: CompletedMetrics;
}

export interface CompletedStep {
  id: string;
  title: string;
  desc: string;
  ts: number;
  status: 'success' | 'warning' | 'error';
}

export interface CompletedMetrics {
  durationSeconds: number;
  successRate: number;
  totalSteps: number;
  totalEvents: number;
  activeSkills: number;
}

const buildQueryString = (baseParams: Record<string, string>, options?: ViewQueryOptions): string => {
  const query = new URLSearchParams(baseParams);

  if (options?.scope) {
    query.set('scope', options.scope);
  }

  if (typeof options?.sinceTs === 'number' && Number.isFinite(options.sinceTs) && options.sinceTs > 0) {
    query.set('sinceTs', String(options.sinceTs));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export interface PhaseResponse {
  phase: 'thinking' | 'executing' | 'completed';
  progress: number;
  eventsCount: number;
  artifactsCount: number;
}

export const openclawViewService = {
  getThinking: (sessionId: string, limit = 20, options: ViewQueryOptions = { scope: 'latest_turn' }) =>
    api.get<ThinkingView>(
      `/openclaw-view/${encodeURIComponent(sessionId)}/thinking${buildQueryString({ limit: String(limit) }, options)}`,
    ),

  getExecuting: (sessionId: string, options: ViewQueryOptions = { scope: 'latest_turn' }) =>
    api.get<ExecutingView>(
      `/openclaw-view/${encodeURIComponent(sessionId)}/executing${buildQueryString({}, options)}`,
    ),

  getCompleted: (sessionId: string, options: ViewQueryOptions = { scope: 'latest_turn' }) =>
    api.get<CompletedView>(
      `/openclaw-view/${encodeURIComponent(sessionId)}/completed${buildQueryString({}, options)}`,
    ),

  getPhase: (sessionId: string, options: ViewQueryOptions = { scope: 'latest_turn' }) =>
    api.get<PhaseResponse>(
      `/openclaw-view/${encodeURIComponent(sessionId)}/phase${buildQueryString({}, options)}`,
    ),

  sendChatMessage: (text: string) =>
    api.post<{ messageId: string }>('/openclaw-view/chat/send', { text }),
};
