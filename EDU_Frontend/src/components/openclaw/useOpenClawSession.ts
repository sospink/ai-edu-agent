/**
 * OpenClaw 会话状态中心 (SessionStore)
 *
 * 核心职责：
 * 1. 集中管理所有阶段的视图数据（thinking、executing、completed）
 * 2. 全阶段并行轮询 — 不因 Tab 切换丢失数据
 * 3. 单向阶段推进（idle → thinking → executing → completed）
 * 4. sessionStorage 持久化 — 浏览器刷新后恢复
 * 5. 唯一清除入口：resetSession()
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  openclawViewService,
  type CompletedView,
  type ExecutingView,
  type OpenclawViewScope,
  type ThinkingView,
} from '@/services/openclawView';
import { WORK_SCENE_PROMPT_KEYS } from './constants';
import type { SessionState } from './types';

// ====== 类型定义 ======

export interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
  time: string;
  isFile?: boolean;
  downloadUrl?: string;
  fileName?: string;
}

export interface OpenClawSessionContextValue {
  // --- 场景与阶段 ---
  selectedSceneIndex: number | null;
  /** 会话的实际推进阶段（只进不退） */
  sessionPhase: SessionState;

  // --- Thinking 数据 ---
  thinkingView: ThinkingView | null;
  thinkingLoading: boolean;
  thinkingError: string | null;

  // --- Executing 数据 ---
  executingView: ExecutingView | null;
  executingLoading: boolean;
  executingError: string | null;

  // --- Completed 数据 ---
  completedView: CompletedView | null;
  completedLoading: boolean;
  completedError: string | null;

  // --- 聊天记录（跨 Tab 持久） ---
  pendingPrompt: string;
  hasSentMessage: boolean;
  localUserMessages: ChatMessage[];
  isWaitingReply: boolean;

  // --- 方法 ---
  startScene: (sceneIndex: number) => void;
  sendMessage: (text: string) => Promise<void>;
  setLocalUserMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsWaitingReply: React.Dispatch<React.SetStateAction<boolean>>;
  setHasSentMessage: React.Dispatch<React.SetStateAction<boolean>>;
  /** 推进阶段（只进不退，除 resetSession） */
  advancePhase: (targetPhase: SessionState) => void;
  /** 唯一清除入口 */
  resetSession: () => void;

  // --- 会话 ID ---
  activeSessionId: string;
}

// ====== 阶段排序（用于单向推进比较） ======

const PHASE_ORDER: Record<SessionState, number> = {
  idle: 0,
  running: 1,    // thinking
  approval: 2,   // executing
  completed: 3,
};

// ====== sessionStorage 持久化 ======

interface PersistedState {
  selectedSceneIndex: number | null;
  sessionPhase: SessionState;
  pendingPrompt: string;
  hasSentMessage: boolean;
  localUserMessages: ChatMessage[];
  thinkingView: ThinkingView | null;
  executingView: ExecutingView | null;
  completedView: CompletedView | null;
}

function storageKeyForSession(activeSessionId: string): string {
  const normalized = (activeSessionId || 'default').trim() || 'default';
  return `openclaw_session:${normalized}`;
}

function loadPersistedState(storageKey: string): Partial<PersistedState> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function persistState(storageKey: string, state: PersistedState) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // 静默忽略 —— 超出 quota 等
  }
}

function clearPersistedState(storageKey: string) {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // noop
  }
}

// ====== Context ======

export const OpenClawSessionContext = createContext<OpenClawSessionContextValue | null>(null);

export function useOpenClawSession(): OpenClawSessionContextValue {
  const ctx = useContext(OpenClawSessionContext);
  if (!ctx) {
    throw new Error('useOpenClawSession must be used within OpenClawSessionProvider');
  }
  return ctx;
}

/** 从当前 URL 路径推导 phase（解决直接访问 /openclaw/executing 时 sessionStorage 为空的问题） */
function inferPhaseFromUrl(): SessionState {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path.includes('/thinking')) return 'running';
  if (path.includes('/executing')) return 'approval';
  if (path.includes('/completed')) return 'completed';
  return 'idle';
}

// ====== Provider Hook（返回 context value，由 Provider 组件包裹） ======

export function useOpenClawSessionProvider(activeSessionId: string, scope: OpenclawViewScope = 'latest_turn'): OpenClawSessionContextValue {
  const { t, i18n } = useTranslation('openclaw');
  const storageKey = useMemo(() => storageKeyForSession(activeSessionId), [activeSessionId]);
  // --- 从 URL 路径推导初始 phase（解决直接访问 /openclaw/executing 等场景） ---
  const urlPhase = useRef<SessionState>(inferPhaseFromUrl());

  // --- 从 sessionStorage 恢复 ---
  const persisted = useRef(loadPersistedState(storageKey));

  // --- 场景与阶段 ---
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(
    persisted.current.selectedSceneIndex ?? null,
  );
  const [sessionPhase, setSessionPhase] = useState<SessionState>(() => {
    const fromStorage = persisted.current.sessionPhase ?? 'idle';
    // 如果 URL 表明在非 idle 页面但 storage 里是 idle，优先信任 URL
    if (fromStorage === 'idle' && urlPhase.current !== 'idle') {
      return urlPhase.current;
    }
    return fromStorage;
  });

  // --- Thinking ---
  const [thinkingView, setThinkingView] = useState<ThinkingView | null>(
    persisted.current.thinkingView ?? null,
  );
  const [thinkingLoading, setThinkingLoading] = useState(false);
  const [thinkingError, setThinkingError] = useState<string | null>(null);

  // --- Executing ---
  const [executingView, setExecutingView] = useState<ExecutingView | null>(
    persisted.current.executingView ?? null,
  );
  const [executingLoading, setExecutingLoading] = useState(false);
  const [executingError, setExecutingError] = useState<string | null>(null);

  // --- Completed ---
  const [completedView, setCompletedView] = useState<CompletedView | null>(
    persisted.current.completedView ?? null,
  );
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState<string | null>(null);

  // --- 聊天记录 ---
  const [pendingPrompt, setPendingPrompt] = useState(
    persisted.current.pendingPrompt ?? '',
  );
  const [hasSentMessage, setHasSentMessage] = useState(
    persisted.current.hasSentMessage ?? false,
  );
  const [localUserMessages, setLocalUserMessages] = useState<ChatMessage[]>(
    persisted.current.localUserMessages ?? [],
  );
  const [isWaitingReply, setIsWaitingReply] = useState(false);

  // ====== sessionStorage 持久化（节流写入） ======
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistState(storageKey, {
        selectedSceneIndex,
        sessionPhase,
        pendingPrompt,
        hasSentMessage,
        localUserMessages,
        thinkingView,
        executingView,
        completedView,
      });
    }, 500);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [storageKey, selectedSceneIndex, sessionPhase, pendingPrompt, hasSentMessage, localUserMessages, thinkingView, executingView, completedView]);

  // ====== 阶段推进（只进不退） ======

  const advancePhase = useCallback((targetPhase: SessionState) => {
    setSessionPhase((current) => {
      if (PHASE_ORDER[targetPhase] > PHASE_ORDER[current]) {
        return targetPhase;
      }
      return current;
    });
  }, []);

  // ====== 场景启动 ======

  const startScene = useCallback((sceneIndex: number) => {
    const promptKey = WORK_SCENE_PROMPT_KEYS[sceneIndex];
    const prompt = promptKey ? t(promptKey) : '';
    setSelectedSceneIndex(sceneIndex);
    setPendingPrompt(prompt);
    setSessionPhase('running');
  }, [t]);

  useEffect(() => {
    if (selectedSceneIndex === null || hasSentMessage) return;
    const promptKey = WORK_SCENE_PROMPT_KEYS[selectedSceneIndex];
    if (promptKey) setPendingPrompt(t(promptKey));
  }, [hasSentMessage, i18n.resolvedLanguage, selectedSceneIndex, t]);

  // ====== 发送消息 ======

  const sendMessage = useCallback(async (text: string) => {
    setHasSentMessage(true);
    // 消息发送后清除 pendingPrompt，避免切换 Tab 回来时重复填充输入框
    setPendingPrompt('');
    await openclawViewService.sendChatMessage(text, activeSessionId);
  }, [activeSessionId]);

  // ====== 全量重置 ======

  const resetSession = useCallback(() => {
    setSelectedSceneIndex(null);
    setSessionPhase('idle');
    setThinkingView(null);
    setThinkingLoading(false);
    setThinkingError(null);
    setExecutingView(null);
    setExecutingLoading(false);
    setExecutingError(null);
    setCompletedView(null);
    setCompletedLoading(false);
    setCompletedError(null);
    setPendingPrompt('');
    setHasSentMessage(false);
    setLocalUserMessages([]);
    setIsWaitingReply(false);
    clearPersistedState(storageKey);
  }, [storageKey]);

  // ====== 全阶段并行轮询 ======
  // 一旦进入 thinking 以上阶段（或 URL 不在 idle），就同时轮询所有 API

  // shouldPoll：只要 sessionPhase 不是 idle 就轮询
  // 这在初始化时已经被 URL 修正过，所以不会遗漏
  const shouldPoll = sessionPhase !== 'idle';

  useEffect(() => {
    if (!shouldPoll) return;
    console.debug('[SessionStore] polling started, phase =', sessionPhase);

    let disposed = false;

    // --- Thinking API ---
    const loadThinking = async () => {
      setThinkingLoading(true);
      try {
        const sinceTs = Date.now() - 10 * 60 * 1000;
        const response = await openclawViewService.getThinking(activeSessionId, 20, { scope, sinceTs });
        if (disposed) return;
        if (response.success && response.data) {
          const msgs = response.data.messages || [];
          console.debug('[SessionStore] thinking poll →', {
            messageCount: msgs.length,
            latestContent: msgs.length > 0 ? msgs[msgs.length - 1].content.slice(0, 60) : '(empty)',
            latestTs: msgs.length > 0 ? new Date(msgs[msgs.length - 1].ts).toLocaleTimeString() : '-',
          });
          setThinkingView(response.data);
          setThinkingError(null);
        } else if (response.error) {
          console.warn('[SessionStore] thinking poll error:', response.error);
          setThinkingError(response.error);
        }
      } catch {
        // 静默
      } finally {
        if (!disposed) setThinkingLoading(false);
      }
    };

    // --- Executing API ---
    const loadExecuting = async () => {
      setExecutingLoading(true);
      try {
        const response = await openclawViewService.getExecuting(activeSessionId, { scope: 'all' });
        if (disposed) return;
        if (response.success && response.data) {
          const ev = response.data;
          console.debug('[SessionStore] executing poll →', {
            events: ev.events?.length ?? 0,
            toolchain: ev.toolchain?.length ?? 0,
            progress: ev.progress,
            status: ev.status,
            currentStep: ev.currentStep,
          });
          setExecutingView(ev);
          setExecutingError(null);
        } else if (response.error) {
          console.warn('[SessionStore] executing poll error:', response.error);
          setExecutingError(response.error);
        }
      } catch {
        // 静默
      } finally {
        if (!disposed) setExecutingLoading(false);
      }
    };

    // --- Completed API ---
    const loadCompleted = async () => {
      setCompletedLoading(true);
      try {
        const response = await openclawViewService.getCompleted(activeSessionId, { scope });
        if (disposed) return;
        if (response.success && response.data) {
          const cv = response.data;
          console.debug('[SessionStore] completed poll →', {
            artifacts: cv.artifacts?.length ?? 0,
            steps: cv.steps?.length ?? 0,
            summary: cv.summary?.slice(0, 50),
          });
          setCompletedView(cv);
          setCompletedError(null);
        } else if (response.error) {
          setCompletedError(response.error);
        }
      } catch {
        // 静默
      } finally {
        if (!disposed) setCompletedLoading(false);
      }
    };

    // 首次加载
    void loadThinking();
    void loadExecuting();
    void loadCompleted();

    // 并行轮询
    const thinkingTimer = window.setInterval(() => void loadThinking(), 8000);
    const executingTimer = window.setInterval(() => void loadExecuting(), 6000);
    const completedTimer = window.setInterval(() => void loadCompleted(), 12000);

    return () => {
      disposed = true;
      window.clearInterval(thinkingTimer);
      window.clearInterval(executingTimer);
      window.clearInterval(completedTimer);
    };
  }, [activeSessionId, scope, shouldPoll]);

  // ====== 自动阶段推进已移除 ======
  // 只保留 场景选择→思考中 的自动跳转（在 startScene 中处理）
  // 用户需手动切换 Tab 来查看 执行中 / 完成态

  // ====== 返回 Context Value ======

  return useMemo<OpenClawSessionContextValue>(() => ({
    selectedSceneIndex,
    sessionPhase,
    thinkingView,
    thinkingLoading,
    thinkingError,
    executingView,
    executingLoading,
    executingError,
    completedView,
    completedLoading,
    completedError,
    pendingPrompt,
    hasSentMessage,
    localUserMessages,
    isWaitingReply,
    startScene,
    sendMessage,
    setLocalUserMessages,
    setIsWaitingReply,
    setHasSentMessage,
    advancePhase,
    resetSession,
    activeSessionId,
  }), [
    selectedSceneIndex, sessionPhase,
    thinkingView, thinkingLoading, thinkingError,
    executingView, executingLoading, executingError,
    completedView, completedLoading, completedError,
    pendingPrompt, hasSentMessage, localUserMessages, isWaitingReply,
    startScene, sendMessage, setLocalUserMessages, setIsWaitingReply, setHasSentMessage,
    advancePhase, resetSession, activeSessionId,
  ]);
}
