import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { ToolbarSearchField } from '@/components/common/ToolbarControls';
import { teacherProgressApi, type TeacherProgressItem, type TeacherProgressView } from '@/services/teacherProgress';
import { useTranslation } from 'react-i18next';
import { getCurrentLocale } from '@/i18n';

const TeacherStudentsPage: React.FC = () => {
  const { t } = useTranslation('teacherStudents');
  const [view, setView] = useState<TeacherProgressView>('course');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TeacherProgressItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherProgressApi.list({ view, q: query, page, pageSize });
    if (response.success && response.data) {
      setItems(response.data.list);
      setTotal(response.data.total);
      setSummary(response.data.summary);
    } else {
      setItems([]);
      setTotal(0);
      setSummary({ total: 0, inProgress: 0, completed: 0 });
      setError(response.error || t('loadFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [view, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-default-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-default-200 bg-white px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card-surface rounded-xl p-5">
          <div className="text-sm text-default-500">{t('totalRecords')}</div>
          <div className="mt-3 text-3xl font-bold text-foreground">{summary.total}</div>
        </div>
        <div className="card-surface rounded-xl p-5">
          <div className="text-sm text-default-500">{t('inProgress')}</div>
          <div className="mt-3 text-3xl font-bold text-primary-600">{summary.inProgress}</div>
        </div>
        <div className="card-surface rounded-xl p-5">
          <div className="text-sm text-default-500">{t('completed')}</div>
          <div className="mt-3 text-3xl font-bold text-success-600">{summary.completed}</div>
        </div>
      </div>

      <div className="card-surface rounded-xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            {([
              { key: 'course', label: t('courseView') },
              { key: 'project', label: t('projectView') },
            ] as const).map(item => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  setPage(1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === item.key ? 'bg-primary-600 text-white' : 'bg-default-100 text-default-600 hover:bg-default-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <ToolbarSearchField
              value={query}
              onChange={setQuery}
              onEnter={() => {
                setPage(1);
                void load();
              }}
              placeholder={t('searchPlaceholder')}
              className="min-w-[260px]"
            />
            <button
              onClick={() => {
                setPage(1);
                void load();
              }}
              className="h-12 rounded-2xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              {t('search')}
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-default-500">
                <th className="px-4 py-3 font-medium">{t('student')}</th>
                <th className="px-4 py-3 font-medium">{view === 'course' ? t('course') : t('project')}</th>
                <th className="px-4 py-3 font-medium">{t('progress')}</th>
                <th className="px-4 py-3 font-medium">{t('status')}</th>
                <th className="px-4 py-3 font-medium">{t('recentActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={`${item.type}-${item.userId}-${item.resourceId}`} className="border-t border-default-100">
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{item.fullName || item.username}</div>
                    <div className="text-xs text-default-400">@{item.username}</div>
                  </td>
                  <td className="px-4 py-4 text-foreground">{item.resourceTitle}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-foreground">{item.progressPercent}%</div>
                    <div className="text-xs text-default-400">{item.completedCount}/{item.totalCount}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.status === 2 ? 'bg-success-50 text-success-700' : item.status === 1 ? 'bg-primary-50 text-primary-700' : 'bg-default-100 text-default-600'
                    }`}>
                      {item.status === 2 ? t('completed') : item.status === 1 ? t('inProgress') : t('notStarted')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-default-500">{item.lastActiveAt ? new Date(item.lastActiveAt).toLocaleString(getCurrentLocale(), { hour12: false }) : '—'}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-default-400">{error || t('empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-default-100 pt-4 text-sm text-default-500">
          <span>{t('pageSummary', { page, totalPages, total })}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(current => Math.max(1, current - 1))}
              className="rounded-lg border border-default-200 px-3 py-1.5 disabled:opacity-40"
            >
              {t('previous')}
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              className="rounded-lg border border-default-200 px-3 py-1.5 disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TeacherStudentsPage;
