import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, Bell, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, FileCheck, Loader2, MessageSquare, RefreshCw, Send, Paperclip, X } from 'lucide-react';
import { api } from '@/services/api';
import SubmissionAttachments from '@/components/common/SubmissionAttachments';
import type { SubmissionFileInput } from '@/services/assignment';
import PageDrawer from '@/components/common/PageDrawer';
import { studentAssignmentApi, type AssignmentDetail, type AssignmentListItem, type AssignmentResourceItem, type StudentNotification, type SubmissionDetail } from '@/services/assignment';
import { labApi, type LabSession } from '@/services/lab';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getCurrentLocale } from '@/i18n';
import { localizeSeededAssignmentDescription, localizeSeededCourseTitle } from '@/utils/seededContentLocale';

type StudentT = TFunction<'student'>;

const getStatusMeta = (t: StudentT): Record<number, { label: string; className: string }> => ({
  1: { label: t('assignments.active'), className: 'bg-emerald-50 text-emerald-700' },
  2: { label: t('assignments.closed'), className: 'bg-amber-50 text-amber-700' },
});

const getResourceLabel = (t: StudentT): Record<string, string> => ({
  course: t('assignments.enterCourse'), course_lesson: t('assignments.enterLesson'), project: t('assignments.enterProject'),
  project_unit: t('assignments.enterUnit'), manual: t('assignments.viewManual'), classic_lab: t('assignments.enterClassicLab'),
});

const formatDateTime = (value: string | null | undefined, t: StudentT) => (value ? new Date(value).toLocaleString(getCurrentLocale()) : t('assignments.notSet'));

const getSubmissionStatusMeta = (t: StudentT): Record<string, { label: string; className: string }> => ({
  not_started: { label: t('assignments.notSubmitted'), className: 'bg-slate-100 text-slate-600' },
  submitted: { label: t('assignments.submitted'), className: 'bg-cyan-50 text-cyan-700' },
  resubmitted: { label: t('assignments.resubmitted'), className: 'bg-blue-50 text-blue-700' },
  returned: { label: t('assignments.returned'), className: 'bg-amber-50 text-amber-700' },
  graded: { label: t('assignments.graded'), className: 'bg-violet-50 text-violet-700' },
});

const getCheckTypeLabel = (t: StudentT): Record<string, string> => ({
  lesson_progress: t('assignments.lessonProgress'), agent_progress: t('assignments.agentProgress'), lab_session: t('assignments.labSession'),
  lab_command: t('assignments.labCommand'), manual_review: t('assignments.manualReview'),
});

interface StudyAssignmentsSectionProps {
  classId?: number | null;
}

const StudyAssignmentsSection: React.FC<StudyAssignmentsSectionProps> = ({ classId }) => {
  const { t, i18n } = useTranslation('student');
  const statusMeta = getStatusMeta(t);
  const resourceLabel = getResourceLabel(t);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitText, setSubmitText] = useState('');
  const [labSessionId, setLabSessionId] = useState('');
  const [agentManualId, setAgentManualId] = useState('');
  const [activeLabSession, setActiveLabSession] = useState<LabSession | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    const response = await studentAssignmentApi.getList({ page: 1, pageSize: 6, classId: classId || undefined });
    if (response.success && response.data) {
      setAssignments(response.data.list);
    } else {
      setAssignments([]);
      setError(response.error || t('assignments.listFailed'));
    }
    setLoading(false);
  };

  const loadNotifications = async () => {
    setNotificationLoading(true);
    const response = await studentAssignmentApi.notifications({ page: 1, pageSize: 20 });
    if (response.success && response.data) {
      setNotifications(response.data.list);
      setUnreadNotifications(response.data.unread);
    }
    setNotificationLoading(false);
  };

  useEffect(() => {
    void loadAssignments();
    void loadNotifications();
  }, [classId, i18n.language]);

  const openDetail = async (item: AssignmentListItem) => {
    await openDetailById(item.id);
  };

  const openDetailById = async (assignmentId: number) => {
    setDetailLoading(true);
    setSubmitError(null);
    const response = await studentAssignmentApi.getById(assignmentId);
    if (response.success && response.data) {
      setSelected(response.data);
      void hydrateSubmissionEvidence(response.data);
    } else {
      setError(response.error || t('assignments.detailFailed'));
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    const target = Number(searchParams.get('openAssignment'));
    if (!target) return;
    void openDetailById(target);
    const next = new URLSearchParams(searchParams);
    next.delete('openAssignment');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hydrateSubmissionEvidence = async (detail: AssignmentDetail) => {
    const manualResource = detail.resources.find((resource) => resource.manualId > 0 || resource.resourceType === 'manual');
    setAgentManualId(manualResource ? String(manualResource.manualId || manualResource.resourceId) : '');

    const activeResponse = await labApi.getActiveSession();
    const activeSession = activeResponse.success ? activeResponse.data?.session || null : null;
    setActiveLabSession(activeSession);
    setLabSessionId(activeSession ? String(activeSession.id) : '');
  };

  const reloadSelected = async () => {
    if (!selected) return;
    const response = await studentAssignmentApi.getById(selected.id);
    if (response.success && response.data) {
      setSelected(response.data);
    }
  };

  useEffect(() => {
    if (!selected) return;
    void reloadSelected();
  }, [i18n.language]);

  const submitAssignment = async (files: SubmissionFileInput[]): Promise<boolean> => {
    if (!selected) return false;
    if (!submitText.trim()) {
      setSubmitError(t('assignments.submitRequired'));
      return false;
    }
    setSubmitLoading(true);
    setSubmitError(null);
    const response = await studentAssignmentApi.submit(selected.id, {
      contentText: submitText.trim(),
      labSessionId: labSessionId ? Number(labSessionId) : 0,
      agentManualId: agentManualId ? Number(agentManualId) : 0,
      files,
    });
    setSubmitLoading(false);
    if (response.success) {
      setSubmitText('');
      setLabSessionId('');
      setAgentManualId('');
      await reloadSelected();
      await hydrateSubmissionEvidence(selected);
      void loadAssignments();
      return true;
    } else {
      setSubmitError(response.error || t('assignments.submitFailed'));
      return false;
    }
  };

  const jumpToResource = (resource: AssignmentResourceItem) => {
    switch (resource.resourceType) {
      case 'project':
      case 'project_unit':
        navigate('/projects');
        break;
      case 'classic_lab': {
        // 带上 lessonId，否则实验页会回退用课程 id 去查手册，导致 Agent 手册无法渲染
        const labParams = new URLSearchParams({ sourceType: 'course', sourceId: String(resource.resourceId) });
        if (resource.lessonId) labParams.set('lessonId', String(resource.lessonId));
        navigate(`/lab?${labParams.toString()}`);
        break;
      }
      case 'course':
        // 已在 /study 页时直接 navigate('/study') 不会有反应，需带 courseId 打开对应课程
        navigate(`/study?courseId=${resource.resourceId}`);
        break;
      case 'course_lesson':
        navigate(resource.lessonId ? `/lesson/${resource.lessonId}` : `/study?courseId=${resource.resourceId}`);
        break;
      default:
        navigate('/study');
        break;
    }
  };

  return (
    <section className="card-surface mb-8 overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 px-6 py-5 text-white">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            <ClipboardList className="h-3.5 w-3.5" />
            {t('assignments.myTasks')}
          </div>
          <h2 className="text-xl font-bold">{t('assignments.todo')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNotificationOpen(true); void loadNotifications(); }} className="relative rounded-2xl bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t('assignments.notifications')}>
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadNotifications}</span>}
          </button>
          <button onClick={() => void loadAssignments()} className="rounded-2xl bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t('assignments.refreshTasks')}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex h-28 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('assignments.loadingTasks')}</div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{t('assignments.noTasks')}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((item) => {
              const meta = statusMeta[item.status] || statusMeta[1];
              const title = localizeSeededCourseTitle(item.title, i18n.language);
              const description = localizeSeededAssignmentDescription(item.description, i18n.language);
              return (
                <button key={item.id} onClick={() => void openDetail(item)} className="card-surface rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    <span className="text-xs font-semibold text-slate-400">{t('assignments.classCount', { count: item.classCount })}</span>
                  </div>
                  <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{description || t('assignments.noDescription')}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t('assignments.due', { date: formatDateTime(item.dueAt, t) })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <PageDrawer isOpen={Boolean(selected)} onClose={() => setSelected(null)} panelClassName="max-w-xl">
        <div className="p-6">
          {detailLoading ? (
            <div className="py-20 text-center text-slate-500">{t('assignments.loading')}</div>
          ) : selected && (
            <div className="space-y-6">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[selected.status]?.className || statusMeta[1].className}`}>{statusMeta[selected.status]?.label || t('assignments.task')}</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{localizeSeededCourseTitle(selected.title, i18n.language)}</h2>
                <p className="mt-2 text-sm text-slate-500">{localizeSeededAssignmentDescription(selected.description, i18n.language) || t('assignments.noDescription')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">{t('assignments.dueAt', { date: formatDateTime(selected.dueAt, t) })}</div>
              <div className="space-y-3">
                {selected.resources.map((resource) => (
                  <div key={resource.id} className="card-surface-muted rounded-2xl p-4">
                    <div className="text-sm font-bold text-slate-900">{localizeSeededCourseTitle(resource.title, i18n.language)}</div>
                    <button onClick={() => jumpToResource(resource)} disabled={selected.status !== 1 || resource.resourceType === 'manual'} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {resourceLabel[resource.resourceType] || t('assignments.enterResource')}
                    </button>
                  </div>
                ))}
              </div>
              <SubmissionPanel
                key={selected.id}
                assignment={selected}
                submitText={submitText}
                labSessionId={labSessionId}
                agentManualId={agentManualId}
                submitLoading={submitLoading}
                submitError={submitError}
                onSubmitTextChange={setSubmitText}
                activeLabSession={activeLabSession}
                onSubmit={submitAssignment}
              />
            </div>
          )}
        </div>
      </PageDrawer>

      <PageDrawer isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} panelClassName="max-w-md">
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t('assignments.inbox')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('assignments.inboxDesc')}</p>
            </div>
            <button onClick={() => void loadNotifications()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label={t('assignments.refreshNotifications')}>
              <RefreshCw className={`h-4 w-4 ${notificationLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {notificationLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('assignments.loadingNotifications')}</div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">{t('assignments.noNotifications')}</div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    if (!item.readAt) await studentAssignmentApi.markNotificationRead(item.id);
                    await loadNotifications();
                    if (item.sourceType === 'assignment' && item.sourceId > 0) {
                      setNotificationOpen(false);
                      await openDetailById(item.sourceId);
                    }
                  }}
                  className={`w-full rounded-2xl p-4 text-left transition hover:bg-slate-50 ${item.readAt ? 'card-surface-muted' : 'bg-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p>
                      <div className="mt-2 text-xs font-medium text-slate-400">{formatDateTime(item.createdAt, t)}</div>
                    </div>
                    {item.readAt ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-600" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PageDrawer>
    </section>
  );
};

interface SubmissionPanelProps {
  assignment: AssignmentDetail;
  submitText: string;
  labSessionId: string;
  agentManualId: string;
  activeLabSession: LabSession | null;
  submitLoading: boolean;
  submitError: string | null;
  onSubmitTextChange: (value: string) => void;
  onSubmit: (files: SubmissionFileInput[]) => Promise<boolean>;
}

const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  assignment,
  submitText,
  labSessionId,
  agentManualId,
  activeLabSession,
  submitLoading,
  submitError,
  onSubmitTextChange,
  onSubmit,
}) => {
  const { t } = useTranslation('student');
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SubmissionFileInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setUploadError(t('assignments.fileTooLarge'));
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<{ url: string }>(`/student/assignments/${assignment.id}/attachments`, form);
      if (!result.success || !result.data?.url) throw new Error(result.error || t('assignments.uploadFailed'));
      setFiles(current => [...current, { fileType: 'file', title: file.name, url: result.data!.url, metadata: { size: file.size } }]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t('assignments.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const state = assignment.studentSubmission;
  const latest = state?.latest;
  const status = state?.status || 'not_started';
  const submissionStatusMeta = getSubmissionStatusMeta(t);
  const meta = submissionStatusMeta[status] || submissionStatusMeta.not_started;
  const publishedGrade = latest?.grade?.status === 'published' ? latest.grade : undefined;

  return (
    <section className="card-surface-muted space-y-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileCheck className="h-4 w-4 text-cyan-600" />
          {t('assignments.submissionFeedback')}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
      </div>

      {latest?.feedback && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <div className="mb-1 flex items-center gap-2 font-bold"><MessageSquare className="h-3.5 w-3.5" />{t('assignments.teacherFeedback')}</div>
          {latest.feedback.content}
        </div>
      )}

      {publishedGrade && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="mb-1 flex items-center gap-2 font-bold"><Award className="h-3.5 w-3.5" />{t('assignments.gradePublished')}</div>
          {t('assignments.score', { score: publishedGrade.score, maxScore: publishedGrade.maxScore })}
        </div>
      )}

      {state?.canSubmit ? (
        <div className="space-y-3">
          <textarea value={submitText} onChange={(event) => onSubmitTextChange(event.target.value)} rows={4} placeholder={t('assignments.submitPlaceholder')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
          <input ref={inputRef} type="file" accept=".zip,.pdf,.txt,.md,.json,.png,.jpg,.jpeg,.webp" className="hidden" aria-label={t('assignments.attachFile')} disabled={uploading || submitLoading || files.length >= 5}
            onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          <button type="button" disabled={uploading || submitLoading || files.length >= 5} onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {t(uploading ? 'assignments.uploadingFile' : 'assignments.attachFile')}
          </button>
          {files.map((file, index) => <div key={file.url} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{file.title}</span>
            <button type="button" disabled={submitLoading} aria-label={t('assignments.removeFile', { name: file.title })} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>)}
          {uploadError && <p role="alert" className="text-sm text-rose-600">{uploadError}</p>}
          <div className="grid gap-2 md:grid-cols-2">
            <EvidencePill
              label={t('assignments.currentLab')}
              value={labSessionId ? `#${labSessionId}` : t('assignments.notDetected')}
              active={Boolean(labSessionId)}
              hint={activeLabSession ? t('assignments.source', { source: activeLabSession.sourceId }) : t('assignments.classicHint')}
            />
            <EvidencePill
              label={t('assignments.agentManual')}
              value={agentManualId ? `#${agentManualId}` : t('assignments.notLinked')}
              active={Boolean(agentManualId)}
              hint={agentManualId ? t('assignments.manualDetected') : t('assignments.noManual')}
            />
          </div>
          {submitError && <div className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{submitError}</div>}
          <button onClick={async () => { if (await onSubmit(files)) setFiles([]); }} disabled={submitLoading || uploading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('assignments.submitWork')}
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-500">{state?.disabledReason || t('assignments.cannotSubmit')}</div>
      )}

      <div className="space-y-3">
        <div className="text-sm font-bold text-slate-900">{t('assignments.history')}</div>
        {!state?.history?.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{t('assignments.noHistory')}</div>
        ) : (
          state.history.map((item) => <SubmissionHistoryCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
};

const EvidencePill: React.FC<{ label: string; value: string; active: boolean; hint: string }> = ({ label, value, active, hint }) => (
  <div className={`rounded-xl px-3 py-2 ${active ? 'bg-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]' : 'card-surface-muted'}`}>
    <div className="text-[11px] font-bold text-slate-400">{label}</div>
    <div className={`mt-1 truncate text-sm font-black ${active ? 'text-cyan-700' : 'text-slate-500'}`}>{value}</div>
    <div className="mt-1 truncate text-[11px] font-medium text-slate-400">{hint}</div>
  </div>
);

const SubmissionHistoryCard: React.FC<{ item: SubmissionDetail }> = ({ item }) => {
  const { t } = useTranslation('student');
  const submissionStatusMeta = getSubmissionStatusMeta(t);
  const checkTypeLabel = getCheckTypeLabel(t);
  const meta = submissionStatusMeta[item.status] || submissionStatusMeta.submitted;
  return (
    <div className="card-surface-muted rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{t('assignments.attempt', { count: item.attemptNo, status: meta.label })}</span>
        <span className="text-xs font-semibold text-slate-400">{formatDateTime(item.submittedAt, t)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.contentText || t('assignments.noSubmissionText')}</p>
      <SubmissionAttachments files={item.files || []} />
      <div className="mt-3 grid gap-2">
        {item.checks.map((check) => (
          <div key={check.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="font-bold text-slate-700">{checkTypeLabel[check.checkType] || check.checkType}</span>
            <span className={check.status === 'passed' ? 'font-bold text-emerald-600' : check.status === 'failed' ? 'font-bold text-rose-600' : 'font-bold text-slate-500'}>{check.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyAssignmentsSection;
