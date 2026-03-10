import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronUp,
  Circle,
  Cpu,
  Database,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Table2,
  Terminal,
} from 'lucide-react';
import AILogoGif from '@/images/AI logo Foriday.gif';

type SessionState = 'idle' | 'running' | 'approval' | 'completed';
type ViewTab = 'process' | 'history';

const SESSION_META: Record<SessionState, { label: string; tone: string; dot: string }> = {
  idle: {
    label: '待机状态',
    tone: 'text-slate-500',
    dot: 'bg-slate-300',
  },
  running: {
    label: '运行中',
    tone: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  approval: {
    label: '待审批',
    tone: 'text-amber-600',
    dot: 'bg-amber-500',
  },
  completed: {
    label: '已完成',
    tone: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
};

const COMPLETED_STEPS = [
  ['步骤 1: 系统初始化', '核心模块已成功加载'],
  ['步骤 2: 需求分析', '用户意图已映射至工作流'],
  ['步骤 3: 源数据提取', '已连接至 4 个外部端点'],
  ['步骤 4: 启发式处理', '模式识别已完成'],
  ['步骤 5: 语义校验', '数据一致性已验证'],
  ['步骤 6: 内容优化', '冗余已清除 (减少 12%)'],
  ['步骤 7: 数据结构化', 'JSON 输出格式已生成'],
  ['步骤 8: 自动化审核', '通过所有合规性检查'],
  ['步骤 9: 最终报告汇编', '正在渲染可视化组件'],
  ['步骤 10: 导出与完成', '输出已保存至工作区'],
] as const;

const OpenClawPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [viewTab, setViewTab] = useState<ViewTab>('process');

  const stepCards = useMemo(
    () => [
      {
        id: 'step-1',
        title: '识别周报目标与人员范围',
        status: 'completed' as const,
        statusLabel: '已完成',
      },
      {
        id: 'step-2',
        title: '收集飞书群内周报数据',
        status: sessionState === 'running' ? ('running' as const) : ('waiting' as const),
        statusLabel: sessionState === 'running' ? '处理中...' : '待处理',
      },
      {
        id: 'step-3',
        title: '生成周报草稿并回传负责人',
        status: 'waiting' as const,
        statusLabel: '待处理',
      },
    ],
    [sessionState],
  );

  const isOnlineState = sessionState !== 'idle';
  const isFullscreenFlowMode = sessionState === 'running' || sessionState === 'approval';

  const handleStart = () => setSessionState('running');
  const handlePause = () => setSessionState('idle');
  const handleStop = () => setSessionState('idle');
  const handleBackToProject = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/projects');
  };

  return (
    <div className={`w-full bg-slate-100 ${isFullscreenFlowMode ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <div className={`w-full bg-white ${isFullscreenFlowMode ? 'h-full flex flex-col overflow-hidden' : 'min-h-screen'}`}>
        <header className={`shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 md:px-6 md:py-3`}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBackToProject}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4" />
              返回项目详情
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <img src={AILogoGif} alt="Agent EDU" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">OpenClaw 实训案例</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">RID-2026-001</span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${SESSION_META[sessionState].tone}`}>
                  <span className={`h-2 w-2 rounded-full ${SESSION_META[sessionState].dot} ${sessionState !== 'idle' ? 'animate-pulse' : ''}`} />
                  {SESSION_META[sessionState].label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2 border-r border-slate-200 pr-3 lg:flex">
              <StatusChip icon={<Monitor className="h-3.5 w-3.5" />} label="Mac 主机" online={isOnlineState} />
              <StatusChip icon={<Terminal className="h-3.5 w-3.5" />} label="OpenClaw" online={isOnlineState} />
              <StatusChip icon={<MessageCircle className="h-3.5 w-3.5" />} label="飞书" online={isOnlineState} />
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSessionState('idle')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sessionState === 'idle' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                待机
              </button>
              <button
                type="button"
                onClick={() => setSessionState('running')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sessionState === 'running' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                运行中
              </button>
              <button
                type="button"
                onClick={() => setSessionState('approval')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sessionState === 'approval' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                待审批
              </button>
              <button
                type="button"
                onClick={() => setSessionState('completed')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sessionState === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                完成态
              </button>
            </div>

            {sessionState === 'completed' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionState('idle')}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  新建任务
                </button>
                <button
                  type="button"
                  onClick={() => setSessionState('completed')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSessionState('completed')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                >
                  <History className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  <Play className="h-4 w-4" />
                  开始
                </button>
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={sessionState !== 'running'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pause className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-rose-600"
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {sessionState === 'completed' ? (
          <CompletedWorkspace />
        ) : (
          <>
            <main className="flex flex-1 min-h-0 flex-col overflow-hidden xl:flex-row">
              <section className="relative flex flex-1 min-h-0 flex-col border-b border-slate-200 bg-slate-200 xl:border-b-0 xl:border-r">
                {sessionState === 'idle' && <IdleDesktop />}
                {sessionState === 'running' && <RunningDesktop />}
                {sessionState === 'approval' && <ApprovalObservabilityWorkspace />}
              </section>

              <aside className="flex w-full min-h-0 flex-col bg-white xl:w-[38%]">
                {sessionState === 'idle' ? (
                  <IdleProcessPanel viewTab={viewTab} onChangeTab={setViewTab} />
                ) : (
                  <RunningProcessPanel stepCards={stepCards} isWaitingApproval={sessionState === 'approval'} />
                )}
              </aside>
            </main>

            <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6 md:py-3">
              {sessionState === 'idle' ? (
                <div className="flex items-center gap-6 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <MetricLite label="CPU 占用" value="0%" />
                  <MetricLite label="内存" value="0%" />
                  <MetricLite label="网络" value="0 KB/s" />
                </div>
              ) : (
                <div className="flex items-center gap-4 overflow-x-auto md:gap-6">
                  <MetricBlock label="成功率" value="85%" progress="w-[85%]" />
                  <MetricBlock label="当前耗时" value="5分 12秒" />
                  <MetricBlock label="已处理令牌" value="12,402" />
                </div>
              )}

              <button type="button" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary-600">
                查看详情
                <ChevronUp className="h-4 w-4" />
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

const CompletedWorkspace: React.FC = () => {
  return (
    <div className="flex min-h-[780px] flex-col bg-slate-50">
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold">
                状态：<span className="text-emerald-600">已完成</span>
              </h2>
              <p className="text-sm text-slate-500">所有自动化序列已成功执行</p>
            </div>
          </div>
          <div className="hidden gap-4 md:flex">
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-slate-400">处理时间</p>
              <p className="font-mono">00:12:45</p>
            </div>
            <div className="border-l border-slate-200 pl-4 text-right">
              <p className="text-xs font-bold uppercase text-slate-400">成功率</p>
              <p className="font-mono text-emerald-600">100%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <div className="min-h-[500px] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
                <span className="text-xs font-bold text-slate-500">最终报告（MORPH C）</span>
              </div>

              <div className="p-6">
                <div className="relative mb-6 flex aspect-[4/3] items-center justify-center rounded border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-primary-50">
                  <div className="rounded-lg border border-primary-200 bg-white/90 p-3 shadow-xl">
                    <FileText className="h-10 w-10 text-primary-600" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="h-2 w-3/4 rounded bg-slate-200" />
                  <div className="h-2 w-full rounded bg-slate-200" />
                  <div className="h-2 w-5/6 rounded bg-slate-200" />
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-bold text-slate-400">指标摘要</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded bg-primary-50 p-2">
                        <p className="text-[10px] text-primary-500">效率提升</p>
                        <p className="text-lg font-bold text-primary-700">+42%</p>
                      </div>
                      <div className="rounded bg-primary-50 p-2">
                        <p className="text-[10px] text-primary-500">准确率</p>
                        <p className="text-lg font-bold text-primary-700">99.8%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="h-full rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <BarChart3 className="h-5 w-5 text-primary-600" />
                  流程执行进度
                </h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">所有步骤均已成功</span>
              </div>

              <div className="grid grid-cols-1 gap-x-12 gap-y-4 md:grid-cols-2">
                {COMPLETED_STEPS.map(([title, desc], index) => (
                  <div key={title} className="relative flex items-start gap-4 py-1.5">
                    {index !== COMPLETED_STEPS.length - 1 && (
                      <div className="absolute left-[11px] top-6 hidden h-[calc(100%-4px)] w-[2px] bg-slate-200 md:block" />
                    )}
                    <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            执行成果总结
          </h3>

          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase text-slate-400">产物链接</p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#"
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-primary-400"
              >
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold group-hover:text-primary-700">周报汇总.xlsx</p>
                  <p className="text-[10px] text-slate-500">2.4 MB · Excel 表格</p>
                </div>
              </a>
              <a
                href="#"
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-primary-400"
              >
                <FileText className="h-5 w-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold group-hover:text-primary-700">执行摘要.pdf</p>
                  <p className="text-[10px] text-slate-500">1.1 MB · PDF 文档</p>
                </div>
              </a>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="处理时间" value="1.2m" delta="▼ 85%" />
            <KpiCard label="人工干预" value="0" delta="▼ 100%" />
            <KpiCard label="成本效益" value="$0.04" delta="▼ 98.2%" />
            <KpiCard label="数据质量" value="A+" delta="▲ 已验证" />
          </div>

          <div className="flex justify-center pt-4">
            <button
              type="button"
              className="flex h-14 min-w-[240px] items-center justify-center gap-3 rounded-xl bg-primary-600 text-lg font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.35)] transition hover:scale-[1.02] hover:bg-primary-700 active:scale-95"
            >
              <Send className="h-5 w-5" />
              提交结果至系统
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 p-8 text-center text-sm text-slate-400">
        OpenClaw 实训环境 © 2024。所有自动化序列已受安全保护。
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

const StatusChip: React.FC<{ icon: React.ReactNode; label: string; online: boolean }> = ({ icon, label, online }) => {
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

const IdleDesktop: React.FC = () => (
  <>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.22),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(165,243,252,0.20),transparent_40%)]" />
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/30 bg-white/20 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 text-white">
          <Monitor className="h-4 w-4" />
          <span className="text-xs font-medium">远程桌面（未连接）</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border border-white/20 bg-black/20 p-8 text-center text-white backdrop-blur-xl">
          <Monitor className="mx-auto mb-4 h-14 w-14 text-white/40" />
          <h3 className="mb-2 text-lg font-semibold">桌面流已暂停</h3>
          <p className="text-sm text-white/70">点击顶部“开始”按钮后，将连接常驻 Mac 并进入 OpenClaw 会话执行。</p>
        </div>
      </div>
    </div>
  </>
);

type RunningChatMessage = {
  id: number;
  role: 'agent' | 'user';
  text: string;
  time: string;
};

const RUNNING_CHAT_SCRIPT: RunningChatMessage[] = [
  { id: 1, role: 'agent', text: '已连接飞书工作台，检测到 15 条待处理财务对账消息。', time: '10:01' },
  { id: 2, role: 'user', text: '按财务模板处理，先标记异常再汇总。', time: '10:01' },
  { id: 3, role: 'agent', text: '收到。正在读取表格连接器数据并匹配汇率接口。', time: '10:02' },
  { id: 4, role: 'agent', text: '发现 3 条异常记录：金额偏差 > 5%，已加入风险标注。', time: '10:02' },
  { id: 5, role: 'user', text: '把异常清单单独发给我，并同步周报草稿。', time: '10:03' },
];

const RunningDesktop: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(1);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(1);
    const timer = window.setInterval(() => {
      setVisibleCount((prev) => (prev >= RUNNING_CHAT_SCRIPT.length ? prev : prev + 1));
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [visibleCount]);

  const visibleMessages = RUNNING_CHAT_SCRIPT.slice(0, visibleCount);
  const isTyping = visibleCount < RUNNING_CHAT_SCRIPT.length;

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="inline-flex min-w-[320px] items-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
            <Lock className="mr-2 h-3.5 w-3.5" />
            feishu.cn/messenger/
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400">远程桌面会话</span>
      </div>

      <div className="flex flex-1 items-center justify-center p-3 md:p-4">
        <div className="flex h-full w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-inner">
          <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">项目财务对账群</div>
                <div className="text-[11px] text-slate-400">OpenClaw 实时会话 · 模拟对话流</div>
              </div>
            </div>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">运行中</span>
          </div>

          <div ref={chatContainerRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[74%] rounded-xl p-3 shadow-sm ${
                  msg.role === 'agent'
                    ? 'self-start rounded-tl-none bg-white text-slate-700'
                    : 'self-end rounded-tr-none bg-primary-100 text-slate-800'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">{msg.time}</p>
              </div>
            ))}

            {isTyping && (
              <div className="self-start rounded-xl rounded-tl-none bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
              输入消息（演示模式，仅展示 OpenClaw 自动对话）
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Send className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const APPROVAL_LOGS = [
  {
    title: '感知：收到 15 条飞书消息',
    desc: '系统已识别待处理的财务对账请求，来源渠道：飞书工作台。',
    time: '10:01:23',
    icon: MessageCircle,
    active: false,
  },
  {
    title: '规划：拟定对账逻辑',
    desc: '生成处理链路：读取表格数据 -> 调取汇率接口 -> 匹配凭证 -> 生成报告。',
    time: '10:01:45',
    icon: Cpu,
    active: false,
  },
  {
    title: '执行：正在读取表格数据...',
    desc: '正在执行步骤 3/5，系统持续同步中。',
    time: '10:02:10',
    icon: Database,
    active: true,
  },
] as const;

const ApprovalObservabilityWorkspace: React.FC = () => (
  <div className="flex h-full min-h-0 bg-slate-100 p-2 md:p-3">
    <div className="flex h-full w-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <section className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3 md:p-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">运行日志</h1>
            <span className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500">实时同步</span>
          </div>

          <div className="relative space-y-8 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-slate-200 before:content-['']">
            {APPROVAL_LOGS.map((item) => (
              <div key={item.title} className="relative">
                <div
                  className={`absolute -left-8 top-1.5 flex size-6 items-center justify-center rounded-full border-4 border-slate-50 ${
                    item.active ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <item.icon className={`h-3.5 w-3.5 ${item.active ? 'animate-pulse' : ''}`} />
                </div>

                <div className={`rounded-xl border p-4 shadow-sm ${item.active ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <h4 className={`text-sm font-semibold ${item.active ? 'text-primary-700' : 'text-slate-900'}`}>{item.title}</h4>
                    <span className={`text-[10px] font-mono ${item.active ? 'text-primary-500' : 'text-slate-400'}`}>{item.time}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{item.desc}</p>
                  {item.active && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white">
                        <Table2 className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary-100">
                        <div className="h-full w-[60%] bg-primary-600" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3 md:w-80 md:p-4">
        <div className="space-y-6">
          <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-slate-400">实时决策分析</h3>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-bold text-slate-900">决策卡片 #402</span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">目标</label>
              <p className="text-sm font-medium text-slate-800">获取最新汇率 (USD/CNY)</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">动作</label>
              <p className="inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                调用内部系统
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">依据</label>
              <p className="text-sm font-medium text-slate-800">任务规划步骤 2</p>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">风险等级</label>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">低</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">工具链状态</h3>
            <ToolItem icon={<Cpu className="h-4 w-4 text-slate-400" />} name="汇率接口" active />
            <ToolItem icon={<Table2 className="h-4 w-4 text-slate-400" />} name="表格连接器" active pulse />
            <ToolItem icon={<Mail className="h-4 w-4 text-slate-400" />} name="邮件分发器" active={false} />
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const ToolItem: React.FC<{ icon: React.ReactNode; name: string; active: boolean; pulse?: boolean }> = ({ icon, name, active, pulse }) => (
  <div
    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
      active ? 'border-slate-200 hover:border-primary-300' : 'border-slate-200 opacity-50 grayscale'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-xs font-medium text-slate-700">{name}</span>
    </div>
    <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'} ${pulse ? 'animate-pulse' : ''}`} />
  </div>
);

const IdleProcessPanel: React.FC<{ viewTab: ViewTab; onChangeTab: (tab: ViewTab) => void }> = ({ viewTab, onChangeTab }) => (
  <>
    <div className="border-b border-slate-200">
      <nav className="flex gap-6 px-4">
        <button
          type="button"
          onClick={() => onChangeTab('process')}
          className={`flex items-center py-4 text-sm font-bold ${viewTab === 'process' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          流程列表
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('history')}
          className={`flex items-center py-4 text-sm font-bold ${viewTab === 'history' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History className="mr-2 h-4 w-4" />
          执行历史
        </button>
      </nav>
    </div>

    <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary-50">
        <Rocket className="h-11 w-11 text-primary-300" />
      </div>
      <h2 className="mb-4 text-2xl font-bold text-slate-900">准备开始了吗？</h2>
      <div className="max-w-md space-y-4">
        <p className="leading-relaxed text-slate-500">
          系统初始检查已完成。<span className="font-semibold text-primary-600">OpenClaw RID-2026-001</span> 的所有依赖项均已就绪。
        </p>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-left">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">启动检查清单</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3 text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div>
                <p className="font-medium">环境镜像已加载</p>
                <p className="text-xs text-slate-400">v2.4.0-stable</p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div>
                <p className="font-medium">连接网关已就绪</p>
                <p className="text-xs text-slate-400">延迟：12ms</p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-slate-400">
              <Circle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">会话初始化</p>
                <p className="text-xs">等待手动触发</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </>
);

interface RunningProcessPanelProps {
  stepCards: Array<{
    id: string;
    title: string;
    status: 'completed' | 'running' | 'waiting';
    statusLabel: string;
  }>;
  isWaitingApproval: boolean;
}

const RunningProcessPanel: React.FC<RunningProcessPanelProps> = ({ stepCards, isWaitingApproval }) => (
  <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:gap-4 md:p-4">
    {isWaitingApproval && (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        当前会话已进入审批等待，请在左侧弹窗处理高风险动作。
      </div>
    )}

    <div className="flex h-[44%] min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="h-4 w-4 text-primary-600" />
          双轨任务列表
        </h3>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">自动同步</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {stepCards.map((card) => (
          <div
            key={card.id}
            className={`rounded-r-lg border-l-4 p-3 ${
              card.status === 'completed'
                ? 'border-slate-300 bg-slate-50'
                : card.status === 'running'
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-slate-200 bg-slate-50/60 opacity-60'
            }`}
          >
            <p className={`text-xs font-bold ${card.status === 'running' ? 'text-primary-700' : 'text-slate-700'}`}>{card.title}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-[10px] font-medium ${card.status === 'completed' ? 'text-emerald-600' : card.status === 'running' ? 'text-primary-600' : 'text-slate-400'}`}>
                {card.statusLabel}
              </span>
              {card.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {card.status === 'running' && <Cpu className="h-3.5 w-3.5 animate-pulse text-primary-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Terminal className="h-4 w-4 text-primary-600" />
          执行详情
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4">
        <DetailField label="任务目标">收集团队负责人周报数据并汇总成草稿</DetailField>
        <div className="grid grid-cols-2 gap-3">
          <DetailField label="状态">
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              运行中
            </span>
          </DetailField>
          <DetailField label="风险等级">
            <span className="inline-flex items-center gap-1.5 rounded bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">低</span>
          </DetailField>
        </div>
        <DetailField label="当前动作">正在打开飞书群组：“项目周报协同群”</DetailField>
        <DetailField label="执行依据">
          公司标准流程第 12 条：“所有周报数据需在截止前 24 小时完成收集并校验。”
        </DetailField>
        <DetailField label="产出物">
          <span className="inline-flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            draft_weekly_report_data.json
          </span>
        </DetailField>
      </div>
    </div>
  </div>
);

const DetailField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
    <div className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">{children}</div>
  </div>
);

const MetricLite: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="inline-flex items-center gap-2">
    <span>{label}</span>
    <span className="text-slate-500">{value}</span>
  </div>
);

const MetricBlock: React.FC<{ label: string; value: string; progress?: string }> = ({ label, value, progress }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="mt-1 flex items-center gap-2">
      <span className="text-base font-bold text-slate-900">{value}</span>
      {progress && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
          <span className={`block h-full bg-primary-600 ${progress}`} />
        </span>
      )}
    </div>
  </div>
);

export default OpenClawPage;
