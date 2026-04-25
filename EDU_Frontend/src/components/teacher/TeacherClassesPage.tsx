import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Select, SelectItem } from '@heroui/react';
import { Download, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCw, UploadCloud, Users, X } from 'lucide-react';
import { teacherClassApi } from '@/services/teacherClass';
import type {
  ClassDetail,
  ClassItem,
  ClassMemberItem,
  ClassroomListResponse,
  ImportMembersResult,
  TermItem,
} from '@/services/classroom';
import { ClassStatus, formatDate, formatDateTime, getClassStatusMeta, getTermStatusMeta } from '@/services/classroom';
import PageDialog from '@/components/common/PageDialog';
import PageDrawer from '@/components/common/PageDrawer';
import { dialogSelectClassNames, dialogSelectItemClassNames } from '@/components/common/dialogSelectStyles';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { ToastContainer, useToast } from '@/components/common/Toast';

interface ClassFormState {
  termId: string;
  name: string;
  code: string;
  description: string;
}

const defaultForm: ClassFormState = {
  termId: '',
  name: '',
  code: '',
  description: '',
};

const TeacherClassesPage: React.FC = () => {
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [listState, setListState] = useState<ClassroomListResponse>({ list: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<ClassMemberItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [formState, setFormState] = useState<ClassFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportMembersResult | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ClassMemberItem | null>(null);
  const { toast, hideToast, success, error: showError } = useToast();

  const pageSize = 10;
  const page = listState.page || 1;
  const totalPages = useMemo(() => Math.max(1, Math.ceil((listState.total || 0) / pageSize)), [listState.total]);
  const classItems = Array.isArray(listState.list) ? listState.list : [];

  const loadTerms = async () => {
    const response = await teacherClassApi.getTerms();
    setTerms(response.success && response.data ? response.data : []);
  };

  const loadClasses = async (nextPage = page) => {
    setLoading(true);
    setError(null);
    const response = await teacherClassApi.getList({
      page: nextPage,
      pageSize,
      keyword,
      termId: termFilter ? Number(termFilter) : undefined,
      status: statusFilter ? Number(statusFilter) : undefined,
    });
    if (response.success && response.data) {
      setListState(response.data);
    } else {
      setListState({ list: [], total: 0, page: nextPage, pageSize });
      setError(response.error || '获取班级列表失败');
    }
    setLoading(false);
  };

  const openDetail = async (item: ClassItem) => {
    setDetailLoading(true);
    const [detailResp, membersResp] = await Promise.all([
      teacherClassApi.getById(item.id),
      teacherClassApi.getMembers(item.id),
    ]);
    if (detailResp.success && detailResp.data) {
      setSelectedClass(detailResp.data);
    } else {
      setSelectedClass(null);
      showError(detailResp.error || '获取班级详情失败');
    }
    if (membersResp.success && membersResp.data) {
      setSelectedMembers(membersResp.data);
    } else {
      setSelectedMembers([]);
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    void loadTerms();
    void loadClasses(1);
  }, []);

  const handleSearch = () => {
    void loadClasses(1);
  };

  const resetForm = () => {
    setEditingClass(null);
    setFormState(defaultForm);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (item: ClassItem) => {
    setEditingClass(item);
    setFormState({
      termId: String(item.termId),
      name: item.name,
      code: item.code,
      description: item.description || '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!formState.termId || !formState.name.trim() || !formState.code.trim()) {
      showError('请完整填写学期、班级名称和班级编码');
      return;
    }
    setSubmitting(true);
    const payload = {
      termId: Number(formState.termId),
      name: formState.name.trim(),
      code: formState.code.trim(),
      description: formState.description.trim(),
    };
    const response = editingClass
      ? await teacherClassApi.update(editingClass.id, payload)
      : await teacherClassApi.create(payload);
    setSubmitting(false);
    if (!response.success || !response.data) {
      showError(response.error || '保存班级失败');
      return;
    }
    success(editingClass ? '班级已更新' : '班级已创建');
    setFormOpen(false);
    resetForm();
    await loadClasses(editingClass ? page : 1);
    await openDetail(response.data);
  };

  const submitImport = async () => {
    if (!selectedClass) {
      showError('请先选择班级');
      return;
    }
    if (!importFile) {
      showError('请先选择 CSV 或 XLSX 文件');
      return;
    }
    setImporting(true);
    const response = await teacherClassApi.importMembers(selectedClass.id, importFile);
    setImporting(false);
    if (!response.success || !response.data) {
      showError(response.error || '导入班级成员失败');
      return;
    }
    setImportResult(response.data);
    success('班级成员导入完成');
    await openDetail(selectedClass);
    await loadClasses(page);
  };

  const downloadImportTemplate = () => {
    const rows = [
      ['studentId', 'username', 'email'],
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'class-member-import-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const removeMember = async () => {
    if (!selectedClass || !memberToRemove) return;
    const response = await teacherClassApi.removeMember(selectedClass.id, memberToRemove.userId);
    if (!response.success) {
      showError(response.error || '移除成员失败');
      return;
    }
    success('成员已移除');
    setMemberToRemove(null);
    await openDetail(selectedClass);
    await loadClasses(page);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">班级管理</h2>
          <p className="mt-1 text-sm text-default-500">围绕学期组织班级、导入学生并查看成员状态。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadClasses(page)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            新建班级
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-surface rounded-2xl p-5">
          <div className="text-sm text-slate-500">活跃班级</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{classItems.filter(item => item.status === ClassStatus.ACTIVE).length}</div>
        </div>
        <div className="card-surface rounded-2xl p-5">
          <div className="text-sm text-slate-500">活跃成员总数</div>
          <div className="mt-3 text-3xl font-bold text-primary-600">{classItems.reduce((sum, item) => sum + item.activeMemberCount, 0)}</div>
        </div>
        <div className="card-surface rounded-2xl p-5">
          <div className="text-sm text-slate-500">当前可选学期</div>
          <div className="mt-3 text-3xl font-bold text-emerald-600">{terms.length}</div>
        </div>
      </div>

      <div className="card-surface rounded-3xl p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_220px_220px]">
            <ToolbarSearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder="搜索班级名称、编码或教师名称" />
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
                { key: 'all', label: '默认活跃班级' },
                { key: String(ClassStatus.ACTIVE), label: '活跃中' },
                { key: String(ClassStatus.DISABLED), label: '已停用' },
                { key: String(ClassStatus.ARCHIVED), label: '已归档' },
              ]}
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            应用筛选
          </button>
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载班级数据...
          </div>
        )}

        {!loading && error && (
          <div className={`mt-6 rounded-2xl px-5 py-4 text-sm ${error.includes('无权') ? 'border border-amber-200 bg-amber-50 text-amber-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
            {error}
          </div>
        )}

        {!loading && !error && classItems.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            当前筛选条件下还没有班级。可以先新建班级，随后导入学生。
          </div>
        )}

        {!loading && !error && classItems.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">班级</th>
                    <th className="px-4 py-3 font-medium">学期</th>
                    <th className="px-4 py-3 font-medium">成员</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">更新时间</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {classItems.map((item) => {
                    const classMeta = getClassStatusMeta(item.status);
                    const termMeta = getTermStatusMeta(item.termStatus);
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.code}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-700">{item.termName}</div>
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${termMeta.className}`}>{termMeta.label}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{item.activeMemberCount} / {item.memberCount}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classMeta.className}`}>{classMeta.label}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => void openDetail(item)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              查看详情
                            </button>
                            <button
                              onClick={() => openEdit(item)}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              编辑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
              <span>第 {page} / {totalPages} 页，共 {listState.total} 个班级</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => void loadClasses(page - 1)}
                  className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => void loadClasses(page + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <PageDialog isOpen={formOpen} onClose={() => setFormOpen(false)} panelClassName="max-w-2xl">
        <div className="flex items-center justify-between border-b border-default-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-foreground">{editingClass ? '编辑班级' : '新建班级'}</h3>
            <p className="mt-1 text-sm text-default-500">班级必须明确关联学期，后续成员导入会挂在该班级下。</p>
          </div>
          <button onClick={() => setFormOpen(false)} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">所属学期</div>
              <Select
                aria-label="所属学期"
                placeholder={terms.length > 0 ? '请选择学期' : '当前暂无可用学期'}
                selectedKeys={formState.termId ? [formState.termId] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  setFormState(prev => ({ ...prev, termId: typeof selected === 'string' ? selected : '' }));
                }}
                isDisabled={terms.length === 0}
                renderValue={(items) => {
                  if (items.length === 0) {
                    return <span className="text-default-400">{terms.length > 0 ? '请选择学期' : '当前暂无可用学期'}</span>;
                  }
                  return items.map((item) => item.textValue).join(', ');
                }}
                classNames={dialogSelectClassNames}
                listboxProps={{ itemClasses: dialogSelectItemClassNames }}
              >
                {terms.map((term) => (
                  <SelectItem key={String(term.id)} textValue={`${term.name} · ${term.code}`}>
                    {term.name} · {term.code}
                  </SelectItem>
                ))}
              </Select>
              {terms.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">当前没有可选学期，请先在管理端创建并启用学期。</p>
              )}
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">班级编码</div>
              <input
                value={formState.code}
                onChange={(event) => setFormState(prev => ({ ...prev, code: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder="例如 GO-LAB-1"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-slate-700">班级名称</div>
              <input
                value={formState.name}
                onChange={(event) => setFormState(prev => ({ ...prev, name: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder="例如 Go 实训 1 班"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-slate-700">班级说明</div>
              <textarea
                value={formState.description}
                onChange={(event) => setFormState(prev => ({ ...prev, description: event.target.value }))}
                className="min-h-[128px] w-full rounded-xl border border-default-200 bg-default-50 px-4 py-3 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder="补充班级适用对象、培养方向或开课说明"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-default-100 bg-slate-50 px-6 py-4">
          <button onClick={() => setFormOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={() => void submitForm()}
            disabled={submitting || terms.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            保存班级
          </button>
        </div>
      </PageDialog>

      <PageDrawer isOpen={!!selectedClass} onClose={() => setSelectedClass(null)} panelClassName="max-w-2xl">
        {selectedClass && (
          <>
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{selectedClass.code}</div>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedClass.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedClass.termName} · {selectedClass.ownerTeacherName}</p>
                </div>
                <button onClick={() => setSelectedClass(null)} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getClassStatusMeta(selectedClass.status).className}`}>
                  {getClassStatusMeta(selectedClass.status).label}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTermStatusMeta(selectedClass.termStatus).className}`}>
                  {getTermStatusMeta(selectedClass.termStatus).label}
                </span>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">班级说明</div>
                  <div className="mt-2 text-sm text-slate-700">{selectedClass.description || '暂无说明'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">学期时间</div>
                  <div className="mt-2 text-sm text-slate-700">{formatDate(selectedClass.termStartAt)} - {formatDate(selectedClass.termEndAt)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">成员列表</h4>
                  <p className="mt-1 text-sm text-slate-500">导入支持 CSV / XLSX，模板列为 studentId / username / email。</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadImportTemplate}
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    下载模板
                  </button>
                  <button
                    onClick={() => {
                      setImportOpen(true);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    disabled={selectedClass.status !== ClassStatus.ACTIVE}
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <UploadCloud className="h-4 w-4 shrink-0" />
                    导入学生
                  </button>
                </div>
              </div>

              {selectedClass.status !== ClassStatus.ACTIVE && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  当前班级不是活跃状态，已禁用成员导入。后续若重新启用，可继续补充成员。
                </div>
              )}

              {detailLoading && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在同步班级详情...
                </div>
              )}

              {!detailLoading && selectedMembers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  当前班级还没有成员，可以从 Excel / CSV 模板批量导入。
                </div>
              )}

              {!detailLoading && selectedMembers.length > 0 && (
                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">学生</th>
                        <th className="px-4 py-3 font-medium">账号信息</th>
                        <th className="px-4 py-3 font-medium">加入时间</th>
                        <th className="px-4 py-3 font-medium">状态</th>
                        <th className="px-4 py-3 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMembers.map((member) => (
                        <tr key={member.id} className="border-t border-slate-100">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900">{member.fullName || member.username}</div>
                            <div className="mt-1 text-xs text-slate-400">学号：{member.studentId || '—'}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            <div>@{member.username}</div>
                            <div className="mt-1 text-xs text-slate-400">{member.email}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-500">{formatDateTime(member.joinedAt)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${member.status === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {member.status === 1 ? '在班' : '已移除'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {member.status === 1 ? (
                              <button
                                onClick={() => setMemberToRemove(member)}
                                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                移除
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">已失效</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </PageDrawer>

      <PageDialog isOpen={importOpen && !!selectedClass} onClose={() => setImportOpen(false)} panelClassName="max-w-3xl">
        <div className="flex items-center justify-between border-b border-default-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-foreground">导入班级成员</h3>
            <p className="mt-1 text-sm text-default-500">班级：{selectedClass?.name}。支持 `.csv` 和 `.xlsx`，首行必须包含 `studentId / username / email`。</p>
          </div>
          <button onClick={() => setImportOpen(false)} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-primary-400 hover:bg-primary-50/40">
            <FileSpreadsheet className="h-10 w-10 text-slate-400" />
            <div className="mt-4 text-base font-semibold text-slate-700">{importFile ? importFile.name : '点击选择成员模板文件'}</div>
            <div className="mt-2 text-sm text-slate-500">建议先导出你的班级花名册为 CSV 或 Excel，再按模板列整理。</div>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
            />
          </label>

          {importResult && (
            <div className="card-surface-muted space-y-4 rounded-3xl p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs text-slate-400">总行数</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{importResult.summary.total}</div>
                </div>
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs text-slate-400">导入成功</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-600">{importResult.summary.imported}</div>
                </div>
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs text-slate-400">已跳过</div>
                  <div className="mt-2 text-2xl font-bold text-amber-600">{importResult.summary.skipped}</div>
                </div>
                <div className="card-surface rounded-2xl p-4">
                  <div className="text-xs text-slate-400">失败行</div>
                  <div className="mt-2 text-2xl font-bold text-rose-600">{importResult.summary.failed}</div>
                </div>
              </div>
              <div className="card-surface max-h-72 overflow-y-auto rounded-2xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">行号</th>
                      <th className="px-4 py-3 font-medium">匹配方式</th>
                      <th className="px-4 py-3 font-medium">结果</th>
                      <th className="px-4 py-3 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.rows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.reason}`} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-600">{row.rowNumber}</td>
                        <td className="px-4 py-3 text-slate-500">{row.matchedBy || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.status === 'imported' ? 'bg-emerald-50 text-emerald-700' : row.status === 'skipped' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {row.status === 'imported' ? '已导入' : row.status === 'skipped' ? '已跳过' : '失败'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default-100 bg-slate-50 px-6 py-4">
          <button
            onClick={downloadImportTemplate}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
          >
            <Download className="h-4 w-4 shrink-0" />
            下载模板
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setImportOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
              关闭
            </button>
            <button
              onClick={() => void submitImport()}
              disabled={importing}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              开始导入
            </button>
          </div>
        </div>
      </PageDialog>

      <ConfirmDialog
        isOpen={!!memberToRemove}
        title="移除班级成员"
        message={memberToRemove ? `确认将 ${memberToRemove.fullName || memberToRemove.username} 从当前班级中移除吗？该操作会保留历史记录。` : ''}
        confirmText="确认移除"
        cancelText="取消"
        type="warning"
        onCancel={() => setMemberToRemove(null)}
        onConfirm={() => void removeMember()}
      />

      <ToastContainer toast={toast} onClose={hideToast} />
    </motion.div>
  );
};

export default TeacherClassesPage;
