import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Eye, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { teacherAssignmentApi, type SubmissionListItem } from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getCurrentLocale } from '@/i18n';

const getStatusMeta = (t: TFunction): Record<string, { label: string; className: string }> => ({
  submitted: { label: t('statuses.submitted'), className: 'bg-cyan-50 text-cyan-700' },
  resubmitted: { label: t('statuses.resubmitted'), className: 'bg-blue-50 text-blue-700' },
  returned: { label: t('statuses.returned'), className: 'bg-amber-50 text-amber-700' },
  graded: { label: t('statuses.graded'), className: 'bg-violet-50 text-violet-700' },
});

const TeacherSubmissionsPage: React.FC = () => {
  const { t } = useTranslation('teacherSubmissions');
  const navigate = useNavigate();
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.getSubmissions({
      page: 1,
      pageSize: 50,
      q: keyword,
      status: status || undefined,
      classId: classId ? Number(classId) : undefined,
    });
    if (response.success && response.data) {
      setItems(response.data.list);
      setTotal(response.data.total);
    } else {
      setItems([]);
      setTotal(0);
      setError(response.error || t('loadFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    void teacherClassApi.getList({ page: 1, pageSize: 100, status: 1 }).then((response) => {
      if (response.success && response.data) setClasses(response.data.list);
    });
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 p-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            <ClipboardCheck className="h-3.5 w-3.5" />
            {t('badge')}
          </div>
          <h1 className="mt-3 text-2xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-sm text-slate-300">{t('subtitle')}</p>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void loadData()}
            placeholder={t('searchPlaceholder')}
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel={t('submissionStatusFilter')}
            value={status || 'all'}
            onChange={(value) => setStatus(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: t('allSubmissionStatuses') },
              { key: 'submitted', label: t('statuses.submitted') },
              { key: 'resubmitted', label: t('statuses.resubmitted') },
              { key: 'returned', label: t('statuses.returned') },
              { key: 'graded', label: t('statuses.graded') },
            ]}
            className="lg:w-52"
          />
          <ToolbarSelect
            ariaLabel={t('classFilter')}
            value={classId || 'all'}
            onChange={(value) => setClassId(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: t('allClasses') },
              ...classes.map((item) => ({ key: String(item.id), label: item.name })),
            ]}
            className="lg:w-52"
          />
          <button onClick={() => void loadData()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            {t('refresh')}
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-5 text-sm font-medium text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">{t('empty')}</div>
          ) : (
            <div className="card-surface-muted overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('assignmentStudent')}</th>
                    <th className="px-4 py-3">{t('submissionStatus')}</th>
                    <th className="px-4 py-3">{t('gradeStatus')}</th>
                    <th className="px-4 py-3">{t('submittedAt')}</th>
                    <th className="px-4 py-3 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const statusMeta = getStatusMeta(t);
                    const meta = statusMeta[item.status] || statusMeta.submitted;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="min-w-0 px-4 py-3">
                          <div className="truncate font-bold text-slate-900">{item.assignmentTitle}</div>
                          <div className="truncate text-xs text-slate-400">{item.studentName || item.studentUsername} · {t('attempt', { count: item.attemptNo })}</div>
                        </td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span></td>
                        <td className="px-4 py-3 text-slate-600">{t(`gradeStatuses.${item.gradeStatus === 'auto_checked' ? 'autoChecked' : item.gradeStatus}`, { defaultValue: item.gradeStatus })}</td>
                        <td className="px-4 py-3 text-slate-600">{item.submittedAt ? new Date(item.submittedAt).toLocaleString(getCurrentLocale()) : t('notSet')}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => navigate(`/teacher/submissions/${item.id}`)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                            <Eye className="h-3.5 w-3.5" />
                            {t('review')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs font-medium text-slate-400">{t('total', { count: total })}</div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSubmissionsPage;
