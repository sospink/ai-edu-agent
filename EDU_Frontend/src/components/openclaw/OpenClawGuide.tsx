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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

const STORAGE_KEY = 'openclaw-guide-dismissed';

interface GuideStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const createGuideSteps = (t: TFunction<'openclaw'>): GuideStep[] => [
  {
    icon: <FolderOpen className="h-4 w-4" />,
    title: t('guide.sceneTitle'), description: t('guide.sceneDesc'),
    color: 'text-slate-600 bg-slate-100',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: t('guide.thinkingTitle'), description: t('guide.thinkingDesc'),
    color: 'text-primary bg-primary/10',
  },
  {
    icon: <Activity className="h-4 w-4" />,
    title: t('guide.executingTitle'), description: t('guide.executingDesc'),
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: t('guide.completedTitle'), description: t('guide.completedDesc'),
    color: 'text-emerald-600 bg-emerald-50',
  },
];

const OpenClawGuide: React.FC = () => {
  const { t } = useTranslation('openclaw');
  const guideSteps = createGuideSteps(t);
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
              <h4 className="text-sm font-bold text-slate-800">{t('guide.title')}</h4>
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
            {guideSteps.map((step, i) => (
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
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{t('guide.footer')}</span>
            <button
              onClick={handleDismiss}
              className="text-[11px] font-bold text-primary transition hover:text-primary-600"
            >
              {t('guide.understood')}
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
        title={t('guide.trigger')}
      >
        {open ? <X className="h-4 w-4" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default OpenClawGuide;
