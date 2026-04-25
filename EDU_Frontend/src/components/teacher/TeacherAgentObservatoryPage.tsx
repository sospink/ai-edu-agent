import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Bot, FileText, Loader2, Megaphone, MessageSquarePlus, RefreshCw, Send, Tags } from 'lucide-react';
import PageDrawer from '@/components/common/PageDrawer';
import PageDialog from '@/components/common/PageDialog';
import { ToolbarSelect } from '@/components/common/ToolbarControls';
import {
  teacherAssignmentApi,
  type AgentCellDetailResponse,
  type AgentFAQItem,
  type AgentHeatmapCell,
  type AgentInterventionRecord,
  type AgentObservatoryResponse,
  type AgentReflectionCard,
  type AgentSkillWeaknessItem,
  type AISuggestion,
} from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import { teacherManualApi, type TeacherManualListItem } from '@/services/teacherManual';
import type { ClassItem } from '@/services/classroom';

const statusClass: Record<AgentHeatmapCell['status'], string> = {
  green: 'bg-success-500',
  yellow: 'bg-warning-400',
  orange: 'bg-orange-500',
  red: 'bg-danger-500',
  gray: 'bg-default-200',
};

const HEATMAP_NAME_COLUMN_WIDTH = 176;
const HEATMAP_STEP_COLUMN_WIDTH = 92;

const TeacherAgentObservatoryPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [manuals, setManuals] = useState<TeacherManualListItem[]>([]);
  const [classId, setClassId] = useState<number>(0);
  const [manualId, setManualId] = useState<number>(0);
  const [data, setData] = useState<AgentObservatoryResponse | null>(null);
  const [weakness, setWeakness] = useState<AgentSkillWeaknessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCell, setSelectedCell] = useState<AgentHeatmapCell | null>(null);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionSending, setInterventionSending] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cellDetail, setCellDetail] = useState<AgentCellDetailResponse | null>(null);
  const [faqList, setFaqList] = useState<AgentFAQItem[]>([]);
  const [interventionList, setInterventionList] = useState<AgentInterventionRecord[]>([]);
  const [reflection, setReflection] = useState<AgentReflectionCard | null>(null);
  const [interventionForm, setInterventionForm] = useState({ actionType: 'student_reminder' as 'student_reminder' | 'class_broadcast' | 'material_note', title: '', content: '' });

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (classId && manualId) void loadObservatory();
  }, [classId, manualId]);

  useEffect(() => {
    if (selectedCell) void loadCellContext(selectedCell);
  }, [selectedCell, manualId, classId]);

  const bootstrap = async () => {
    const [classRes, manualRes] = await Promise.all([
      teacherClassApi.getList({ page: 1, pageSize: 100 }),
      teacherManualApi.list({ page: 1, pageSize: 100 }),
    ]);
    const nextClasses = classRes.data?.list || [];
    const nextManuals = manualRes.data?.list || [];
    setClasses(nextClasses);
    setManuals(nextManuals);
    setClassId(nextClasses[0]?.id || 0);
    setManualId(nextManuals[0]?.id || 0);
  };

  const loadObservatory = async () => {
    setLoading(true);
    setError('');
    try {
      const [obsRes, weaknessRes] = await Promise.all([
        teacherAssignmentApi.agentObservatory({ manualId, classId }),
        teacherAssignmentApi.agentSkillWeakness({ manualId, classId }),
      ]);
      if (obsRes.error) throw new Error(obsRes.error);
      setData(obsRes.data || null);
      setWeakness(weaknessRes.data || []);
      if (selectedCell) void loadCellContext(selectedCell);
    } catch (err) {
      setData(null);
      setWeakness([]);
      setError(err instanceof Error ? err.message : '加载观察台失败');
    } finally {
      setLoading(false);
    }
  };

  const cellMap = useMemo(() => {
    const map = new Map<string, AgentHeatmapCell>();
    data?.heatmap.forEach(cell => map.set(`${cell.studentId}:${cell.stepId}`, cell));
    return map;
  }, [data]);

  const selectedStep = data?.steps.find(step => step.stepId === selectedCell?.stepId);
  const selectedStudent = data?.students.find(student => student.studentId === selectedCell?.studentId);
  const emptyReason = manuals.length === 0
    ? '暂无可观察手册。请先在“实训手册”中创建手册，或通过作业把手册分配给当前任教班级。'
    : classes.length === 0
      ? '暂无任教班级。请先在班级管理中加入或创建班级。'
      : !manualId
        ? '请选择要观察的 Agent 手册。'
        : !classId
          ? '请选择要观察的班级。'
          : data && data.students.length === 0
            ? '当前班级暂无活跃学生。请先把学生加入班级。'
            : data && data.steps.length === 0
              ? '当前手册还没有步骤。请先在手册编辑中维护步骤。'
              : '暂无可观察数据';

  const loadCellContext = async (cell: AgentHeatmapCell) => {
    setDetailLoading(true);
    try {
      const [detailRes, faqRes, interventionRes, reflectionRes] = await Promise.all([
        teacherAssignmentApi.agentCellDetail({ manualId, classId, studentId: cell.studentId, stepId: cell.stepId }),
        teacherAssignmentApi.agentFAQ({ manualId, classId, stepId: cell.stepId, status: 'all' }),
        teacherAssignmentApi.agentInterventions({ manualId, classId, stepId: cell.stepId }),
        teacherAssignmentApi.reflectionCard(cell.studentId, manualId),
      ]);
      setCellDetail(detailRes.data || null);
      setFaqList(faqRes.data || []);
      setInterventionList(interventionRes.data || []);
      setReflection(reflectionRes.error ? null : reflectionRes.data || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const generateFAQ = async () => {
    if (!selectedCell) return;
    setSuggestionLoading(true);
    const res = await teacherAssignmentApi.agentFAQSuggestion(selectedCell.stepId, classId);
    setSuggestionLoading(false);
    if (res.data) setSuggestion(res.data);
  };

  const publishFAQ = async () => {
    if (!suggestion) return;
    setSuggestionLoading(true);
    const res = await teacherAssignmentApi.publishFAQ(suggestion.id, classId);
    setSuggestionLoading(false);
    if (!res.error) {
      setSuggestion(null);
      if (selectedCell) await loadCellContext(selectedCell);
    }
  };

  const sendIntervention = async () => {
    setInterventionSending(true);
    const res = await teacherAssignmentApi.createAgentIntervention({
      manualId,
      classId,
      stepId: selectedCell?.stepId || 0,
      studentId: selectedCell?.studentId || 0,
      actionType: interventionForm.actionType,
      title: interventionForm.title,
      content: interventionForm.content,
    });
    setInterventionSending(false);
    if (!res.error) {
      setInterventionOpen(false);
      setInterventionForm({ actionType: 'student_reminder', title: '', content: '' });
      if (selectedCell) await loadCellContext(selectedCell);
    }
  };

  const archiveFAQ = async (id: number) => {
    const res = await teacherAssignmentApi.archiveFAQ(id);
    if (!res.error && selectedCell) {
      await loadCellContext(selectedCell);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Bot className="h-4 w-4" />
            Agent Observatory
          </div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Agent 观察台</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <ToolbarSelect
            ariaLabel="选择手册"
            value={manualId ? String(manualId) : ''}
            placeholder="选择手册"
            disallowEmptySelection={false}
            onChange={(value) => setManualId(Number(value) || 0)}
            options={manuals.map((manual) => ({ key: String(manual.id), label: manual.title }))}
            className="w-56"
          />
          <ToolbarSelect
            ariaLabel="选择班级"
            value={classId ? String(classId) : ''}
            placeholder="选择班级"
            disallowEmptySelection={false}
            onChange={(value) => setClassId(Number(value) || 0)}
            options={classes.map((item) => ({ key: String(item.id), label: item.name }))}
            className="w-52"
          />
          <button onClick={() => void loadObservatory()} disabled={!manualId || !classId || loading} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['学生数', data?.summary.totalStudents || 0],
          ['已完成', data?.summary.completedCount || 0],
          ['活跃学生', data?.summary.activeCount || 0],
          ['平均完成率', `${Math.round((data?.summary.avgCompletionRate || 0) * 100)}%`],
          ['AI 使用', data?.summary.aiUsageCount || 0],
        ].map(([label, value]) => (
          <div key={label} className="card-surface rounded-lg p-4">
            <div className="text-xs font-medium text-default-500">{label}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card-surface min-w-0 overflow-hidden rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">步骤热力图</h2>
            <div className="flex flex-wrap justify-end gap-2 text-xs text-default-500">
              <span>绿 自主完成</span><span>黄 AI 辅助</span><span>橙 探索中</span><span>红 卡住</span><span>灰 未开始</span>
            </div>
          </div>
          {loading ? (
            <div className="flex h-64 items-center justify-center text-default-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载中</div>
          ) : !data || data.students.length === 0 || data.steps.length === 0 ? (
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-default-500">{emptyReason}</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-default-400">步骤较多时可左右滚动查看全部列，左侧学生列会固定显示。</div>
              <div className="max-w-full overflow-x-auto overflow-y-hidden pb-3 [scrollbar-gutter:stable]">
                <div
                  className="grid min-w-max gap-2"
                  style={{ gridTemplateColumns: `${HEATMAP_NAME_COLUMN_WIDTH}px repeat(${data.steps.length}, ${HEATMAP_STEP_COLUMN_WIDTH}px)` }}
                >
                  <div className="sticky left-0 z-20 flex items-end bg-white/95 px-2 pb-2 text-xs font-semibold text-default-400 backdrop-blur">
                    学生 / 步骤
                  </div>
                  {data.steps.map(step => (
                    <div
                      key={step.stepId}
                      className="flex h-16 items-end justify-center rounded-lg bg-default-50 px-2 pb-2 text-center"
                      title={step.title}
                    >
                      <div className="line-clamp-2 text-[11px] font-semibold leading-4 text-default-500">
                        {step.title}
                      </div>
                    </div>
                  ))}
                {data.students.map(student => (
                  <React.Fragment key={student.studentId}>
                    <div className="sticky left-0 z-10 flex h-10 items-center rounded-lg bg-white/95 px-4 text-sm font-medium text-default-700 shadow-[8px_0_18px_-18px_rgba(15,23,42,0.28)] backdrop-blur">
                      <span className="truncate">{student.name}</span>
                    </div>
                    {data.steps.map(step => {
                      const cell = cellMap.get(`${student.studentId}:${step.stepId}`);
                      return (
                        <button
                          key={step.stepId}
                          onClick={() => cell && setSelectedCell(cell)}
                          className={`h-10 rounded-lg ${cell ? statusClass[cell.status] : 'bg-default-100'} transition hover:scale-[1.02]`}
                          title={`${student.name} - ${step.title}`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card-surface rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-foreground"><Tags className="h-4 w-4" />薄弱点 Top 5</div>
            {weakness.length === 0 ? (
              <div className="text-sm text-default-500">还没有维护 skill tags。</div>
            ) : weakness.slice(0, 5).map(item => (
              <div key={item.skillTag} className="border-b border-default-100 py-3 last:border-0">
                <div className="font-medium text-default-800">{item.skillTag}</div>
                <div className="mt-1 text-xs text-default-500">失败率 {Math.round(item.failureRate * 100)}% · 卡点 {item.stuckStudentCount} 人 · 完成率 {Math.round(item.completionRate * 100)}%</div>
              </div>
            ))}
          </div>
          <div className="card-surface rounded-lg p-4">
            <div className="mb-3 font-semibold text-foreground">风险学生</div>
            {(data?.riskStudents || []).slice(0, 6).map(item => (
              <div key={item.studentId} className="flex items-center justify-between border-b border-default-100 py-2 text-sm last:border-0">
                <span>{item.name}</span>
                <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger-600">{item.stuckStepCount} 步</span>
              </div>
            ))}
            {(data?.riskStudents || []).length === 0 && <div className="text-sm text-default-500">暂无高风险学生。</div>}
          </div>
        </div>
      </div>

      <PageDrawer isOpen={Boolean(selectedCell)} onClose={() => setSelectedCell(null)} panelClassName="max-w-lg">
        <div className="space-y-5 p-6">
          <div>
            <div className="text-sm text-default-500">{selectedStudent?.name}</div>
            <h3 className="text-xl font-bold text-foreground">{selectedStep?.title}</h3>
          </div>
          {selectedCell && (
            <div className="grid grid-cols-3 gap-3">
              <Metric label="状态" value={selectedCell.status} />
              <Metric label="验证" value={selectedCell.attemptCount} />
              <Metric label="失败" value={selectedCell.failCount} />
            </div>
          )}
          <div className="space-y-3">
            <button onClick={generateFAQ} disabled={suggestionLoading || !selectedCell} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {suggestionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              生成 FAQ 草稿
            </button>
            <button onClick={() => setInterventionOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-warning-100 px-4 py-2 text-sm font-semibold text-warning-700">
              <Bell className="h-4 w-4" />
              创建干预
            </button>
          </div>
          {detailLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-default-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载详情</div>
          ) : (
            <>
              {cellDetail?.suggestedActions.length ? (
                <Section title="建议动作">
                  <div className="flex flex-wrap gap-2">
                    {cellDetail.suggestedActions.map(action => (
                      <span key={action} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{actionLabel(action)}</span>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="最近验证">
                {cellDetail?.attempts.length ? cellDetail.attempts.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className={item.success ? 'font-semibold text-success-600' : 'font-semibold text-danger-600'}>{item.success ? '通过' : '失败'}</div>
                    {item.failureReason && <div className="mt-1 text-default-600">{item.failureReason}</div>}
                    <div className="mt-1 text-xs text-default-400">{formatTime(item.createdAt)}</div>
                  </div>
                )) : <EmptyText text="暂无验证记录" />}
              </Section>

              <Section title="最近对话">
                {cellDetail?.recentMessages.length ? cellDetail.recentMessages.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-default-500">{item.role}</div>
                    <div className="mt-1 whitespace-pre-wrap text-default-700">{item.content}</div>
                  </div>
                )) : <EmptyText text="暂无对话记录" />}
              </Section>

              <Section title="终端摘要">
                {cellDetail?.terminalEvents.length ? cellDetail.terminalEvents.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-950 p-3 font-mono text-xs text-default-100">
                    <div>$ {item.command}</div>
                    <div className="mt-2 whitespace-pre-wrap text-default-300">{item.outputSummary}</div>
                    <div className="mt-2 text-default-500">exit {item.exitCode}</div>
                  </div>
                )) : <EmptyText text="暂无终端记录" />}
              </Section>

              <Section title="FAQ 管理">
                {faqList.length ? faqList.map(item => (
                  <div key={item.id} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-default-800">{item.question}</div>
                        <div className="mt-1 whitespace-pre-wrap text-default-600">{item.answer}</div>
                        <div className="mt-2 text-xs text-default-400">{item.status}</div>
                      </div>
                      {item.status === 'published' && (
                        <button onClick={() => void archiveFAQ(item.id)} className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-default-600 hover:bg-default-100">归档</button>
                      )}
                    </div>
                  </div>
                )) : <EmptyText text="当前步骤暂无 FAQ" />}
              </Section>

              <Section title="干预记录">
                {interventionList.length ? interventionList.map(item => (
                  <div key={item.id} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-default-800">{item.title}</div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-default-500">{item.status}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-default-600">{item.content}</div>
                    <div className="mt-2 text-xs text-default-400">{interventionLabel(item.actionType)}</div>
                  </div>
                )) : <EmptyText text="暂无干预记录" />}
              </Section>

              <Section title="复盘卡片">
                {reflection ? (
                  <div className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-default-800"><FileText className="h-4 w-4" />学习复盘</div>
                    <div className="mt-2 whitespace-pre-wrap text-default-600">{reflection.summary}</div>
                  </div>
                ) : <EmptyText text="学生暂未生成复盘" />}
              </Section>

              <div className="rounded-lg bg-default-50 p-4 text-sm text-default-600">
                技能标签请在手册步骤编辑中维护，观察台会自动使用已保存的 skill tags 计算薄弱点。
              </div>
            </>
          )}
        </div>
      </PageDrawer>

      <PageDialog isOpen={Boolean(suggestion)} onClose={() => setSuggestion(null)} panelClassName="max-w-xl">
        <div className="space-y-4 p-6">
          <h3 className="text-lg font-bold">FAQ 草稿</h3>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-default-50 p-4 text-sm whitespace-pre-wrap">{suggestion?.content}</div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSuggestion(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-default-600 hover:bg-default-100">取消</button>
            <button onClick={publishFAQ} disabled={suggestionLoading} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">发布 FAQ</button>
          </div>
        </div>
      </PageDialog>

      <PageDialog isOpen={interventionOpen} onClose={() => setInterventionOpen(false)} panelClassName="max-w-xl">
        <div className="space-y-4 p-6">
          <h3 className="text-lg font-bold">创建干预</h3>
          <ToolbarSelect
            ariaLabel="干预类型"
            value={interventionForm.actionType}
            onChange={(value) => setInterventionForm(prev => ({ ...prev, actionType: value as typeof prev.actionType }))}
            options={[
              { key: 'student_reminder', label: '提醒当前学生' },
              { key: 'class_broadcast', label: '全班广播' },
              { key: 'material_note', label: '备课备注' },
            ]}
          />
          <input value={interventionForm.title} onChange={event => setInterventionForm(prev => ({ ...prev, title: event.target.value }))} placeholder="标题" className="h-10 w-full rounded-lg border border-default-200 px-3 text-sm" />
          <textarea value={interventionForm.content} onChange={event => setInterventionForm(prev => ({ ...prev, content: event.target.value }))} placeholder="内容" rows={5} className="w-full rounded-lg border border-default-200 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setInterventionOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-default-600 hover:bg-default-100">取消</button>
            <button onClick={sendIntervention} disabled={interventionSending || !interventionForm.title || !interventionForm.content} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {interventionForm.actionType === 'class_broadcast' ? <Megaphone className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              发送
            </button>
          </div>
        </div>
      </PageDialog>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg bg-default-50 p-3">
    <div className="text-xs text-default-500">{label}</div>
    <div className="mt-1 font-bold text-foreground">{value}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold text-default-700">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

const EmptyText: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-lg bg-default-50 px-3 py-4 text-sm text-default-500">{text}</div>
);

const actionLabel = (action: string) => {
  if (action === 'student_reminder') return '提醒学生';
  if (action === 'class_broadcast') return '全班广播';
  if (action === 'waiting_student_response') return '等待学生回应';
  return action;
};

const interventionLabel = (actionType: string) => {
  if (actionType === 'student_reminder') return '学生提醒';
  if (actionType === 'class_broadcast') return '全班广播';
  if (actionType === 'material_note') return '备课备注';
  return actionType;
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};

export default TeacherAgentObservatoryPage;
