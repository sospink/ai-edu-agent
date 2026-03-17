export interface ThinkingMessage {
  id: string;
  ts: number;
  source: 'feishu' | 'openclaw';
  role: 'assistant';
  content: string;
  messageId?: string;
  msgType?: string;
  fileKey?: string;
  fileName?: string;
}

export interface ThinkingView {
  messages: ThinkingMessage[];
}

export interface ExecutingEvent {
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
  events: ExecutingEvent[];
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
  /** 总处理时间（秒） */
  durationSeconds: number;
  /** 成功率（0-100） */
  successRate: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 总事件数 */
  totalEvents: number;
  /** 活跃技能数 */
  activeSkills: number;
}

export interface IntegrationHealthResult {
  provider: 'openclaw' | 'feishu';
  ok: boolean;
  detail: string;
  checkedAt: string;
  meta?: Record<string, unknown>;
}
