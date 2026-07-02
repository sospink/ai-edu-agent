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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type GuideTab = 'start' | 'map' | 'core' | 'highlights';

const GUIDE_SEEN_KEY = 'guide_seen_v1';
const GUIDE_COMPLETED_KEY = 'guide_completed_v1';

interface TourStep {
  title: string;
  description: string;
  route: string;
  actionLabel: string;
}

const createTourSteps = (t: TFunction<'guide'>): TourStep[] => [
  {
    title: t('tour1Title'), description: t('tour1Desc'),
    route: '/study',
    actionLabel: t('tour1Action'),
  },
  {
    title: t('tour2Title'), description: t('tour2Desc'),
    route: '/study',
    actionLabel: t('tour2Action'),
  },
  {
    title: t('tour3Title'), description: t('tour3Desc'),
    route: '/projects',
    actionLabel: t('tour3Action'),
  },
  {
    title: t('tour4Title'), description: t('tour4Desc'),
    route: '/study',
    actionLabel: t('tour4Action'),
  },
];

const GuideHub: React.FC = () => {
  const { t } = useTranslation('guide');
  const tourSteps = createTourSteps(t);
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
    { key: 'start', label: t('startTab'), icon: <Compass className="w-4 h-4" /> },
    { key: 'map', label: t('mapTab'), icon: <Map className="w-4 h-4" /> },
    { key: 'core', label: t('coreTab'), icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'highlights', label: t('highlightsTab'), icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <>
      <motion.button
        type="button"
        onClick={openHub}
        className="fixed left-6 bottom-6 z-40 group"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        aria-label={t('trigger')}
      >
        <div className="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 border border-slate-700/60">
          <Compass className="w-4 h-4" />
          <span className="text-sm font-medium">{t('trigger')}</span>
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
                  <h3 className="text-sm font-semibold text-slate-800">{t('title')}</h3>
                  <p className="text-xs text-slate-500">{t('subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={closeHub}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label={t('close')}
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
                        <h4 className="text-sm font-semibold text-slate-800">{t('quickTitle')}</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-6">
                          {t('quickDesc')}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={startTour}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                          >
                            <Rocket className="w-3.5 h-3.5" />
                            {hasCompleted ? t('restart') : t('start')}
                          </button>
                          {hasCompleted && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('completed')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {tourActive && (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {t('step', { current: tourStepIndex + 1, total: tourSteps.length })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTourActive(false)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            {t('pause')}
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
                            {t('previous')}
                          </button>
                          <button
                            type="button"
                            onClick={nextStep}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {tourStepIndex >= tourSteps.length - 1 ? t('finish') : t('next')}
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
                        {t('learning')}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{t('learningDesc')}</p>
                      <button
                        type="button"
                        onClick={() => jumpTo('/study')}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                      >
                        {t('openLearning')}
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                        <FolderKanban className="w-4 h-4 text-violet-600" />
                        {t('projects')}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{t('projectsDesc')}</p>
                      <button
                        type="button"
                        onClick={() => jumpTo('/projects')}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                      >
                        {t('openProjects')}
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                        <Bot className="w-4 h-4 text-emerald-600" />
                        {t('ai')}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{t('aiDesc')}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'core' && (
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('layeredTitle')}</p><p className="mt-2 leading-6">{t('layeredDesc')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('labTitle')}</p><p className="mt-2 leading-6">{t('labDesc')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('teacherTitle')}</p><p className="mt-2 leading-6">{t('teacherDesc')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('progressTitle')}</p><p className="mt-2 leading-6">{t('progressDesc')}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'highlights' && (
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('ecosystemTitle')}</p><p className="mt-2 leading-6">{t('ecosystemDesc')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('dualTitle')}</p><p className="mt-2 leading-6">{t('dualDesc')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">{t('extensibleTitle')}</p><p className="mt-2 leading-6">{t('extensibleDesc')}</p>
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
