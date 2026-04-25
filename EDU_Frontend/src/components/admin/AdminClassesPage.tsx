import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, Loader2, Plus, RefreshCw, School2, X } from 'lucide-react';
import PageDialog from '@/components/common/PageDialog';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { adminTermApi } from '@/services/adminTerm';
import { adminClassApi } from '@/services/adminClass';
import type { ClassDetail, ClassroomListResponse, TermItem } from '@/services/classroom';
import { ClassStatus, formatDate, formatDateTime, getClassStatusMeta, getTermStatusMeta, TermStatus } from '@/services/classroom';

type AdminTab = 'terms' | 'classes';

interface TermFormState {
  name: string;
  code: string;
  startAt: string;
  endAt: string;
}

const emptyTermForm: TermFormState = {
  name: '',
  code: '',
  startAt: '',
  endAt: '',
};

const AdminClassesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('terms');
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [classes, setClasses] = useState<ClassroomListResponse>({ list: [], total: 0, page: 1, pageSize: 10 });
  const [termKeyword, setTermKeyword] = useState('');
  const [classKeyword, setClassKeyword] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [termError, setTermError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [termFormOpen, setTermFormOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);
  const [savingTerm, setSavingTerm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast, hideToast, success, error } = useToast();

  const pageSize = 10;
  const classPage = classes.page || 1;
  const totalPages = useMemo(() => Math.max(1, Math.ceil((classes.total || 0) / pageSize)), [classes.total]);
  const classItems = Array.isArray(classes.list) ? classes.list : [];

  const loadTerms = async () => {
    setLoadingTerms(true);
    setTermError(null);
    const response = await adminTermApi.getTerms(termKeyword);
    if (response.success && response.data) {
      setTerms(response.data);
    } else {
      setTerms([]);
      setTermError(response.error || '获取学期列表失败');
    }
    setLoadingTerms(false);
  };

  const loadClasses = async (nextPage = classPage) => {
    setLoadingClasses(true);
    setClassError(null);
    const response = await adminClassApi.getList({
      page: nextPage,
      pageSize,
      keyword: classKeyword,
      termId: termFilter ? Number(termFilter) : undefined,
      status: statusFilter ? Number(statusFilter) : undefined,
    });
    if (response.success && response.data) {
      setClasses(response.data);
    } else {
      setClasses({ list: [], total: 0, page: nextPage, pageSize });
      setClassError(response.error || '获取班级总览失败');
    }
    setLoadingClasses(false);
  };

  const openClassDetail = async (id: number) => {
    setDetailLoading(true);
    const response = await adminClassApi.getById(id);
    if (response.success && response.data) {
      setSelectedClass(response.data);
    } else {
      setSelectedClass(null);
      error(response.error || '获取班级详情失败');
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    void loadTerms();
    void loadClasses(1);
  }, []);

  const openCreateTerm = () => {
    setEditingTerm(null);
    setTermForm(emptyTermForm);
    setTermFormOpen(true);
  };

  const openEditTerm = (item: TermItem) => {
    setEditingTerm(item);
    setTermForm({
      name: item.name,
      code: item.code,
      startAt: item.startAt ? item.startAt.slice(0, 10) : '',
      endAt: item.endAt ? item.endAt.slice(0, 10) : '',
    });
    setTermFormOpen(true);
  };

  const submitTerm = async () => {
    if (!termForm.name.trim() || !termForm.code.trim()) {
      error('请完整填写学期名称和编码');
      return;
    }
    setSavingTerm(true);
    const payload = {
      name: termForm.name.trim(),
      code: termForm.code.trim(),
      startAt: termForm.startAt || null,
      endAt: termForm.endAt || null,
    };
    const response = editingTerm
      ? await adminTermApi.update(editingTerm.id, payload)
      : await adminTermApi.create({ ...payload, status: TermStatus.PLANNING });
    setSavingTerm(false);
    if (!response.success) {
      error(response.error || '保存学期失败');
      return;
    }
    success(editingTerm ? '学期已更新' : '学期已创建');
    setTermFormOpen(false);
    await loadTerms();
  };

  const updateTermStatus = async (item: TermItem, status: TermStatus) => {
    const response = await adminTermApi.updateStatus(item.id, status);
    if (!response.success) {
      error(response.error || '更新学期状态失败');
      return;
    }
    success('学期状态已更新');
    await loadTerms();
  };

  const updateClassStatus = async (status: ClassStatus) => {
    if (!selectedClass) return;
    const response = await adminClassApi.updateStatus(selectedClass.id, status);
    if (!response.success || !response.data) {
      error(response.error || '更新班级状态失败');
      return;
    }
    setSelectedClass(response.data);
    success('班级状态已更新');
    await loadClasses(classPage);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">班级组织</h2>
          <p className="mt-1 text-sm text-default-500">维护教学学期与全校班级结构，支撑后续作业和教学分发闭环。</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'terms') void loadTerms();
            else void loadClasses(classPage);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loadingTerms || loadingClasses ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="card-surface inline-flex rounded-2xl p-1">
        {([
          { key: 'terms', label: '学期管理' },
          { key: 'classes', label: '班级总览' },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === item.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'terms' && (
        <div className="card-surface rounded-3xl p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <ToolbarSearchField value={termKeyword} onChange={setTermKeyword} onEnter={() => void loadTerms()} placeholder="搜索学期名称或编码" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => void loadTerms()} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                查询
              </button>
              <button onClick={openCreateTerm} className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                <Plus className="h-4 w-4" />
                新建学期
              </button>
            </div>
          </div>

          {loadingTerms && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载学期列表...
            </div>
          )}

          {!loadingTerms && termError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{termError}</div>
          )}

          {!loadingTerms && !termError && terms.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              当前还没有学期，可以先创建 2026 春季 / 秋季等教学周期。
            </div>
          )}

          {!loadingTerms && !termError && terms.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">学期</th>
                    <th className="px-4 py-3 font-medium">时间范围</th>
                    <th className="px-4 py-3 font-medium">班级数</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((item) => {
                    const statusMeta = getTermStatusMeta(item.status);
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.code}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(item.startAt)} - {formatDate(item.endAt)}</td>
                        <td className="px-4 py-4 text-slate-600">{item.classCount}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEditTerm(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                              编辑
                            </button>
                            {item.status !== TermStatus.ACTIVE && (
                              <button onClick={() => void updateTermStatus(item, TermStatus.ACTIVE)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                                启用
                              </button>
                            )}
                            {item.status !== TermStatus.ARCHIVED && (
                              <button onClick={() => void updateTermStatus(item, TermStatus.ARCHIVED)} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                                <Archive className="h-3.5 w-3.5" />
                                归档
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="card-surface rounded-3xl p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px_220px]">
              <ToolbarSearchField value={classKeyword} onChange={setClassKeyword} onEnter={() => void loadClasses(1)} placeholder="搜索班级、编码或教师名称" />
              <ToolbarSelect
                ariaLabel="按学期筛选"
                value={termFilter || 'all'}
                onChange={(value) => setTermFilter(value === 'all' ? '' : value)}
                options={[
                  { key: 'all', label: '全部学期' },
                  ...terms.map(term => ({ key: String(term.id), label: `${term.name} · ${term.code}` })),
                ]}
              />
              <ToolbarSelect
                ariaLabel="按状态筛选"
                value={statusFilter || 'all'}
                onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                options={[
                  { key: 'all', label: '全部状态' },
                  { key: String(ClassStatus.ACTIVE), label: '活跃中' },
                  { key: String(ClassStatus.DISABLED), label: '已停用' },
                  { key: String(ClassStatus.ARCHIVED), label: '已归档' },
                ]}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => void loadClasses(1)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                应用筛选
              </button>
            </div>

            {loadingClasses && (
              <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在同步班级总览...
              </div>
            )}

            {!loadingClasses && classError && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{classError}</div>
            )}

            {!loadingClasses && !classError && classItems.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                当前还没有班级数据。
              </div>
            )}

            {!loadingClasses && !classError && classItems.length > 0 && (
              <>
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-3 font-medium">班级</th>
                        <th className="px-4 py-3 font-medium">任课教师</th>
                        <th className="px-4 py-3 font-medium">成员</th>
                        <th className="px-4 py-3 font-medium">状态</th>
                        <th className="px-4 py-3 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classItems.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.termName} · {item.code}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{item.ownerTeacherName}</td>
                          <td className="px-4 py-4 text-slate-600">{item.activeMemberCount} / {item.memberCount}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getClassStatusMeta(item.status).className}`}>{getClassStatusMeta(item.status).label}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button onClick={() => void openClassDetail(item.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                              查看
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                  <span>第 {classPage} / {totalPages} 页，共 {classes.total} 个班级</span>
                  <div className="flex gap-2">
                    <button disabled={classPage <= 1} onClick={() => void loadClasses(classPage - 1)} className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40">
                      上一页
                    </button>
                    <button disabled={classPage >= totalPages} onClick={() => void loadClasses(classPage + 1)} className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40">
                      下一页
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card-surface rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <School2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">班级详情</h3>
                <p className="text-sm text-slate-500">查看组织信息并执行停用 / 归档操作。</p>
              </div>
            </div>

            {detailLoading && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在获取班级详情...
              </div>
            )}

            {!detailLoading && !selectedClass && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                从左侧选择一个班级后，这里会显示学期、成员规模和状态操作。
              </div>
            )}

            {!detailLoading && selectedClass && (
              <div className="mt-6 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{selectedClass.code}</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">{selectedClass.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{selectedClass.termName} · {selectedClass.ownerTeacherName}</div>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">班级状态</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getClassStatusMeta(selectedClass.status).className}`}>{getClassStatusMeta(selectedClass.status).label}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">成员规模</div>
                    <div className="mt-2 font-semibold text-slate-700">{selectedClass.activeMemberCount} / {selectedClass.memberCount}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">最近更新时间</div>
                    <div className="mt-2 font-semibold text-slate-700">{formatDateTime(selectedClass.updatedAt)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">班级说明</div>
                    <div className="mt-2 text-slate-700">{selectedClass.description || '暂无说明'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedClass.status !== ClassStatus.ACTIVE && (
                    <button onClick={() => void updateClassStatus(ClassStatus.ACTIVE)} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                      设为活跃
                    </button>
                  )}
                  {selectedClass.status !== ClassStatus.DISABLED && (
                    <button onClick={() => void updateClassStatus(ClassStatus.DISABLED)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
                      停用班级
                    </button>
                  )}
                  {selectedClass.status !== ClassStatus.ARCHIVED && (
                    <button onClick={() => void updateClassStatus(ClassStatus.ARCHIVED)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                      归档班级
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PageDialog isOpen={termFormOpen} onClose={() => setTermFormOpen(false)} panelClassName="max-w-2xl">
        <div className="flex items-center justify-between border-b border-default-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-foreground">{editingTerm ? '编辑学期' : '新建学期'}</h3>
            <p className="mt-1 text-sm text-default-500">学期是班级组织的上层容器，M1 阶段所有班级都必须挂靠学期。</p>
          </div>
          <button onClick={() => setTermFormOpen(false)} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-slate-700">学期名称</div>
              <input
                value={termForm.name}
                onChange={(event) => setTermForm(prev => ({ ...prev, name: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder="例如 2026 春季学期"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">学期编码</div>
              <input
                value={termForm.code}
                onChange={(event) => setTermForm(prev => ({ ...prev, code: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder="例如 2026-SPRING"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">开始日期</div>
              <input
                type="date"
                value={termForm.startAt}
                onChange={(event) => setTermForm(prev => ({ ...prev, startAt: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">结束日期</div>
              <input
                type="date"
                value={termForm.endAt}
                onChange={(event) => setTermForm(prev => ({ ...prev, endAt: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-default-100 bg-slate-50 px-6 py-4">
          <button onClick={() => setTermFormOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={() => void submitTerm()}
            disabled={savingTerm}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:opacity-50"
          >
            {savingTerm && <Loader2 className="h-4 w-4 animate-spin" />}
            保存学期
          </button>
        </div>
      </PageDialog>

      <ToastContainer toast={toast} onClose={hideToast} />
    </motion.div>
  );
};

export default AdminClassesPage;
