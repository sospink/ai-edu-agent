import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Briefcase, Bug, Check, CheckCircle2, Code2, Cpu, GitBranch, Layers, Megaphone, MessageSquare, Play, Send, ShieldCheck, Terminal } from 'lucide-react';
import WorkSceneFolder, { type WorkSceneFolderItem } from '@/components/ui/work-scene-folder';
import type { ExecutingView, ExecutingViewEvent, ThinkingViewMessage } from '@/services/openclawView';

const workSceneCards: WorkSceneFolderItem[] = [
  {
    icon: <Briefcase className="size-4 text-sky-100" />,
    title: '售前工程师工作台',
    subtitle: '方案设计 / 需求分析',
    description: '围绕客户需求梳理、技术路线设计、解决方案书与商务报价进行一体化输出。',
    directories: ['ABOUT ME', 'TEMPLATES', 'KNOWLEDGE BASE', 'CLAUDE OUTPUTS'],
    accentClassName: 'bg-sky-500',
  },
  {
    icon: <Megaphone className="size-4 text-emerald-100" />,
    title: '品牌营销工作台',
    subtitle: '品牌定位 / 传播策略',
    description: '聚焦品牌定位、市场洞察、传播策略和年度营销方案的结构化协同产出。',
    directories: ['ABOUT ME', 'KNOWLEDGE BASE', 'PROJECTS', 'CLAUDE OUTPUTS'],
    accentClassName: 'bg-emerald-500',
  },
  {
    icon: <Code2 className="size-4 text-amber-100" />,
    title: '项目开发工作台',
    subtitle: '源码开发 / 部署上线',
    description: '覆盖市场调研、需求分析、源码实现、构建产物、测试报告与部署方案全链路。',
    directories: ['01_市场调研', '04_源代码', '05_构建产物', '07_部署方案'],
    accentClassName: 'bg-amber-500',
  },
  {
    icon: <Bug className="size-4 text-violet-100" />,
    title: '软件质量工程师工作台',
    subtitle: '缺陷评估 / 回归验证',
    description: '聚焦代码缺陷评估、回归测试、修复方案验证与最终交付质量闭环。',
    directories: ['01_源码', '02_评估文档', '03_测试报告', '04_修复方案'],
    accentClassName: 'bg-violet-500',
  },
];

interface IdleProcessPanelProps {
  onStartScene?: (sceneIndex: number) => void;
}

export const IdleProcessPanel: React.FC<IdleProcessPanelProps> = ({ onStartScene }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const accentColors = ['sky', 'emerald', 'amber', 'violet'];
  const accent = accentColors[selectedIndex] || 'sky';

  return (
    <>
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 px-4">
          <div className="flex items-center border-b-2 border-primary-600 py-4 text-sm font-bold text-primary-600">
            <BarChart3 className="mr-2 h-4 w-4" />
            工作场景
          </div>
        </nav>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5">
        <div className="mx-auto w-full max-w-[460px]">
          <WorkSceneFolder items={workSceneCards} onIndexChange={setSelectedIndex} />
          
          {/* 开始工作按钮 */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => onStartScene?.(selectedIndex)}
              className={`group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] bg-${accent}-500 hover:bg-${accent}-600`}
              style={{
                background: `var(--tw-gradient-stops, ${
                  accent === 'sky' ? '#0ea5e9' :
                  accent === 'emerald' ? '#10b981' :
                  accent === 'amber' ? '#f59e0b' :
                  '#8b5cf6'
                })`,
              }}
            >
              <Play className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              开始 {workSceneCards[selectedIndex]?.title?.replace('工作台', '') || '工作'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

interface RunningProcessPanelProps {
  sessionState: 'running' | 'approval';
  executingView: ExecutingView | null;
  thinkingMessages?: ThinkingViewMessage[];
}

/** 管线图标配置 */
const PHASE_ICONS: Record<string, React.ReactNode> = {
  'phase-inbound': <MessageSquare className="h-5 w-5" />,
  'phase-dispatch': <GitBranch className="h-5 w-5" />,
  'phase-processing': <Cpu className="h-5 w-5" />,
  'phase-delivery': <Send className="h-5 w-5" />,
};
const PHASE_DESCS: Record<string, string> = {
  'phase-inbound': '正在解析自然语言指令...',
  'phase-dispatch': '智能编排任务逻辑中...',
  'phase-processing': '深度神经网络计算处理...',
  'phase-delivery': '安全下发执行结果...',
};

/** 从事件列表自动推导出 4 阶段任务管线 */
function derivePhases(events: ExecutingViewEvent[] | undefined, progress: number) {
  const hasKind = (kind: string) => events?.some((e) => e.kind === kind);

  const hasUserInput = hasKind('user_input');
  const hasToolCall = hasKind('tool_call');
  const hasToolResult = hasKind('tool_result');
  const hasAgentReply = hasKind('agent_reply');

  // 瀑布逻辑：后面的阶段完成了，前面的也应该标记完成
  // 例：Agent 直接回复（没有 tool_call），三四阶段完成 → 二阶段也完成
  const phase4Done = Boolean(hasAgentReply);
  const phase3Done = phase4Done || Boolean(hasToolResult);
  const phase2Done = phase3Done || Boolean(hasToolCall);
  const phase1Done = phase2Done || Boolean(hasUserInput);

  const phases = [
    { id: 'phase-inbound', title: '接收用户指令', done: phase1Done },
    { id: 'phase-dispatch', title: 'Agent 任务分派', done: phase2Done },
    { id: 'phase-processing', title: 'AI 分析与处理', done: phase3Done, running: Boolean(hasToolCall) && !hasAgentReply },
    { id: 'phase-delivery', title: '结果下发', done: phase4Done },
  ];

  let foundRunning = false;
  return phases.map((p) => {
    if (p.done) {
      return { ...p, status: 'completed' as const, statusLabel: '已完成' };
    }
    if ('running' in p && p.running) {
      foundRunning = true;
      return { ...p, status: 'running' as const, statusLabel: '处理中—' };
    }
    if (!foundRunning) {
      foundRunning = true;
      return { ...p, status: 'running' as const, statusLabel: '处理中' };
    }
    return { ...p, status: 'waiting' as const, statusLabel: '等待中' };
  });
}

export const RunningProcessPanel: React.FC<RunningProcessPanelProps> = ({
  sessionState,
  executingView,
  thinkingMessages,
}) => {
  const events = executingView?.events;
  const progress = executingView?.progress ?? 0;

  const phases = useMemo(() => derivePhases(events, progress), [events, progress]);

  const userInstruction = useMemo(() => {
    const inbound = events?.find((e) => e.kind === 'user_input');
    if (inbound?.desc) return inbound.desc;
    if (thinkingMessages?.length) return thinkingMessages[thinkingMessages.length - 1].content;
    return '等待接收用户指令…';
  }, [events, thinkingMessages]);

  const currentAction = executingView?.currentStep || '等待执行…';
  const hasError = events?.some((e) => e.level === 'error');
  const riskLevel = hasError ? '中' : '低';
  const riskColor = hasError ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700';
  const statusLabel = executingView?.status || (sessionState === 'running' ? '思考中' : '执行中');
  const activeSkillCount = executingView?.toolchain?.filter((s) => s.active).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:gap-4 md:p-4">

      {/* ====== 新版任务管线 ====== */}
      <div className="flex shrink-0 flex-col rounded-[1.5rem] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden">
        {/* 背景氛围扫描 */}
        <div className="ambient-scan" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 relative z-10">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">任务执行管线</h3>
          </div>
          <div className="px-2.5 py-1 bg-slate-50 rounded-full border border-slate-100 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">实时同步</span>
          </div>
        </div>

        {/* Pipeline nodes */}
        <div className="relative px-5 pb-5 space-y-6">
          {phases.map((phase, index) => {
            const isCompleted = phase.status === 'completed';
            const isProcessing = phase.status === 'running';
            const isPending = phase.status === 'waiting';

            return (
              <div key={phase.id} className="relative flex items-center gap-4 group">
                {/* 连线系统 */}
                {index < phases.length - 1 && (
                  <div className="absolute left-[19px] top-[40px] w-[2px] h-[24px]">
                    <div className="absolute inset-0 rounded-full bg-slate-100" />
                    {isCompleted && (
                      <div className="absolute inset-0 rounded-full bg-primary transition-all duration-700 origin-top" />
                    )}
                    {isProcessing && (
                      <svg className="absolute -left-[5px] top-0 w-3 h-full overflow-visible">
                        <line x1="5" y1="0" x2="5" y2="100%" stroke="#006fee" strokeWidth="2" strokeLinecap="round" className="animate-flow" />
                      </svg>
                    )}
                  </div>
                )}

                {/* 节点图标 */}
                <div className={`relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-500 node-completed'
                    : isProcessing
                      ? 'node-processing border-primary text-primary shadow-lg shadow-primary/10'
                      : 'border-slate-200 bg-slate-50 text-slate-300'
                }`}>
                  {isCompleted ? <Check className="h-5 w-5" /> : PHASE_ICONS[phase.id]}
                  {isProcessing && (
                    <div className="absolute -inset-1.5 rounded-[0.875rem] bg-primary/5 animate-pulse -z-10" />
                  )}
                </div>

                {/* 内容文本 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-[13px] font-bold transition-colors ${isPending ? 'text-slate-300' : 'text-slate-800'}`}>
                      {phase.title}
                    </h4>
                    <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter ${
                      isCompleted ? 'bg-emerald-50 text-emerald-500' :
                      isProcessing ? 'bg-primary/10 text-primary shadow-sm' :
                      'bg-slate-50 text-slate-300'
                    }`}>
                      {isProcessing && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />}
                      {phase.statusLabel}
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    <p className={`text-[11px] mt-0.5 font-medium transition-all duration-300 ${
                      isProcessing ? 'text-slate-500 opacity-100' : 'text-slate-400 opacity-0 h-0'
                    }`}>
                      {PHASE_DESCS[phase.id]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== Monitor v2 控制中心 ====== */}
      <div className="flex-1 min-h-0 rounded-2xl premium-border bg-white relative overflow-hidden flex flex-col select-none p-3 md:p-4">
        {/* 装饰性背景光晕 */}
        <div className="bg-glow w-48 h-48 -top-16 -right-16" />
        <div className="bg-glow w-32 h-32 -bottom-8 -left-8" style={{ background: 'radial-gradient(circle, #17c964 0%, transparent 70%)', animationDelay: '-2s' }} />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10 shrink-0 mb-2">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">OpenClaw 控制中心</h3>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[9px] font-bold text-slate-600">{hasError ? '连接异常' : '实时连接中'}</span>
          </div>
        </div>

        {/* 2x2 Stats Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-2 flex-1">
          {/* 1. 运行状态 */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 transition-all hover:border-primary/30 glass-panel flex flex-col">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">运行状态</span>
              <ShieldCheck className={`h-3 w-3 ${hasError ? 'text-amber-400' : 'text-emerald-500'}`} />
            </div>
            <div className="mt-auto">
              <div className="font-mono text-sm md:text-base font-bold tracking-tighter text-slate-800">{statusLabel}</div>
              <div className="mt-1 flex gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-[3px] flex-1 rounded-full opacity-40 ${hasError && i >= 4 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                ))}
              </div>
            </div>
          </div>

          {/* 2. 队列任务 — 蓝色强调 */}
          <div className="rounded-xl bg-primary p-2 text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] flex flex-col">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">队列任务</span>
              <Terminal className="h-3 w-3 text-white/80" />
            </div>
            <div className="mt-auto flex items-baseline gap-1">
              <div className="font-mono text-xl md:text-2xl font-black leading-none">{events?.length ?? 0}</div>
              <div className="text-[9px] font-bold text-white/60">单元</div>
            </div>
          </div>

          {/* 3. 执行进度 — 波形图标 */}
          <div className="group rounded-xl border border-slate-100 bg-white p-2 shadow-sm glass-panel flex flex-col">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">执行进度</span>
              <div className="flex items-end gap-0.5 h-2">
                <div className="wave-bar" style={{ animationDelay: '0.1s' }} />
                <div className="wave-bar" style={{ animationDelay: '0.3s' }} />
                <div className="wave-bar" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
            <div className="mt-auto">
              <div className="font-mono text-sm md:text-base font-bold tracking-tight text-slate-800">{progress}%</div>
              <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary/60 transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* 4. 活跃技能 — 圆点指示灯 */}
          <div className="rounded-xl border border-slate-100 bg-white p-2 shadow-sm glass-panel flex flex-col">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">活跃技能</span>
              <Layers className="h-3 w-3 text-amber-400" />
            </div>
            <div className="mt-auto">
              <div className="font-mono text-lg md:text-xl font-black leading-none text-slate-800">{activeSkillCount}</div>
              <div className="mt-1 flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-1 w-1 rounded-full ${i < activeSkillCount ? 'bg-amber-400' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
    <div className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">{children}</div>
  </div>
);

export const MetricLite: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="inline-flex items-center gap-2">
    <span>{label}</span>
    <span className="text-slate-500">{value}</span>
  </div>
);

export const MetricBlock: React.FC<{ label: string; value: string; progress?: string; progressPercent?: number }> = ({
  label,
  value,
  progress,
  progressPercent,
}) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="mt-1 flex items-center gap-2">
      <span className="text-base font-bold text-slate-900">{value}</span>
      {(progress || Number.isFinite(progressPercent)) && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
          <span
            className={`block h-full bg-primary-600 ${progress || ''}`}
            style={Number.isFinite(progressPercent) ? { width: `${Math.max(0, Math.min(100, progressPercent || 0))}%` } : undefined}
          />
        </span>
      )}
    </div>
  </div>
);
