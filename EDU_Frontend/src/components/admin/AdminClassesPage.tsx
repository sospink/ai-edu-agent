import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('adminClasses');
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
      setTermError(response.error || t('loadTermsFailed'));
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
      setClassError(response.error || t('loadClassesFailed'));
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
      error(response.error || t('loadDetailFailed'));
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
      error(t('termRequired'));
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
      error(response.error || t('saveTermFailed'));
      return;
    }
    success(editingTerm ? t('termUpdated') : t('termCreated'));
    setTermFormOpen(false);
    await loadTerms();
  };

  const updateTermStatus = async (item: TermItem, status: TermStatus) => {
    const response = await adminTermApi.updateStatus(item.id, status);
    if (!response.success) {
      error(response.error || t('termStatusFailed'));
      return;
    }
    success(t('termStatusUpdated'));
    await loadTerms();
  };

  const updateClassStatus = async (status: ClassStatus) => {
    if (!selectedClass) return;
    const response = await adminClassApi.updateStatus(selectedClass.id, status);
    if (!response.success || !response.data) {
      error(response.error || t('classStatusFailed'));
      return;
    }
    setSelectedClass(response.data);
    success(t('classStatusUpdated'));
    await loadClasses(classPage);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-default-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'terms') void loadTerms();
            else void loadClasses(classPage);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loadingTerms || loadingClasses ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      <div className="card-surface inline-flex rounded-2xl p-1">
        {([
          { key: 'terms', label: t('termsTab') },
          { key: 'classes', label: t('classesTab') },
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
              <ToolbarSearchField value={termKeyword} onChange={setTermKeyword} onEnter={() => void loadTerms()} placeholder={t('searchTerms')} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => void loadTerms()} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                {t('search')}
              </button>
              <button onClick={openCreateTerm} className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                <Plus className="h-4 w-4" />
                {t('newTerm')}
              </button>
            </div>
          </div>

          {loadingTerms && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loadingTerms')}
            </div>
          )}

          {!loadingTerms && termError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{termError}</div>
          )}

          {!loadingTerms && !termError && terms.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {t('emptyTerms')}
            </div>
          )}

          {!loadingTerms && !termError && terms.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">{t('term')}</th>
                    <th className="px-4 py-3 font-medium">{t('dateRange')}</th>
                    <th className="px-4 py-3 font-medium">{t('classCount')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('actions')}</th>
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
                              {t('edit')}
                            </button>
                            {item.status !== TermStatus.ACTIVE && (
                              <button onClick={() => void updateTermStatus(item, TermStatus.ACTIVE)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                                {t('activate')}
                              </button>
                            )}
                            {item.status !== TermStatus.ARCHIVED && (
                              <button onClick={() => void updateTermStatus(item, TermStatus.ARCHIVED)} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                                <Archive className="h-3.5 w-3.5" />
                                {t('archive')}
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
              <ToolbarSearchField value={classKeyword} onChange={setClassKeyword} onEnter={() => void loadClasses(1)} placeholder={t('searchClasses')} />
              <ToolbarSelect
                ariaLabel={t('termFilter')}
                value={termFilter || 'all'}
                onChange={(value) => setTermFilter(value === 'all' ? '' : value)}
                options={[
                  { key: 'all', label: t('allTerms') },
                  ...terms.map(term => ({ key: String(term.id), label: `${term.name} · ${term.code}` })),
                ]}
              />
              <ToolbarSelect
                ariaLabel={t('statusFilter')}
                value={statusFilter || 'all'}
                onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                options={[
                  { key: 'all', label: t('allStatuses') },
                  { key: String(ClassStatus.ACTIVE), label: t('active') },
                  { key: String(ClassStatus.DISABLED), label: t('disabled') },
                  { key: String(ClassStatus.ARCHIVED), label: t('archived') },
                ]}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => void loadClasses(1)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                {t('applyFilters')}
              </button>
            </div>

            {loadingClasses && (
              <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loadingClasses')}
              </div>
            )}

            {!loadingClasses && classError && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{classError}</div>
            )}

            {!loadingClasses && !classError && classItems.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {t('emptyClasses')}
              </div>
            )}

            {!loadingClasses && !classError && classItems.length > 0 && (
              <>
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-3 font-medium">{t('className')}</th>
                        <th className="px-4 py-3 font-medium">{t('teacher')}</th>
                        <th className="px-4 py-3 font-medium">{t('members')}</th>
                        <th className="px-4 py-3 font-medium">{t('status')}</th>
                        <th className="px-4 py-3 font-medium text-right">{t('actions')}</th>
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
                              {t('view')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                  <span>{t('pagination', { page: classPage, totalPages, total: classes.total })}</span>
                  <div className="flex gap-2">
                    <button disabled={classPage <= 1} onClick={() => void loadClasses(classPage - 1)} className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40">
                      {t('previous')}
                    </button>
                    <button disabled={classPage >= totalPages} onClick={() => void loadClasses(classPage + 1)} className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40">
                      {t('next')}
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
                <h3 className="text-lg font-bold text-slate-900">{t('detailTitle')}</h3>
                <p className="text-sm text-slate-500">{t('detailSubtitle')}</p>
              </div>
            </div>

            {detailLoading && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loadingDetail')}
              </div>
            )}

            {!detailLoading && !selectedClass && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {t('detailEmpty')}
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
                    <div className="text-xs text-slate-400">{t('classStatus')}</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getClassStatusMeta(selectedClass.status).className}`}>{getClassStatusMeta(selectedClass.status).label}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">{t('memberScale')}</div>
                    <div className="mt-2 font-semibold text-slate-700">{selectedClass.activeMemberCount} / {selectedClass.memberCount}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">{t('updatedAt')}</div>
                    <div className="mt-2 font-semibold text-slate-700">{formatDateTime(selectedClass.updatedAt)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs text-slate-400">{t('description')}</div>
                    <div className="mt-2 text-slate-700">{selectedClass.description || t('noDescription')}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedClass.status !== ClassStatus.ACTIVE && (
                    <button onClick={() => void updateClassStatus(ClassStatus.ACTIVE)} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                      {t('setActive')}
                    </button>
                  )}
                  {selectedClass.status !== ClassStatus.DISABLED && (
                    <button onClick={() => void updateClassStatus(ClassStatus.DISABLED)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
                      {t('disableClass')}
                    </button>
                  )}
                  {selectedClass.status !== ClassStatus.ARCHIVED && (
                    <button onClick={() => void updateClassStatus(ClassStatus.ARCHIVED)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                      {t('archiveClass')}
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
            <h3 className="text-lg font-bold text-foreground">{editingTerm ? t('editTerm') : t('newTerm')}</h3>
            <p className="mt-1 text-sm text-default-500">{t('dialogSubtitle')}</p>
          </div>
          <button onClick={() => setTermFormOpen(false)} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('termName')}</div>
              <input
                value={termForm.name}
                onChange={(event) => setTermForm(prev => ({ ...prev, name: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder={t('termNamePlaceholder')}
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('termCode')}</div>
              <input
                value={termForm.code}
                onChange={(event) => setTermForm(prev => ({ ...prev, code: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition placeholder:font-medium placeholder:text-default-400 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
                placeholder={t('termCodePlaceholder')}
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('startDate')}</div>
              <input
                type="date"
                value={termForm.startAt}
                onChange={(event) => setTermForm(prev => ({ ...prev, startAt: event.target.value }))}
                className="h-[46px] w-full rounded-xl border border-default-200 bg-default-50 px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('endDate')}</div>
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
            {t('cancel')}
          </button>
          <button
            onClick={() => void submitTerm()}
            disabled={savingTerm}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:opacity-50"
          >
            {savingTerm && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('saveTerm')}
          </button>
        </div>
      </PageDialog>

      <ToastContainer toast={toast} onClose={hideToast} />
    </motion.div>
  );
};

export default AdminClassesPage;
