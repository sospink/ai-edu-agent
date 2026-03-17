import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  X,
  FolderOpen,
  MessageSquare,
  Activity,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const STORAGE_KEY = 'openclaw-guide-dismissed';

interface GuideStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    icon: <FolderOpen className="h-4 w-4" />,
    title: '场景选择',
    description: '选择一个实训场景作为 OpenClaw 的工作目标，每个场景预设了不同的 AI 任务类型。',
    color: 'text-slate-600 bg-slate-100',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: '思考中',
    description: '向 OpenClaw 发送自然语言指令，支持提示词增强功能，AI 将解析你的意图并生成执行计划。',
    color: 'text-primary bg-primary/10',
  },
  {
    icon: <Activity className="h-4 w-4" />,
    title: '执行中',
    description: '实时查看 Agent 的执行日志与决策分析，监控任务管线、运行状态、队列任务、执行进度及活跃技能。',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: '完成态',
    description: '查看 OpenClaw 执行完成后返回的产物和链接，同时可回顾完整的流程执行进度。',
    color: 'text-emerald-600 bg-emerald-50',
  },
];

const OpenClawGuide: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // 首次进入自动弹出
    if (!dismissed) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleToggle = () => {
    setOpen((v) => !v);
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {/* 展开的向导面板 */}
      {open && (
        <div className="mb-1 w-[340px] animate-[pageEnter_0.25s_ease-out_both] rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl shadow-slate-900/10">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-slate-800">OpenClaw 实训向导</h4>
            </div>
            <button
              onClick={handleDismiss}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 步骤列表 */}
          <div className="space-y-1">
            {GUIDE_STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`w-full text-left rounded-xl p-3 transition-all ${
                  activeStep === i
                    ? 'bg-slate-50 shadow-sm'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* 步骤编号 / 图标 */}
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${step.color}`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{step.title}</span>
                      <span className="text-[10px] font-bold text-slate-300">{i + 1}/4</span>
                    </div>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-slate-300 transition-transform ${activeStep === i ? 'rotate-90' : ''}`} />
                </div>

                {/* 展开描述 */}
                {activeStep === i && (
                  <p className="mt-2 pl-[38px] text-[12px] leading-relaxed text-slate-500 animate-[pageEnter_0.2s_ease-out_both]">
                    {step.description}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* 底部 */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">按步骤完成实训</span>
            <button
              onClick={handleDismiss}
              className="text-[11px] font-bold text-primary transition hover:text-primary-600"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 悬浮触发按钮 */}
      <button
        onClick={handleToggle}
        className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 ${
          open
            ? 'bg-slate-800 text-white shadow-slate-800/20'
            : 'bg-primary text-white shadow-primary/30 animate-bounce'
        }`}
        title="使用向导"
      >
        {open ? <X className="h-4 w-4" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default OpenClawGuide;
