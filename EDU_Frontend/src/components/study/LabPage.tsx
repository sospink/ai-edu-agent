import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Terminal as TerminalIcon,
  Code2,
  Bot,
  Globe,
  RefreshCw,
  HelpCircle,
  Wifi,
  Cpu,
  Activity,
  CheckCircle2,
  Loader2,
  FlaskConical,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  labApi,
  LabSession,
  LabUrls,
  LabSessionStatus,
  LabSourceType,
} from '@/services/lab';
import { courseApi } from '@/services/course';
import PageDialog from '@/components/common/PageDialog';
import { useTranslation } from 'react-i18next';

// 懒加载 WebTerminal 组件
const WebTerminal = lazy(() => import('./WebTerminal'));

// 懒加载 AgentWidget 组件
const AgentWidget = lazy(() => import('../agent/AgentWidget'));

type LabTab = 'desktop' | 'terminal' | 'ide' | 'opencode' | 'ports';

// --- 启动序列组件 ---
interface BootStep {
  id: number;
  text: string;
  status: 'pending' | 'waiting' | 'done' | 'error';
}

interface BootSequenceProps {
  onComplete: () => void;
  onError: (error: string) => void;
  onConflict: (error?: string) => void;
  sourceType: LabSourceType;
  sourceId: number;
  onSessionCreated: (session: LabSession, urls: LabUrls) => void;
  onCancel: () => void;
}

const isSessionConflictError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    message.includes('并发上限') ||
    message.includes('已有实验环境') ||
    message.includes('已有一个运行中') ||
    message.includes('先停止已有环境') ||
    message.includes('请先关闭') ||
    normalized.includes('concurrent') ||
    normalized.includes('quota')
  );
};

const BootSequence: React.FC<BootSequenceProps> = ({
  onComplete,
  onError,
  onConflict,
  sourceType,
  sourceId,
  onSessionCreated,
  onCancel,
}) => {
  const { t } = useTranslation('lab');
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<BootStep[]>([
    { id: 1, text: t('boot.allocating'), status: 'pending' },
    { id: 2, text: t('boot.pulling'), status: 'waiting' },
    { id: 3, text: t('boot.starting'), status: 'waiting' },
    { id: 4, text: t('boot.networking'), status: 'waiting' },
    { id: 5, text: t('boot.connecting'), status: 'waiting' },
  ]);
  const [capacityWait, setCapacityWait] = useState<{ attempt: number; maxAttempts: number } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const createSession = async () => {
      // 模拟前两步
      for (let i = 0; i < 2; i++) {
        if (!isMounted) return;
        setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'pending' } : s)));
        setProgress(((i + 1) / 5) * 100 * 0.4);
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)));
      }

      // 第三步：调用 API 创建实验环境
      setSteps((prev) => prev.map((s, idx) => (idx === 2 ? { ...s, status: 'pending' } : s)));
      setProgress(50);

      try {
        let response = await labApi.createSession(sourceType, sourceId);
        let attempt = 0;

        while (isMounted && !response.success) {
          const isReleasing = response.code === 'LAB_CAPACITY_RELEASING';
          const isFull = response.code === 'LAB_CAPACITY_REACHED';
          if (!isReleasing && !isFull) break;

          const maxAttempts = isReleasing ? 10 : 5;
          if (attempt >= maxAttempts) break;
          attempt += 1;
          const retryAfterMs = response.data?.capacity?.retryAfterMs || (isReleasing ? 1500 : 3000);
          setCapacityWait({ attempt, maxAttempts });
          setProgress(Math.min(65, 50 + attempt * 2));
          setSteps((prev) => prev.map((step, index) => index === 2 ? {
            ...step,
            text: isReleasing
              ? t('boot.releasingPrevious', { attempt, max: maxAttempts })
              : t('boot.waitingCapacity', { attempt, max: maxAttempts }),
            status: 'pending',
          } : step));
          await new Promise((resolve) => window.setTimeout(resolve, retryAfterMs));
          if (!isMounted) return;
          response = await labApi.createSession(sourceType, sourceId);
        }

        if (!isMounted) return;
        setCapacityWait(null);

        if (response.success && response.data?.session && response.data.urls) {
          setSteps((prev) => prev.map((s, idx) => (idx === 2 ? { ...s, status: 'done' } : s)));
          setProgress(70);

          // 完成剩余步骤
          for (let i = 3; i < 5; i++) {
            if (!isMounted) return;
            setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'pending' } : s)));
            setProgress(70 + ((i - 2) / 3) * 30);
            await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
            setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)));
          }

          setProgress(100);
          onSessionCreated(response.data.session, response.data.urls);
          setTimeout(onComplete, 500);
        } else {
          setSteps((prev) => prev.map((s, idx) => (idx === 2 ? { ...s, status: 'error' } : s)));
          const errorMsg = response.error || t('createFailed');
          
          // 检查是否是会话冲突错误
          if (isSessionConflictError(errorMsg)) {
            onConflict(errorMsg);
          } else {
            onError(errorMsg);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSteps((prev) => prev.map((s, idx) => (idx === 2 ? { ...s, status: 'error' } : s)));
        // 检查是否是认证错误
        const errorMsg = err?.response?.data?.error || err?.message || t('networkError');
        
        // 检查是否是会话冲突错误
        if (isSessionConflictError(errorMsg)) {
          onConflict(errorMsg);
        } else {
          onError(errorMsg);
        }
      }
    };

    createSession();

    return () => {
      isMounted = false;
    };
  }, [sourceType, sourceId, onComplete, onError, onConflict, onSessionCreated, t]);

  return (
    <motion.div
      className="absolute inset-0 z-[100] bg-[#1e1e1e] flex flex-col items-center justify-center font-sans text-sm overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="w-full max-w-lg relative z-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-12"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_-10px_rgba(37,99,235,0.6)] mb-4">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agent EDU Lab</h1>
          <p className="text-slate-500 mt-1 font-mono text-xs">{t('boot.initialization')}</p>
        </motion.div>

        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-8 relative">
          <motion.div
            className="h-full bg-blue-500 relative"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white/50 to-transparent"></div>
          </motion.div>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: step.status === 'waiting' ? 0.3 : 1,
                x: 0,
              }}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 flex items-center justify-center rounded-full ${
                    step.status === 'done'
                      ? 'bg-emerald-500 text-white'
                      : step.status === 'pending'
                        ? 'bg-blue-500/20 text-blue-500'
                        : step.status === 'error'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700'
                  }`}
                >
                  {step.status === 'done' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : step.status === 'pending' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : step.status === 'error' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                  )}
                </div>
                <span
                  className={`text-sm font-mono ${
                    step.status === 'done'
                      ? 'text-slate-300'
                      : step.status === 'pending'
                        ? 'text-blue-400'
                        : step.status === 'error'
                          ? 'text-red-400'
                          : 'text-slate-600'
                  }`}
                >
                  {step.text}
                </span>
              </div>
              {step.status === 'done' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded"
                >
                  {t('done', { ns: 'uiReview' })}
                </motion.span>
              )}
              {step.status === 'error' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded"
                >
                  {t('error', { ns: 'uiReview' })}
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>

        {capacityWait && (
          <div className="mt-8 flex items-center justify-between rounded-md bg-white/5 px-4 py-3 text-xs text-slate-400">
            <span>{t('boot.autoRetrying')}</span>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-300 transition-colors hover:text-white"
            >
              {t('cancelWait')}
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 text-xs text-slate-600 font-mono">
        ID: env-{sourceId}-{sourceType === LabSourceType.COURSE ? 'course' : 'project'} • {t('region', { ns: 'uiReview' })}:
        local
      </div>
    </motion.div>
  );
};


// --- iframe 内容组件 ---
interface IframeContentProps {
  url: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  allowDownloads?: boolean;
}

const appendRetryParam = (rawUrl: string, key: string, value: number): string => {
  if (!rawUrl || value <= 0) return rawUrl;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    parsed.searchParams.set(key, String(value));
    const isRelative = rawUrl.startsWith('/');
    return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
  } catch {
    return rawUrl;
  }
};

const buildIframeRetryUrl = (rawUrl: string, retryCount: number): string => {
  if (!rawUrl || retryCount <= 0) return rawUrl;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const nestedPath = parsed.searchParams.get('path');
    if (nestedPath) {
      parsed.searchParams.set('path', appendRetryParam(nestedPath, '_labWsRetry', retryCount));
    }
    parsed.searchParams.set('_labFrameRetry', String(retryCount));
    const isRelative = rawUrl.startsWith('/');
    return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
  } catch {
    return appendRetryParam(rawUrl, '_labFrameRetry', retryCount);
  }
};

const IframeContent: React.FC<IframeContentProps> = ({ url, title, icon: Icon, description, allowDownloads = false }) => {
  const { t } = useTranslation('lab');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingText, setLoadingText] = useState(t('connecting'));
  const initStartedAtRef = useRef<number>(Date.now());
  const retryTimerRef = useRef<number | null>(null);
  const noVNCWatchdogRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const MAX_INIT_WAIT_MS = 30000;
  const RETRY_INTERVAL_MS = 3000;
  const NOVNC_WATCHDOG_MS = 12000;
  const MAX_FRAME_RETRIES = 2;
  const frameUrl = useMemo(() => buildIframeRetryUrl(url, retryCount), [retryCount, url]);
  const isNoVNCFrame = url.includes('/novnc/vnc.html');

  const clearNoVNCWatchdog = useCallback(() => {
    if (noVNCWatchdogRef.current) {
      window.clearTimeout(noVNCWatchdogRef.current);
      noVNCWatchdogRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setRetryCount(0);
    setLoadingText(t('connecting'));
    initStartedAtRef.current = Date.now();
    clearNoVNCWatchdog();

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      clearNoVNCWatchdog();
    };
  }, [clearNoVNCWatchdog, url]);

  const handleFrameError = () => {
    const elapsed = Date.now() - initStartedAtRef.current;
    if (elapsed < MAX_INIT_WAIT_MS) {
      setError(false);
      setLoading(true);
      setLoadingText(t('waitingService'));

      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, RETRY_INTERVAL_MS);
      return;
    }

    setLoading(false);
    setError(true);
  };

  const handleFrameLoad = () => {
    setLoading(false);
    setError(false);
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    clearNoVNCWatchdog();
    if (!isNoVNCFrame) return;

    noVNCWatchdogRef.current = window.setTimeout(() => {
      try {
        const frameDocument = iframeRef.current?.contentDocument;
        const htmlClass = frameDocument?.documentElement?.className || '';
        const statusText = frameDocument?.querySelector('#noVNC_status')?.textContent || '';
        const connected = htmlClass.includes('noVNC_connected') || statusText.includes('已连接');
        const stillConnecting = htmlClass.includes('noVNC_connecting') || statusText.includes('连接中');

        if (connected || !stillConnecting) return;
        if (retryCount >= MAX_FRAME_RETRIES) {
          setLoading(false);
          setError(true);
          return;
        }

        setError(false);
        setLoading(true);
        setLoadingText(t('reconnectingVnc'));
        setRetryCount((prev) => prev + 1);
      } catch {
        // iframe 为同源代理时可读；若浏览器限制读取，则保持当前连接状态，不额外打断用户。
      }
    }, NOVNC_WATCHDOG_MS);
  };

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center z-10">
          <div className="w-20 h-20 mb-8 rounded-2xl bg-[#252526] border border-[#333] flex items-center justify-center shadow-2xl">
            <Icon className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2 text-slate-200">{title}</h2>
          <p className="text-slate-500 text-sm mb-2">{description}</p>
          <p className="text-slate-400 text-xs mb-4">
            {loadingText}
            {retryCount > 0 ? t('retryCount', { count: retryCount }) : ''}
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-200 mb-2">{t('connectionFailed')}</h2>
          <p className="text-slate-500 text-sm mb-4">{t('cannotConnect', { title })}</p>
          <a
            href={frameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <ExternalLink className="w-4 h-4" />
            {t('openNewWindow')}
          </a>
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={`${url}-${retryCount}`}
        src={frameUrl}
        className="w-full h-full border-0 overflow-hidden"
        title={title}
        allow="cross-origin-isolated"
        sandbox={`allow-same-origin allow-scripts allow-forms allow-modals allow-popups${allowDownloads ? ' allow-downloads' : ''}`}
        style={{ display: 'block' }}
        onLoad={handleFrameLoad}
        onError={handleFrameError}
      />
    </div>
  );
};

// --- Tab 组件 ---
interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
            relative flex items-center gap-2 px-5 h-full text-xs font-medium transition-all
            border-r border-white/5
            ${
              active
                ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500'
                : 'bg-[#2d2d2d] text-slate-500 hover:bg-[#2a2a2b] hover:text-slate-300 border-t-2 border-t-transparent'
            }
        `}
  >
    <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
    {label}
  </button>
);

// --- Header 组件 ---
interface LabHeaderProps {
  activeTab: string;
  setActiveTab: (tab: LabTab) => void;
  timeLeft: number;
  onBack: () => void;
  onHelp: () => void;
  hasDesktop: boolean;
  hasIde: boolean;
  hasAppPorts: boolean;
  onComplete: () => void;
  completing: boolean;
  completionStage: 'idle' | 'saving' | 'releasing';
}

const LabHeader: React.FC<LabHeaderProps> = ({
  activeTab,
  setActiveTab,
  timeLeft,
  onBack,
  onHelp,
  hasDesktop,
  hasIde,
  hasAppPorts,
  onComplete,
  completing,
  completionStage,
}) => {
  const { t } = useTranslation('lab');
  const tabs: Array<{ id: LabTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [];
  if (hasDesktop) {
    tabs.push({ id: 'desktop', label: 'Desktop', icon: Monitor });
  }
  tabs.push({ id: 'terminal', label: 'Terminal', icon: TerminalIcon });

  if (hasAppPorts) {
    tabs.push({ id: 'ports', label: 'Ports', icon: Globe });
  }
  tabs.push({ id: 'opencode', label: 'CLI', icon: Bot });
  if (hasIde) {
    tabs.push({ id: 'ide', label: 'WebIDE', icon: Code2 });
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-10 bg-[#252526] flex items-center justify-between shadow-md z-50 select-none border-b border-black">
      <div className="flex items-center h-full">
        <button
          onClick={onBack}
          className="h-full px-4 text-slate-400 hover:text-white hover:bg-[#333] transition-colors border-r border-white/5 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">{t('back')}</span>
        </button>
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div
          className={`bg-[#1e1e1e] border border-[#333] px-4 py-0.5 rounded text-sm font-mono font-bold tracking-wider shadow-inner flex items-center gap-2 ${
            timeLeft < 300 ? 'text-red-400' : 'text-slate-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${timeLeft < 300 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}
          ></span>
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="flex items-center h-full px-4 gap-4">
        <div className="hidden lg:flex items-center gap-3 mr-2 border-r border-white/5 pr-4">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Cpu className="w-3 h-3" />
            <span>{t('active')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <Wifi className="w-3 h-3" />
            <span>{t('connected')}</span>
          </div>
        </div>

        <button
          className="text-slate-400 hover:text-white transition-colors"
          title={t('help')}
          onClick={onHelp}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <button
          className="text-slate-400 hover:text-white transition-colors"
          title={t('refresh')}
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* 完成实验按钮 */}
        <button
          onClick={onComplete}
          disabled={completing}
          className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold rounded shadow-sm transition-all"
        >
          {completing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              {completionStage === 'releasing' ? t('releasingEnvironment') : t('submitting')}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              {t('completeLab')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};


// --- 会话冲突弹窗组件 ---
interface SessionConflictModalProps {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const SessionConflictModal: React.FC<SessionConflictModalProps> = ({ onClose, onConfirm, loading }) => {
  const { t } = useTranslation('lab');
  return (
    <PageDialog
      isOpen
      onClose={loading ? undefined : onClose}
      closeOnBackdrop={!loading}
      panelClassName="max-w-md rounded-xl bg-[#252526] text-white"
      zIndexClassName="z-[10000]"
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('conflictTitle')}</h3>
            <p className="text-sm text-slate-400">{t('conflictSubtitle')}</p>
          </div>
        </div>
        
        <p className="text-slate-300 text-sm mb-6">
          {t('conflictDesc')}
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg text-sm font-medium transition-colors text-white"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 rounded-lg text-sm font-medium transition-colors text-white flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('stopping')}
              </>
            ) : (
              t('stopAndCreate')
            )}
          </button>
        </div>
      </div>
    </PageDialog>
  );
};

// --- 错误页面组件 ---
interface ErrorPageProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
  onLogin?: () => void;
  onResolveConflict?: () => void;
  resolvingConflict?: boolean;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, onRetry, onBack, onLogin, onResolveConflict, resolvingConflict }) => {
  const { t } = useTranslation('lab');
  // 检查是否是认证相关错误
  const isAuthError = error.includes('认证') || error.includes('登录') || error.includes('令牌') || error.includes('token');
  const isConflictError = isSessionConflictError(error);
  
  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{isAuthError ? t('loginRequired') : t('launchFailed')}</h1>
        <p className="text-slate-400 mb-6">{isAuthError ? t('loginRequiredDesc') : error}</p>
        {isConflictError && (
          <p className="text-xs leading-relaxed text-slate-500 mb-6">
            {t('conflictHint')}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            {t('back')}
          </button>
          {isAuthError && onLogin ? (
            <button
              onClick={onLogin}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              {t('goLogin')}
            </button>
          ) : isConflictError && onResolveConflict ? (
            <button
              onClick={onResolveConflict}
              disabled={resolvingConflict}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              {resolvingConflict && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('resolveAndRetry')}
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              {t('retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface LabPageProps {
  onLoginRequired?: () => void;
}

// --- 主组件 ---
const LabPage: React.FC<LabPageProps> = ({ onLoginRequired }) => {
  const { t } = useTranslation('lab');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 从 URL 参数获取来源类型和 ID
  const sourceTypeParam = searchParams.get('sourceType');
  const sourceIdParam = searchParams.get('sourceId');
  const lessonIdParam = searchParams.get('lessonId');  // 课时 ID（用于课程加载 Agent 手册）
  const unitIdParam = searchParams.get('unitId');      // 单元 ID（用于项目加载 Agent 手册）
  const initialTabParam = searchParams.get('initialTab');
  const classIdParam = searchParams.get('classId');

  const sourceType = sourceTypeParam === 'project' ? LabSourceType.PROJECT : LabSourceType.COURSE;
  const sourceId = parseInt(sourceIdParam || '0');
  const lessonId = parseInt(lessonIdParam || '0');  // 课时 ID
  const unitId = parseInt(unitIdParam || '0');      // 单元 ID
  const classId = parseInt(classIdParam || '0');

  // 计算 AgentWidget 的 sourceType 和 sourceId
  // 课程：sourceType=1, sourceId=lessonId
  // 项目：sourceType=2, sourceId=unitId
  const agentSourceType = sourceType === LabSourceType.PROJECT ? 2 : 1;
  const agentSourceId = sourceType === LabSourceType.PROJECT ? unitId : (lessonId || sourceId);

  const [activeTab, setActiveTab] = useState<LabTab>('desktop');
  const initializedTabKey = useRef('');
  const [opencodeRefreshToken, setOpencodeRefreshToken] = useState(0);
  const [selectedAppPortName, setSelectedAppPortName] = useState('');

  // 包装 setActiveTab，在切换标签页时触发 resize 事件刷新终端
  const handleSetActiveTab = useCallback((tab: LabTab) => {
    setActiveTab(tab);
    // 延迟触发 resize 事件，让终端有时间重新渲染
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, []);
  const [timeLeft, setTimeLeft] = useState(7200); // 2 小时
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<LabSession | null>(null);
  const [urls, setUrls] = useState<LabUrls | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [checkedSessionSourceKey, setCheckedSessionSourceKey] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [timeoutHandled, setTimeoutHandled] = useState(false);

  // 完成实验相关状态
  const [completing, setCompleting] = useState(false);
  const [completionStage, setCompletionStage] = useState<'idle' | 'saving' | 'releasing'>('idle');
  const sessionReleaseInProgress = completing || timeoutHandled || conflictLoading || completionStage === 'releasing';
  // 是否是新创建的会话（用于重置 Agent 进度）
  const [isNewSession, setIsNewSession] = useState(false);

  // 检查登录状态
  const isLoggedIn = !!localStorage.getItem('authToken');
  const sessionSourceKey = `${Number(sourceType)}:${sourceId}`;
  const appUrls = urls?.appUrls || [];
  const explicitDefaultAppUrl = appUrls.find((item) => item.isDefault) || null;
  const defaultAppUrl = explicitDefaultAppUrl || appUrls[0] || null;
  const selectedAppUrl = appUrls.find((item) => item.name === selectedAppPortName) || defaultAppUrl;
  const hasDesktop = Boolean(urls?.vncUrl);
  const hasAppPorts = appUrls.length > 0;
  useEffect(() => {
    if (!urls || !session) return;
    const key = `${session.id}:${initialTabParam || ''}`;
    const available = new Set<LabTab>(['terminal', 'opencode']);
    if (hasDesktop) available.add('desktop');
    if (urls.ideUrl) available.add('ide');
    if (defaultAppUrl) available.add('ports');
    const fallback: LabTab = defaultAppUrl ? 'ports' : hasDesktop ? 'desktop' : 'terminal';
    if (initializedTabKey.current !== key) {
      initializedTabKey.current = key;
      const requested = initialTabParam as LabTab | null;
      setActiveTab(requested && available.has(requested) ? requested : explicitDefaultAppUrl ? 'ports' : hasDesktop ? 'desktop' : fallback);
      return;
    }
    // 默认入口只在会话初始化时应用，不覆盖学生之后的手动切换。
    if (!available.has(activeTab)) {
      setActiveTab(fallback);
    }
  }, [activeTab, defaultAppUrl, explicitDefaultAppUrl, hasDesktop, initialTabParam, session, urls]);

  useEffect(() => {
    if (defaultAppUrl && !selectedAppPortName) {
      setSelectedAppPortName(defaultAppUrl.name);
    }
    if (selectedAppPortName && !appUrls.some((item) => item.name === selectedAppPortName)) {
      setSelectedAppPortName(defaultAppUrl?.name || '');
    }
  }, [appUrls, defaultAppUrl, selectedAppPortName]);

  const handleRefreshOpencode = useCallback(() => {
    setOpencodeRefreshToken((prev) => prev + 1);
  }, []);

  const exitLabPage = useCallback(() => {
    const fallbackPath = '/study';
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
      }
    } catch (err) {
      console.warn('[LabPage] 无法访问 opener:', err);
    }

    try {
      window.close();
    } catch (err) {
      console.warn('[LabPage] 关闭窗口失败，回退路由:', err);
    }

    window.setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate(fallbackPath, { replace: true });
    }, 120);
  }, [navigate]);

  // 检查是否有活跃会话
  useEffect(() => {
    // 如果未登录，直接显示错误
    if (!isLoggedIn) {
      setError(t('authTokenMissing'));
      setIsBooting(false);
      setCheckedSessionSourceKey(sessionSourceKey);
      return;
    }

    if (sourceId <= 0) {
      setError(t('missingRequiredParams'));
      setIsBooting(false);
      setCheckedSessionSourceKey(sessionSourceKey);
      return;
    }

    let disposed = false;

    const checkActiveSession = async () => {
      try {
        const response = await labApi.getActiveSession();
        if (disposed) return;
        
        // 检查是否有错误（如未登录）
        if (!response.success) {
          // 如果是认证错误，设置错误状态
          if (response.error) {
            setError(response.error);
            setIsBooting(false);
          }
          return;
        }
        
        if (response.data?.session) {
          const activeSession = response.data.session;
          // 活跃会话来源不匹配，触发冲突流程（先关闭再重建）
          if (
            Number(activeSession.sourceType) !== Number(sourceType) ||
            Number(activeSession.sourceId) !== Number(sourceId)
          ) {
            setShowConflictModal(true);
            setIsBooting(false);
            return;
          }

          // 已有活跃会话且来源匹配，直接复用
          setSession(response.data.session);
          setUrls(response.data.urls || null);

          // 计算剩余时间
          if (response.data.session.expiresAt) {
            const expiresAt = new Date(response.data.session.expiresAt).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setTimeLeft(remaining);
          }

          setIsBooting(false);
        }
        // 如果没有活跃会话，isBooting 保持 true，BootSequence 会创建新会话
      } catch (err) {
        if (disposed) return;
        console.error('检查活跃会话失败:', err);
        // 出错时也保持 isBooting 为 true，让 BootSequence 尝试创建新会话
      } finally {
        if (!disposed) {
          setCheckedSessionSourceKey(sessionSourceKey);
        }
      }
    };

    void checkActiveSession();
    return () => {
      disposed = true;
    };
  }, [isLoggedIn, sessionSourceKey, sourceId, sourceType, t]);

  // 倒计时
  useEffect(() => {
    if (!session || session.status !== LabSessionStatus.RUNNING) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    setTimeoutHandled(false);
  }, [session?.id]);

  useEffect(() => {
    if (!session || session.status !== LabSessionStatus.RUNNING || sessionReleaseInProgress) return;
    let disposed = false;
    const renew = async () => {
      const response = await labApi.renewLease(session.id);
      if (!disposed && !response.success) {
        if (response.code === 'LAB_SESSION_EXPIRED') {
          setSession(null);
          setUrls(null);
          setError(null);
          setIsBooting(true);
          setRetryKey((key) => key + 1);
          return;
        }
        setError(response.error || t('operationFailed'));
      }
    };
    const timer = window.setInterval(() => void renew(), 30_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [session?.id, session?.status, sessionReleaseInProgress, t]);

  const releaseSessionAndWait = useCallback(async (sessionId: number) => {
    let response = await labApi.stopSession(sessionId);
    if (!response.success || !response.data) {
      throw new Error(response.error || t('stopFailed'));
    }

    for (let attempt = 0; !response.data.released && attempt < 20; attempt += 1) {
      const retryAfterMs = response.data.retryAfterMs || 1500;
      await new Promise((resolve) => window.setTimeout(resolve, retryAfterMs));
      response = await labApi.getReleaseStatus(sessionId);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('releaseStatusFailed'));
      }
    }

    if (!response.data.released) {
      throw new Error(t('releaseTimeout'));
    }
  }, [t]);

  useEffect(() => {
    if (!session || timeoutHandled || timeLeft > 0) return;

    let cancelled = false;
    setTimeoutHandled(true);

    const autoStopAndExit = async () => {
      if (session.status === LabSessionStatus.RUNNING) {
        try {
          await releaseSessionAndWait(session.id);
        } catch (err) {
          console.error('[LabPage] 自动结束实验失败:', err);
        }
      }

      if (cancelled) return;
      alert(t('timeExpired'));
      exitLabPage();
    };

    autoStopAndExit();

    return () => {
      cancelled = true;
    };
  }, [session, timeoutHandled, timeLeft, exitLabPage, releaseSessionAndWait, t]);

  // 完成实验
  const handleCompleteLesson = async () => {
    // 对于课程，使用 lessonId；对于项目，使用 unitId
    const targetId = sourceType === LabSourceType.PROJECT ? unitId : lessonId;
    
    if (sourceType === LabSourceType.COURSE && (!targetId || targetId === 0)) {
      alert(t('invalidLesson'));
      console.error('[LabPage] 无效的lessonId:', lessonId);
      return;
    }
    
    if (completing) {
      return;
    }

    // 检查登录状态
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      alert(t('loginBeforeComplete'));
      return;
    }

    setCompleting(true);
    setCompletionStage('saving');
    try {
      let success = false;
      
      // 项目单元暂时不调用完成 API
      if (sourceType === LabSourceType.PROJECT) {
        success = true;
      } else {
        // 课程课时调用完成 API
        const response = await courseApi.completeLesson(lessonId);
        
        if (response.success && response.data) {
          success = true;
        } else {
          console.error('[LabPage] 完成实验失败:', response.error);
          alert(response.error || t('completeFailed'));
        }
      }
      
      // 如果完成成功，停止环境并关闭页面
      if (success) {
        setCompletionStage('releasing');
        if (session) {
          await releaseSessionAndWait(session.id);
        }
        exitLabPage();
      }
    } catch (err) {
      console.error('[LabPage] 完成实验异常:', err);
      alert(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setCompleting(false);
      setCompletionStage('idle');
    }
  };
  // 处理会话创建成功（新创建的会话）
  const handleSessionCreated = useCallback((newSession: LabSession, newUrls: LabUrls) => {
    setSession(newSession);
    setUrls(newUrls);
    setIsNewSession(true);  // 标记为新会话，需要重置 Agent 进度

    // 计算剩余时间
    if (newSession.expiresAt) {
      const expiresAt = new Date(newSession.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
    }
  }, []);

  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
  }, []);

  // 返回
  const handleBack = () => {
    if (completing) return;
    exitLabPage();
  };

  const handleHelp = useCallback(() => {
    alert(t('helpText'));
  }, [t]);

  // 重试
  const handleRetry = () => {
    setError(null);
    setIsBooting(true);
    setRetryKey((k) => k + 1);
  };

  // 错误处理
  const handleError = useCallback((err: string) => {
    setError(err);
    setIsBooting(false);
  }, []);

  // 会话冲突处理
  const handleConflict = useCallback((conflictMessage?: string) => {
    if (conflictMessage) {
      setError(null);
    }
    setIsBooting(false);
    setShowConflictModal(true);
  }, []);

  // 关闭现有会话并重新创建
  const handleCloseAndRecreate = async () => {
    setConflictLoading(true);
    try {
      let sessionToStop: LabSession | null = null;

      // 优先获取当前运行中的活跃会话
      const activeResponse = await labApi.getActiveSession();
      if (activeResponse.success && activeResponse.data?.session) {
        sessionToStop = activeResponse.data.session;
      }

      // 并发上限也可能被 creating 状态占用，活跃接口只返回 running，因此补查会话列表。
      if (!sessionToStop) {
        const sessionsResponse = await labApi.getUserSessions();
        const sessions = sessionsResponse.success && Array.isArray(sessionsResponse.data) ? sessionsResponse.data : [];
        sessionToStop = sessions.find((item) =>
          item.status === LabSessionStatus.RUNNING || item.status === LabSessionStatus.CREATING
        ) || null;
      }

      if (!sessionToStop) {
        setShowConflictModal(false);
        setConflictLoading(false);
        setError(null);
        setIsBooting(true);
        setRetryKey((k) => k + 1);
        return;
      }

      await releaseSessionAndWait(sessionToStop.id);
      
      // 关闭弹窗，重新启动创建流程
      setShowConflictModal(false);
      setConflictLoading(false);
      setIsBooting(true);
      setRetryKey((k) => k + 1);
    } catch (err: any) {
      setError(err?.message || t('operationFailed'));
      setShowConflictModal(false);
      setConflictLoading(false);
    }
  };

  // 登录跳转
  const handleLogin = () => {
    if (onLoginRequired) {
      onLoginRequired();
      return;
    }

    // 兼容未接入全局登录弹窗的旧调用场景
    const currentUrl = window.location.pathname + window.location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  // 参数错误
  if (!sourceId || sourceId <= 0) {
    return (
      <ErrorPage
        error={t('missingParams')}
        onRetry={() => navigate(-1)}
        onBack={() => navigate(-1)}
      />
    );
  }

  // 启动错误
  if (error) {
    return (
      <ErrorPage
        error={error}
        onRetry={handleRetry}
        onBack={handleBack}
        onLogin={handleLogin}
        onResolveConflict={handleCloseAndRecreate}
        resolvingConflict={conflictLoading}
      />
    );
  }

  if (isBooting && checkedSessionSourceKey !== sessionSourceKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1e1e] text-white">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span>{t('connecting')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans relative">
      <AnimatePresence>
        {isBooting && checkedSessionSourceKey === sessionSourceKey && (
          <BootSequence
            key={retryKey}
            onComplete={handleBootComplete}
            onError={handleError}
            onConflict={handleConflict}
            sourceType={sourceType}
            sourceId={sourceId}
            onSessionCreated={handleSessionCreated}
            onCancel={handleBack}
          />
        )}
      </AnimatePresence>

      {/* 会话冲突弹窗 */}
      <AnimatePresence>
        {showConflictModal && (
          <SessionConflictModal
            onClose={() => {
              setShowConflictModal(false);
              navigate(-1);
            }}
            onConfirm={handleCloseAndRecreate}
            loading={conflictLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completing && completionStage !== 'idle' && (
          <motion.div
            className="absolute inset-0 z-[180] flex items-center justify-center bg-[#111]/85 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex max-w-sm flex-col items-center px-6 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {completionStage === 'releasing' ? t('releaseTitle') : t('saveProgressTitle')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {completionStage === 'releasing' ? t('releaseDescription') : t('saveProgressDescription')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isBooting && session && urls && (
        <>
          <LabHeader
            activeTab={activeTab}
            setActiveTab={handleSetActiveTab}
            timeLeft={timeLeft}
            onBack={handleBack}
            onHelp={handleHelp}
            hasDesktop={hasDesktop}
            hasIde={!!urls.ideUrl}
            hasAppPorts={hasAppPorts}
            onComplete={handleCompleteLesson}
            completing={completing}
            completionStage={completionStage}
          />

          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
            {/* Desktop Tab - 使用 CSS 控制显示隐藏，避免重新加载 */}
            {hasDesktop && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'desktop' ? 'block' : 'none' }}
              >
                <IframeContent
                  url={urls.vncUrl}
                  title="Ubuntu Desktop"
                  icon={Monitor}
                  description={t('desktopDesc')}
                />
              </div>
            )}
            
            {/* Terminal Tab - 使用 CSS 控制显示隐藏，保持连接 */}
            <div
              className="absolute inset-0"
              style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}
            >
              <Suspense fallback={
                <div className="w-full h-full bg-[#0c0c0c] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              }>
                <WebTerminal
                  sessionId={session.id}
                  sshPort={session.sshPort}
                  terminalId="ssh"
                  isActive={activeTab === 'terminal'}
                />
              </Suspense>
            </div>

            {hasAppPorts && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'ports' ? 'block' : 'none' }}
              >
                <div className="absolute left-0 top-0 z-20 flex max-w-full gap-2 overflow-x-auto bg-[#252526]/95 px-3 py-2">
                  {appUrls.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => setSelectedAppPortName(item.name)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        selectedAppUrl?.name === item.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/15'
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {item.label || item.name}:{item.containerPort}
                    </button>
                  ))}
                </div>
                {selectedAppUrl ? (
                  <IframeContent
                    url={selectedAppUrl.url}
                    allowDownloads
                    title={selectedAppUrl.label || selectedAppUrl.name}
                    icon={Globe}
                    description={t('portDesc', { containerPort: selectedAppUrl.containerPort, servicePort: selectedAppUrl.servicePort })}
                  />
                ) : (
                  <div className="w-full h-full bg-[#1e1e1e] flex flex-col items-center justify-center gap-3 text-slate-300">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-sm">{t('noPorts')}</p>
                  </div>
                )}
              </div>
            )}

            {/* OpenCode Tab (K8S exec opencode) */}
            <div
              className="absolute inset-0"
              style={{ display: activeTab === 'opencode' ? 'block' : 'none' }}
            >
              {activeTab === 'opencode' && (
                <div className="absolute top-3 right-3 z-20">
                  <button
                    onClick={handleRefreshOpencode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/70 hover:bg-black/80 border border-white/10 text-slate-200 text-xs"
                    title={t('refreshOpenCode')}
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('refreshOpenCodeAction')}
                  </button>
                </div>
              )}
              <Suspense fallback={
                <div className="w-full h-full bg-[#0c0c0c] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              }>
                <WebTerminal
                  sessionId={session.id}
                  sshPort={session.sshPort}
                  terminalId="opencode"
                  disableMouse={true}
                  mode="exec"
                  command="opencode"
                  isActive={activeTab === 'opencode'}
                  sessionPolicy="reuse"
                  connectNonce={opencodeRefreshToken}
                  restartToken={opencodeRefreshToken}
                />
              </Suspense>
            </div>

            {/* WebIDE Tab */}
            {urls.ideUrl && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'ide' ? 'block' : 'none' }}
              >
                <IframeContent
                  url={urls.ideUrl}
                  title="WebIDE"
                  icon={Code2}
                  description={t('ideDesc')}
                />
              </div>
            )}
          </div>

          <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] font-sans select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 cursor-pointer hover:bg-white/10 px-1 rounded">
                <Activity className="w-3 h-3" /> {t('container', { ns: 'uiReview' })}: {session.containerName}
              </span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:bg-white/10 px-1 rounded">
                <Wifi className="w-3 h-3" /> noVNC:{session.vncPort} | SSH:{session.sshPort}
                {appUrls.length > 0 ? ` | App:${appUrls.map((item) => item.containerPort).join(',')}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hover:bg-white/10 px-1 rounded cursor-pointer">
                {t('image', { ns: 'uiReview' })}: {session.imageName}
              </span>
              <span className="hover:bg-white/10 px-1 rounded cursor-pointer">
                {t('status', { ns: 'uiReview' })}: {session.status === LabSessionStatus.RUNNING ? t('running', { ns: 'uiReview' }) : t('unknown', { ns: 'uiReview' })}
              </span>
            </div>
          </div>

          {/* 教学智能体组件 */}
          <Suspense fallback={null}>
            <AgentWidget 
              sourceType={agentSourceType}
              sourceId={agentSourceId}
              containerId={session.containerId}
              classId={classId || undefined}
              resetProgress={isNewSession}
              onComplete={handleCompleteLesson}
              onExecuteCommand={async (command, context) => {
                const result = await labApi.executeCommand(command, context);
                if (result.success && result.data) {
                  return {
                    output: result.data.output,
                    exitCode: result.data.exitCode,
                    error: result.data.error,
                  };
                }
                return {
                  output: '',
                  exitCode: 1,
                  error: result.error || t('executeFailed'),
                };
              }}
            />
          </Suspense>
        </>
      )}
    </div>
  );
};

export default LabPage;
