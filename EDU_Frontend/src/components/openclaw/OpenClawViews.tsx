import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/vs2015.css';
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  Monitor,
  Send,
  ShieldCheck,
  Table2,
  Terminal,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CompletedView,
  ExecutingToolchainSkill,
  ExecutingViewEvent,
  ThinkingViewMessage,
} from '@/services/openclawView';
import { COMPLETED_STEPS } from './constants';
import type { ChatMessage } from './useOpenClawSession';
import { AnimatedOrb } from './chat/AnimatedOrb';
import { ChatMarkdownRenderer } from './chat/ChatMarkdownRenderer';
import { AudioWaveform } from './chat/AudioWaveform';
import { DottedSurface } from '@/components/ui/DottedSurface';

interface CompletedWorkspaceProps {
  data?: CompletedView | null;
  isLoading?: boolean;
  error?: string | null;
}

interface RunningDesktopProps {
  messages?: ThinkingViewMessage[];
  isLoading?: boolean;
  error?: string | null;
  onSendMessage?: (text: string) => Promise<void>;
  initialPrompt?: string;
  // 以下是为了解决路由切换时组件卸载导致状态丢失而提升的 state
  localUserMessages?: ChatMessage[];
  setLocalUserMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isWaitingReply?: boolean;
  setIsWaitingReply?: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ApprovalObservabilityWorkspaceProps {
  events?: ExecutingViewEvent[];
  toolchain?: ExecutingToolchainSkill[];
  status?: string;
  progress?: number;
  currentStep?: string;
  isLoading?: boolean;
  error?: string | null;
}

export const CompletedWorkspace: React.FC<CompletedWorkspaceProps> = ({ data, isLoading, error }) => {
  // 空状态：没有数据且没有在加载
  if (!data && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <CheckCircle2 className="h-10 w-10 text-slate-300" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-700">暂无完成记录</h3>
          <p className="mt-1 text-sm text-slate-400">当任务执行完成后，结果和产物将显示在此页面</p>
        </div>
        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 px-4 py-2 text-xs text-rose-600">{error}</p>
        )}
      </div>
    );
  }

  // 加载骨架屏
  if (isLoading && !data) {
    return (
      <div className="flex flex-1 flex-col bg-slate-50 p-4 lg:p-8">
        <div className="mx-auto w-full max-w-[1440px] space-y-6">
          <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="h-3 w-56 rounded bg-slate-100" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
            <div className="lg:col-span-3">
              <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 space-y-4" style={{ minHeight: 400 }}>
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-14 rounded bg-slate-100" />
                <div className="h-14 rounded bg-slate-100" />
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-6 space-y-6" style={{ minHeight: 400 }}>
                <div className="h-5 w-36 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-4">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-slate-200" />
                      <div className="space-y-1 flex-1">
                        <div className="h-3 w-24 rounded bg-slate-200" />
                        <div className="h-2 w-32 rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summaryText = data?.summary?.trim() || '已完成执行，产物可下载。';
  const artifacts = data?.artifacts?.length ? data.artifacts : [];
  const latestFinalMessage = data?.finalMessages?.[data.finalMessages.length - 1]?.content || '';
  const steps = data?.steps || [];
  const metrics = data?.metrics || { durationSeconds: 0, successRate: 100, totalSteps: 0, totalEvents: 0, activeSkills: 0 };

  /** 格式化秒数为 mm:ss 或 hh:mm:ss */
  const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-[780px] flex-col bg-slate-50">
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 lg:p-8">
        
        {/* === Card 1: 顶部状态栏 === */}
        <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] animate-[fadeSlideIn_0.3s_ease-out_both]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">
                运行完成
              </h2>
              <p className="mt-0.5 text-sm font-medium text-slate-500">{error ? '已完成（获取产物存在异常）' : '该序列自动生成的数字资产和日志已归档'}</p>
            </div>
          </div>
          <div className="hidden gap-8 pr-4 md:flex">
            <div className="text-right">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">总处理用时</p>
              <p className="font-mono text-xl font-medium tracking-tight text-slate-700">{formatDuration(metrics.durationSeconds)}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="text-right">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">执行成功率</p>
              <p className={`font-mono text-xl font-medium tracking-tight ${metrics.successRate >= 90 ? 'text-emerald-600' : metrics.successRate >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                {metrics.successRate}%
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          
          {/* === Card 2: 产物与指标看板 === */}
          <div className="flex flex-col gap-6 xl:col-span-4 xl:col-start-1 xl:row-start-1">
            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] animate-[fadeSlideIn_0.3s_ease-out_0.1s_both]">
              <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <span className="text-sm font-bold tracking-wide text-slate-800">输出结果分析</span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                {/* 产物文件列表 */}
                <div className="flex-1">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">构建产物 ({artifacts.length})</p>
                  <div className="space-y-3">
                    {artifacts.length > 0 ? (
                      artifacts.map((artifact) => {
                        const isProxy = artifact.url?.startsWith('/api/');
                        return (
                          <a
                            key={artifact.id}
                            href={artifact.url || '#'}
                            download={isProxy ? artifact.name : undefined}
                            target={!isProxy && artifact.url && artifact.url !== '#' ? '_blank' : undefined}
                            rel={!isProxy && artifact.url && artifact.url !== '#' ? 'noreferrer' : undefined}
                            className="group flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-3 transition-all hover:border-primary-300 hover:shadow-md hover:shadow-primary-500/5"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100">
                              {artifact.type === 'file' ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-700 group-hover:text-primary-700">{artifact.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{artifact.size || `${artifact.source} · ${artifact.type}`}</p>
                            </div>
                            <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-500" />
                          </a>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-slate-400">
                        <FileText className="mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-xs font-medium">暂无产物文件生成</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 指标摘要 */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">运行指标评估</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded bg-primary-50 p-2">
                      <p className="text-[10px] text-primary-500">总步骤</p>
                      <p className="text-lg font-bold text-primary-700">{metrics.totalSteps}</p>
                    </div>
                    <div className="rounded bg-primary-50 p-2">
                      <p className="text-[10px] text-primary-500">总事件</p>
                      <p className="text-lg font-bold text-primary-700">{metrics.totalEvents}</p>
                    </div>
                    <div className="rounded bg-primary-50 p-2">
                      <p className="text-[10px] text-primary-500">活跃技能</p>
                      <p className="text-lg font-bold text-primary-700">{metrics.activeSkills}</p>
                    </div>
                    <div className="rounded bg-primary-50 p-2">
                      <p className="text-[10px] text-primary-500">成功率</p>
                      <p className="text-lg font-bold text-primary-700">{metrics.successRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === Card 3: 时间轴 === */}
          <div className="xl:col-span-8 xl:col-start-5 xl:row-start-1">
            <div className="h-full rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] animate-[fadeSlideIn_0.3s_ease-out_0.2s_both]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800">
                  <BarChart3 className="h-4 w-4 text-primary-500" />
                  流程执行时间轴
                </h3>
                {steps.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-wide text-slate-600">
                    共 {steps.length} 步
                  </span>
                )}
              </div>

              <div className="p-6">
                {steps.length > 0 ? (
                  <div className="relative pl-3">
                    {/* 贯穿时间轴的背景线 */}
                    <div className="absolute bottom-6 left-6 top-6 w-px bg-slate-100" />

                    <div className="space-y-6">
                      {steps.map((step, idx) => (
                        <div key={step.id} className="relative flex items-start gap-5">
                          {/* 时间轴节点图标 */}
                          <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-4 border-white ${
                            step.status === 'success' ? 'bg-emerald-500' : step.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}>
                            {step.status === 'success' ? (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : step.status === 'warning' ? (
                              <span className="text-[10px] font-bold text-white">!</span>
                            ) : (
                              <span className="text-[10px] font-bold text-white">×</span>
                            )}
                          </div>

                          {/* 内容卡片 */}
                          <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="rounded bg-slate-200/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                    Step {idx + 1}
                                  </span>
                                  <p className="truncate text-sm font-bold text-slate-700">{step.title}</p>
                                </div>
                                {step.desc && (
                                  <p className="text-xs font-medium leading-relaxed text-slate-500">{step.desc}</p>
                                )}
                              </div>
                              <span className="shrink-0 font-mono text-[10px] font-medium text-slate-400">
                                {new Date(step.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <BarChart3 className="mb-4 h-12 w-12 text-slate-200" />
                    <p className="text-sm font-semibold tracking-wide text-slate-600">暂无执行步骤记录</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">任务执行完成后，流程进度将在此展示</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 p-8 text-center text-sm text-slate-400">
        {`OpenClaw 实训环境 © ${new Date().getFullYear()}。所有自动化序列已受安全保护。`}
      </footer>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; delta: string }> = ({ label, value, delta }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
    <p className="mb-1 text-xs font-bold uppercase text-slate-400">{label}</p>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-emerald-500">{delta}</span>
    </div>
  </div>
);

export const StatusChip: React.FC<{ icon: React.ReactNode; label: string; online: boolean }> = ({ icon, label, online }) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
        online ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-100 text-slate-500 opacity-70'
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

export const IdleDesktop: React.FC = () => {
  const pixelOfficeUrl = import.meta.env.VITE_OPENCLAW_PIXEL_OFFICE_URL || 'http://139.199.68.121:26080/';
  const frameViewportRef = useRef<HTMLDivElement>(null);
  const [frameLayout, setFrameLayout] = useState({ scale: 1, left: 0, top: 0 });
  const baseWidth = 1720;
  const baseHeight = 1180;
  // Measured from the live pixel office page at 1720x1180 viewport:
  // the primary game canvas sits at 220,20 with size 1280x720.
  const focusX = Number(import.meta.env.VITE_OPENCLAW_PIXEL_FOCUS_X || 0.127907);
  const focusY = Number(import.meta.env.VITE_OPENCLAW_PIXEL_FOCUS_Y || 0.016949);
  const focusWidth = Number(import.meta.env.VITE_OPENCLAW_PIXEL_FOCUS_WIDTH || 0.744186);
  const focusHeight = Number(import.meta.env.VITE_OPENCLAW_PIXEL_FOCUS_HEIGHT || 0.610169);

  useEffect(() => {
    const viewport = frameViewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const { clientWidth, clientHeight } = viewport;
      if (!clientWidth || !clientHeight) return;

      const safeFocusX = Math.max(0, Math.min(0.8, focusX));
      const safeFocusY = Math.max(0, Math.min(0.8, focusY));
      const safeFocusWidth = Math.max(0.2, Math.min(1, focusWidth));
      const safeFocusHeight = Math.max(0.2, Math.min(1, focusHeight));

      const visibleWidth = Math.max(200, baseWidth * safeFocusWidth);
      const visibleHeight = Math.max(120, baseHeight * safeFocusHeight);
      const fitScale = Math.min(clientWidth / visibleWidth, clientHeight / visibleHeight);
      const scale = Math.max(0.45, Math.min(1.4, fitScale));

      const x = baseWidth * safeFocusX * scale;
      const y = baseHeight * safeFocusY * scale;
      const renderedVisibleWidth = visibleWidth * scale;
      const centeredLeft = (clientWidth - renderedVisibleWidth) / 2;

      setFrameLayout({
        scale,
        left: centeredLeft - x,
        top: -y,
      });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [baseHeight, baseWidth, focusHeight, focusWidth, focusX, focusY]);

  return (
    <div className="relative z-10 flex h-full flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-2 text-slate-700">
          <Monitor className="h-4 w-4" />
          <span className="text-xs font-medium">OpenClaw 办公室</span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div
          ref={frameViewportRef}
          className="relative h-full min-h-0 overflow-hidden"
        >
          <div
            className="absolute"
            style={{
              left: `${frameLayout.left}px`,
              top: `${frameLayout.top}px`,
              width: `${baseWidth}px`,
              height: `${baseHeight}px`,
              transform: `scale(${frameLayout.scale})`,
              transformOrigin: 'top left',
            }}
          >
            <iframe
              title="OpenClaw Pixel Office"
              src={pixelOfficeUrl}
              className="h-full w-full border-0"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const RunningDesktop: React.FC<RunningDesktopProps> = ({
  messages,
  isLoading,
  error,
  onSendMessage,
  initialPrompt,
  localUserMessages: externalLocalMsgs,
  setLocalUserMessages: externalSetLocalMsgs,
  isWaitingReply: externalIsWaiting,
  setIsWaitingReply: externalSetIsWaiting,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [isSending, setIsSending] = useState(false);
  
  // 支持内部 fallback 或者外部强控
  const [internalLocalMsgs, setInternalLocalMsgs] = useState<ChatMessage[]>([]);
  const [internalIsWaiting, setInternalIsWaiting] = useState(false);
  
  const localUserMessages = externalLocalMsgs ?? internalLocalMsgs;
  const setLocalUserMessages = externalSetLocalMsgs ?? setInternalLocalMsgs;
  const isWaitingReply = externalIsWaiting ?? internalIsWaiting;
  const setIsWaitingReply = externalSetIsWaiting ?? setInternalIsWaiting;
  const initialPromptApplied = useRef(false);
  const waitingMessageCountRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 语音识别
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const finalTranscriptsRef = useRef('');

  // Orb 入场动画
  const [hasAnimated, setHasAnimated] = useState(false);
  const hasPlayedIntroRef = useRef(false);

  // 平滑滚动
  const [autoScroll, setAutoScroll] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    if (initialPrompt && !initialPromptApplied.current) {
      setInputText(initialPrompt);
      initialPromptApplied.current = true;
    }
  }, [initialPrompt]);

  // 初始化语音识别
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = 'zh-CN';
      r.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) text += e.results[i][0].transcript + ' ';
        }
        if (text) {
          finalTranscriptsRef.current += text;
          setInputText(baseTextRef.current + finalTranscriptsRef.current);
        }
      };
      r.onerror = () => setIsRecording(false);
      r.onend = () => setIsRecording(false);
      recognitionRef.current = r;
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      mediaStream?.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    } else {
      baseTextRef.current = inputText;
      finalTranscriptsRef.current = '';
      recognitionRef.current.start();
      setIsRecording(true);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(setMediaStream).catch(() => {});
    }
  }, [isRecording, inputText, mediaStream]);

  const externalMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return messages.map((message, index) => {
      const isFile = message.msgType === 'file' && message.messageId && message.fileKey;
      const downloadUrl = isFile
        ? `/api/openclaw-view/file/${encodeURIComponent(message.messageId!)}/${encodeURIComponent(message.fileKey!)}?name=${encodeURIComponent(message.fileName || 'download')}`
        : undefined;
      return {
        id: Number(message.ts || Date.now()) + index,
        role: 'agent' as const,
        text: message.content,
        time: toHourMinute(message.ts),
        isFile: Boolean(isFile),
        downloadUrl,
        fileName: message.fileName || message.content.replace('[文件] ', ''),
      };
    });
  }, [messages]);

  // 当新消息到达时清除等待状态
  useEffect(() => {
    if (isWaitingReply && externalMessages.length > waitingMessageCountRef.current) {
      console.debug('[RunningDesktop] clearing isWaitingReply: externalMessages.length', externalMessages.length, '> waitingCountRef', waitingMessageCountRef.current);
      setIsWaitingReply(false);
    }
  }, [externalMessages.length, isWaitingReply]);

  // 安全回退：如果等待超过 90 秒且有任何消息，强制清除等待状态
  useEffect(() => {
    if (!isWaitingReply) return;
    const timer = window.setTimeout(() => {
      console.debug('[RunningDesktop] isWaitingReply timeout (90s), forcing clear');
      setIsWaitingReply(false);
    }, 90_000);
    return () => window.clearTimeout(timer);
  }, [isWaitingReply]);

  const sourceMessages = useMemo(() => {
    const all = [
      ...externalMessages.map(m => ({ ...m, role: 'agent' as const })),
      ...localUserMessages.map(m => ({ ...m, role: 'user' as const, isFile: false, downloadUrl: undefined, fileName: '' })),
    ].sort((a, b) => a.id - b.id);
    return all;
  }, [externalMessages, localUserMessages]);

  // Orb 入场动画
  useEffect(() => {
    if (sourceMessages.length === 0 && !hasPlayedIntroRef.current) {
      setHasAnimated(true);
      hasPlayedIntroRef.current = true;
    } else if (sourceMessages.length > 0) {
      setHasAnimated(false);
      hasPlayedIntroRef.current = true;
    }
  }, [sourceMessages.length]);

  // 新消息滚动
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (sourceMessages.length > prevMessageCountRef.current) {
      container.scrollTop = container.scrollHeight;
      setAutoScroll(true);
    }
    prevMessageCountRef.current = sourceMessages.length;
  }, [sourceMessages.length]);

  // 等待回复时平滑滚动
  useEffect(() => {
    if (!(isWaitingReply || isLoading) || !autoScroll || !chatContainerRef.current) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      return;
    }
    const container = chatContainerRef.current;
    lastScrollRef.current = container.scrollTop;
    const tick = () => {
      if (!container) return;
      const target = container.scrollHeight - container.clientHeight;
      const diff = target - lastScrollRef.current;
      if (diff > 0.5) {
        lastScrollRef.current += diff * 0.03;
        container.scrollTop = lastScrollRef.current;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isWaitingReply, isLoading, autoScroll]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 150);
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !onSendMessage || isSending) return;
    const text = inputText.trim();
    setInputText('');
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    const lastId = externalMessages.length > 0 ? externalMessages[externalMessages.length - 1].id : 0;
    const uid = Math.max(lastId, Date.now()) + 1;
    setLocalUserMessages(prev => [...prev, { id: uid, role: 'user' as const, text, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }]);
    waitingMessageCountRef.current = externalMessages.length;
    setIsWaitingReply(true);
    setIsSending(true);
    try { await onSendMessage(text); } finally { setIsSending(false); }
  }, [inputText, onSendMessage, isSending, isRecording, externalMessages]);

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; }
  };

  // 只在用户实际发了消息等回复时才显示打字指示器
  // 之前 (isLoading && hasAnyMessages) 会导致每次轮询都闪烁打字指示器
  const showTyping = isWaitingReply;

  return (
    <div
      className="relative h-full bg-slate-50"
      style={{ boxShadow: 'rgba(14,63,126,0.04) 0 0 0 1px, rgba(42,51,69,0.04) 0 1px 1px -0.5px, rgba(42,51,70,0.04) 0 3px 3px -1.5px, rgba(42,51,70,0.04) 0 6px 6px -3px' }}
    >
      {/* 粒子波浪背景 - 覆盖整个面板 */}
      {sourceMessages.length === 0 && !error && !showTyping && (
        <DottedSurface className="opacity-60" />
      )}

      {/* 消息列表 */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={`absolute inset-0 pt-6 pb-32 space-y-4 px-6 ${sourceMessages.length > 0 ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {/* 空态：Orb 入场 + 粒子波浪背景 */}
        {sourceMessages.length === 0 && !error && !showTyping && (
          <div className="flex flex-col items-center h-full pt-[35vh] text-center relative z-10">
            <div className={`mb-4 relative z-10 ${hasAnimated ? 'orb-intro' : ''}`}>
              <AnimatedOrb size={128} />
            </div>
            <p className={`text-lg font-medium text-slate-500 relative z-10 ${hasAnimated ? 'text-blur-intro' : ''}`}>
              Hi，我是 OpenClaw
            </p>
            <p className={`text-sm mt-1 text-slate-400 relative z-10 ${hasAnimated ? 'text-blur-intro-delay' : ''}`}>
              发送指令开始与 AI 智能体对话
            </p>
          </div>
        )}

        {/* 消息 */}
        {sourceMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex max-w-[85%] gap-2',
              msg.role === 'user'
                ? 'ml-auto flex-row-reverse user-message-enter'
                : 'mr-auto items-end',
            )}
          >
            {/* 头像 */}
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'user' ? 'bg-white shadow-sm' : '',
            )}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-slate-600" />
                : <AnimatedOrb className="w-8 h-8 shrink-0" />
              }
            </div>

            {/* 气泡 */}
            <div className="flex flex-col" style={{ maxWidth: '100%' }}>
              <span className="text-xs text-slate-400 mb-1">{msg.role === 'user' ? '你' : 'OpenClaw'}</span>
              <div
                className={cn(
                  'rounded-2xl overflow-hidden',
                  msg.role === 'user'
                    ? 'bg-white text-slate-800 rounded-br-md shadow-sm'
                    : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-200/60',
                )}
                style={{
                  boxShadow: 'rgba(14,63,126,0.04) 0 0 0 1px, rgba(42,51,69,0.04) 0 1px 1px -0.5px, rgba(42,51,70,0.04) 0 3px 3px -1.5px',
                }}
              >
                <div className="px-4 py-3">
                  {msg.text === '[卡片消息]' ? (
                    <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50/50 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100">
                        <BarChart3 className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary-700">飞书卡片消息</p>
                        <p className="text-[10px] text-slate-400">请在飞书中查看完整内容</p>
                      </div>
                    </div>
                  ) : msg.isFile ? (
                    <a href={msg.downloadUrl} download={msg.fileName} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-primary-400 hover:bg-primary-50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100">
                        <FileText className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800 group-hover:text-primary-700">{msg.fileName}</p>
                        <p className="text-[10px] text-slate-400">点击下载文件</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-500" />
                    </a>
                  ) : msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  ) : (
                    <ChatMarkdownRenderer content={msg.text} isStreaming={isWaitingReply && msg.id === sourceMessages[sourceMessages.length - 1]?.id} />
                  )}
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-1">{msg.time}</span>
            </div>
          </div>
        ))}

        {/* 打字指示器 */}
        {showTyping && (
          <div className="flex gap-2 max-w-[85%] mr-auto items-end">
            <div className="shrink-0"><AnimatedOrb size={32} /></div>
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-slate-200"
              style={{ boxShadow: 'rgba(14,63,126,0.04) 0 0 0 1px, rgba(42,51,69,0.04) 0 1px 1px -0.5px' }}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {/* 增加显性的文字提示，缓解等待焦虑 */}
                <span className="text-xs font-medium text-slate-500 ml-1">正在分析任务边界并规划执行路径...</span>
              </div>
            </div>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700">{trimText(error, 100)}</p>
          </div>
        )}

        <div className="h-20" aria-hidden="true" />
      </div>

      {/* Composer 输入区 */}
      <div className={`fixed-composer absolute bottom-8 left-0 right-0 px-4 z-10 ${sourceMessages.length === 0 ? 'composer-intro' : ''}`}>
        <div className="relative max-w-2xl mx-auto">
          <div
            className="relative flex flex-col p-4 pb-12 bg-white rounded-3xl transition-all focus-within:ring-2 focus-within:ring-slate-200"
            style={{ boxShadow: 'rgba(14,63,126,0.06) 0 0 0 1px, rgba(42,51,69,0.06) 0 1px 1px -0.5px, rgba(42,51,70,0.06) 0 3px 3px -1.5px, rgba(42,51,70,0.06) 0 6px 6px -3px, rgba(14,63,126,0.06) 0 12px 12px -6px' }}
          >
            <div className="flex gap-2 items-center">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); handleTextareaInput(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isRecording ? '正在聆听...' : '输入消息与 OpenClaw 对话...'}
                disabled={isSending}
                rows={2}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 max-h-[96px] overflow-y-auto"
              />

              {isRecording && <AudioWaveform isRecording={isRecording} stream={mediaStream} />}

              {/* 发送 / 停止 */}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isSending}
                className={cn(
                  'relative h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all',
                  !inputText.trim() || isSending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105',
                )}
              >
                <AnimatedOrb size={36} />
              </button>
            </div>

            {/* 语音按钮 - 绝对定位在卡片内底部 */}
            <button
              onClick={toggleRecording}
              disabled={isSending}
              className={cn(
                'absolute bottom-3 left-4 h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-200',
                isRecording
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
                inputText.trim() ? 'opacity-0 pointer-events-none' : 'opacity-100',
              )}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ApprovalObservabilityWorkspace: React.FC<ApprovalObservabilityWorkspaceProps> = ({
  events,
  toolchain,
  status,
  progress,
  currentStep,
  isLoading,
  error,
}) => {
  const timelineItems = useMemo(() => {
    if (!events || events.length === 0) return [];

    return events.map((event, index) => ({
      title: event.title,
      desc: event.desc,
      time: formatClock(event.ts),
      icon: pickEventIcon(event),
      stage: pickEventStage(event),
      active: index === events.length - 1,
      level: event.level,
      kind: event.kind,
    }));
  }, [events]);

  const safeProgress = Number.isFinite(progress || 0)
    ? Math.max(0, Math.min(100, progress || 0))
    : 60;

  const latestDesc = timelineItems[timelineItems.length - 1]?.desc || '等待执行事件';
  const currentStatus = status?.trim() || 'running';
  const toolchainItems = useMemo(() => {
    if (!toolchain || toolchain.length === 0) {
      return [];
    }

    return toolchain.map((skill) => ({
      id: skill.id,
      name: skill.name,
      active: skill.active,
      detail: skill.detail,
      pulse: skill.state === 'missing',
      icon: skill.state === 'ready'
        ? <Cpu className="h-4 w-4 text-slate-400" />
        : skill.state === 'missing'
          ? <Table2 className="h-4 w-4 text-amber-500" />
          : skill.state === 'blocked'
            ? <ShieldCheck className="h-4 w-4 text-rose-500" />
            : <Mail className="h-4 w-4 text-slate-400" />,
    }));
  }, [toolchain]);

  return (
    <div className="flex h-full min-h-0 bg-slate-100 p-2 md:p-3">
      <div className="flex h-full w-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <section className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3 md:p-4">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">运行日志</h1>
              <span className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors duration-300 ${
                isLoading ? 'border-primary-200 bg-primary-50 text-primary-600' : 'border-slate-200 bg-white text-slate-500'
              }`}>
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                    同步中
                  </span>
                ) : '实时同步'}
              </span>
            </div>

            {/* 骨架屏 */}
            {isLoading && timelineItems.length === 0 && (
              <div className="relative space-y-8 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-slate-200 before:content-['']">
                {[1, 2, 3].map(i => (
                  <div key={i} className="relative animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>
                    <div className="absolute -left-8 top-1.5 flex size-6 items-center justify-center rounded-full border-4 border-slate-50 bg-slate-200" />
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="h-4 w-40 rounded bg-slate-200" />
                        <div className="h-3 w-12 rounded bg-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded bg-slate-100" />
                        <div className="h-3 w-3/4 rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 时间线 */}
            <div className="relative space-y-8 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-slate-200 before:content-['']">
              {timelineItems.map((item, idx) => (
                <TimelineEventItem
                  key={`${item.title}-${item.time}-${idx}`}
                  item={item}
                  idx={idx}
                  safeProgress={item.active ? safeProgress : 0}
                />
              ))}

              {!isLoading && !error && timelineItems.length === 0 && (
                <div className="relative -ml-8 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400 shadow-sm">
                  暂无执行事件（当前仅展示真实执行数据）
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/50 p-3 md:w-80 md:p-4">
          <div className="space-y-5">
            <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-slate-400">实时决策分析</h3>

            {/* 决策卡片：加载骨架 */}
            {isLoading && !currentStep && !status ? (
              <div className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100" />
                  <div className="flex-1">
                    <div className="mb-1.5 h-3.5 w-24 rounded bg-slate-200" />
                    <div className="h-2.5 w-16 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-1 h-2 w-8 rounded bg-slate-200" />
                    <div className="h-3.5 w-full rounded bg-slate-200" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl bg-slate-50 p-3">
                      <div className="mb-1 h-2 w-8 rounded bg-slate-200" />
                      <div className="h-3.5 w-16 rounded bg-slate-200" />
                    </div>
                    <div className="flex-1 rounded-xl bg-slate-50 p-3">
                      <div className="mb-1 h-2 w-8 rounded bg-slate-200" />
                      <div className="h-3.5 w-12 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-[fadeSlideIn_0.3s_ease-out_both] rounded-2xl bg-white shadow-sm">
                {/* 卡片头部 */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">决策卡片</p>
                    <p className="text-[10px] text-slate-400">实时状态追踪</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    error ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {error ? '异常' : '正常'}
                  </span>
                </div>

                {/* 当前目标 */}
                <div className="mx-5 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">当前目标</p>
                  <p className="text-[13px] font-medium leading-snug text-slate-700">{currentStep || '获取执行中任务上下文'}</p>
                </div>

                {/* 状态 + 风险 */}
                <div className="flex gap-3 px-5 pt-3 pb-5">
                  <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">动作状态</p>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                      {currentStatus}
                      <span className={`h-2 w-2 rounded-full ${
                        currentStatus === 'completed' ? 'bg-emerald-500' : 'bg-primary-500 animate-pulse'
                      }`} />
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">风险等级</p>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                      error ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {error ? '⚠ 中' : '✓ 低'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 工具链状态 */}
            <div className="space-y-3">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">工具链状态</h3>

              <div className="rounded-2xl bg-white shadow-sm">
                <div className="divide-y divide-slate-50 p-2">
                  {/* 工具链骨架屏 */}
                  {isLoading && toolchainItems.length === 0 && (
                    <>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex items-center justify-between rounded-xl px-3 py-2.5" style={{ animationDelay: `${i * 100}ms` }}>
                          <div className="flex items-center gap-3">
                            <div className="h-4 w-4 rounded bg-slate-100" />
                            <div>
                              <div className="mb-1 h-3 w-24 rounded bg-slate-200" />
                              <div className="h-2 w-16 rounded bg-slate-100" />
                            </div>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-slate-200" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* 实际工具链 */}
                  {toolchainItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-[fadeSlideIn_0.3s_ease-out_both]"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <ToolItem
                        icon={item.icon}
                        name={item.name}
                        detail={item.detail}
                        active={item.active}
                        pulse={item.pulse}
                      />
                    </div>
                  ))}
                  {!isLoading && toolchainItems.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                      暂无技能状态
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

/** 事件类型颜色映射 */
function getEventColor(kind?: string, level?: string): { border: string; bg: string; badge: string; text: string; dot: string } {
  if (level === 'error') return { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700', text: 'text-rose-700', dot: 'bg-rose-500' };
  if (level === 'warn') return { border: 'border-l-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700', dot: 'bg-amber-500' };

  switch (kind) {
    case 'user_input':
    case 'feishu_inbound':
      return { border: 'border-l-sky-500', bg: 'bg-sky-50/50', badge: 'bg-sky-100 text-sky-700', text: 'text-sky-700', dot: 'bg-sky-500' };
    case 'tool_call':
    case 'feishu_dispatch':
      return { border: 'border-l-amber-500', bg: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'tool_result':
    case 'gateway_res':
      return { border: 'border-l-violet-500', bg: 'bg-violet-50/50', badge: 'bg-violet-100 text-violet-700', text: 'text-violet-700', dot: 'bg-violet-500' };
    case 'agent_reply':
    case 'assistant_output':
    case 'feishu_dispatch_complete':
      return { border: 'border-l-emerald-500', bg: 'bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700', dot: 'bg-emerald-500' };
    case 'feishu_stream_start':
    case 'feishu_stream_end':
      return { border: 'border-l-primary', bg: 'bg-primary-50/50', badge: 'bg-primary-100 text-primary-700', text: 'text-primary-700', dot: 'bg-primary' };
    default:
      return { border: 'border-l-slate-300', bg: 'bg-white', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600', dot: 'bg-slate-400' };
  }
}

/** 事件类型中文标签 */
function getEventKindLabel(kind?: string): string {
  switch (kind) {
    case 'user_input': return '用户输入';
    case 'tool_call': return '工具调用';
    case 'tool_result': return '工具输出';
    case 'agent_reply': return 'Agent 回复';
    case 'assistant_output': return 'Agent 输出';
    case 'gateway_res': return '网关响应';
    case 'feishu_inbound': return '用户指令';
    case 'feishu_dispatch': return '任务分派';
    case 'feishu_stream_start': return '开始输出';
    case 'feishu_stream_end': return '输出结束';
    case 'feishu_dispatch_complete': return '下发完成';
    case 'system': return '系统事件';
    default: return '事件';
  }
}

/** Markdown 组件映射 — 精简版，用于事件描述卡片内 */
const eventMarkdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ children, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-xs" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead className="bg-slate-50 border-b border-slate-200" {...props}>{children}</thead>,
  tbody: ({ children, ...props }) => <tbody className="divide-y divide-slate-100" {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => <tr className="hover:bg-slate-50/50" {...props}>{children}</tr>,
  th: ({ children, ...props }) => <th className="px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600" {...props}>{children}</th>,
  td: ({ children, ...props }) => <td className="px-2.5 py-1.5 text-xs text-slate-600" {...props}>{children}</td>,
  pre: ({ children }) => <pre className="my-1.5 p-2.5 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-xs font-mono">{children}</pre>,
  code: ({ className: codeClassName, children, ...props }) => {
    if (!codeClassName) return <code className="px-1 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono" {...props}>{children}</code>;
    return <code className={codeClassName} {...props}>{children}</code>;
  },
  p: ({ children }) => <p className="my-0.5">{children}</p>,
  h1: ({ children }) => <h1 className="text-sm font-bold text-slate-800 mt-2 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-bold text-slate-800 mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-slate-700 mt-1.5 mb-0.5">{children}</h3>,
  ul: ({ children }) => <ul className="my-1 ml-3 list-disc space-y-0.5 marker:text-slate-400 text-xs">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-3 list-decimal space-y-0.5 marker:text-slate-400 text-xs">{children}</ol>,
  li: ({ children }) => <li className="text-xs text-slate-600 pl-0.5">{children}</li>,
  hr: () => <hr className="my-2 border-slate-200" />,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-600 underline underline-offset-2">{children}</a>,
  strong: ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-1 border-l-2 border-primary-200 bg-primary-50/30 pl-2 py-0.5 text-xs text-slate-600 italic">{children}</blockquote>,
};

/** 是否为 Agent 回复类事件（内容较长，需要折叠） */
function isAgentReplyKind(kind?: string): boolean {
  return kind === 'agent_reply' || kind === 'assistant_output' || kind === 'feishu_dispatch_complete';
}

/** 时间线事件节点 — 企业产品风格 */
const TimelineEventItem: React.FC<{
  item: {
    title: string;
    desc: string;
    time: string;
    icon: React.FC<{ className?: string }>;
    stage?: string;
    active: boolean;
    level?: string;
    kind?: string;
  };
  idx: number;
  safeProgress: number;
}> = ({ item, idx, safeProgress }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getEventColor(item.kind, item.level);
  const isReply = isAgentReplyKind(item.kind);

  return (
    <div
      className="relative animate-[fadeSlideIn_0.3s_ease-out_both]"
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      {/* 时间线圆点 */}
      <div
        className={`absolute -left-8 top-1.5 flex size-6 items-center justify-center rounded-full border-4 border-slate-50 transition-colors duration-300 ${
          item.active ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
        }`}
      >
        <item.icon className={`h-3.5 w-3.5 ${item.active ? 'animate-pulse' : ''}`} />
      </div>

      {/* 卡片 */}
      <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${item.active ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-white'}`}>
        {/* 标题行 */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h4 className={`truncate text-sm font-semibold ${item.active ? 'text-primary-700' : 'text-slate-900'}`}>{item.title}</h4>
            {item.stage && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                {item.stage}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-mono ${item.active ? 'text-primary-500' : 'text-slate-400'}`}>{item.time}</span>
        </div>

        {/* 内容区域 */}
        {isReply ? (
          /* Agent 回复：折叠式 */
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`mt-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                expanded
                  ? 'border-primary-200 bg-primary-50 text-primary-600'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              <MessageCircle className="h-3 w-3" />
              {expanded ? '收起回复内容' : '查看回复内容'}
              <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {expanded && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 animate-[fadeSlideIn_0.2s_ease-out_both]">
                <div className="chat-markdown text-xs leading-relaxed text-slate-600">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={eventMarkdownComponents}>
                    {item.desc}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        ) : (
          /* 其他事件：直接显示纯文本 */
          <p className="text-xs leading-relaxed text-slate-500">{item.desc}</p>
        )}

        {/* 进度条 — 仅最新活跃事件 */}
        {item.active && safeProgress > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white">
              <Table2 className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary-100">
              <div className="h-full bg-primary-600 transition-all duration-500 ease-out" style={{ width: `${safeProgress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


const ToolItem: React.FC<{
  icon: React.ReactNode;
  name: string;
  detail?: string;
  active: boolean;
  pulse?: boolean;
}> = ({ icon, name, detail, active, pulse }) => (
  <div
    className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${
      active ? 'hover:bg-slate-50' : 'opacity-40 grayscale'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs font-medium text-slate-700">{name}</p>
        {detail && <p className="text-[10px] text-slate-400">{detail}</p>}
      </div>
    </div>
    <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'} ${pulse ? 'animate-pulse' : ''}`} />
  </div>
);

function pickEventIcon(event: ExecutingViewEvent) {
  if (event.kind === 'feishu_inbound') return MessageCircle;
  if (event.kind === 'feishu_dispatch') return Send;
  if (event.kind === 'feishu_stream_start') return Mail;
  if (event.kind === 'feishu_stream_end') return Mail;
  if (event.kind === 'feishu_dispatch_complete') return CheckCircle2;
  if (event.kind === 'gateway_res') return Table2;

  if (event.level === 'error') return ShieldCheck;
  if (event.level === 'warn') return Mail;
  return MessageCircle;
}

function pickEventStage(event: ExecutingViewEvent): string {
  if (event.kind === 'feishu_inbound') return '用户指令';
  if (event.kind === 'feishu_dispatch') return '任务分派';
  if (event.kind === 'feishu_stream_start') return '开始输出';
  if (event.kind === 'feishu_stream_end') return '输出结束';
  if (event.kind === 'feishu_dispatch_complete') return '下发完成';
  if (event.kind === 'gateway_res') return event.method || '网关响应';
  return '';
}

function toHourMinute(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatClock(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function trimText(text: string, length: number): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}…`;
}
