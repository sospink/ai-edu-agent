import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bell, Bot, ClipboardCheck, Clock3, Eye, FileWarning, Loader2, RefreshCw, RotateCcw, ShieldAlert, Sparkles, TrendingDown, UsersRound } from 'lucide-react';
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

const todoTypeMeta: Record<TodoItemType, { label: string; className: string; icon: React.ElementType }> = {
  pending_review: { label: '待批改', className: 'bg-cyan-50 text-cyan-700', icon: ClipboardCheck },
  overdue_missing: { label: '逾期未交', className: 'bg-amber-50 text-amber-700', icon: Clock3 },
  verification_failed: { label: '验证失败', className: 'bg-rose-50 text-rose-700', icon: FileWarning },
  lab_failed: { label: 'Lab 异常', className: 'bg-violet-50 text-violet-700', icon: ShieldAlert },
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未设置');

type ActionTarget = {
  mode: 'remind' | 'reopen';
  assignmentId: number;
  studentId?: number;
  classId?: number;
  title: string;
  studentName?: string;
};

const TeacherDashboard: React.FC = () => {
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

  const load = async (nextType = todoType, nextKeyword = keyword) => {
    setLoading(true);
    const [overviewResp, todoResp, riskResp, progressResp] = await Promise.all([
      teacherAssignmentApi.teachingOverview(),
      teacherAssignmentApi.todoItems({ page: 1, pageSize: 20, type: nextType, q: nextKeyword }),
      teacherAssignmentApi.riskStudents({ page: 1, pageSize: 8, q: nextKeyword }),
      teacherAssignmentApi.assignmentProgress({ page: 1, pageSize: 8, q: nextKeyword }),
    ]);

    if (overviewResp.success && overviewResp.data) setOverview(overviewResp.data);
    else showError(overviewResp.error || '加载教学过程概览失败');

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
      showError(response.error || 'Agent 步骤统计加载失败');
    }
  };

  useEffect(() => {
    if (selectedManual && selectedClassId) {
      void loadAgentStepStats();
    }
  }, [selectedManualKey, selectedClassId]);

  const kpis = useMemo(() => [
    { key: 'pending_review' as TodoItemType, label: '待批改', value: overview?.pendingReview || 0, icon: ClipboardCheck, accent: 'text-cyan-600 bg-cyan-50' },
    { key: 'overdue_missing' as TodoItemType, label: '逾期未交', value: overview?.overdueMissing || 0, icon: Clock3, accent: 'text-amber-700 bg-amber-50' },
    { key: 'verification_failed' as TodoItemType, label: '验证失败', value: overview?.verificationFailed || 0, icon: FileWarning, accent: 'text-rose-600 bg-rose-50' },
    { key: 'lab_failed' as TodoItemType, label: 'Lab 异常', value: overview?.labFailed || 0, icon: ShieldAlert, accent: 'text-violet-600 bg-violet-50' },
    { key: 'risk' as const, label: '风险学生', value: overview?.riskStudents || 0, icon: AlertTriangle, accent: 'text-orange-700 bg-orange-50' },
    { key: 'low' as const, label: '低完成班级', value: overview?.lowCompletionClasses || 0, icon: TrendingDown, accent: 'text-slate-700 bg-slate-100' },
  ], [overview]);

  const handleKpiClick = (key: TodoItemType | 'risk' | 'low') => {
    if (key === 'risk' || key === 'low') return;
    setTodoType(key);
    void load(key, keyword);
  };

  const openAction = (target: ActionTarget) => {
    setActionTarget(target);
    setActionMessage(target.mode === 'reopen' ? '已为你重开一次提交，请根据反馈补充后重新提交。' : '请关注本次作业进度和老师反馈。');
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
      success(actionTarget.mode === 'reopen' ? '已重开提交并通知学生' : '提醒已发送');
      setActionTarget(null);
      void load();
    } else {
      showError(response.error || '操作失败');
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
      success('AI 作业摘要已生成');
    } else {
      showError(response.error || 'AI 作业摘要生成失败');
    }
  };

  const generateWeaknessDiagnosis = async (item: RiskStudentItem) => {
    const key = `weakness-${item.studentId}-${item.classId}`;
    setAILoadingKey(key);
    const response = await teacherAssignmentApi.weaknessDiagnosis(item.studentId, item.classId);
    setAILoadingKey('');
    if (response.success && response.data) {
      setAISuggestion(response.data);
      success('AI 诊断已生成');
    } else {
      showError(response.error || 'AI 诊断生成失败');
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
      success('AI 步骤诊断已生成');
    } else {
      showError(response.error || 'AI 步骤诊断生成失败');
    }
  };

  const handleAISuggestionAction = async (action: 'confirm' | 'dismiss') => {
    if (!aiSuggestion) return;
    setAISuggestionAction(action);
    const response = await teacherAssignmentApi.updateAISuggestion(aiSuggestion.id, action);
    setAISuggestionAction('');
    if (response.success) {
      success(action === 'confirm' ? 'AI 建议已确认' : 'AI 建议已忽略');
      const shouldRefreshAgentStats = aiSuggestion.sourceType === 'agent_step';
      setAISuggestion(null);
      if (shouldRefreshAgentStats) {
        void loadAgentStepStats();
      }
    } else {
      showError(response.error || 'AI 建议状态更新失败');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">教学过程工作台</h2>
          <p className="mt-1 text-sm text-default-500">发现待办、钻取原因、处理提醒与重开提交。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void load(todoType, keyword)}
            placeholder="搜索作业、学生、班级"
            className="sm:w-72"
          />
          <button onClick={() => void load()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-default-200 bg-white px-4 text-sm font-semibold text-default-600 hover:bg-default-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
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

      <section className="card-surface overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-default-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Agent 步骤卡点</h3>
            <p className="mt-1 text-xs text-default-500">按教学手册和班级查看实训步骤中的验证失败与卡点学生。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ToolbarSelect
              ariaLabel="选择教学手册"
              value={selectedManualKey}
              placeholder={manuals.length === 0 ? '暂无已发布手册' : '选择教学手册'}
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
              ariaLabel="选择班级"
              value={selectedClassId ? String(selectedClassId) : ''}
              placeholder={classes.length === 0 ? '暂无班级' : '选择班级'}
              isDisabled={classes.length === 0}
              disallowEmptySelection={false}
              onChange={(value) => setSelectedClassId(Number(value) || 0)}
              options={classes.map((item) => ({ key: String(item.id), label: item.name }))}
              className="sm:w-48"
            />
            <button onClick={() => void loadAgentStepStats()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-default-200 bg-white px-4 text-sm font-semibold text-default-600 hover:bg-default-50">
              <RefreshCw className={`h-4 w-4 ${agentStatsLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-default-50 text-left text-xs font-semibold text-default-500">
              <tr>
                <th className="px-5 py-3">步骤</th>
                <th className="px-5 py-3">完成率</th>
                <th className="px-5 py-3">失败</th>
                <th className="px-5 py-3">卡点预警</th>
                <th className="px-5 py-3">最近失败</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-100">
              {agentStatsLoading ? (
                <tr><td colSpan={6}><LoadingRows /></td></tr>
              ) : agentStepStats.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-default-400">请选择已发布手册和班级查看 Agent 步骤统计。</td></tr>
              ) : agentStepStats.map((item) => {
                const loadingKey = `step-${item.stepId}-${selectedClassId}`;
                return (
                  <tr key={item.stepId} className="hover:bg-default-50/60">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">步骤 {item.stepOrder + 1}</div>
                      <div className="max-w-[280px] truncate text-xs text-default-500">{item.stepTitle}</div>
                    </td>
                    <td className="px-5 py-4 text-default-600">{item.completedCount}/{item.totalStudents} · {Math.round(item.completionRate * 100)}%</td>
                    <td className="px-5 py-4 text-default-600">{item.failedCount}</td>
                    <td className="px-5 py-4">
                      {item.strugglingCount > 0 ? (
                        <span className="rounded-full bg-danger-50 px-2.5 py-1 text-xs font-bold text-danger-700">{item.strugglingCount} 名学生连续失败 3 次以上</span>
                      ) : (
                        <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">暂无卡点</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[260px] truncate text-xs text-default-500">
                        {item.recentFailures[0]?.failureReason || '暂无失败记录'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => void generateStepInsight(item)}
                        disabled={aiDisabled || aiLoadingKey === loadingKey || item.failedCount === 0}
                        className="inline-flex items-center gap-1 rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-default-300"
                      >
                        {aiLoadingKey === loadingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        AI 诊断
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <section className="card-surface overflow-hidden rounded-xl">
          <div className="flex flex-col gap-3 border-b border-default-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold text-foreground">教学待办</h3>
              <p className="mt-1 text-xs text-default-500">共 {todoTotal} 条，点击 KPI 可快速筛选。</p>
            </div>
            <ToolbarSelect
              ariaLabel="按待办类型筛选"
              value={todoType || 'all'}
              onChange={(value) => {
                const next = value === 'all' ? '' : value as TodoItemType;
                setTodoType(next);
                void load(next, keyword);
              }}
              options={[
                { key: 'all', label: '全部待办' },
                { key: 'pending_review', label: '待批改' },
                { key: 'overdue_missing', label: '逾期未交' },
                { key: 'verification_failed', label: '验证失败' },
                { key: 'lab_failed', label: 'Lab 异常' },
              ]}
              className="lg:w-52"
            />
          </div>
          <div className="divide-y divide-default-100">
            {loading ? <LoadingRows /> : todos.length === 0 ? (
              <div className="p-10 text-center text-sm text-default-400">当前没有符合条件的教学待办。</div>
            ) : todos.map((item) => {
              const meta = todoTypeMeta[item.type] || todoTypeMeta.pending_review;
              const Icon = meta.icon;
              return (
                <div key={`${item.type}-${item.assignmentId}-${item.studentId}-${item.submissionId}`} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}><Icon className="h-3.5 w-3.5" />{meta.label}</span>
                      <span className="truncate text-sm font-bold text-foreground">{item.assignmentTitle}</span>
                    </div>
                    <div className="truncate text-sm text-default-500">{item.studentName || item.studentUsername} · {item.className || '未分班'}</div>
                    <div className="mt-2 text-xs text-default-400">截止 {formatDateTime(item.dueAt)} · 更新 {formatDateTime(item.updatedAt)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.submissionId > 0 && (
                      <button onClick={() => navigate(`/teacher/submissions/${item.submissionId}`)} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                        <Eye className="h-3.5 w-3.5" />
                        详情
                      </button>
                    )}
                    <button onClick={() => openAction({ mode: 'remind', assignmentId: item.assignmentId, studentId: item.studentId, title: item.assignmentTitle, studentName: item.studentName || item.studentUsername })} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                      <Bell className="h-3.5 w-3.5" />
                      提醒
                    </button>
                    <button onClick={() => openAction({ mode: 'reopen', assignmentId: item.assignmentId, studentId: item.studentId, title: item.assignmentTitle, studentName: item.studentName || item.studentUsername })} className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                      <RotateCcw className="h-3.5 w-3.5" />
                      重开
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-surface overflow-hidden rounded-xl">
          <div className="border-b border-default-100 px-5 py-4">
            <h3 className="font-semibold text-foreground">风险学生</h3>
            <p className="mt-1 text-xs text-default-500">按逾期、失败、低完成率和长时间无活跃识别。</p>
          </div>
          <div className="space-y-3 p-4">
            {loading ? <LoadingRows /> : risks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-default-200 p-8 text-center text-sm text-default-400">暂无风险学生。</div>
            ) : risks.map((item) => (
              <div key={`${item.studentId}-${item.classId}`} className="card-surface-muted rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{item.studentName || item.studentUsername}</div>
                    <div className="mt-1 text-xs text-default-500">{item.className} · 完成率 {Math.round(item.completionRate * 100)}%</div>
                  </div>
                  <button onClick={() => openAction({ mode: 'remind', assignmentId: 0, classId: item.classId, studentId: item.studentId, title: item.className, studentName: item.studentName || item.studentUsername })} className="rounded-lg border border-default-200 bg-white p-2 text-default-500 hover:text-primary-600" aria-label="提醒学生">
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
                  AI 诊断
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card-surface overflow-hidden rounded-xl">
        <div className="border-b border-default-100 px-5 py-4">
          <h3 className="font-semibold text-foreground">作业进度钻取</h3>
          <p className="mt-1 text-xs text-default-500">按作业和班级聚合提交、退回、评分与成绩发布。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-default-50 text-left text-xs font-semibold text-default-500">
              <tr>
                <th className="px-5 py-3">作业 / 班级</th>
                <th className="px-5 py-3">提交</th>
                <th className="px-5 py-3">待批改</th>
                <th className="px-5 py-3">退回</th>
                <th className="px-5 py-3">成绩</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-100">
              {progress.map((item) => (
                <tr key={`${item.assignmentId}-${item.classId}`} className="hover:bg-default-50/60">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-foreground">{item.assignmentTitle}</div>
                    <div className="text-xs text-default-400">{item.className} · 截止 {formatDateTime(item.dueAt)}</div>
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
                      AI 摘要
                    </button>
                    <button onClick={() => openAction({ mode: 'remind', assignmentId: item.assignmentId, classId: item.classId, title: item.assignmentTitle })} className="inline-flex items-center gap-1 rounded-xl border border-default-200 px-3 py-2 text-xs font-bold text-default-600 hover:bg-default-50">
                      <UsersRound className="h-3.5 w-3.5" />
                      班级提醒
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && progress.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-default-400">暂无作业进度数据。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface overflow-hidden rounded-xl">
        <div className="flex items-center justify-between gap-4 border-b border-default-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-foreground">班级 Lab 异常</h3>
            <p className="mt-1 text-xs text-default-500">只读展示班级实训运行异常，治理操作由管理员在运维工作台处理。</p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700">{overview?.labFailed || 0} 条</span>
        </div>
        <div className="space-y-3 p-5">
          {loading ? (
            <LoadingRows />
          ) : (overview?.labFailed || 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-default-200 p-8 text-center text-sm text-default-400">当前没有需要教师关注的班级 Lab 异常。</div>
          ) : (
            <>
              {todos.filter((item) => item.type === 'lab_failed').slice(0, 4).map((item) => (
                <div key={`lab-${item.assignmentId}-${item.studentId}`} className="card-surface-muted rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{item.assignmentTitle}</div>
                      <div className="mt-1 text-xs text-default-500">{item.className || '未分班'} · {item.studentName || item.studentUsername}</div>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">Lab 异常</span>
                  </div>
                </div>
              ))}
              {todos.filter((item) => item.type === 'lab_failed').length === 0 && (
                <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-700">检测到 Lab 异常，请点击上方 KPI 切换到 Lab 异常待办查看详情。</div>
              )}
            </>
          )}
        </div>
      </section>

      <PageDialog isOpen={Boolean(actionTarget)} onClose={() => setActionTarget(null)} panelClassName="max-w-lg">
        <div className="border-b border-default-100 p-5">
          <h3 className="text-lg font-bold text-foreground">{actionTarget?.mode === 'reopen' ? '重开提交' : '发送提醒'}</h3>
          <p className="mt-1 text-sm text-default-500">{actionTarget?.studentName ? `对象：${actionTarget.studentName}` : '对象：当前班级学生'} · {actionTarget?.title}</p>
        </div>
        <div className="space-y-3 p-5">
          <textarea value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} rows={4} className="w-full rounded-xl border border-default-200 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>
        <div className="flex justify-end gap-2 border-t border-default-100 p-5">
          <button onClick={() => setActionTarget(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-default-500 hover:bg-default-100">取消</button>
          <button onClick={() => void submitAction()} disabled={submittingAction} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:bg-default-300">
            {submittingAction && <Loader2 className="h-4 w-4 animate-spin" />}
            确认
          </button>
        </div>
      </PageDialog>

      <PageDialog isOpen={Boolean(aiSuggestion)} onClose={() => setAISuggestion(null)} panelClassName="max-w-2xl">
        <div className="border-b border-default-100 p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-bold text-foreground">{aiSuggestion?.title || 'AI 建议'}</h3>
          </div>
          <p className="mt-1 text-sm text-default-500">仅教师可见，确认后仍需由教师决定下一步操作。</p>
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
            关闭
          </button>
          <button
            onClick={() => void handleAISuggestionAction('dismiss')}
            disabled={Boolean(aiSuggestionAction) || aiSuggestion?.status !== 'pending'}
            className="inline-flex items-center gap-2 rounded-xl border border-default-200 px-4 py-2 text-sm font-bold text-default-600 hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiSuggestionAction === 'dismiss' && <Loader2 className="h-4 w-4 animate-spin" />}
            忽略
          </button>
          <button
            onClick={() => void handleAISuggestionAction('confirm')}
            disabled={Boolean(aiSuggestionAction) || aiSuggestion?.status !== 'pending'}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-default-300"
          >
            {aiSuggestionAction === 'confirm' && <Loader2 className="h-4 w-4 animate-spin" />}
            确认采用
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

export default TeacherDashboard;
