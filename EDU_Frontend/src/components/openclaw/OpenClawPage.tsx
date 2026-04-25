import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, ChevronUp, FolderOpen, Loader2 } from 'lucide-react';
import CompleteLessonDialog from '@/components/study/CompleteLessonDialog';
import { courseApi } from '@/services/course';
import AILogoGif from '@/images/AI logo Foriday.gif';
import { SESSION_META } from './constants';
import { MetricBlock, MetricLite, IdleProcessPanel, RunningProcessPanel } from './OpenClawPanels';
import {
  ApprovalObservabilityWorkspace,
  CompletedWorkspace,
  IdleDesktop,
  RunningDesktop,
} from './OpenClawViews';
import PromptEnginePanel from './PromptEnginePanel';
import OpenClawGuide from './OpenClawGuide';
import type { SessionState } from './types';
import {
  OpenClawSessionContext,
  useOpenClawSession,
  useOpenClawSessionProvider,
} from './useOpenClawSession';

/** 从 pathname 解析当前 Tab（纯 UI 路由，不影响 sessionPhase） */
function pathToTab(pathname: string): SessionState {
  if (pathname.endsWith('/thinking')) return 'running';
  if (pathname.endsWith('/executing')) return 'approval';
  if (pathname.endsWith('/completed')) return 'completed';
  return 'idle';
}

/** 从 sessionState 计算子路由路径 */
function stateToPath(state: SessionState): string {
  switch (state) {
    case 'running': return '/openclaw/thinking';
    case 'approval': return '/openclaw/executing';
    case 'completed': return '/openclaw/completed';
    default: return '/openclaw/idle';
  }
}

interface OpenClawPageProps {
  onLoginRequired?: () => void;
}

/** 外层 Provider 包裹 */
const OpenClawPage: React.FC<OpenClawPageProps> = ({ onLoginRequired }) => {
  const location = useLocation();
  const authToken = typeof window === 'undefined' ? '' : localStorage.getItem('authToken') || '';

  const activeSessionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('sessionId') || '';
  }, [location.search]);

  const activeScope = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('scope') === 'all' ? 'all' as const : 'latest_turn' as const;
  }, [location.search]);

  useEffect(() => {
    if (authToken || !onLoginRequired) return;
    onLoginRequired();
  }, [authToken, onLoginRequired]);

  if (!authToken) {
    const redirect = `${location.pathname}${location.search}`;
    if (!onLoginRequired) {
      return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md text-center">
          <div className="text-lg font-semibold">需要登录后进入 OpenClaw</div>
          <p className="mt-2 text-sm text-slate-400">请使用学生账号登录，登录后会回到当前 OpenClaw 页面。</p>
          <button
            type="button"
            onClick={onLoginRequired}
            className="mt-6 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700"
          >
            打开登录弹窗
          </button>
        </div>
      </div>
    );
  }

  if (!activeSessionId) {
    return <OpenClawProjectEntryGuide />;
  }

  return (
    <OpenClawSessionBridge
      key={`${activeSessionId}:${activeScope}`}
      activeSessionId={activeSessionId}
      activeScope={activeScope}
    />
  );
};

const OpenClawSessionBridge: React.FC<{ activeSessionId: string; activeScope: 'all' | 'latest_turn' }> = ({
  activeSessionId,
  activeScope,
}) => {
  const sessionValue = useOpenClawSessionProvider(activeSessionId, activeScope);

  return (
    <OpenClawSessionContext.Provider value={sessionValue}>
      <OpenClawPageInner />
    </OpenClawSessionContext.Provider>
  );
};

/** 内层页面组件 — 从 Context 读取所有状态 */
const OpenClawPageInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useOpenClawSession();
  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('returnTo') || '/projects';
  }, [location.search]);

  // 当前 Tab（纯 UI 路由）
  const currentTab = useMemo(() => pathToTab(location.pathname), [location.pathname]);

  // 自动跳转已移除 — 只有 handleStartScene 会 navigate 到 /openclaw/thinking
  // 用户需手动点击 Tab 切换到 执行中 / 完成态

  // 完成实验相关状态（UI 级别，不需要持久化）
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const experimentStartRef = useRef(Date.now());
  const [experimentDuration, setExperimentDuration] = useState('—');

  const isFullscreenFlowMode = currentTab === 'running' || currentTab === 'approval';

  const tokenCount = useMemo(() => {
    const total = (session.thinkingView?.messages || []).reduce((sum, message) => sum + message.content.length, 0);
    return total > 0 ? total.toLocaleString() : '—';
  }, [session.thinkingView]);
  const successRate = Math.max(1, Math.min(100, Math.round(session.executingView?.progress || 85)));

  /** Tab 切换：通过路由导航（不影响 sessionPhase） */
  const navigateToTab = (state: SessionState) => {
    navigate(`${stateToPath(state)}${location.search}`);
  };

  /** 工作场景"开始"按钮回调 */
  const handleStartScene = (sceneIndex: number) => {
    session.startScene(sceneIndex);
    navigate(`/openclaw/thinking${location.search}`);
  };

  /** 完成实验 */
  const handleCompleteExperiment = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      const params = new URLSearchParams(location.search);
      const lessonId = parseInt(params.get('lessonId') || '0', 10);
      if (lessonId > 0) {
        const response = await courseApi.completeLesson(lessonId);
        if (response.success && response.data) {
          setEarnedXP(response.data.earnedXP || 0);
        }
      } else {
        setEarnedXP(50);
      }
      const elapsed = Math.round((Date.now() - experimentStartRef.current) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setExperimentDuration(mins > 0 ? `${mins}分 ${secs}秒` : `${secs}秒`);
      setShowCompleteDialog(true);
    } catch (err) {
      console.error('[OpenClaw] 完成实验失败:', err);
      setEarnedXP(0);
      const elapsed = Math.round((Date.now() - experimentStartRef.current) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setExperimentDuration(mins > 0 ? `${mins}分 ${secs}秒` : `${secs}秒`);
      setShowCompleteDialog(true);
    } finally {
      setCompleting(false);
    }
  };

  /** 完成弹窗关闭后：重置会话 + 返回项目列表 */
  const handleCompleteDialogClose = useCallback(() => {
    setShowCompleteDialog(false);
    session.resetSession();
    navigate(returnTo, { replace: true });
  }, [navigate, returnTo, session]);

  /** Tab 按钮组件 */
  const TabButton: React.FC<{ state: SessionState; label: string }> = ({ state, label }) => (
    <button
      type="button"
      onClick={() => navigateToTab(state)}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
        currentTab === state ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`w-full bg-slate-100 ${isFullscreenFlowMode ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <div className={`flex w-full flex-col bg-white ${isFullscreenFlowMode ? 'h-full overflow-hidden' : 'min-h-screen'}`}>
        {/* Header */}
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 md:px-6 md:py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              title="返回"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <img src={AILogoGif} alt="Agent EDU" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">OpenClaw 工作台</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab 切换 */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <TabButton state="idle" label="场景选择" />
              <TabButton state="running" label="思考中" />
              <TabButton state="approval" label="执行中" />
              <TabButton state="completed" label="完成态" />
            </div>

            {/* 完成实验 */}
            <button
              type="button"
              onClick={handleCompleteExperiment}
              disabled={completing}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-emerald-400 active:scale-[0.97]"
            >
              {completing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>提交中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>完成实验</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* 内容区域 - 使用子路由 + 页面过渡动画 */}
        <Routes>
          <Route index element={<Navigate to={`/openclaw/idle${location.search}`} replace />} />
          
          {/* 待机 */}
          <Route path="idle" element={
            <PageTransition viewKey="idle">
              <main className="flex flex-1 min-h-0 flex-col overflow-hidden xl:flex-row">
                <section className="relative flex flex-1 min-h-0 flex-col border-b border-slate-200 bg-slate-200 xl:border-b-0 xl:border-r">
                  <IdleDesktop />
                </section>
                <aside className="flex w-full min-h-0 flex-col bg-white xl:w-[32%]">
                  <IdleProcessPanel onStartScene={handleStartScene} />
                </aside>
              </main>

              <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6 md:py-3">
                <div className="flex items-center gap-6 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <MetricLite label="CPU 占用" value="0%" />
                  <MetricLite label="内存" value="0%" />
                  <MetricLite label="网络" value="0 KB/s" />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary-600"
                >
                  查看详情
                  <ChevronUp className="h-4 w-4" />
                </button>
              </footer>
            </PageTransition>
          } />

          {/* 思考中 */}
          <Route path="thinking" element={
            <PageTransition viewKey="thinking">
              <main className="flex flex-1 min-h-0 flex-col overflow-hidden xl:flex-row">
                <section className="relative flex flex-1 min-h-0 flex-col border-b border-slate-200 bg-slate-200 xl:border-b-0 xl:border-r">
                  <RunningDesktop
                    messages={session.thinkingView?.messages}
                    isLoading={session.thinkingLoading}
                    error={session.thinkingError}
                    initialPrompt={session.pendingPrompt}
                    localUserMessages={session.localUserMessages}
                    setLocalUserMessages={session.setLocalUserMessages}
                    isWaitingReply={session.isWaitingReply}
                    setIsWaitingReply={session.setIsWaitingReply}
                    onSendMessage={async (text) => {
                      session.setHasSentMessage(true);
                      await session.sendMessage(text);
                    }}
                  />
                </section>
                <aside className="flex w-full min-h-0 flex-col bg-white xl:w-[32%]">
                  <PromptEnginePanel />
                </aside>
              </main>

              <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6 md:py-3">
                <div className="flex items-center gap-6 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <MetricLite label="已处理令牌" value={tokenCount} />
                  <MetricLite label="当前耗时" value={(() => {
                    const msgs = session.thinkingView?.messages || [];
                    if (msgs.length === 0) return '—';
                    const firstTs = msgs[0]?.ts || 0;
                    if (firstTs <= 0) return '—';
                    const elapsed = Math.round((Date.now() - firstTs) / 1000);
                    if (elapsed <= 0) return '—';
                    const m = Math.floor(elapsed / 60);
                    const s = elapsed % 60;
                    return `${m}分 ${String(s).padStart(2, '0')}秒`;
                  })()} />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary-600"
                >
                  查看详情
                  <ChevronUp className="h-4 w-4" />
                </button>
              </footer>
            </PageTransition>
          } />

          {/* 执行中 */}
          <Route path="executing" element={
            <PageTransition viewKey="executing">
              <main className="flex flex-1 min-h-0 flex-col overflow-hidden xl:flex-row">
                <section className="relative flex flex-1 min-h-0 flex-col border-b border-slate-200 bg-slate-200 xl:border-b-0 xl:border-r">
                  <ApprovalObservabilityWorkspace
                    events={session.executingView?.events}
                    toolchain={session.executingView?.toolchain}
                    status={session.executingView?.status}
                    progress={session.executingView?.progress}
                    currentStep={session.executingView?.currentStep}
                    isLoading={session.executingLoading}
                    error={session.executingError}
                  />
                </section>
                <aside className="flex w-full min-h-0 flex-col bg-white xl:w-[32%]">
                  <RunningProcessPanel
                    sessionState="approval"
                    executingView={session.executingView}
                    thinkingMessages={session.thinkingView?.messages}
                  />
                </aside>
              </main>

              <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6 md:py-3">
                <div className="flex items-center gap-6 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <MetricLite label="成功率" value={`${successRate}%`} />
                  <MetricLite label="事件" value={`${session.executingView?.events?.length || 0} 条`} />
                  <MetricLite label="已处理令牌" value={tokenCount} />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary-600"
                >
                  查看详情
                  <ChevronUp className="h-4 w-4" />
                </button>
              </footer>
            </PageTransition>
          } />

          {/* 完成态 */}
          <Route path="completed" element={
            <PageTransition viewKey="completed">
              <CompletedWorkspace data={session.completedView} isLoading={session.completedLoading} error={session.completedError} />
              <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6 md:py-3">
                <div className="flex items-center gap-6 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <MetricLite label="CPU 占用" value="0%" />
                  <MetricLite label="内存" value="0%" />
                  <MetricLite label="网络" value="0 KB/s" />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary-600"
                >
                  查看详情
                  <ChevronUp className="h-4 w-4" />
                </button>
              </footer>
            </PageTransition>
          } />

          {/* 其他路径重定向到 idle */}
          <Route path="*" element={<Navigate to={`/openclaw/idle${location.search}`} replace />} />
        </Routes>
      </div>

      {/* 向导 */}
      <OpenClawGuide />

      {/* 完成实验 Dialog */}
      <CompleteLessonDialog
        isOpen={showCompleteDialog}
        onClose={handleCompleteDialogClose}
        lessonName="OpenClaw 工作台"
        earnedXP={earnedXP}
        actionText="返回项目"
        duration={experimentDuration}
      />
    </div>
  );
};

/** 页面过渡动画包裹组件 */
const PageTransition: React.FC<{ viewKey: string; children: React.ReactNode }> = ({ viewKey, children }) => (
  <div
    key={viewKey}
    className="flex flex-1 min-h-0 flex-col overflow-hidden animate-[pageEnter_0.35s_ease-out_both]"
  >
    {children}
  </div>
);

const OpenClawProjectEntryGuide: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <FolderOpen className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">选择 OpenClaw 项目进入</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          OpenClaw 是项目实战中的独立场景演示，需要从带有 OpenClaw 标签的项目进入，才能为当前项目建立专属观察会话。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
          >
            前往项目实战
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenClawPage;
