import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, FolderGit, RefreshCw } from 'lucide-react';
import AgentManualEditor from '@/components/admin/AgentManualEditor';
import { ToolbarSearchField } from '@/components/common/ToolbarControls';
import { teacherManualApi, type TeacherManualListItem } from '@/services/teacherManual';
import { useTranslation } from 'react-i18next';

const TeacherManualsPage: React.FC = () => {
  const { t } = useTranslation('teacherManuals');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TeacherManualListItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TeacherManualListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const response = await teacherManualApi.list({ page: 1, pageSize: 50, q: query });
    if (response.success && response.data) {
      setItems(response.data.list);
      setSelected(current => current ? response.data!.list.find(item => item.id === current.id) || response.data!.list[0] || null : response.data!.list[0] || null);
    } else {
      setItems([]);
      setSelected(null);
      setError(response.error || t('loadFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="card-surface rounded-xl">
        <div className="border-b border-default-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">{t('title')}</h2>
              <p className="mt-1 text-xs text-default-500">{t('subtitle')}</p>
            </div>
            <button
              onClick={() => void load()}
              title={t('refresh')}
              className="rounded-lg border border-default-200 p-2 text-default-500 hover:bg-default-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <ToolbarSearchField
            value={query}
            onChange={setQuery}
            onEnter={() => void load()}
            placeholder={t('searchPlaceholder')}
            className="mt-4"
          />
        </div>
        <div className="max-h-[72vh] overflow-y-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={`w-full border-b border-default-100 px-5 py-4 text-left transition hover:bg-default-50 ${
                selected?.id === item.id ? 'bg-primary-50' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 truncate text-xs text-default-500">{item.sourceName}</div>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                  item.isPublished ? 'bg-success-50 text-success-700' : 'bg-default-100 text-default-600'
                }`}>
                  {item.isPublished ? t('published') : t('draft')}
                </span>
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && (
            <div className="px-5 py-10 text-center">
              <div className="text-sm text-default-500">{error || t('empty')}</div>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/teacher/courses')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-default-200 px-3 py-2 text-sm font-medium text-default-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                >
                  <BookOpen className="h-4 w-4" />
                  {t('goCourses')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/teacher/projects')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-default-200 px-3 py-2 text-sm font-medium text-default-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                >
                  <FolderGit className="h-4 w-4" />
                  {t('goProjects')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card-surface rounded-xl p-6">
        {selected ? (
          <AgentManualEditor
            sourceType={selected.sourceType}
            sourceId={selected.sourceId}
            sourceName={selected.sourceName}
          />
        ) : (
          <div className="flex min-h-[400px] items-center justify-center text-sm text-default-400">
            {t('selectPrompt')}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TeacherManualsPage;
