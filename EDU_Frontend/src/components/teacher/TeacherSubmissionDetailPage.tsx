import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, Bot, CheckCircle2, FileCheck, Loader2, RefreshCw, RotateCcw, Send, Sparkles, Undo2, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { teacherAssignmentApi, type AISuggestion, type AIStatus, type SubmissionCheck, type SubmissionDetail } from '@/services/assignment';
import { useTranslation } from 'react-i18next';
import { getCurrentLocale } from '@/i18n';

const TeacherSubmissionDetailPage: React.FC = () => {
  const { t } = useTranslation('teacherSubmissionDetail');
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [command, setCommand] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [aiDraft, setAIDraft] = useState<AISuggestion | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const [feedbackSuggestionId, setFeedbackSuggestionId] = useState<number | undefined>();
  const [returnSuggestionId, setReturnSuggestionId] = useState<number | undefined>();
  const { toast, hideToast, success, error: showError } = useToast();

  const submissionId = Number(id);

  const loadDetail = async () => {
    if (!submissionId) return;
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.getSubmission(submissionId);
    if (response.success && response.data) {
      setDetail(response.data);
      const nextScores: Record<number, string> = {};
      response.data.rubric.items.forEach((item) => {
        const existing = response.data?.grade?.rubricScores?.find((score) => score.rubricItemId === item.id);
        nextScores[item.id] = String(existing?.score ?? '');
      });
      setScores(nextScores);
      setFeedback(response.data.feedback?.content || '');
      setReturnFeedback(response.data.feedback?.content || '');
    } else {
      setDetail(null);
      setError(response.error || t('loadFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDetail();
    void loadAIStatus();
  }, [submissionId]);

  const loadAIStatus = async () => {
    const response = await teacherAssignmentApi.aiStatus();
    if (response.success && response.data) {
      setAIStatus(response.data);
    }
  };

  const totalScore = useMemo(() => {
    if (!detail) return 0;
    return detail.rubric.items.reduce((sum, item) => sum + Math.min(Number(scores[item.id]) || 0, item.maxScore), 0);
  }, [detail, scores]);

  const runChecks = async () => {
    if (!detail) return;
    setSaving(true);
    const response = await teacherAssignmentApi.runChecks(detail.id, command);
    setSaving(false);
    if (response.success && response.data) {
      setDetail(response.data);
      setCommand('');
      success(t('checksRecorded'));
    } else {
      showError(response.error || t('checksFailed'));
    }
  };

  const saveGrade = async () => {
    if (!detail) return;
    setSaving(true);
    const response = await teacherAssignmentApi.gradeSubmission(detail.id, {
      scores: detail.rubric.items.map((item) => ({ rubricItemId: item.id, score: Number(scores[item.id]) || 0 })),
      feedback,
      aiSuggestionId: feedbackSuggestionId,
    });
    setSaving(false);
    if (response.success && response.data) {
      setDetail(response.data);
      setFeedbackSuggestionId(undefined);
      if (feedbackSuggestionId) setAIDraft(null);
      success(t('gradeSaved'));
    } else {
      showError(response.error || t('gradeSaveFailed'));
    }
  };

  const returnSubmission = async () => {
    if (!detail) return;
    setSaving(true);
    const response = await teacherAssignmentApi.returnSubmission(detail.id, returnFeedback || t('defaultReturnFeedback'), returnSuggestionId);
    setSaving(false);
    if (response.success && response.data) {
      setDetail(response.data);
      setReturnSuggestionId(undefined);
      if (returnSuggestionId) setAIDraft(null);
      success(t('returned'));
    } else {
      showError(response.error || t('returnFailed'));
    }
  };

  const generateAIDraft = async () => {
    if (!detail) return;
    setAILoading(true);
    const response = await teacherAssignmentApi.suggestFeedback(detail.id);
    setAILoading(false);
    if (response.success && response.data) {
      setAIDraft(response.data);
      success(t('aiGenerated'));
    } else {
      showError(response.error || t('aiGenerateFailed'));
    }
  };

  const fillFeedback = () => {
    if (!aiDraft) return;
    setFeedback(aiDraft.content);
    setFeedbackSuggestionId(aiDraft.id);
    success(t('feedbackFilled'));
  };

  const fillReturnFeedback = () => {
    if (!aiDraft) return;
    setReturnFeedback(aiDraft.content);
    setReturnSuggestionId(aiDraft.id);
    success(t('returnFilled'));
  };

  const dismissAIDraft = async () => {
    if (!aiDraft) return;
    const response = await teacherAssignmentApi.updateAISuggestion(aiDraft.id, 'dismiss');
    if (response.success) {
      setAIDraft(null);
      setFeedbackSuggestionId(undefined);
      setReturnSuggestionId(undefined);
      success(t('aiDismissed'));
    } else {
      showError(response.error || t('aiDismissFailed'));
    }
  };

  const publishGrade = async () => {
    if (!detail?.grade?.id) return;
    setSaving(true);
    const response = await teacherAssignmentApi.publishGrade(detail.grade.id);
    setSaving(false);
    if (response.success && response.data) {
      setDetail(response.data);
      success(t('gradePublished'));
    } else {
      showError(response.error || t('gradePublishFailed'));
    }
  };

  if (loading) {
    return <div className="flex h-80 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>;
  }

  if (error || !detail) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-rose-50 p-8 text-rose-700">
        {error || t('notFound')}
      </div>
    );
  }

  const canPublish = detail.grade?.status === 'reviewed';
  const published = detail.grade?.status === 'published';
  const aiDisabledReason = !aiStatus
    ? t('aiStatusLoading')
    : !aiStatus.enabled
      ? t('aiDisabled')
      : !aiStatus.configured
        ? t('aiNotConfigured')
        : '';

  return (
    <div className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />
      <button onClick={() => navigate('/teacher/submissions')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </button>

      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <FileCheck className="h-3.5 w-3.5" />
                {t('attempt', { count: detail.attemptNo })}
              </div>
              <h1 className="truncate text-2xl font-bold">{detail.assignmentTitle}</h1>
              <p className="mt-2 text-sm text-slate-300">{detail.studentName || detail.studentUsername} · {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString(getCurrentLocale()) : t('notSet')}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">
              {published ? t('publishedScore', { score: detail.grade?.score, maxScore: detail.grade?.maxScore }) : t('currentScore', { score: totalScore, maxScore: detail.rubric.totalScore })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <section className="card-surface-muted rounded-2xl p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-900">{t('submissionNotes')}</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{detail.contentText || t('noNotes')}</p>
            </section>

            <section className="card-surface-muted rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">{t('evidence')}</h2>
                <button onClick={runChecks} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('rerun')}
                </button>
              </div>
              <div className="mb-3">
                <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={t('commandPlaceholder')} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div className="space-y-2">
                {detail.checks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{t('noEvidence')}</div>
                ) : (
                  detail.checks.map((check) => <CheckRow key={check.id} check={check} />)
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card-surface-muted rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Bot className="h-4 w-4 text-violet-600" />
                  {t('aiDraft')}
                </div>
                <button
                  onClick={generateAIDraft}
                  disabled={Boolean(aiDisabledReason) || aiLoading || published}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t('generate')}
                </button>
              </div>
              {aiDisabledReason ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">{aiDisabledReason}</div>
              ) : aiDraft ? (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">{aiDraft.content}</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button onClick={fillFeedback} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{t('fillGrade')}</button>
                    <button onClick={fillReturnFeedback} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{t('fillReturn')}</button>
                    <button onClick={() => void dismissAIDraft()} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">
                      <XCircle className="h-3.5 w-3.5" />
                      {t('dismiss')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{t('noAIDraft')}</div>
              )}
            </section>

            <section className="card-surface-muted rounded-2xl p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Award className="h-4 w-4 text-cyan-600" />
                {t('rubric')}
              </div>
              <div className="space-y-3">
                {detail.rubric.items.map((item) => (
                  <label key={item.id} className="block rounded-xl bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-slate-800">{item.title}</span>
                      <span className="text-xs font-semibold text-slate-400">{t('maxScore', { score: item.maxScore })}</span>
                    </div>
                    {item.description && <div className="mb-2 text-xs text-slate-500">{item.description}</div>}
                    <input value={scores[item.id] || ''} onChange={(event) => setScores({ ...scores, [item.id]: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" />
                  </label>
                ))}
              </div>
              <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={4} placeholder={t('feedbackPlaceholder')} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
              <button onClick={saveGrade} disabled={saving || published} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                <CheckCircle2 className="h-4 w-4" />
                {t('saveGrade')}
              </button>
              <button onClick={publishGrade} disabled={saving || !canPublish} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                <Send className="h-4 w-4" />
                {t('publishGrade')}
              </button>
            </section>

            <section className="card-surface-muted rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Undo2 className="h-4 w-4 text-amber-600" />
                {t('returnTitle')}
              </div>
              <textarea value={returnFeedback} onChange={(event) => setReturnFeedback(event.target.value)} rows={3} placeholder={t('returnPlaceholder')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500" />
              <button onClick={returnSubmission} disabled={saving || published} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                <RotateCcw className="h-4 w-4" />
                {t('returnToStudent')}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

const CheckRow: React.FC<{ check: SubmissionCheck }> = ({ check }) => {
  const { t } = useTranslation('teacherSubmissionDetail');
  const typeKey = check.checkType.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  return (
  <div className="rounded-xl bg-slate-50 p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-bold text-slate-800">{t(`checkTypes.${typeKey}`, { defaultValue: check.checkType })}</div>
      <span className={check.status === 'passed' ? 'text-xs font-bold text-emerald-600' : check.status === 'failed' ? 'text-xs font-bold text-rose-600' : 'text-xs font-bold text-slate-500'}>{t(`checkStatuses.${check.status}`, { defaultValue: check.status })}</span>
    </div>
    {(check.output || check.error) && <div className="mt-2 line-clamp-3 text-xs text-slate-500">{check.error || check.output}</div>}
  </div>
  );
};

export default TeacherSubmissionDetailPage;
