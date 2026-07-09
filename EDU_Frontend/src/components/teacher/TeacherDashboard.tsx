import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bell, Bot, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Eye, FileWarning, Loader2, RefreshCw, RotateCcw, ShieldAlert, Sparkles, TrendingDown, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageDialog from '@/components/common/PageDialog';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import {
  teacherAssignmentApi,
  type AgentStepStatsItem,
  type AISuggestion,
  type AIStatus,
  type AssignmentProgressItem,
  type RiskStudentItem,
  type TeacherTodoItem,
  type TeachingOverview,
  type TodoItemType,
} from '@/services/assignment';
import { teacherManualApi, type TeacherManualListItem } from '@/services/teacherManual';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getCurrentLocale } from '@/i18n';

const getTodoTypeMeta = (t: TFunction): Record<TodoItemType, { label: string; className: string; icon: React.ElementType }> => ({
  pending_review: { label: t('todoTypes.pendingReview'), className: 'bg-cyan-50 text-cyan-700', icon: ClipboardCheck },
  overdue_missing: { label: t('todoTypes.overdueMissing'), className: 'bg-amber-50 text-amber-700', icon: Clock3 },
  verification_failed: { label: t('todoTypes.verificationFailed'), className: 'bg-rose-50 text-rose-700', icon: FileWarning },
  lab_failed: { label: t('todoTypes.labFailed'), className: 'bg-violet-50 text-violet-700', icon: ShieldAlert },
});

type ActionTarget = {
  mode: 'remind' | 'reopen';
  assignmentId: number;
  studentId?: number;
  classId?: number;
  title: string;
  studentName?: string;
};

type DashboardTab = 'todos' | 'agent' | 'risks' | 'progress' | 'lab';

const PAGE_SIZE = {
  todos: 6,
  agent: 8,
  risks: 4,
  progress: 6,
  lab: 4,
} as const;

const paginateItems = <T,>(items: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

const TeacherDashboard: React.FC = () => {
  const { t } = useTranslation('teacherDashboard');
  const navigate = useNavigate();
  const { toast, hideToast, success, error: showError } = useToast();
  const [overview, setOverview] = useState<TeachingOverview | null>(null);
  const [todos, setTodos] = useState<TeacherTodoItem[]>([]);
  const [todoTotal, setTodoTotal] = useState(0);
  const [risks, setRisks] = useState<RiskStudentItem[]>([]);
  const [progress, setProgress] = useState<AssignmentProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todoType, setTodoType] = useState<TodoItemType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [aiSuggestion, setAISuggestion] = useState<AISuggestion | null>(null);
  const [aiLoadingKey, setAILoadingKey] = useState('');
  const [aiSuggestionAction, setAISuggestionAction] = useState<'confirm' | 'dismiss' | ''>('');
  const [manuals, setManuals] = useState<TeacherManualListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedManualKey, setSelectedManualKey] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [agentStepStats, setAgentStepStats] = useState<AgentStepStatsItem[]>([]);
  const [agentStatsLoading, setAgentStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('todos');
  const [todoPage, setTodoPage] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [riskPage, setRiskPage] = useState(1);
  const [progressPage, setProgressPage] = useState(1);
  const [labPage, setLabPage] = useState(1);

  const load = async (nextType = todoType, nextKeyword = keyword) => {
    setLoading(true);
    const [overviewResp, todoResp, riskResp, progressResp] = await Promise.all([
      teacherAssignmentApi.teachingOverview(),
      teacherAssignmentApi.todoItems({ page: 1, pageSize: 100, type: nextType, q: nextKeyword }),
      teacherAssignmentApi.riskStudents({ page: 1, pageSize: 50, q: nextKeyword }),
      teacherAssignmentApi.assignmentProgress({ page: 1, pageSize: 50, q: nextKeyword }),
    ]);

    if (overviewResp.success && overviewResp.data) setOverview(overviewResp.data);
    else showError(overviewResp.error || t('loadFailed'));

    setTodos(todoResp.success && todoResp.data ? todoResp.data.list : []);
    setTodoTotal(todoResp.success && todoResp.data ? todoResp.data.total : 0);
    setRisks(riskResp.success && riskResp.data ? riskResp.data.list : []);
    setProgress(progressResp.success && progressResp.data ? progressResp.data.list : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    void loadAIStatus();
    void loadAgentStatsOptions();
  }, []);

  const loadAIStatus = async () => {
    const response = await teacherAssignmentApi.aiStatus();
    if (response.success && response.data) {
      setAIStatus(response.data);
    }
  };

  const loadAgentStatsOptions = async () => {
    const [manualResp, classResp] = await Promise.all([
      teacherManualApi.list({ page: 1, pageSize: 50, published: 1 }),
      teacherClassApi.getList({ page: 1, pageSize: 50 }),
    ]);
    const manualList = manualResp.success && manualResp.data ? manualResp.data.list : [];
    const classList = classResp.success && classResp.data ? classResp.data.list : [];
    setManuals(manualList);
    setClasses(classList);
    if (manualList.length > 0) {
      setSelectedManualKey(`${manualList[0].sourceType}:${manualList[0].sourceId}`);
    }
    if (classList.length > 0) {
      setSelectedClassId(classList[0].id);
    }
  };

  const selectedManual = useMemo(() => {
    if (!selectedManualKey) return null;
    return manuals.find(item => `${item.sourceType}:${item.sourceId}` === selectedManualKey) || null;
  }, [manuals, selectedManualKey]);

  const loadAgentStepStats = async () => {
    if (!selectedManual || !selectedClassId) {
      setAgentStepStats([]);
      return;
    }
    setAgentStatsLoading(true);
    const response = await teacherAssignmentApi.agentStepStats({
      sourceType: selectedManual.sourceType,
      sourceId: selectedManual.sourceId,
      classId: selectedClassId,
    });
    setAgentStatsLoading(false);
    if (response.success && response.data) {
      setAgentStepStats(response.data);
    } else {
      setAgentStepStats([]);
      showError(response.error || t('agentStatsFailed'));
    }
  };

  useEffect(() => {
    if (selectedManual && selectedClassId) {
      void loadAgentStepStats();
    }
  }, [selectedManualKey, selectedClassId]);

  const kpis = useMemo(() => [
    { key: 'pending_review' as TodoItemType, label: t('todoTypes.pendingReview'), value: overview?.pendingReview || 0, icon: ClipboardCheck, accent: 'text-cyan-600 bg-cyan-50' },
    { key: 'overdue_missing' as TodoItemType, label: t('todoTypes.overdueMissing'), value: overview?.overdueMissing || 0, icon: Clock3, accent: 'text-amber-700 bg-amber-50' },
    { key: 'verification_failed' as TodoItemType, label: t('todoTypes.verificationFailed'), value: overview?.verificationFailed || 0, icon: FileWarning, accent: 'text-rose-600 bg-rose-50' },
    { key: 'lab_failed' as TodoItemType, label: t('todoTypes.labFailed'), value: overview?.labFailed || 0, icon: ShieldAlert, accent: 'text-violet-600 bg-violet-50' },
    { key: 'risk' as const, label: t('riskStudents'), value: overview?.riskStudents || 0, icon: AlertTriangle, accent: 'text-orange-700 bg-orange-50' },
    { key: 'low' as const, label: t('lowCompletionClasses'), value: overview?.lowCompletionClasses || 0, icon: TrendingDown, accent: 'text-slate-700 bg-slate-100' },
  ], [overview, t]);

  const handleKpiClick = (key: TodoItemType | 'risk' | 'low') => {
    if (key === 'risk') {
      setActiveTab('risks');
      setRiskPage(1);
      return;
    }
    if (key === 'low') {
      setActiveTab('progress');
      setProgressPage(1);
      return;
    }
    setActiveTab(key === 'lab_failed' ? 'lab' : 'todos');
    setTodoPage(1);
    setLabPage(1);
    setTodoType(key);
    void load(key, keyword);
  };

  const labTodos = useMemo(() => todos.filter((item) => item.type === 'lab_failed'), [todos]);
  const pagedTodos = useMemo(() => paginateItems(todos, todoPage, PAGE_SIZE.todos), [todos, todoPage]);
  const pagedAgentStepStats = useMemo(() => paginateItems(agentStepStats, agentPage, PAGE_SIZE.agent), [agentStepStats, agentPage]);
  const pagedRisks = useMemo(() => paginateItems(risks, riskPage, PAGE_SIZE.risks), [risks, riskPage]);
  const pagedProgress = useMemo(() => paginateItems(progress, progressPage, PAGE_SIZE.progress), [progress, progressPage]);
  const pagedLabTodos = useMemo(() => paginateItems(labTodos, labPage, PAGE_SIZE.lab), [labTodos, labPage]);

  const switchTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === 'lab') {
      setTodoType('lab_failed');
      setLabPage(1);
      void load('lab_failed', keyword);
      return;
    }
    if (tab === 'todos') {
      setTodoPage(1);
      void load(todoType, keyword);
      return;
    }
    if (tab === 'agent') setAgentPage(1);
    if (tab === 'risks') setRiskPage(1);
    if (tab === 'progress') setProgressPage(1);
  };

  const executeSearch = () => {
    setTodoPage(1);
    setLabPage(1);
    setRiskPage(1);
    setProgressPage(1);
    void load(activeTab === 'lab' ? 'lab_failed' : todoType, keyword);
  };

  const refreshDashboard = () => {
    void load(activeTab === 'lab' ? 'lab_failed' : todoType, keyword);
    if (activeTab === 'agent') {
      void loadAgentStepStats();
    }
  };

  const dashboardTabs = useMemo(() => [
    { key: 'todos' as const, label: t('tabs.todos'), count: todoTotal || todos.length, icon: ClipboardCheck },
    { key: 'agent' as const, label: t('tabs.agent'), count: agentStepStats.length, icon: Bot },
    { key: 'risks' as const, label: t('tabs.risks'), count: risks.length, icon: AlertTriangle },
    { key: 'progress' as const, label: t('tabs.progress'), count: progress.length, icon: TrendingDown },
    { key: 'lab' as const, label: t('tabs.lab'), count: overview?.labFailed || labTodos.length, icon: ShieldAlert },
  ], [agentStepStats.length, labTodos.length, overview?.labFailed, progress.length, risks.length, t, todoTotal, todos.length]);

  const openAction = (target: ActionTarget) => {
    setActionTarget(target);
    setActionMessage(target.mode === 'reopen' ? t('reopenDefault') : t('remindDefault'));
  };

  const submitAction = async () => {
    if (!actionTarget) return;
    setSubmittingAction(true);
    const studentIds = actionTarget.studentId ? [actionTarget.studentId] : undefined;
    const response = actionTarget.mode === 'reopen'
      ? await teacherAssignmentApi.reopenAssignment(actionTarget.assignmentId, {
        studentIds,
        classId: actionTarget.classId,
        extraAttempts: 1,
        reason: actionMessage.trim(),
      })
      : await teacherAssignmentApi.remindStudents({
        assignmentId: actionTarget.assignmentId,
        studentIds,
        classId: actionTarget.classId,
        message: actionMessage.trim(),
      });
    setSubmittingAction(false);
    if (response.success) {
      success(actionTarget.mode === 'reopen' ? t('reopened') : t('reminded'));
      setActionTarget(null);
      void load();
    } else {
      showError(response.error || t('actionFailed'));
    }
  };

  const aiDisabled = !aiStatus || !aiStatus.enabled || !aiStatus.configured;

  const generateAssignmentSummary = async (item: AssignmentProgressItem) => {
    const key = `summary-${item.assignmentId}-${item.classId}`;
    setAILoadingKey(key);
    const response = await teacherAssignmentApi.assignmentSummary(item.assignmentId, item.classId);
    setAILoadingKey('');
    if (response.success && response.data) {
      setAISuggestion(response.data);
      success(t('aiSummaryGenerated'));
    } else {
      showError(response.error || t('aiSummaryFailed'));
    }
  };

  const generateWeaknessDiagnosis = async (item: RiskStudentItem) => {
    const key = `weakness-${item.studentId}-${item.classId}`;
    setAILoadingKey(key);
    const response = await teacherAssignmentApi.weaknessDiagnosis(item.studentId, item.classId);
    setAILoadingKey('');
    if (response.success && response.data) {
      setAISuggestion(response.data);
      success(t('aiDiagnosisGenerated'));
    } else {
      showError(response.error || t('aiDiagnosisFailed'));
    }
  };

  const generateStepInsight = async (item: AgentStepStatsItem) => {
    if (!selectedClassId) return;
    const key = `step-${item.stepId}-${selectedClassId}`;
    setAILoadingKey(key);
    const response = await teacherAssignmentApi.agentStepInsight(item.stepId, selectedClassId);
    setAILoadingKey('');
    if (response.success && response.data) {
      setAISuggestion(response.data);
      success(t('aiStepGenerated'));
    } else {
      showError(response.error || t('aiStepFailed'));
    }
  };

  const handleAISuggestionAction = async (action: 'confirm' | 'dismiss') => {
    if (!aiSuggestion) return;
    setAISuggestionAction(action);
    const response = await teacherAssignmentApi.updateAISuggestion(aiSuggestion.id, action);
    setAISuggestionAction('');
    if (response.success) {
      success(action === 'confirm' ? t('aiConfirmed') : t('aiDismissed'));
      const shouldRefreshAgentStats = aiSuggestion.sourceType === 'agent_step';
      setAISuggestion(null);
      if (shouldRefreshAgentStats) {
        void loadAgentStepStats();
      }
    } else {
      showError(response.error || t('aiUpdateFailed'));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-default-500">{t('subtitle')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={executeSearch}
            placeholder={t('searchPlaceholder')}
            className="sm:w-72"
          />
          <button onClick={refreshDashboard} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-default-200 bg-white px-4 text-sm font-semibold text-default-600 hover:bg-default-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((card) => (
          <button key={card.label} onClick={() => handleKpiClick(card.key)} className="card-surface rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.accent}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div className="text-xs font-semibold text-default-500">{card.label}</div>
            <div className="mt-1 text-2xl font-black text-foreground">{loading ? '-' : card.value}</div>
          </button>
        ))}
      </div>

      <div className="card-surface rounded-xl p-2">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {dashboardTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`relative flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${selected ? 'text-slate-950' : 'text-default-500 hover:bg-default-50 hover:text-default-700'}`}
              >
                {selected && <motion.span layoutId="teacher-dashboard-tab" className="absolute inset-0 rounded-lg bg-slate-950/5" />}
                <span className="relative flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-bold">{tab.label}</span>
                </span>
                <span className={`relative shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${selected ? 'bg-slate-950 text-white' : 'bg-default-100 text-default-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'agent' && <section className="card-surface overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-default-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{t('agentBottlenecks')}</h3>
            <p className="mt-1 text-xs text-default-500">{t('agentBottlenecksDesc')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ToolbarSelect
              ariaLabel={t('selectManual')}
              value={selectedManualKey}
              placeholder={manuals.length === 0 ? t('noPublishedManuals') : t('selectManual')}
              isDisabled={manuals.length === 0}
              disallowEmptySelection={false}
              onChange={setSelectedManualKey}
              options={manuals.map((manual) => ({
                key: `${manual.sourceType}:${manual.sourceId}`,
                label: manual.title || manual.sourceName,
              }))}
              className="sm:w-72"
            />
            <ToolbarSelect
              ariaLabel={t('selectClass')}
              value={selectedClassId ? String(selectedClassId) : ''}
              placeholder={classes.length === 0 ? t('noClasses') : t('selectClass')}
              isDisabled={classes.length === 0}
              disallowEmptySelection={false}
              onChange={(value) => setSelectedClassId(Number(value) || 0)}
              options={classes.map((item) => ({ key: String(item.id), label: item.name }))}
              className="sm:w-48"
            />
            <button onClick={() => void loadAgentStepStats()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-default-200 bg-white px-4 text-sm font-semibold text-default-600 hover:bg-default-50">
              <RefreshCw className={`h-4 w-4 ${agentStatsLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-default-50 text-left text-xs font-semibold text-default-500">
              <tr>
                <th className="px-5 py-3">{t('step')}</th><th className="px-5 py-3">{t('completionRate')}</th><th className="px-5 py-3">{t('failures')}</th><th className="px-5 py-3">{t('bottleneckAlert')}</th><th className="px-5 py-3">{t('recentFailure')}</th><th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-100">
              {agentStatsLoading ? (
                <tr><td colSpan={6}><LoadingRows /></td></tr>
              ) : agentStepStats.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-default-400">{t('selectStatsPrompt')}</td></tr>
              ) : pagedAgentStepStats.map((item) => {
                const loadingKey = `step-${item.stepId}-${selectedClassId}`;
                return (
                  <tr key={item.stepId} className="hover:bg-default-50/60">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{t('stepNumber', { number: item.stepOrder + 1 })}</div>
                      <div className="max-w-[280px] truncate text-xs text-default-500">{item.stepTitle}</div>
                    </td>
                    <td className="px-5 py-4 text-default-600">{item.completedCount}/{item.totalStudents} · {Math.round(item.completionRate * 100)}%</td>
                    <td className="px-5 py-4 text-default-600">{item.failedCount}</td>
                    <td className="px-5 py-4">
                      {item.strugglingCount > 0 ? (
                        <span className="rounded-full bg-danger-50 px-2.5 py-1 text-xs font-bold text-danger-700">{t('struggling', { count: item.strugglingCount })}</span>
                      ) : (
                        <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">{t('noBottleneck')}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[260px] truncate text-xs text-default-500">
                        {item.recentFailures[0]?.failureReason || t('noFailures')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => void generateStepInsight(item)}
                        disabled={aiDisabled || aiLoadingKey === loadingKey || item.failedCount === 0}
                        className="inline-flex items-center gap-1 rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-default-300"
                      >
                        {aiLoadingKey === loadingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {t('aiDiagnosis')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          page={agentPage}
          pageSize={PAGE_SIZE.agent}
          total={agentStepStats.length}
          onPageChange={setAgentPage}
          summary={(from, to, total) => t('pageSummary', { from, to, total })}
          previousText={t('previous')}
          nextText={t('next')}
        />
      </section>}

      {activeTab === 'todos' && (
        <section className="card-surface overflow-hidden rounded-xl">
          <div className="flex flex-col gap-3 border-b border-default-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{t('teachingTodos')}</h3>
              <p className="mt-1 text-xs text-default-500">{t('todoSummary', { count: todoTotal })}</p>
            </div>
            <ToolbarSelect
              ariaLabel={t('todoFilter')}
              value={todoType || 'all'}
              onChange={(value) => {
                const next = value === 'all' ? '' : value as TodoItemType;
                setTodoType(next);
                setTodoPage(1);
                void load(next, keyword);
              }}
              options={[
                { key: 'all', label: t('allTodos') },
                { key: 'pending_review', label: t('todoTypes.pendingReview') },
                { key: 'overdue_missing', label: t('todoTypes.overdueMissing') },
                { key: 'verification_failed', label: t('todoTypes.verificationFailed') },
                { key: 'lab_failed', label: t('todoTypes.labFailed') },
              ]}
              className="lg:w-52"
            />
          </div>
          <div className="divide-y divide-default-100">
            {loading ? <LoadingRows /> : todos.length === 0 ? (
              <div className="p-10 text-center text-sm text-default-400">{t('noTodos')}</div>
            ) : pagedTodos.map((item) => {
              const todoTypeMeta = getTodoTypeMeta(t);
              const meta = todoTypeMeta[item.type] || todoTypeMeta.pending_review;
              const Icon = meta.icon;
              return (
                <div key={`${item.type}-${item.assignmentId}-${item.studentId}-${item.submissionId}`} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}><Icon className="h-3.5 w-3.5" />{meta.label}</span>
                      <span className="truncate text-sm font-bold text-foreground">{item.assignmentTitle}</span>
                    </div>
                    <div className="truncate text-sm text-default-500">{item.studentName || item.studentUsername} · {item.className || t('unassigned')}</div>
                    <div className="mt-2 text-xs text-default-400">{t('dates', { due: item.dueAt ? new Date(item.dueAt).toLocaleString(getCurrentLocale(), { hour12: false }) : t('notSet'), updated: item.updatedAt ? new Date(item.updatedAt).toLocaleString(getCurrentLocale(), { hour12: false }) : t('notSet') })}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.submissionId > 0 && (
                      <button onClick={() => navigate(`/teacher/submissions/${item.submissionId}`)} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                        <Eye className="h-3.5 w-3.5" />
                        {t('details')}
                      </button>
                    )}
                    <button onClick={() => openAction({ mode: 'remind', assignmentId: item.assignmentId, studentId: item.studentId, title: item.assignmentTitle, studentName: item.studentName || item.studentUsername })} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                      <Bell className="h-3.5 w-3.5" />
                      {t('remind')}
                    </button>
                    <button onClick={() => openAction({ mode: 'reopen', assignmentId: item.assignmentId, studentId: item.studentId, title: item.assignmentTitle, studentName: item.studentName || item.studentUsername })} className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('reopen')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <PaginationFooter
            page={todoPage}
            pageSize={PAGE_SIZE.todos}
            total={todos.length}
            onPageChange={setTodoPage}
            summary={(from, to, total) => t('pageSummary', { from, to, total })}
            previousText={t('previous')}
            nextText={t('next')}
          />
        </section>
      )}

      {activeTab === 'risks' && (
        <section className="card-surface overflow-hidden rounded-xl">
          <div className="border-b border-default-100 px-5 py-4">
            <h3 className="font-semibold text-foreground">{t('riskStudents')}</h3>
            <p className="mt-1 text-xs text-default-500">{t('riskDescription')}</p>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {loading ? <LoadingRows /> : risks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-default-200 p-8 text-center text-sm text-default-400 lg:col-span-2">{t('noRisk')}</div>
            ) : pagedRisks.map((item) => (
              <div key={`${item.studentId}-${item.classId}`} className="card-surface-muted rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{item.studentName || item.studentUsername}</div>
                    <div className="mt-1 text-xs text-default-500">{t('classCompletion', { className: item.className, rate: Math.round(item.completionRate * 100) })}</div>
                  </div>
                  <button onClick={() => openAction({ mode: 'remind', assignmentId: 0, classId: item.classId, studentId: item.studentId, title: item.className, studentName: item.studentName || item.studentUsername })} className="rounded-lg border border-default-200 bg-white p-2 text-default-500 hover:text-primary-600" aria-label={t('remindStudent')}>
                    <Bell className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.riskReasons.map((reason) => <span key={reason} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-default-500">{reason}</span>)}
                </div>
                <button
                  onClick={() => void generateWeaknessDiagnosis(item)}
                  disabled={aiDisabled || aiLoadingKey === `weakness-${item.studentId}-${item.classId}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-default-300"
                >
                  {aiLoadingKey === `weakness-${item.studentId}-${item.classId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  {t('aiDiagnosis')}
                </button>
              </div>
            ))}
          </div>
          <PaginationFooter
            page={riskPage}
            pageSize={PAGE_SIZE.risks}
            total={risks.length}
            onPageChange={setRiskPage}
            summary={(from, to, total) => t('pageSummary', { from, to, total })}
            previousText={t('previous')}
            nextText={t('next')}
          />
        </section>
      )}

      {activeTab === 'progress' && <section className="card-surface overflow-hidden rounded-xl">
        <div className="border-b border-default-100 px-5 py-4">
          <h3 className="font-semibold text-foreground">{t('assignmentProgress')}</h3>
          <p className="mt-1 text-xs text-default-500">{t('assignmentProgressDesc')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-default-50 text-left text-xs font-semibold text-default-500">
              <tr>
                <th className="px-5 py-3">{t('assignmentClass')}</th><th className="px-5 py-3">{t('submitted')}</th><th className="px-5 py-3">{t('pendingReview')}</th><th className="px-5 py-3">{t('returned')}</th><th className="px-5 py-3">{t('grades')}</th><th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-100">
              {loading ? (
                <tr><td colSpan={6}><LoadingRows /></td></tr>
              ) : pagedProgress.map((item) => (
                <tr key={`${item.assignmentId}-${item.classId}`} className="hover:bg-default-50/60">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-foreground">{item.assignmentTitle}</div>
                    <div className="text-xs text-default-400">{t('classDue', { className: item.className, due: item.dueAt ? new Date(item.dueAt).toLocaleString(getCurrentLocale(), { hour12: false }) : t('notSet') })}</div>
                  </td>
                  <td className="px-5 py-4 text-default-600">{item.submitted}/{item.totalStudents}</td>
                  <td className="px-5 py-4 text-default-600">{item.pendingReview}</td>
                  <td className="px-5 py-4 text-default-600">{item.returned}</td>
                  <td className="px-5 py-4 text-default-600">{item.publishedGrades}/{item.graded}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => void generateAssignmentSummary(item)}
                      disabled={aiDisabled || aiLoadingKey === `summary-${item.assignmentId}-${item.classId}`}
                      className="mr-2 inline-flex items-center gap-1 rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-default-300"
                    >
                      {aiLoadingKey === `summary-${item.assignmentId}-${item.classId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {t('aiSummary')}
                    </button>
                    <button onClick={() => openAction({ mode: 'remind', assignmentId: item.assignmentId, classId: item.classId, title: item.assignmentTitle })} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                      <UsersRound className="h-3.5 w-3.5" />
                      {t('classReminder')}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && progress.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-default-400">{t('noProgress')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          page={progressPage}
          pageSize={PAGE_SIZE.progress}
          total={progress.length}
          onPageChange={setProgressPage}
          summary={(from, to, total) => t('pageSummary', { from, to, total })}
          previousText={t('previous')}
          nextText={t('next')}
        />
      </section>}

      {activeTab === 'lab' && <section className="card-surface overflow-hidden rounded-xl">
        <div className="flex items-center justify-between gap-4 border-b border-default-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-foreground">{t('labIssues')}</h3>
            <p className="mt-1 text-xs text-default-500">{t('labIssuesDesc')}</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700">{t('itemCount', { count: overview?.labFailed || 0 })}</span>
        </div>
        <div className="space-y-3 p-5">
          {loading ? (
            <LoadingRows />
          ) : (overview?.labFailed || 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-default-200 p-8 text-center text-sm text-default-400">{t('noLabIssues')}</div>
          ) : (
            <>
              {pagedLabTodos.map((item) => (
                <div key={`lab-${item.assignmentId}-${item.studentId}`} className="card-surface-muted rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{item.assignmentTitle}</div>
                      <div className="mt-1 text-xs text-default-500">{item.className || t('unassigned')} · {item.studentName || item.studentUsername}</div>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{t('todoTypes.labFailed')}</span>
                  </div>
                </div>
              ))}
              {labTodos.length === 0 && (
                <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-700">{t('labIssueHint')}</div>
              )}
            </>
          )}
        </div>
        <PaginationFooter
          page={labPage}
          pageSize={PAGE_SIZE.lab}
          total={labTodos.length}
          onPageChange={setLabPage}
          summary={(from, to, total) => t('pageSummary', { from, to, total })}
          previousText={t('previous')}
          nextText={t('next')}
        />
      </section>}

      <PageDialog isOpen={Boolean(actionTarget)} onClose={() => setActionTarget(null)} panelClassName="max-w-lg">
        <div className="border-b border-default-100 p-5">
          <h3 className="text-lg font-bold text-foreground">{actionTarget?.mode === 'reopen' ? t('reopenTitle') : t('remindTitle')}</h3>
          <p className="mt-1 text-sm text-default-500">{actionTarget?.studentName ? t('targetStudent', { name: actionTarget.studentName }) : t('targetClass')} · {actionTarget?.title}</p>
        </div>
        <div className="space-y-3 p-5">
          <textarea value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} rows={4} className="w-full rounded-xl border border-default-200 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>
        <div className="flex justify-end gap-2 border-t border-default-100 p-5">
          <button onClick={() => setActionTarget(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-default-500 hover:bg-default-100">{t('cancel')}</button>
          <button onClick={() => void submitAction()} disabled={submittingAction} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:bg-default-300">
            {submittingAction && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('confirm')}
          </button>
        </div>
      </PageDialog>

      <PageDialog isOpen={Boolean(aiSuggestion)} onClose={() => setAISuggestion(null)} panelClassName="max-w-2xl">
        <div className="border-b border-default-100 p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-bold text-foreground">{aiSuggestion?.title || t('aiSuggestion')}</h3>
          </div>
          <p className="mt-1 text-sm text-default-500">{t('aiNotice')}</p>
        </div>
        <div className="max-h-[60vh] overflow-auto p-5">
          <div className="whitespace-pre-wrap rounded-xl bg-default-50 p-4 text-sm leading-6 text-default-700">{aiSuggestion?.content}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-default-100 p-5">
          <button
            onClick={() => setAISuggestion(null)}
            disabled={Boolean(aiSuggestionAction)}
            className="rounded-xl px-4 py-2 text-sm font-bold text-default-500 hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('close')}
          </button>
          <button
            onClick={() => void handleAISuggestionAction('dismiss')}
            disabled={Boolean(aiSuggestionAction) || aiSuggestion?.status !== 'pending'}
            className="inline-flex items-center gap-2 rounded-xl border border-default-200 px-4 py-2 text-sm font-bold text-default-600 hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiSuggestionAction === 'dismiss' && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('dismiss')}
          </button>
          <button
            onClick={() => void handleAISuggestionAction('confirm')}
            disabled={Boolean(aiSuggestionAction) || aiSuggestion?.status !== 'pending'}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-default-300"
          >
            {aiSuggestionAction === 'confirm' && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('adopt')}
          </button>
        </div>
      </PageDialog>
    </motion.div>
  );
};

const LoadingRows = () => (
  <div className="space-y-3 p-4">
    {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-default-100" />)}
  </div>
);

type PaginationFooterProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  summary: (from: number, to: number, total: number) => string;
  previousText: string;
  nextText: string;
};

const PaginationFooter: React.FC<PaginationFooterProps> = ({ page, pageSize, total, onPageChange, summary, previousText, nextText }) => {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-default-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-semibold text-default-500">{summary(from, to, total)}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-default-200 px-3 text-xs font-bold text-default-600 hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {previousText}
        </button>
        <span className="min-w-12 text-center text-xs font-black text-default-500">{currentPage}/{totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-default-200 px-3 text-xs font-bold text-default-600 hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextText}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TeacherDashboard;
