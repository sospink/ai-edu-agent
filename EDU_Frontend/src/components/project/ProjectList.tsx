import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, Filter, Loader2, Search } from 'lucide-react';
import type { Project, ProjectDifficulty } from '@/types/project';
import type { User } from '@/types';
import { getDifficultyLevel } from '@/types/project';
import { projectApi, tagApi, type Tag } from '@/services/project';
import { getImageUrlCandidates, handleImageFallback } from '@/config';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface ProjectListProps {
  onProjectSelect: (project: Project) => void;
  currentUser: User | null;
  onLoginRequired: () => void;
  initialProjectId?: number | null;
}

const getLevelBadge = (level: ProjectDifficulty, t: TFunction<'project'>) => {
  switch (level) {
    case 'Beginner':
      return { label: t('beginner'), className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'Intermediate':
      return { label: t('intermediate'), className: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'Advanced':
      return { label: t('advanced'), className: 'bg-amber-100 text-amber-700 border-amber-200' };
    default:
      return { label: t('unrated'), className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
};

const getEstimatedDuration = (labsCount: number, challengesCount: number, t: TFunction<'project'>, durationMinutes?: number): string => {
  const totalMinutes = durationMinutes ?? ((labsCount || 0) * 15 + (challengesCount || 0) * 30);
  if (totalMinutes < 60) return t('durationMinutes', { minutes: totalMinutes || 30 });
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? t('durationHoursMinutes', { hours, minutes: mins }) : t('durationHours', { hours });
};

const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect, initialProjectId }) => {
  const { t, i18n } = useTranslation('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [openedInitialProjectId, setOpenedInitialProjectId] = useState<number | null>(null);

  const loadProjects = async (keyword?: string, tagId?: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await projectApi.getList({
        page: 1,
        pageSize: 20,
        status: 1,
        keyword: keyword || undefined,
        tagId: tagId || undefined,
      });
      if (result.success && result.data) {
        setProjects(result.data.list as Project[]);
      } else {
        setLoadError(result.error || t('loadFailed'));
      }
    } catch (error) {
      console.error('加载项目失败:', error);
      setLoadError(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const result = await tagApi.getAll();
      if (result.success && result.data) {
        setTags(result.data);
      }
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTags();
  }, [i18n.language]);

  useEffect(() => {
    if (!initialProjectId || loading || openedInitialProjectId === initialProjectId) return;
    const matched = projects.find((project) => Number(project.id) === initialProjectId);
    if (matched) {
      setOpenedInitialProjectId(initialProjectId);
      onProjectSelect(matched);
      return;
    }
    const loadInitialProject = async () => {
      setOpenedInitialProjectId(initialProjectId);
      const response = await projectApi.getById(initialProjectId);
      if (response.success && response.data) {
        onProjectSelect(response.data as Project);
      }
    };
    void loadInitialProject();
  }, [initialProjectId, loading, openedInitialProjectId, projects, onProjectSelect]);

  const handleSearch = () => {
    loadProjects(searchQuery, activeFilter || undefined);
  };

  const handleFilterChange = (tagId: number | null) => {
    setActiveFilter(tagId);
    loadProjects(searchQuery, tagId || undefined);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(186,230,253,0.26),transparent_34%),radial-gradient(circle_at_86%_16%,rgba(165,243,252,0.24),transparent_32%),radial-gradient(circle_at_52%_92%,rgba(253,230,138,0.22),transparent_36%)]" />
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-sky-200/55 blur-3xl" />
        <div className="absolute right-[-4%] top-12 h-80 w-80 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-1/3 h-96 w-96 rounded-full bg-amber-100/50 blur-3xl" />
      </div>

      <div className="mx-auto min-h-screen w-full max-w-7xl px-6 pb-20 pt-24 md:px-12">

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-14 text-center">
        <h1 className="mb-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">{t('title')}</h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          {t('desc')}
        </p>

        <div className="relative z-20 mx-auto mt-8 max-w-2xl">
          <div className="absolute inset-0 rounded-2xl bg-sky-200/30 blur-2xl" />
          <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <Search className="ml-5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent px-4 py-3.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="mr-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t('search')}
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-10 flex flex-wrap items-center justify-center gap-3"
      >
        <div className="mr-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Filter className="h-4 w-4" />
          {t('tagFilter')}
        </div>
        <button
          type="button"
          onClick={() => handleFilterChange(null)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            activeFilter === null
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          {t('all')}
        </button>
        {tags.map((tag) => (
          <button
            type="button"
            key={tag.id}
            onClick={() => handleFilterChange(tag.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              activeFilter === tag.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
          <span className="ml-3 text-slate-600">{t('loading')}</span>
        </div>
      )}

      {!loading && loadError && (
        <div className="py-20 text-center">
          <h3 className="text-lg font-bold text-danger-600">{loadError}</h3>
          <button type="button" onClick={() => void loadProjects(searchQuery, activeFilter || undefined)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {t('retry')}
          </button>
        </div>
      )}

      {!loading && !loadError && projects.length === 0 && (
        <div className="py-24 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-700">{t('emptyTitle')}</h3>
          <p className="text-slate-500">{t('emptyDesc')}</p>
        </div>
      )}

      {!loading && !loadError && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => {
            const difficulty = getDifficultyLevel(project.difficulty);
            const level = getLevelBadge(difficulty, t);
            const duration = getEstimatedDuration(project.labsCount, project.challengesCount, t, project.durationMinutes);
            const isActive = hoveredId === Number(project.id);
            const coverCandidates = getImageUrlCandidates(project.coverUrl);
            const coverSrc = coverCandidates[0];

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.06, 0.24), ease: [0.22, 1, 0.36, 1] }}
                onHoverStart={() => setHoveredId(Number(project.id))}
                onHoverEnd={() => setHoveredId(null)}
                onClick={() => onProjectSelect(project)}
                className="group relative mx-auto w-full max-w-[320px] cursor-pointer"
                style={{ perspective: '1200px' }}
              >
                <motion.div
                  className="card-surface relative z-0 h-[230px] rounded-2xl backdrop-blur-sm"
                  animate={{ rotateX: isActive ? 12 : 0, y: isActive ? -4 : 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.8 }}
                  style={{ transformOrigin: 'center bottom', transformStyle: 'preserve-3d' }}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/35 to-slate-100/55" />
                  </div>

                  {[0, 1, 2].map((stackIndex) => {
                    const offsetX = stackIndex === 0 ? 0 : stackIndex === 1 ? -14 : 14;
                    const rotate = stackIndex === 0 ? 0 : stackIndex === 1 ? -4 : 4;
                    const scale = stackIndex === 0 ? 1 : 0.94;
                    const opacity = stackIndex === 0 ? 1 : 0.72;

                    return (
                      <motion.div
                        key={stackIndex}
                        className="card-surface absolute left-1/2 top-7 h-[152px] w-[96px] overflow-hidden rounded-lg"
                        animate={{
                          x: `calc(-50% + ${isActive ? offsetX * 1.25 : offsetX}px)`,
                          rotate: isActive ? rotate * 1.2 : rotate,
                          y: isActive ? -6 : 0,
                          scale,
                          opacity,
                        }}
                        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                        style={{ zIndex: 10 - stackIndex }}
                      >
                        <img
                          src={coverSrc}
                          alt={project.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(event) => handleImageFallback(event, coverCandidates)}
                        />
                      </motion.div>
                    );
                  })}

                  <div
                    className={`pointer-events-none absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${level.className}`}
                  >
                    {level.label}
                  </div>
                  <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-transparent bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {t('classicCard')}
                  </div>
                </motion.div>

                <motion.div
                  className="card-surface absolute bottom-0 left-0 right-0 z-10 overflow-hidden rounded-2xl backdrop-blur"
                  animate={{ rotateX: isActive ? -20 : 0, y: isActive ? 4 : 0 }}
                  transition={{ type: 'spring', stiffness: 210, damping: 25, mass: 0.9 }}
                  style={{ transformOrigin: 'center bottom', transformStyle: 'preserve-3d' }}
                >
                  <div className="px-4 pb-3 pt-3.5">
                    <h3 className="line-clamp-2 min-h-[2.8rem] text-base font-bold leading-snug text-slate-900">
                      {project.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {t('classicSubtitle')}
                    </p>
                    <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-slate-600">
                      {project.subtitle || project.description || t('noDescription')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-dashed border-slate-200 px-4 py-2.5 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      {project.tags && project.tags[0] ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: project.tags[0].styleColor || '#94a3b8' }}
                          />
                          {project.tags[0].name}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Clock className="h-3 w-3" />
                        {duration}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 opacity-0 transition group-hover:opacity-100">
                      {t('enter')}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}

      </div>
    </div>
  );
};

export default ProjectList;
