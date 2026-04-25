import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, Bell, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, FileCheck, Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import PageDrawer from '@/components/common/PageDrawer';
import { studentAssignmentApi, type AssignmentDetail, type AssignmentListItem, type AssignmentResourceItem, type StudentNotification, type SubmissionDetail } from '@/services/assignment';
import { labApi, type LabSession } from '@/services/lab';

const statusMeta: Record<number, { label: string; className: string }> = {
  1: { label: '进行中', className: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已关闭', className: 'bg-amber-50 text-amber-700' },
};

const resourceLabel: Record<string, string> = {
  course: '进入课程',
  course_lesson: '进入课时',
  project: '进入项目',
  project_unit: '进入项目单元',
  manual: '查看手册说明',
  classic_lab: '进入 Classic Lab',
  openclaw_project: '进入 OpenClaw',
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '未设置');

const submissionStatusMeta: Record<string, { label: string; className: string }> = {
  not_started: { label: '未提交', className: 'bg-slate-100 text-slate-600' },
  submitted: { label: '已提交', className: 'bg-cyan-50 text-cyan-700' },
  resubmitted: { label: '已重交', className: 'bg-blue-50 text-blue-700' },
  returned: { label: '已退回', className: 'bg-amber-50 text-amber-700' },
  graded: { label: '已评分', className: 'bg-violet-50 text-violet-700' },
};

const checkTypeLabel: Record<string, string> = {
  lesson_progress: '课时进度',
  agent_progress: 'Agent 步骤',
  lab_session: 'Lab 会话',
  lab_command: '验证命令',
  openclaw_phase: 'OpenClaw 阶段',
  manual_review: '教师批改',
};

interface StudyAssignmentsSectionProps {
  classId?: number | null;
}

const StudyAssignmentsSection: React.FC<StudyAssignmentsSectionProps> = ({ classId }) => {
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
  const [openClawSessionId, setOpenClawSessionId] = useState('');
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
      setError(response.error || '获取我的任务失败');
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
  }, [classId]);

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
      setError(response.error || '获取任务详情失败');
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

    const openClawResource = detail.resources.find((resource) => resource.resourceType === 'openclaw_project');
    setOpenClawSessionId(openClawResource ? buildOpenClawSessionId(openClawResource) : '');

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

  const submitAssignment = async () => {
    if (!selected) return;
    if (!submitText.trim()) {
      setSubmitError('请填写提交说明');
      return;
    }
    setSubmitLoading(true);
    setSubmitError(null);
    const response = await studentAssignmentApi.submit(selected.id, {
      contentText: submitText.trim(),
      labSessionId: labSessionId ? Number(labSessionId) : 0,
      openclawSessionId: openClawSessionId.trim(),
      agentManualId: agentManualId ? Number(agentManualId) : 0,
    });
    setSubmitLoading(false);
    if (response.success) {
      setSubmitText('');
      setLabSessionId('');
      setOpenClawSessionId('');
      setAgentManualId('');
      await reloadSelected();
      void loadAssignments();
    } else {
      setSubmitError(response.error || '提交失败');
    }
  };

  const jumpToResource = (resource: AssignmentResourceItem) => {
    switch (resource.resourceType) {
      case 'project':
      case 'project_unit':
        navigate('/projects');
        break;
      case 'classic_lab':
        navigate(`/lab?sourceType=course&sourceId=${resource.resourceId}`);
        break;
      case 'openclaw_project':
        navigate(`/openclaw/idle?projectId=${resource.resourceId}`);
        break;
      case 'course':
      case 'course_lesson':
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
            我的任务
          </div>
          <h2 className="text-xl font-bold">班级作业待办</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNotificationOpen(true); void loadNotifications(); }} className="relative rounded-2xl bg-white/10 p-2 text-white hover:bg-white/20" aria-label="通知">
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadNotifications}</span>}
          </button>
          <button onClick={() => void loadAssignments()} className="rounded-2xl bg-white/10 p-2 text-white hover:bg-white/20" aria-label="刷新任务">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex h-28 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载任务中...</div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">当前班级暂未发布任务。</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((item) => {
              const meta = statusMeta[item.status] || statusMeta[1];
              return (
                <button key={item.id} onClick={() => void openDetail(item)} className="card-surface rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    <span className="text-xs font-semibold text-slate-400">{item.classCount} 个班级</span>
                  </div>
                  <h3 className="truncate text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description || '暂无说明'}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    截止 {formatDateTime(item.dueAt)}
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
            <div className="py-20 text-center text-slate-500">加载中...</div>
          ) : selected && (
            <div className="space-y-6">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[selected.status]?.className || statusMeta[1].className}`}>{statusMeta[selected.status]?.label || '任务'}</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{selected.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{selected.description || '暂无说明'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">截止时间：{formatDateTime(selected.dueAt)}</div>
              <div className="space-y-3">
                {selected.resources.map((resource) => (
                  <div key={resource.id} className="card-surface-muted rounded-2xl p-4">
                    <div className="text-sm font-bold text-slate-900">{resource.title}</div>
                    <button onClick={() => jumpToResource(resource)} disabled={selected.status !== 1 || resource.resourceType === 'manual'} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {resourceLabel[resource.resourceType] || '进入资源'}
                    </button>
                  </div>
                ))}
              </div>
              <SubmissionPanel
                assignment={selected}
                submitText={submitText}
                labSessionId={labSessionId}
                openClawSessionId={openClawSessionId}
                agentManualId={agentManualId}
                submitLoading={submitLoading}
                submitError={submitError}
                onSubmitTextChange={setSubmitText}
                activeLabSession={activeLabSession}
                onSubmit={() => void submitAssignment()}
              />
            </div>
          )}
        </div>
      </PageDrawer>

      <PageDrawer isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} panelClassName="max-w-md">
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">站内通知</h2>
              <p className="mt-1 text-sm text-slate-500">老师提醒、重开提交和成绩发布会在这里同步。</p>
            </div>
            <button onClick={() => void loadNotifications()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="刷新通知">
              <RefreshCw className={`h-4 w-4 ${notificationLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {notificationLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载通知...</div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">暂无通知。</div>
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
                      <div className="mt-2 text-xs font-medium text-slate-400">{formatDateTime(item.createdAt)}</div>
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

const buildOpenClawSessionId = (resource: AssignmentResourceItem) => {
  if (resource.unitId > 0) {
    return `project:${resource.resourceId}:unit:${resource.unitId}`;
  }
  return `project:${resource.resourceId}`;
};

interface SubmissionPanelProps {
  assignment: AssignmentDetail;
  submitText: string;
  labSessionId: string;
  openClawSessionId: string;
  agentManualId: string;
  activeLabSession: LabSession | null;
  submitLoading: boolean;
  submitError: string | null;
  onSubmitTextChange: (value: string) => void;
  onSubmit: () => void;
}

const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  assignment,
  submitText,
  labSessionId,
  openClawSessionId,
  agentManualId,
  activeLabSession,
  submitLoading,
  submitError,
  onSubmitTextChange,
  onSubmit,
}) => {
  const state = assignment.studentSubmission;
  const latest = state?.latest;
  const status = state?.status || 'not_started';
  const meta = submissionStatusMeta[status] || submissionStatusMeta.not_started;
  const publishedGrade = latest?.grade?.status === 'published' ? latest.grade : undefined;

  return (
    <section className="card-surface-muted space-y-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileCheck className="h-4 w-4 text-cyan-600" />
          提交与反馈
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
      </div>

      {latest?.feedback && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <div className="mb-1 flex items-center gap-2 font-bold"><MessageSquare className="h-3.5 w-3.5" />教师反馈</div>
          {latest.feedback.content}
        </div>
      )}

      {publishedGrade && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="mb-1 flex items-center gap-2 font-bold"><Award className="h-3.5 w-3.5" />成绩已发布</div>
          得分 {publishedGrade.score} / {publishedGrade.maxScore}
        </div>
      )}

      {state?.canSubmit ? (
        <div className="space-y-3">
          <textarea value={submitText} onChange={(event) => onSubmitTextChange(event.target.value)} rows={4} placeholder="填写本次提交说明、关键命令、结果摘要或需要老师关注的问题" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
          <div className="grid gap-2 md:grid-cols-3">
            <EvidencePill
              label="当前 Lab 会话"
              value={labSessionId ? `#${labSessionId}` : '未检测到'}
              active={Boolean(labSessionId)}
              hint={activeLabSession ? `来源 ${activeLabSession.sourceId}` : '提交前进入 Classic Lab 可自动绑定'}
            />
            <EvidencePill
              label="OpenClaw 会话"
              value={openClawSessionId || '未关联'}
              active={Boolean(openClawSessionId)}
              hint={openClawSessionId ? '按项目资源自动派生' : '非 OpenClaw 作业无需绑定'}
            />
            <EvidencePill
              label="Agent 手册"
              value={agentManualId ? `#${agentManualId}` : '未关联'}
              active={Boolean(agentManualId)}
              hint={agentManualId ? '按作业资源自动识别' : '无 Agent 手册资源'}
            />
          </div>
          {submitError && <div className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{submitError}</div>}
          <button onClick={onSubmit} disabled={submitLoading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交成果
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-500">{state?.disabledReason || '当前状态暂不能提交。'}</div>
      )}

      <div className="space-y-3">
        <div className="text-sm font-bold text-slate-900">提交历史</div>
        {!state?.history?.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">暂无提交记录。</div>
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
  const meta = submissionStatusMeta[item.status] || submissionStatusMeta.submitted;
  return (
    <div className="card-surface-muted rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>第 {item.attemptNo} 次 · {meta.label}</span>
        <span className="text-xs font-semibold text-slate-400">{formatDateTime(item.submittedAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.contentText || '未填写说明'}</p>
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
