import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, ClipboardList, Eye, Loader2, Plus, RefreshCw, Rocket, XCircle } from 'lucide-react';
import PageDialog from '@/components/common/PageDialog';
import PageDrawer from '@/components/common/PageDrawer';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { teacherAssignmentApi, type AssignmentDetail, type AssignmentListItem, type AssignmentResourceType } from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { teacherCourseApi } from '@/services/teacherCourse';
import type { Course } from '@/services/course';
import { teacherProjectApi } from '@/services/teacherProject';
import type { Project } from '@/services/project';
import { teacherManualApi, type TeacherManualListItem } from '@/services/teacherManual';

type ResourceOption = { id: number; title: string; status?: number };

interface FormState {
  title: string;
  description: string;
  dueAt: string;
  classIds: number[];
  resourceType: AssignmentResourceType;
  resourceId: string;
  attemptLimit: string;
  allowLate: boolean;
  allowReturn: boolean;
  allowResubmit: boolean;
  rubricTitle: string;
  rubricMaxScore: string;
}

const defaultForm: FormState = {
  title: '',
  description: '',
  dueAt: '',
  classIds: [],
  resourceType: 'course',
  resourceId: '',
  attemptLimit: '1',
  allowLate: false,
  allowReturn: true,
  allowResubmit: false,
  rubricTitle: '完成质量',
  rubricMaxScore: '100',
};

const statusMeta: Record<number, { label: string; className: string }> = {
  0: { label: '草稿', className: 'bg-slate-100 text-slate-600' },
  1: { label: '已发布', className: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已关闭', className: 'bg-amber-50 text-amber-700' },
  3: { label: '已归档', className: 'bg-zinc-100 text-zinc-500' },
};

const resourceTypeLabels: Record<AssignmentResourceType, string> = {
  course: '课程',
  course_lesson: '课时',
  project: '项目',
  project_unit: '项目单元',
  manual: 'Agent 手册',
  classic_lab: 'Classic Lab',
  openclaw_project: 'OpenClaw 项目',
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('zh-CN') : '未设置');

const TeacherAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentDetail | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [manuals, setManuals] = useState<TeacherManualListItem[]>([]);
  const { toast, hideToast, success, error: showError } = useToast();

  const resourceOptions = useMemo<ResourceOption[]>(() => {
    if (form.resourceType === 'manual') {
      return manuals.map((manual) => ({ id: manual.id, title: manual.title || `手册 #${manual.id}`, status: manual.isPublished }));
    }
    if (form.resourceType === 'project' || form.resourceType === 'openclaw_project') {
      return projects.map((project) => ({ id: project.id, title: project.title, status: project.status }));
    }
    return courses.map((course) => ({ id: course.id, title: course.title, status: course.status }));
  }, [courses, form.resourceType, manuals, projects]);

  const loadReferenceData = async () => {
    const [classResp, courseResp, projectResp, manualResp] = await Promise.all([
      teacherClassApi.getList({ page: 1, pageSize: 100, status: 1 }),
      teacherCourseApi.getList({ page: 1, pageSize: 100, status: 1 }),
      teacherProjectApi.getList({ page: 1, pageSize: 100, status: 1 }),
      teacherManualApi.list({ page: 1, pageSize: 100, published: 1 }),
    ]);
    setClasses(classResp.success && classResp.data ? classResp.data.list : []);
    setCourses(courseResp.success && courseResp.data ? courseResp.data.list : []);
    setProjects(projectResp.success && projectResp.data ? projectResp.data.list : []);
    setManuals(manualResp.success && manualResp.data ? manualResp.data.list : []);
  };

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.getList({
      page: 1,
      pageSize: 50,
      q: keyword,
      status: statusFilter ? Number(statusFilter) : undefined,
    });
    if (response.success && response.data) {
      setAssignments(response.data.list);
      setTotal(response.data.total);
    } else {
      setAssignments([]);
      setTotal(0);
      setError(response.error || '获取作业列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadReferenceData();
    void loadAssignments();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormOpen(true);
  };

  const openEdit = async (item: AssignmentListItem) => {
    setDetailLoading(true);
    const response = await teacherAssignmentApi.getById(item.id);
    setDetailLoading(false);
    if (!response.success || !response.data) {
      showError(response.error || '获取作业详情失败');
      return;
    }
    const detail = response.data;
    const firstResource = detail.resources[0];
    setEditing(detail);
    setForm({
      title: detail.title,
      description: detail.description || '',
      dueAt: detail.dueAt ? detail.dueAt.slice(0, 16) : '',
      classIds: detail.classes.map((item) => item.classId),
      resourceType: firstResource?.resourceType || 'course',
      resourceId: firstResource?.resourceId ? String(firstResource.resourceId) : '',
      attemptLimit: String(detail.rule?.attemptLimit || 1),
      allowLate: Boolean(detail.rule?.allowLate),
      allowReturn: detail.rule?.allowReturn !== false,
      allowResubmit: Boolean(detail.rule?.allowResubmit),
      rubricTitle: detail.rubric?.items?.[0]?.title || '完成质量',
      rubricMaxScore: String(detail.rubric?.items?.[0]?.maxScore || 100),
    });
    setFormOpen(true);
  };

  const openDetail = async (item: AssignmentListItem) => {
    setDetailLoading(true);
    const response = await teacherAssignmentApi.getById(item.id);
    if (response.success && response.data) {
      setSelected(response.data);
    } else {
      showError(response.error || '获取作业详情失败');
    }
    setDetailLoading(false);
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      showError('请填写作业标题');
      return;
    }
    if (!form.resourceId) {
      showError('请选择一个发布资源');
      return;
    }
    setSubmitting(true);
    const resourceId = Number(form.resourceId);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      classIds: form.classIds,
      resources: [{
        resourceType: form.resourceType,
        resourceId,
        manualId: form.resourceType === 'manual' ? resourceId : 0,
        sortOrder: 1,
      }],
      rule: {
        attemptLimit: Number(form.attemptLimit) || 1,
        allowLate: form.allowLate,
        allowReturn: form.allowReturn,
        allowResubmit: form.allowResubmit,
        scoreMode: 'completion',
      },
      rubricItems: [{
        title: form.rubricTitle.trim() || '完成质量',
        maxScore: Number(form.rubricMaxScore) || 100,
        sortOrder: 1,
      }],
    };
    const response = editing
      ? await teacherAssignmentApi.update(editing.id, payload)
      : await teacherAssignmentApi.create(payload);
    setSubmitting(false);
    if (response.success) {
      success(editing ? '作业已更新' : '作业已创建');
      setFormOpen(false);
      void loadAssignments();
    } else {
      showError(response.error || '保存作业失败');
    }
  };

  const transition = async (item: AssignmentListItem, action: 'publish' | 'close' | 'draft') => {
    const response = action === 'publish'
      ? await teacherAssignmentApi.publish(item.id)
      : action === 'close'
        ? await teacherAssignmentApi.close(item.id)
        : await teacherAssignmentApi.draft(item.id);
    if (response.success) {
      success(action === 'publish' ? '作业已发布' : action === 'close' ? '作业已关闭' : '作业已设为草稿');
      void loadAssignments();
      return;
    }
    const check = response.data as unknown as { errors?: Array<{ message: string }> } | undefined;
    const firstError = check?.errors?.[0]?.message;
    showError(firstError || response.error || '操作失败');
  };

  return (
    <div className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <ClipboardList className="h-3.5 w-3.5" />
                M3 任务层首版
              </div>
              <h1 className="text-2xl font-bold">作业任务</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">把已发布内容绑定到班级，形成学生端“我的任务”可见链路。</p>
            </div>
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20">
              <Plus className="h-4 w-4" />
              创建作业
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void loadAssignments()}
            placeholder="搜索作业标题或说明"
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel="按作业状态筛选"
            value={statusFilter || 'all'}
            onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: '全部状态' },
              { key: '0', label: '草稿' },
              { key: '1', label: '已发布' },
              { key: '2', label: '已关闭' },
            ]}
            className="md:w-52"
          />
          <button onClick={() => void loadAssignments()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载作业中...</div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-5 text-sm font-medium text-rose-700">{error}</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">还没有作业。先创建一个草稿，再发布给班级。</div>
          ) : (
            <div className="space-y-3">
              {assignments.map((item) => {
                const meta = statusMeta[item.status] || statusMeta[0];
                return (
                  <div key={item.id} className="card-surface grid gap-4 rounded-2xl p-4 md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                        <h3 className="truncate text-base font-bold text-slate-900">{item.title}</h3>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description || '暂无说明'}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span>班级 {item.classCount}</span>
                        <span>资源 {item.resourceCount}</span>
                        <span>学生 {item.studentCount}</span>
                        <span>截止 {formatDateTime(item.dueAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => void openDetail(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Eye className="mr-1 inline h-3.5 w-3.5" />详情</button>
                      <button onClick={() => void openEdit(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">编辑</button>
                      {item.status !== 1 && <button onClick={() => void transition(item, 'publish')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Rocket className="mr-1 inline h-3.5 w-3.5" />发布</button>}
                      {item.status === 1 && <button onClick={() => void transition(item, 'close')} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"><XCircle className="mr-1 inline h-3.5 w-3.5" />关闭</button>}
                      {item.status !== 0 && <button onClick={() => void transition(item, 'draft')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">草稿</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 text-xs font-medium text-slate-400">共 {total} 条作业</div>
        </div>
      </motion.div>

      <PageDialog isOpen={formOpen} onClose={() => setFormOpen(false)} panelClassName="max-w-4xl">
        <div className="border-b border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-900">{editing ? '编辑作业' : '创建作业'}</h2>
          <p className="mt-1 text-sm text-slate-500">按“基础信息、绑定资源、选择班级、发布确认”四步补齐首版任务链路。</p>
        </div>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">作业标题<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-500" /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">截止时间<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-500" /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">说明<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-500" /></label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm font-semibold text-slate-700">
              资源类型
              <ToolbarSelect
                ariaLabel="资源类型"
                value={form.resourceType}
                onChange={(value) => setForm({ ...form, resourceType: value as AssignmentResourceType, resourceId: '' })}
                options={[
                  { key: 'course', label: '课程' },
                  { key: 'project', label: '项目' },
                  { key: 'manual', label: 'Agent 手册' },
                  { key: 'openclaw_project', label: 'OpenClaw 项目' },
                ]}
              />
            </div>
            <div className="space-y-2 text-sm font-semibold text-slate-700">
              发布资源
              <ToolbarSelect
                ariaLabel="发布资源"
                value={form.resourceId}
                placeholder="请选择资源"
                disallowEmptySelection={false}
                onChange={(value) => setForm({ ...form, resourceId: value })}
                options={resourceOptions.map((option) => ({ key: String(option.id), label: option.title }))}
              />
            </div>
          </section>

          <section>
            <div className="mb-3 text-sm font-semibold text-slate-700">选择班级</div>
            <div className="grid gap-3 md:grid-cols-2">
              {classes.map((item) => (
                <label key={item.id} className="card-surface-muted flex items-center gap-3 rounded-2xl p-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.classIds.includes(item.id)} onChange={(event) => setForm({
                    ...form,
                    classIds: event.target.checked ? [...form.classIds, item.id] : form.classIds.filter((id) => id !== item.id),
                  })} />
                  <span className="min-w-0 flex-1 truncate">{item.name} · {item.activeMemberCount} 人</span>
                </label>
              ))}
              {classes.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无启用班级，请先在班级管理中创建或启用班级。</div>}
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-slate-700">尝试次数<input value={form.attemptLimit} onChange={(event) => setForm({ ...form, attemptLimit: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 px-3" /></label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allowLate} onChange={(event) => setForm({ ...form, allowLate: event.target.checked })} />允许迟交</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allowReturn} onChange={(event) => setForm({ ...form, allowReturn: event.target.checked })} />允许退回</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allowResubmit} onChange={(event) => setForm({ ...form, allowResubmit: event.target.checked })} />允许重提</label>
          </section>

          <section className="grid gap-4 rounded-2xl bg-cyan-50 p-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">Rubric 条目<input value={form.rubricTitle} onChange={(event) => setForm({ ...form, rubricTitle: event.target.value })} className="h-10 w-full rounded-xl border border-cyan-100 px-3 outline-none focus:border-cyan-500" /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">满分<input value={form.rubricMaxScore} onChange={(event) => setForm({ ...form, rubricMaxScore: event.target.value })} className="h-10 w-full rounded-xl border border-cyan-100 px-3 outline-none focus:border-cyan-500" /></label>
          </section>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <button onClick={() => setFormOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">取消</button>
          <button onClick={() => void submitForm()} disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            保存草稿
          </button>
        </div>
      </PageDialog>

      <PageDrawer isOpen={Boolean(selected)} onClose={() => setSelected(null)} panelClassName="max-w-2xl">
        <div className="p-6">
          {detailLoading ? <div className="py-20 text-center text-slate-500">加载中...</div> : selected && (
            <div className="space-y-6">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[selected.status]?.className || statusMeta[0].className}`}>{statusMeta[selected.status]?.label || '未知'}</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{selected.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{selected.description || '暂无说明'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">截止时间：{formatDateTime(selected.dueAt)}</div>
              {selected.submissionProgress && (
                <section>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">批改进度</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ['总学生', selected.submissionProgress.totalStudents],
                      ['已提交', selected.submissionProgress.submitted],
                      ['待批改', selected.submissionProgress.pendingReview],
                      ['已退回', selected.submissionProgress.returned],
                      ['已评分', selected.submissionProgress.graded],
                      ['已发布', selected.submissionProgress.publishedGrades],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs font-bold text-slate-400">{label}</div>
                        <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h3 className="mb-3 text-sm font-bold text-slate-900">绑定班级</h3>
                <div className="space-y-2">{selected.classes.map((item) => <div key={item.classId} className="card-surface-muted rounded-xl p-3 text-sm text-slate-700">{item.name} · {item.activeMemberCount} 人</div>)}</div>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-bold text-slate-900">任务资源</h3>
                <div className="space-y-2">{selected.resources.map((item) => <div key={item.id} className="card-surface-muted flex items-center gap-3 rounded-xl p-3 text-sm text-slate-700"><BookOpenCheck className="h-4 w-4 text-cyan-600" />{resourceTypeLabels[item.resourceType]} · {item.title}</div>)}</div>
              </section>
            </div>
          )}
        </div>
      </PageDrawer>
    </div>
  );
};

export default TeacherAssignmentsPage;
