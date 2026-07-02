import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { teacherAssignmentApi, type GradeStatus, type TeacherGradeItem } from '@/services/assignment';
import { teacherClassApi } from '@/services/teacherClass';
import type { ClassItem } from '@/services/classroom';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getCurrentLocale } from '@/i18n';

const getGradeStatusLabel = (t: TFunction<'teacherGrades'>): Record<GradeStatus, string> => ({
  pending: t('pending'), auto_checked: t('autoChecked'), reviewed: t('reviewed'), published: t('published'),
});

const gradeStatusClass: Record<GradeStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  auto_checked: 'bg-cyan-50 text-cyan-700',
  reviewed: 'bg-violet-50 text-violet-700',
  published: 'bg-emerald-50 text-emerald-700',
};

const formatDateTime = (value: string | null | undefined, t: TFunction<'teacherGrades'>) => (value ? new Date(value).toLocaleString(getCurrentLocale(), { hour12: false }) : t('notPublished'));

const TeacherGradesPage: React.FC = () => {
  const { t } = useTranslation('teacherGrades');
  const gradeStatusLabel = getGradeStatusLabel(t);
  const navigate = useNavigate();
  const [items, setItems] = useState<TeacherGradeItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [gradeStatus, setGradeStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherAssignmentApi.grades({
      page: 1,
      pageSize: 80,
      q: keyword,
      gradeStatus,
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
    void load();
  }, []);

  const averageScore = useMemo(() => {
    if (items.length === 0) return 0;
    const totalScore = items.reduce((sum, item) => sum + (item.maxScore > 0 ? item.score / item.maxScore : 0), 0);
    return Math.round((totalScore / items.length) * 100);
  }, [items]);

  const downloadCSV = () => {
    const rows = [
      [t('csvAssignment'), t('csvClass'), t('csvStudent'), t('csvAccount'), t('csvScore'), t('csvMaxScore'), t('csvStatus'), t('csvPublishedAt'), t('csvUpdatedAt')],
      ...items.map((item) => [
        item.assignmentTitle,
        item.className,
        item.studentName,
        item.studentUsername,
        String(item.score),
        String(item.maxScore),
        gradeStatusLabel[item.status] || item.status,
        formatDateTime(item.publishedAt, t),
        formatDateTime(item.updatedAt, t),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teacher-grades-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card-surface overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <Award className="h-3.5 w-3.5" />
                {t('badge')}
              </div>
              <h1 className="text-2xl font-bold">{t('title')}</h1><p className="mt-2 text-sm text-slate-300">{t('subtitle')}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">{t('summary', { average: averageScore, total })}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <ToolbarSearchField
            value={keyword}
            onChange={setKeyword}
            onEnter={() => void load()}
            placeholder={t('search')}
            className="flex-1"
          />
          <ToolbarSelect
            ariaLabel={t('statusFilter')}
            value={gradeStatus || 'all'}
            onChange={(value) => setGradeStatus(value === 'all' ? '' : value)}
            options={[
              { key: 'all', label: t('allStatuses') }, { key: 'auto_checked', label: t('autoChecked') }, { key: 'reviewed', label: t('reviewed') }, { key: 'published', label: t('published') },
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
          <button onClick={() => void load()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button onClick={downloadCSV} disabled={items.length === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:bg-slate-300">
            <Download className="h-4 w-4" />
            CSV
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
                    <th className="px-4 py-3">{t('assignmentStudent')}</th><th className="px-4 py-3">{t('class')}</th><th className="px-4 py-3">{t('score')}</th><th className="px-4 py-3">{t('status')}</th><th className="px-4 py-3">{t('updatedAt')}</th><th className="px-4 py-3 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.gradeId} className="hover:bg-slate-50">
                      <td className="min-w-0 px-4 py-3">
                        <div className="truncate font-bold text-slate-900">{item.assignmentTitle}</div>
                        <div className="truncate text-xs text-slate-400">{item.studentName || item.studentUsername} · @{item.studentUsername}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.className || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.score}/{item.maxScore}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${gradeStatusClass[item.status] || gradeStatusClass.pending}`}>{gradeStatusLabel[item.status] || item.status}</span></td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(item.updatedAt, t)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate(`/teacher/submissions/${item.submissionId}`)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">
                          <Eye className="h-3.5 w-3.5" />
                          {t('submissionDetails')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherGradesPage;
