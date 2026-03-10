import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Map,
  Sparkles,
  GraduationCap,
  Rocket,
  BookOpen,
  FolderKanban,
  Bot,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';

type GuideTab = 'start' | 'map' | 'core' | 'highlights';

const GUIDE_SEEN_KEY = 'guide_seen_v1';
const GUIDE_COMPLETED_KEY = 'guide_completed_v1';

interface TourStep {
  title: string;
  description: string;
  route: string;
  actionLabel: string;
}

const tourSteps: TourStep[] = [
  {
    title: '进入学习路径',
    description: '先进入学习中心，查看课程与技能列表，选择你的第一门课开始学习。',
    route: '/study',
    actionLabel: '带我去学习中心',
  },
  {
    title: '打开课时并开始实训',
    description: '在课程中进入具体课时，阅读资料并结合 AI 智能体教师完成练习。',
    route: '/study',
    actionLabel: '继续浏览课时',
  },
  {
    title: '进入项目实战',
    description: '完成基础课后转到项目模块，用真实任务巩固技能与工程能力。',
    route: '/projects',
    actionLabel: '带我去项目实战',
  },
  {
    title: '持续迭代学习',
    description: '结合 AI 助手、课程资料和实操反馈，形成“学-练-评”闭环。',
    route: '/study',
    actionLabel: '回到学习闭环',
  },
];

const GuideHub: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>('start');
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [hasSeen, setHasSeen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(GUIDE_SEEN_KEY) === '1';
    const completed = localStorage.getItem(GUIDE_COMPLETED_KEY) === '1';
    setHasSeen(seen);
    setHasCompleted(completed);
  }, []);

  const currentStep = useMemo(() => tourSteps[tourStepIndex], [tourStepIndex]);

  const openHub = () => {
    setIsOpen(true);
    if (!hasSeen) {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
      setHasSeen(true);
    }
  };

  const closeHub = () => {
    setIsOpen(false);
  };

  const startTour = () => {
    setActiveTab('start');
    setTourActive(true);
    setTourStepIndex(0);
  };

  const completeTour = () => {
    setTourActive(false);
    setTourStepIndex(0);
    setHasCompleted(true);
    localStorage.setItem(GUIDE_COMPLETED_KEY, '1');
  };

  const nextStep = () => {
    if (tourStepIndex >= tourSteps.length - 1) {
      completeTour();
      return;
    }
    setTourStepIndex((prev) => prev + 1);
  };

  const prevStep = () => {
    setTourStepIndex((prev) => Math.max(0, prev - 1));
  };

  const jumpTo = (path: string) => {
    navigate(path);
    closeHub();
  };

  const tabs: Array<{ key: GuideTab; label: string; icon: React.ReactNode }> = [
    { key: 'start', label: '开始向导', icon: <Compass className="w-4 h-4" /> },
    { key: 'map', label: '功能地图', icon: <Map className="w-4 h-4" /> },
    { key: 'core', label: '核心功能', icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'highlights', label: '产品特点', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <>
      <motion.button
        type="button"
        onClick={openHub}
        className="fixed left-6 bottom-6 z-40 group"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        aria-label="向导与指南"
      >
        <div className="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 border border-slate-700/60">
          <Compass className="w-4 h-4" />
          <span className="text-sm font-medium">向导与指南</span>
          {!hasSeen && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
              onClick={closeHub}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed z-50 left-4 right-4 bottom-4 md:left-6 md:right-auto md:bottom-24 w-auto md:w-[460px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">平台向导与指南</h3>
                  <p className="text-xs text-slate-500">快速了解平台功能、学习路径与产品能力</p>
                </div>
                <button
                  type="button"
                  onClick={closeHub}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="关闭指南"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 py-3 border-b border-slate-100 grid grid-cols-2 gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key !== 'start') setTourActive(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 max-h-[65vh] overflow-y-auto">
                {activeTab === 'start' && (
                  <div className="space-y-4">
                    {!tourActive && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-sm font-semibold text-slate-800">3 分钟开始向导</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-6">
                          按 4 个步骤快速了解平台的学习路径、实训方式和项目实践入口。
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={startTour}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                          >
                            <Rocket className="w-3.5 h-3.5" />
                            {hasCompleted ? '重新开始向导' : '开始向导'}
                          </button>
                          {hasCompleted && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              已完成
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {tourActive && (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            步骤 {tourStepIndex + 1}/{tourSteps.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTourActive(false)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            暂停向导
                          </button>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800 mt-2">{currentStep.title}</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-6">{currentStep.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => jumpTo(currentStep.route)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                          >
                            {currentStep.actionLabel}
                          </button>
                          <button
                            type="button"
                            onClick={prevStep}
                            disabled={tourStepIndex === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 disabled:opacity-40"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            上一步
                          </button>
                          <button
                            type="button"
                            onClick={nextStep}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {tourStepIndex >= tourSteps.length - 1 ? '完成向导' : '下一步'}
                            {tourStepIndex < tourSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'map' && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        学习中心
                      </div>
                      <p className="text-xs text-slate-600 mt-2">浏览课程与技能路径，进入课时学习和实训。</p>
                      <button
                        type="button"
                        onClick={() => jumpTo('/study')}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                      >
                        打开学习中心
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                        <FolderKanban className="w-4 h-4 text-violet-600" />
                        项目实战
                      </div>
                      <p className="text-xs text-slate-600 mt-2">围绕真实任务练习工程能力，做完整项目闭环。</p>
                      <button
                        type="button"
                        onClick={() => jumpTo('/projects')}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                      >
                        打开项目实战
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                        <Bot className="w-4 h-4 text-emerald-600" />
                        AI 助手
                      </div>
                      <p className="text-xs text-slate-600 mt-2">对话式答疑、资料解析、路径建议，陪伴学习全过程。</p>
                    </div>
                  </div>
                )}

                {activeTab === 'core' && (
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">课程学习与技能分层</p>
                      <p className="mt-2 leading-6">从课程到阶段到课时分层组织，支持系统化学习与阶段推进。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">实训驱动学习</p>
                      <p className="mt-2 leading-6">围绕课时实验和项目实践展开，强调“学完就能做”。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">AI 教师辅助</p>
                      <p className="mt-2 leading-6">可根据当前课程上下文给出开场引导、疑难解释与练习建议。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">进度与成果沉淀</p>
                      <p className="mt-2 leading-6">学习记录、课时完成、项目实践结果可持续跟踪与复盘。</p>
                    </div>
                  </div>
                )}

                {activeTab === 'highlights' && (
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">国产模型生态适配</p>
                      <p className="mt-2 leading-6">支持主流国产模型生态，贴合教学落地与产业场景。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">课程与项目双引擎</p>
                      <p className="mt-2 leading-6">理论课程与项目实战结合，降低“只会看不会做”的风险。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">平台化可扩展</p>
                      <p className="mt-2 leading-6">可持续新增课程、技能与实训内容，快速对齐教学目标。</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GuideHub;
