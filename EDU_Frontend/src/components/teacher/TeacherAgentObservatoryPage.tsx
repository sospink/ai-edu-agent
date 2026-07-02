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
import { useTranslation } from 'react-i18next';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { getCurrentLocale } from '@/i18n';
import type { TFunction } from 'i18next';

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
  const { t } = useTranslation('teacherAgentObservatory');
  const { toast, hideToast, success, error: showError } = useToast();
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
      setError(err instanceof Error ? err.message : t('loadFailed'));
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
    ? t('noManuals')
    : classes.length === 0
      ? t('noClasses')
      : !manualId
        ? t('selectManualReason')
        : !classId
          ? t('selectClassReason')
          : data && data.students.length === 0
            ? t('noStudents')
            : data && data.steps.length === 0
              ? t('noSteps')
              : t('noData');

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
    if (res.data) { setSuggestion(res.data); success(t('faqGenerated')); } else { showError(res.error || t('faqGenerateFailed')); }
  };

  const publishFAQ = async () => {
    if (!suggestion) return;
    setSuggestionLoading(true);
    const res = await teacherAssignmentApi.publishFAQ(suggestion.id, classId);
    setSuggestionLoading(false);
    if (!res.error) {
      setSuggestion(null);
      success(t('faqPublished'));
      if (selectedCell) await loadCellContext(selectedCell);
    } else showError(res.error || t('faqPublishFailed'));
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
      success(t('interventionCreated'));
      if (selectedCell) await loadCellContext(selectedCell);
    } else showError(res.error || t('interventionFailed'));
  };

  const archiveFAQ = async (id: number) => {
    const res = await teacherAssignmentApi.archiveFAQ(id);
    if (!res.error && selectedCell) {
      success(t('faqArchived'));
      await loadCellContext(selectedCell);
    } else if (res.error) showError(res.error || t('faqArchiveFailed'));
  };

  return (
    <div className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Bot className="h-4 w-4" />
            {t('agentObservatory', { ns: 'uiReview' })}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{t('title')}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <ToolbarSelect
            ariaLabel={t('selectManual')}
            value={manualId ? String(manualId) : ''}
            placeholder={t('selectManual')}
            disallowEmptySelection={false}
            onChange={(value) => setManualId(Number(value) || 0)}
            options={manuals.map((manual) => ({ key: String(manual.id), label: manual.title }))}
            className="w-56"
          />
          <ToolbarSelect
            ariaLabel={t('selectClass')}
            value={classId ? String(classId) : ''}
            placeholder={t('selectClass')}
            disallowEmptySelection={false}
            onChange={(value) => setClassId(Number(value) || 0)}
            options={classes.map((item) => ({ key: String(item.id), label: item.name }))}
            className="w-52"
          />
          <button onClick={() => void loadObservatory()} disabled={!manualId || !classId || loading} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('refresh')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          [t('totalStudents'), data?.summary.totalStudents || 0],
          [t('completed'), data?.summary.completedCount || 0],
          [t('activeStudents'), data?.summary.activeCount || 0],
          [t('averageCompletion'), `${Math.round((data?.summary.avgCompletionRate || 0) * 100)}%`],
          [t('aiUsage'), data?.summary.aiUsageCount || 0],
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
            <h2 className="font-semibold text-foreground">{t('heatmap')}</h2>
            <div className="flex flex-wrap justify-end gap-2 text-xs text-default-500">
              {(['green', 'yellow', 'orange', 'red', 'gray'] as const).map(status => <span key={status}>{t('legend', { color: t(`colors.${status}`), status: t(`statuses.${status}`) })}</span>)}
            </div>
          </div>
          {loading ? (
            <div className="flex h-64 items-center justify-center text-default-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
          ) : !data || data.students.length === 0 || data.steps.length === 0 ? (
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-default-500">{emptyReason}</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-default-400">{t('heatmapHelp')}</div>
              <div className="max-w-full overflow-x-auto overflow-y-hidden pb-3 [scrollbar-gutter:stable]">
                <div
                  className="grid min-w-max gap-2"
                  style={{ gridTemplateColumns: `${HEATMAP_NAME_COLUMN_WIDTH}px repeat(${data.steps.length}, ${HEATMAP_STEP_COLUMN_WIDTH}px)` }}
                >
                  <div className="sticky left-0 z-20 flex items-end bg-white/95 px-2 pb-2 text-xs font-semibold text-default-400 backdrop-blur">
                    {t('studentStep')}
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
            <div className="mb-3 flex items-center gap-2 font-semibold text-foreground"><Tags className="h-4 w-4" />{t('weakness')}</div>
            {weakness.length === 0 ? (
              <div className="text-sm text-default-500">{t('noTags')}</div>
            ) : weakness.slice(0, 5).map(item => (
              <div key={item.skillTag} className="border-b border-default-100 py-3 last:border-0">
                <div className="font-medium text-default-800">{item.skillTag}</div>
                <div className="mt-1 text-xs text-default-500">{t('weaknessMetrics', { failure: Math.round(item.failureRate * 100), stuck: item.stuckStudentCount, completion: Math.round(item.completionRate * 100) })}</div>
              </div>
            ))}
          </div>
          <div className="card-surface rounded-lg p-4">
            <div className="mb-3 font-semibold text-foreground">{t('riskStudents')}</div>
            {(data?.riskStudents || []).slice(0, 6).map(item => (
              <div key={item.studentId} className="flex items-center justify-between border-b border-default-100 py-2 text-sm last:border-0">
                <span>{item.name}</span>
                <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger-600">{t('stuckSteps', { count: item.stuckStepCount })}</span>
              </div>
            ))}
            {(data?.riskStudents || []).length === 0 && <div className="text-sm text-default-500">{t('noRisk')}</div>}
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
              <Metric label={t('status')} value={t(`statuses.${selectedCell.status}`)} />
              <Metric label={t('attempts')} value={selectedCell.attemptCount} />
              <Metric label={t('failures')} value={selectedCell.failCount} />
            </div>
          )}
          <div className="space-y-3">
            <button onClick={generateFAQ} disabled={suggestionLoading || !selectedCell} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {suggestionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              {t('generateFAQ')}
            </button>
            <button onClick={() => setInterventionOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-warning-100 px-4 py-2 text-sm font-semibold text-warning-700">
              <Bell className="h-4 w-4" />
              {t('createIntervention')}
            </button>
          </div>
          {detailLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-default-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('detailLoading')}</div>
          ) : (
            <>
              {cellDetail?.suggestedActions.length ? (
                <Section title={t('suggestedActions')}>
                  <div className="flex flex-wrap gap-2">
                    {cellDetail.suggestedActions.map(action => (
                      <span key={action} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{actionLabel(action, t)}</span>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title={t('recentVerification')}>
                {cellDetail?.attempts.length ? cellDetail.attempts.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className={item.success ? 'font-semibold text-success-600' : 'font-semibold text-danger-600'}>{item.success ? t('statuses.passed') : t('statuses.failed')}</div>
                    {item.failureReason && <div className="mt-1 text-default-600">{item.failureReason}</div>}
                    <div className="mt-1 text-xs text-default-400">{formatTime(item.createdAt)}</div>
                  </div>
                )) : <EmptyText text={t('noVerification')} />}
              </Section>

              <Section title={t('recentMessages')}>
                {cellDetail?.recentMessages.length ? cellDetail.recentMessages.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-default-500">{item.role}</div>
                    <div className="mt-1 whitespace-pre-wrap text-default-700">{item.content}</div>
                  </div>
                )) : <EmptyText text={t('noMessages')} />}
              </Section>

              <Section title={t('terminalSummary')}>
                {cellDetail?.terminalEvents.length ? cellDetail.terminalEvents.map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-default-950 p-3 font-mono text-xs text-default-100">
                    <div>$ {item.command}</div>
                    <div className="mt-2 whitespace-pre-wrap text-default-300">{item.outputSummary}</div>
                    <div className="mt-2 text-default-500">{t('exitCode', { ns: 'uiReview' })} {item.exitCode}</div>
                  </div>
                )) : <EmptyText text={t('noTerminal')} />}
              </Section>

              <Section title={t('faqManagement')}>
                {faqList.length ? faqList.map(item => (
                  <div key={item.id} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-default-800">{item.question}</div>
                        <div className="mt-1 whitespace-pre-wrap text-default-600">{item.answer}</div>
                        <div className="mt-2 text-xs text-default-400">{t(`statuses.${item.status}`, { defaultValue: item.status })}</div>
                      </div>
                      {item.status === 'published' && (
                        <button onClick={() => void archiveFAQ(item.id)} className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-default-600 hover:bg-default-100">{t('archive')}</button>
                      )}
                    </div>
                  </div>
                )) : <EmptyText text={t('noFAQ')} />}
              </Section>

              <Section title={t('interventions')}>
                {interventionList.length ? interventionList.map(item => (
                  <div key={item.id} className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-default-800">{item.title}</div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-default-500">{t(`statuses.${item.status}`, { defaultValue: item.status })}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-default-600">{item.content}</div>
                    <div className="mt-2 text-xs text-default-400">{interventionLabel(item.actionType, t)}</div>
                  </div>
                )) : <EmptyText text={t('noInterventions')} />}
              </Section>

              <Section title={t('reflectionCard')}>
                {reflection ? (
                  <div className="rounded-lg bg-default-50 p-3 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-default-800"><FileText className="h-4 w-4" />{t('reflection')}</div>
                    <div className="mt-2 whitespace-pre-wrap text-default-600">{reflection.summary}</div>
                  </div>
                ) : <EmptyText text={t('noReflection')} />}
              </Section>

              <div className="rounded-lg bg-default-50 p-4 text-sm text-default-600">
                {t('tagHelp')}
              </div>
            </>
          )}
        </div>
      </PageDrawer>

      <PageDialog isOpen={Boolean(suggestion)} onClose={() => setSuggestion(null)} panelClassName="max-w-xl">
        <div className="space-y-4 p-6">
          <h3 className="text-lg font-bold">{t('faqDraft')}</h3>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-default-50 p-4 text-sm whitespace-pre-wrap">{suggestion?.content}</div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSuggestion(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-default-600 hover:bg-default-100">{t('cancel')}</button>
            <button onClick={publishFAQ} disabled={suggestionLoading} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('publishFAQ')}</button>
          </div>
        </div>
      </PageDialog>

      <PageDialog isOpen={interventionOpen} onClose={() => setInterventionOpen(false)} panelClassName="max-w-xl">
        <div className="space-y-4 p-6">
          <h3 className="text-lg font-bold">{t('createIntervention')}</h3>
          <ToolbarSelect
            ariaLabel={t('interventionType')}
            value={interventionForm.actionType}
            onChange={(value) => setInterventionForm(prev => ({ ...prev, actionType: value as typeof prev.actionType }))}
            options={[
              { key: 'student_reminder', label: t('remindStudent') },
              { key: 'class_broadcast', label: t('broadcast') },
              { key: 'material_note', label: t('note') },
            ]}
          />
          <input value={interventionForm.title} onChange={event => setInterventionForm(prev => ({ ...prev, title: event.target.value }))} placeholder={t('formTitle')} className="h-10 w-full rounded-lg border border-default-200 px-3 text-sm" />
          <textarea value={interventionForm.content} onChange={event => setInterventionForm(prev => ({ ...prev, content: event.target.value }))} placeholder={t('content')} rows={5} className="w-full rounded-lg border border-default-200 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setInterventionOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-default-600 hover:bg-default-100">{t('cancel')}</button>
            <button onClick={sendIntervention} disabled={interventionSending || !interventionForm.title || !interventionForm.content} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {interventionForm.actionType === 'class_broadcast' ? <Megaphone className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {t('send')}
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

const actionLabel = (action: string, t: TFunction) => {
  if (action === 'student_reminder') return t('actions.studentReminder');
  if (action === 'class_broadcast') return t('actions.classBroadcast');
  if (action === 'waiting_student_response') return t('actions.waitingStudentResponse');
  return action;
};

const interventionLabel = (actionType: string, t: TFunction) => {
  if (actionType === 'student_reminder') return t('actions.studentReminder');
  if (actionType === 'class_broadcast') return t('actions.classBroadcast');
  if (actionType === 'material_note') return t('actions.materialNote');
  return actionType;
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString(getCurrentLocale());
};

export default TeacherAgentObservatoryPage;
