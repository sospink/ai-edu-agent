import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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
  Copy,
  Check,
} from 'lucide-react';
import {
  labApi,
  LabSession,
  LabUrls,
  LabSessionStatus,
  LabSourceType,
} from '@/services/lab';
import { courseApi } from '@/services/course';

// 懒加载 WebTerminal 组件
const WebTerminal = lazy(() => import('./WebTerminal'));

// 懒加载 AgentWidget 组件
const AgentWidget = lazy(() => import('../agent/AgentWidget'));

type LabTab = 'desktop' | 'terminal' | 'ide' | 'opencode' | 'openclaw' | 'gateway';

// --- 启动序列组件 ---
interface BootStep {
  id: number;
  text: string;
  status: 'pending' | 'waiting' | 'done' | 'error';
}

interface BootSequenceProps {
  onComplete: () => void;
  onError: (error: string) => void;
  onConflict: (existingSessionId: number) => void;
  sourceType: LabSourceType;
  sourceId: number;
  onSessionCreated: (session: LabSession, urls: LabUrls) => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({
  onComplete,
  onError,
  onConflict,
  sourceType,
  sourceId,
  onSessionCreated,
}) => {
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<BootStep[]>([
    { id: 1, text: '正在分配云端计算资源 (Allocating Resources)...', status: 'pending' },
    { id: 2, text: '正在拉取环境镜像 (Docker Image)...', status: 'waiting' },
    { id: 3, text: '正在启动容器实例 (Container)...', status: 'waiting' },
    { id: 4, text: '正在配置网络端口 (VNC/IDE/SSH)...', status: 'waiting' },
    { id: 5, text: '正在建立安全连接 (Secure Tunnel)...', status: 'waiting' },
  ]);

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
        const response = await labApi.createSession(sourceType, sourceId);

        if (!isMounted) return;

        if (response.success && response.data) {
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
          const errorMsg = response.error || '创建实验环境失败';
          
          // 检查是否是会话冲突错误
          if (errorMsg.includes('已有一个运行中的实验环境') || errorMsg.includes('请先关闭')) {
            onConflict(0); // 触发冲突处理
          } else {
            onError(errorMsg);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSteps((prev) => prev.map((s, idx) => (idx === 2 ? { ...s, status: 'error' } : s)));
        // 检查是否是认证错误
        const errorMsg = err?.response?.data?.error || err?.message || '网络错误，请稍后重试';
        
        // 检查是否是会话冲突错误
        if (errorMsg.includes('已有一个运行中的实验环境') || errorMsg.includes('请先关闭')) {
          onConflict(0); // 触发冲突处理
        } else {
          onError(errorMsg);
        }
      }
    };

    createSession();

    return () => {
      isMounted = false;
    };
  }, [sourceType, sourceId, onComplete, onError, onSessionCreated]);

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
          <p className="text-slate-500 mt-1 font-mono text-xs">Environment Initialization</p>
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
                  DONE
                </motion.span>
              )}
              {step.status === 'error' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded"
                >
                  ERROR
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 text-xs text-slate-600 font-mono">
        ID: env-{sourceId}-{sourceType === LabSourceType.COURSE ? 'course' : 'project'} • Region:
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
}

const IframeContent: React.FC<IframeContentProps> = ({ url, title, icon: Icon, description }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingText, setLoadingText] = useState('正在加载...');
  const initStartedAtRef = useRef<number>(Date.now());
  const retryTimerRef = useRef<number | null>(null);
  const MAX_INIT_WAIT_MS = 30000;
  const RETRY_INTERVAL_MS = 3000;

  useEffect(() => {
    setLoading(true);
    setError(false);
    setRetryCount(0);
    setLoadingText('正在加载...');
    initStartedAtRef.current = Date.now();

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [url]);

  const handleFrameError = () => {
    const elapsed = Date.now() - initStartedAtRef.current;
    if (elapsed < MAX_INIT_WAIT_MS) {
      setError(false);
      setLoading(true);
      setLoadingText('环境初始化中，正在等待服务启动...');

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
            {retryCount > 0 ? `（重试 ${retryCount}）` : ''}
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-200 mb-2">连接失败</h2>
          <p className="text-slate-500 text-sm mb-4">无法连接到 {title}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <ExternalLink className="w-4 h-4" />
            在新窗口打开
          </a>
        </div>
      )}
      <iframe
        key={`${url}-${retryCount}`}
        src={url}
        className="w-full h-full border-0 overflow-hidden"
        title={title}
        allow="cross-origin-isolated"
        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups"
        style={{ display: 'block' }}
        onLoad={() => {
          setLoading(false);
          setError(false);
          setLoadingText('正在加载...');
          if (retryTimerRef.current) {
            window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        }}
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
  isProjectMode: boolean;
  hasIde: boolean;
  hasGateway: boolean;
  onComplete: () => void;
  completing: boolean;
}

const LabHeader: React.FC<LabHeaderProps> = ({
  activeTab,
  setActiveTab,
  timeLeft,
  onBack,
  onHelp,
  isProjectMode,
  hasIde,
  hasGateway,
  onComplete,
  completing,
}) => {
  const tabs: Array<{ id: LabTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'desktop', label: 'Desktop', icon: Monitor },
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  ];

  if (isProjectMode) {
    tabs.push({ id: 'openclaw', label: 'OpenClaw', icon: Bot });
    if (hasGateway) {
      tabs.push({ id: 'gateway', label: 'Gateway', icon: Globe });
    }
  } else {
    tabs.push({ id: 'opencode', label: 'CLI', icon: Bot });
    if (hasIde) {
      tabs.push({ id: 'ide', label: 'WebIDE', icon: Code2 });
    }
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
          <span className="text-xs">返回</span>
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
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <Wifi className="w-3 h-3" />
            <span>Connected</span>
          </div>
        </div>

        <button
          className="text-slate-400 hover:text-white transition-colors"
          title="Help"
          onClick={onHelp}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <button
          className="text-slate-400 hover:text-white transition-colors"
          title="Refresh"
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
              提交中...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              完成实验
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
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[#252526] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-[#333]"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">检测到已有实验环境</h3>
            <p className="text-sm text-slate-400">需要先关闭现有环境</p>
          </div>
        </div>
        
        <p className="text-slate-300 text-sm mb-6">
          您已有一个运行中的实验环境。是否关闭现有环境并创建新的实验环境？
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg text-sm font-medium transition-colors text-white"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 rounded-lg text-sm font-medium transition-colors text-white flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在关闭...
              </>
            ) : (
              '关闭并重新创建'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 错误页面组件 ---
interface ErrorPageProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
  onLogin?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, onRetry, onBack, onLogin }) => {
  // 检查是否是认证相关错误
  const isAuthError = error.includes('认证') || error.includes('登录') || error.includes('令牌') || error.includes('token');
  
  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{isAuthError ? '请先登录' : '启动失败'}</h1>
        <p className="text-slate-400 mb-6">{isAuthError ? '访问实验环境需要登录账号' : error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            返回
          </button>
          {isAuthError && onLogin ? (
            <button
              onClick={onLogin}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              去登录
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 主组件 ---
const LabPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 从 URL 参数获取来源类型和 ID
  const sourceTypeParam = searchParams.get('sourceType');
  const sourceIdParam = searchParams.get('sourceId');
  const lessonIdParam = searchParams.get('lessonId');  // 课时 ID（用于课程加载 Agent 手册）
  const unitIdParam = searchParams.get('unitId');      // 单元 ID（用于项目加载 Agent 手册）
  const unitNameParam = searchParams.get('unitName');  // 单元名称

  const sourceType = sourceTypeParam === 'project' ? LabSourceType.PROJECT : LabSourceType.COURSE;
  const sourceId = parseInt(sourceIdParam || '0');
  const lessonId = parseInt(lessonIdParam || '0');  // 课时 ID
  const unitId = parseInt(unitIdParam || '0');      // 单元 ID
  const isProjectLab = sourceType === LabSourceType.PROJECT;

  // 计算 AgentWidget 的 sourceType 和 sourceId
  // 课程：sourceType=1, sourceId=lessonId
  // 项目：sourceType=2, sourceId=unitId
  const agentSourceType = sourceType === LabSourceType.PROJECT ? 2 : 1;
  const agentSourceId = sourceType === LabSourceType.PROJECT ? unitId : (lessonId || sourceId);

  const [activeTab, setActiveTab] = useState<LabTab>('desktop');
  const [copiedGatewayToken, setCopiedGatewayToken] = useState(false);
  const [opencodeRefreshToken, setOpencodeRefreshToken] = useState(0);

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
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [timeoutHandled, setTimeoutHandled] = useState(false);

  // 完成实验相关状态
  const [completing, setCompleting] = useState(false);
  // 是否是新创建的会话（用于重置 Agent 进度）
  const [isNewSession, setIsNewSession] = useState(false);

  // 检查登录状态
  const isLoggedIn = !!localStorage.getItem('authToken');
  const isProjectOpenClawMode =
    isProjectLab &&
    (!!urls?.gatewayUrl || urls?.runtimeMode === 'openclaw' || session?.runtimeMode === 2);
  const openClawExecCommand = "printf '🦞 OpenClaw\\n'; openclaw tui";
  const gatewayFrameUrl = urls?.gatewayUrl
    ? (() => {
        const authToken = localStorage.getItem('authToken') || '';
        if (!authToken) return urls.gatewayUrl || '';
        const sep = urls.gatewayUrl.includes('?') ? '&' : '?';
        return `${urls.gatewayUrl}${sep}authToken=${encodeURIComponent(authToken)}`;
      })()
    : '';

  const maskToken = (token: string): string => {
    if (!token) return '';
    if (token.length <= 12) return token;
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  };

  const copyGatewayToken = async (token: string) => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopiedGatewayToken(true);
      setTimeout(() => setCopiedGatewayToken(false), 1200);
    } catch (error) {
      console.error('[LabPage] 复制 Gateway Token 失败:', error);
    }
  };

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
      setError('未提供认证令牌');
      setIsBooting(false);
      return;
    }

    const checkActiveSession = async () => {
      try {
        const response = await labApi.getActiveSession();
        
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
        console.log('[LabPage] No active session, will create new one');
      } catch (err) {
        console.error('检查活跃会话失败:', err);
        // 出错时也保持 isBooting 为 true，让 BootSequence 尝试创建新会话
      }
    };

    if (sourceId > 0) {
      checkActiveSession();
    } else {
      setError('缺少必要参数');
      setIsBooting(false);
    }
  }, [sourceId, sourceType, isLoggedIn]);

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
    if (!session || timeoutHandled || timeLeft > 0) return;

    let cancelled = false;
    setTimeoutHandled(true);

    const autoStopAndExit = async () => {
      if (session.status === LabSessionStatus.RUNNING) {
        try {
          await labApi.stopSession(session.id);
        } catch (err) {
          console.error('[LabPage] 自动结束实验失败:', err);
        }
      }

      if (cancelled) return;
      alert('实验时间已到，实验已自动结束。');
      exitLabPage();
    };

    autoStopAndExit();

    return () => {
      cancelled = true;
    };
  }, [session, timeoutHandled, timeLeft, exitLabPage]);

  // 完成实验
  const handleCompleteLesson = async () => {
    console.log('[LabPage] 完成实验被调用');
    console.log('[LabPage] lessonId:', lessonId, 'unitId:', unitId, 'sourceType:', sourceType);
    console.log('[LabPage] completing:', completing);
    
    // 对于课程，使用 lessonId；对于项目，使用 unitId
    const targetId = sourceType === LabSourceType.PROJECT ? unitId : lessonId;
    
      if (!targetId || targetId === 0) {
      // 项目单元暂时不需要调用完成 API，直接停止环境并返回
      if (sourceType === LabSourceType.PROJECT) {
        // 停止环境
        if (session) {
          await labApi.stopSession(session.id);
        }
        exitLabPage();
        return;
      }
      alert('课时ID无效，无法完成实验');
      console.error('[LabPage] 无效的lessonId:', lessonId);
      return;
    }
    
    if (completing) {
      console.log('[LabPage] 正在提交中，跳过重复请求');
      return;
    }

    // 检查登录状态
    const token = localStorage.getItem('authToken');
    console.log('[LabPage] 完成实验 - token存在:', !!token);
    
    if (!token) {
      alert('请先登录后再完成实验');
      return;
    }

    setCompleting(true);
    try {
      let success = false;
      
      // 项目单元暂时不调用完成 API
      if (sourceType === LabSourceType.PROJECT) {
        success = true;
        console.log('[LabPage] 项目单元完成');
      } else {
        // 课程课时调用完成 API
        console.log('[LabPage] 开始调用API - lessonId:', lessonId);
        const response = await courseApi.completeLesson(lessonId);
        console.log('[LabPage] 完成实验响应:', response);
        
        if (response.success && response.data) {
          success = true;
          console.log('[LabPage] 完成实验成功');
        } else {
          console.error('[LabPage] 完成实验失败:', response.error);
          alert(response.error || '完成实验失败');
        }
      }
      
      // 如果完成成功，停止环境并关闭页面
      if (success) {
        // 先停止环境
        if (session) {
          console.log('[LabPage] 停止实验环境...');
          await labApi.stopSession(session.id);
          console.log('[LabPage] 实验环境已停止');
        }
        exitLabPage();
      }
    } catch (err) {
      console.error('[LabPage] 完成实验异常:', err);
      alert('网络错误，请稍后重试');
    } finally {
      setCompleting(false);
      console.log('[LabPage] 完成实验流程结束');
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

  // 返回
  const handleBack = () => {
    if (completing) return;
    exitLabPage();
  };

  const handleHelp = useCallback(() => {
    alert('操作提示：\n1. 点击“完成实验”将提交并关闭当前实验。\n2. 顶部倒计时结束后会自动停止实验并退出。\n3. 需要刷新终端会话可使用右上角刷新按钮。');
  }, []);

  // 重试
  const handleRetry = () => {
    setError(null);
    setIsBooting(true);
    setRetryKey((k) => k + 1);
  };

  // 错误处理
  const handleError = (err: string) => {
    setError(err);
    setIsBooting(false);
  };

  // 会话冲突处理
  const handleConflict = () => {
    setIsBooting(false);
    setShowConflictModal(true);
  };

  // 关闭现有会话并重新创建
  const handleCloseAndRecreate = async () => {
    setConflictLoading(true);
    try {
      // 先获取当前活跃会话
      const activeResponse = await labApi.getActiveSession();
      if (activeResponse.success && activeResponse.data?.session) {
        // 停止现有会话
        const stopResponse = await labApi.stopSession(activeResponse.data.session.id);
        if (!stopResponse.success) {
          setError(stopResponse.error || '关闭现有环境失败');
          setShowConflictModal(false);
          setConflictLoading(false);
          return;
        }
      }
      
      // 关闭弹窗，重新启动创建流程
      setShowConflictModal(false);
      setConflictLoading(false);
      setIsBooting(true);
      setRetryKey((k) => k + 1);
    } catch (err: any) {
      setError(err?.message || '操作失败');
      setShowConflictModal(false);
      setConflictLoading(false);
    }
  };

  // 登录跳转
  const handleLogin = () => {
    // 保存当前 URL，登录后可以返回
    const currentUrl = window.location.pathname + window.location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  // 参数错误
  if (!sourceId || sourceId <= 0) {
    return (
      <ErrorPage
        error="缺少必要参数，请从课程或项目页面进入实验环境"
        onRetry={() => navigate(-1)}
        onBack={() => navigate(-1)}
      />
    );
  }

  // 启动错误
  if (error) {
    return <ErrorPage error={error} onRetry={handleRetry} onBack={handleBack} onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans relative">
      <AnimatePresence>
        {isBooting && (
          <BootSequence
            key={retryKey}
            onComplete={() => setIsBooting(false)}
            onError={handleError}
            onConflict={handleConflict}
            sourceType={sourceType}
            sourceId={sourceId}
            onSessionCreated={handleSessionCreated}
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

      {!isBooting && session && urls && (
        <>
          <LabHeader
            activeTab={activeTab}
            setActiveTab={handleSetActiveTab}
            timeLeft={timeLeft}
            onBack={handleBack}
            onHelp={handleHelp}
            isProjectMode={isProjectOpenClawMode}
            hasIde={!!urls.ideUrl}
            hasGateway={!!urls.gatewayUrl}
            onComplete={handleCompleteLesson}
            completing={completing}
          />

          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
            {/* Desktop Tab - 使用 CSS 控制显示隐藏，避免重新加载 */}
            <div
              className="absolute inset-0"
              style={{ display: activeTab === 'desktop' ? 'block' : 'none' }}
            >
              <IframeContent
                url={urls.vncUrl}
                title="Ubuntu Desktop"
                icon={Monitor}
                description="通过 noVNC 连接到 Ubuntu 桌面环境"
              />
            </div>
            
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

            {/* 项目模式: OpenClaw CLI (SSH 自动执行 openclaw) */}
            {isProjectOpenClawMode && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'openclaw' ? 'block' : 'none' }}
              >
                <Suspense fallback={
                  <div className="w-full h-full bg-[#0c0c0c] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                }>
                  <WebTerminal
                    sessionId={session.id}
                    sshPort={session.sshPort}
                    terminalId="openclaw"
                    mode="exec"
                    command={openClawExecCommand}
                    isActive={activeTab === 'openclaw'}
                  />
                </Suspense>
              </div>
            )}

            {/* 项目模式: Gateway 内置浏览器 */}
            {isProjectOpenClawMode && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'gateway' ? 'block' : 'none' }}
              >
                {gatewayFrameUrl ? (
                  <div className="w-full h-full relative">
                    <IframeContent
                      url={gatewayFrameUrl}
                      title="OpenClaw Gateway"
                      icon={Globe}
                      description="OpenClaw 控制台（首次访问需输入 Gateway Token）"
                    />
                    {urls.gatewayToken && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur border border-white/10 text-xs">
                        <span className="text-slate-300">Gateway Token:</span>
                        <code className="text-emerald-300">{maskToken(urls.gatewayToken)}</code>
                        <button
                          onClick={() => copyGatewayToken(urls.gatewayToken || '')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200"
                          title="复制完整 Token"
                        >
                          {copiedGatewayToken ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedGatewayToken ? '已复制' : '复制'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#1e1e1e] flex flex-col items-center justify-center gap-3 text-slate-300">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-sm">Gateway 地址尚未就绪，请稍后刷新重试。</p>
                  </div>
                )}
              </div>
            )}

            {/* 课程模式: OpenCode Tab (Docker exec opencode) */}
            {!isProjectOpenClawMode && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'opencode' ? 'block' : 'none' }}
              >
                {activeTab === 'opencode' && (
                  <div className="absolute top-3 right-3 z-20">
                    <button
                      onClick={handleRefreshOpencode}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/70 hover:bg-black/80 border border-white/10 text-slate-200 text-xs"
                      title="刷新 Opencode 会话（重新加载 Skills）"
                    >
                      <RefreshCw className="w-3 h-3" />
                      刷新 Opencode
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
            )}

            {/* 课程模式: WebIDE Tab */}
            {!isProjectOpenClawMode && urls.ideUrl && (
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'ide' ? 'block' : 'none' }}
              >
                <IframeContent
                  url={urls.ideUrl}
                  title="WebIDE"
                  icon={Code2}
                  description="在线代码编辑器"
                />
              </div>
            )}
          </div>

          <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] font-sans select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 cursor-pointer hover:bg-white/10 px-1 rounded">
                <Activity className="w-3 h-3" /> Container: {session.containerName}
              </span>
              <span className="flex items-center gap-1.5 cursor-pointer hover:bg-white/10 px-1 rounded">
                <Wifi className="w-3 h-3" /> noVNC:{session.vncPort} | SSH:{session.sshPort}
                {isProjectOpenClawMode && session.gatewayPort > 0 ? ` | Gateway:${session.gatewayPort}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hover:bg-white/10 px-1 rounded cursor-pointer">
                Image: {session.imageName}
              </span>
              <span className="hover:bg-white/10 px-1 rounded cursor-pointer">
                Status: {session.status === LabSessionStatus.RUNNING ? 'Running' : 'Unknown'}
              </span>
            </div>
          </div>

          {/* 教学智能体组件 */}
          <Suspense fallback={null}>
            <AgentWidget 
              sourceType={agentSourceType}
              sourceId={agentSourceId}
              containerId={session.containerId}
              resetProgress={isNewSession}
              onComplete={handleCompleteLesson}
              onExecuteCommand={async (command) => {
                const result = await labApi.executeCommand(command);
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
                  error: result.error || '执行失败',
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
