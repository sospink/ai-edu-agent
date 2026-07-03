import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Terminal, Globe, Code2, Layout, Server, Container, 
  Shield, CheckCircle2, Flame, Award, Zap,
  Loader2, AlertCircle, BookOpen, Clock, LucideIcon
} from 'lucide-react';
import { courseApi, studentCourseApi, type Course } from '@/services/course';
import { userService, type StudentLeaderboardItem } from '@/services/user';
import { emptyLearningOverview, learningOverviewApi, type LearningOverview } from '@/services/learningOverview';
import StudyAssignmentsSection from './StudyAssignmentsSection';
import type { Skill, SkillStage } from '@/types/skill';
import { RoleType, type User } from '@/types';
import { studentClassApi } from '@/services/studentClass';
import { ClassStatus, type ClassItem } from '@/services/classroom';
import { 
  CourseDifficulty, CourseStatus, LessonType,
  lessonTypeToString, formatDuration, levelLabelToLevel
} from '@/types/skill';
import { localizeSeededClassName, localizeSeededClassText } from '@/utils/seededContentLocale';

interface SkillListProps {
  onSkillSelect: (skill: Skill) => void;
  currentUser: User | null;
  onLoginRequired: () => void;
  initialCourseId?: number | null;
}

// 图标映射
const iconMap: Record<string, LucideIcon> = {
  'terminal': Terminal,
  'globe': Globe,
  'code': Code2,
  'layout': Layout,
  'server': Server,
  'container': Container,
  'layers': Container,
  'shield': Shield,
  'cpu': Server,
};

// 根据图标URL获取图标组件
const getIconComponent = (iconUrl: string): LucideIcon => {
  const iconName = iconUrl.replace('/icons/', '').replace('.svg', '').toLowerCase();
  return iconMap[iconName] || Code2;
};

// 根据颜色获取样式类
const getColorClass = (coverColor: string): string => {
  // 颜色映射
  const colorClassMap: Record<string, string> = {
    '#1e293b': 'bg-slate-800 text-white',
    '#3b82f6': 'bg-blue-500 text-white',
    '#06b6d4': 'bg-cyan-500 text-white',
    '#f97316': 'bg-orange-500 text-white',
    '#facc15': 'bg-yellow-400 text-slate-900',
    '#f43f5e': 'bg-rose-500 text-white',
    '#4f46e5': 'bg-indigo-600 text-white',
    '#10b981': 'bg-emerald-500 text-white',
    '#8b5cf6': 'bg-purple-500 text-white',
  };
  return colorClassMap[coverColor] || 'bg-blue-500 text-white';
};

const avatarColors = [
  'bg-primary-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-slate-700',
];

const getInitial = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'S';
};

const getDifficultyKey = (difficulty: CourseDifficulty): string => {
  switch (difficulty) {
    case CourseDifficulty.BEGINNER:
      return 'beginner';
    case CourseDifficulty.INTERMEDIATE:
      return 'intermediate';
    case CourseDifficulty.ADVANCED:
      return 'advanced';
    default:
      return 'beginner';
  }
};

// 将API课程数据转换为前端Skill类型
const convertCourseToSkill = (course: Course): Skill => {
  const IconComponent = getIconComponent(course.iconUrl);
  const colorClass = getColorClass(course.coverColor);
  
  // 转换阶段和课时
  const stages: SkillStage[] = (course.stages || []).map(stage => ({
    id: stage.id,
    title: stage.title,
    description: stage.description,
    levelLabel: stage.levelLabel,
    level: levelLabelToLevel(stage.levelLabel),
    lessons: (stage.lessons || []).map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      type: lessonTypeToString(lesson.type as LessonType),
      time: formatDuration(lesson.durationMinutes),
      level: levelLabelToLevel(stage.levelLabel),
      points: lesson.points,
      stageId: stage.id,
    })),
  }));

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    icon: IconComponent,
    color: colorClass,
    coverColor: course.coverColor,
    difficulty: course.difficulty as CourseDifficulty,
    status: course.status as CourseStatus,
    stats: {
      skills: course.totalSkills,
      lessons: course.totalLessons,
      hours: course.estimatedHours,
    },
    progress: typeof course.userProgress === 'number' ? course.userProgress : undefined,
    isAdded: true,
    stages,
  };
};

interface ClassContextTabsProps {
  classes: ClassItem[];
  selectedClassId: number | null;
  onSelectClass: (classId: number) => void;
  onSelectExplore: () => void;
}

const ClassContextTabs: React.FC<ClassContextTabsProps> = ({ classes, selectedClassId, onSelectClass, onSelectExplore }) => {
  const { t, i18n } = useTranslation('study');

  return (
    <section className="relative mb-8">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="flex gap-3 overflow-x-auto px-1 pb-2">
        {classes.map((item) => {
          const active = selectedClassId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectClass(item.id)}
              className={`relative min-w-[120px] shrink-0 rounded-2xl px-4 py-3 text-left transition-all ${
                active
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                  : 'card-surface text-slate-700 hover:-translate-y-0.5 hover:shadow-lg'
              }`}
            >
              {item.pendingTaskCount > 0 && !active && (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40" />
              )}
              <div className="max-w-[180px] truncate text-sm font-black">{localizeSeededClassName(item.name, i18n.language)}</div>
              <div className={`mt-1 max-w-[180px] truncate text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                <span data-i18n-skip>{item.termCode}</span> · <span>{item.ownerTeacherName ? localizeSeededClassText(item.ownerTeacherName, i18n.language) : t('classes.noTeacher')}</span>
              </div>
            </button>
          );
        })}
        <button
          onClick={onSelectExplore}
          className={`min-w-[120px] shrink-0 rounded-2xl px-4 py-3 text-left transition-all ${
            selectedClassId === null
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
              : 'card-surface text-slate-700 hover:-translate-y-0.5 hover:shadow-lg'
          }`}
        >
          <div className="text-sm font-black">{t('classes.explore')}</div>
          <div className={`mt-1 text-xs ${selectedClassId === null ? 'text-primary-100' : 'text-slate-400'}`}>{t('classes.browsePublic')}</div>
        </button>
      </div>
    </section>
  );
};

interface ClassCoursesSectionProps {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  onSkillSelect: (skill: Skill) => void;
}

interface SkillGridProps {
  skills: Skill[];
  onSkillSelect: (skill: Skill) => void;
}

const SkillGrid: React.FC<SkillGridProps> = ({ skills, onSkillSelect }) => {
  const { t } = useTranslation('study');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
      {skills.map((skill, i) => (
      <motion.div
        key={skill.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        onClick={() => onSkillSelect(skill)}
        className="card-surface rounded-2xl p-5 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex items-center gap-5 group"
      >
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${skill.color} group-hover:scale-110 transition-transform`}>
          <skill.icon className="w-7 h-7" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="text-base font-bold text-slate-900 truncate mb-1" data-i18n-skip>{skill.title}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              skill.difficulty === CourseDifficulty.BEGINNER ? 'bg-emerald-50 text-emerald-600' :
              skill.difficulty === CourseDifficulty.INTERMEDIATE ? 'bg-blue-50 text-blue-600' :
              'bg-purple-50 text-purple-600'
            }`}>
              {t(`difficulty.${getDifficultyKey(skill.difficulty)}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {skill.stats.skills} {t('stats.skills')}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {skill.stats.lessons} {t('stats.lessons')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {skill.stats.hours}h
            </span>
          </div>
          {skill.progress !== undefined && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, skill.progress))}%` }}
              />
            </div>
          )}
        </div>
      </motion.div>
      ))}
    </div>
  );
};

const ClassCoursesSection: React.FC<ClassCoursesSectionProps> = ({ skills, loading, error, onSkillSelect }) => {
  const { t } = useTranslation('study');

  return (
    <section className="mb-12">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
            <BookOpen className="h-3.5 w-3.5" />
            {t('classes.assignedBadge')}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t('classes.assignedTitle')}</h2>
        </div>
      </div>
    {loading ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card-surface rounded-2xl p-5">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-4/5 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : error ? (
      <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
    ) : skills.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        {t('classes.emptyAssigned')}
      </div>
    ) : (
      <SkillGrid skills={skills} onSkillSelect={onSkillSelect} />
    )}
    </section>
  );
};

const SkillList: React.FC<SkillListProps> = ({ onSkillSelect, currentUser, initialCourseId }) => {
  const { t, i18n } = useTranslation('study');
  const [searchParams, setSearchParams] = useSearchParams();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [assignedSkills, setAssignedSkills] = useState<Skill[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentLeaderboardItem[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [overview, setOverview] = useState<LearningOverview>(emptyLearningOverview);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUseClassContext = currentUser?.roleType === RoleType.STUDENT;
  const selectedClass = selectedClassId ? classes.find((item) => item.id === selectedClassId) : null;

  // 加载课程数据
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setError(null);
        // 只获取已发布的课程
        const response = await courseApi.getList({ 
          pageSize: 100, 
          status: CourseStatus.PUBLISHED 
        });
        
        if (response.success && response.data) {
          const convertedSkills = response.data.list.map(convertCourseToSkill);
          setSkills(convertedSkills);
        } else {
          setError(response.error || t('errors.loadCourses'));
        }
      } catch (err) {
        console.error('获取课程列表失败:', err);
        setError(t('errors.network'));
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [i18n.language]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        const response = await userService.getStudentLeaderboard(4);
        if (response.success && response.data) {
          setLeaderboard(response.data);
        } else {
          setLeaderboard([]);
        }
      } catch (err) {
        console.error('获取学习者排行失败:', err);
        setLeaderboard([]);
      } finally {
        setLeaderboardLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (currentUser?.roleType !== RoleType.STUDENT) {
      setOverview(emptyLearningOverview);
      setOverviewError(null);
      setOverviewLoading(false);
      return;
    }

    const fetchOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      const response = await learningOverviewApi.getOverview();
      if (response.success && response.data) {
        setOverview(response.data);
      } else {
        setOverview(emptyLearningOverview);
        setOverviewError(response.error || t('errors.overviewUnavailable'));
      }
      setOverviewLoading(false);
    };

    void fetchOverview();
  }, [currentUser?.id, currentUser?.roleType]);

  useEffect(() => {
    if (!canUseClassContext || !currentUser) {
      setClasses([]);
      setSelectedClassId(null);
      setClassError(null);
      setClassesLoading(false);
      return;
    }

    const loadClasses = async () => {
      setClassesLoading(true);
      setClassError(null);
      const response = await studentClassApi.getMyClasses();
      if (response.success && response.data) {
        const activeClasses = response.data.filter((item) => item.status === ClassStatus.ACTIVE);
        setClasses(activeClasses);
        const urlClassId = Number(searchParams.get('classId'));
        const storageKey = `study_last_selected_class_${currentUser.id}`;
        const storedClassId = Number(localStorage.getItem(storageKey));
        const pick =
          activeClasses.find((item) => item.id === urlClassId) ||
          activeClasses.find((item) => item.id === storedClassId) ||
          activeClasses[0];
        setSelectedClassId(pick?.id || null);
      } else {
        setClasses([]);
        setSelectedClassId(null);
        setClassError(response.error || t('errors.loadClasses'));
      }
      setClassesLoading(false);
    };

    void loadClasses();
  }, [canUseClassContext, currentUser?.id, i18n.language]);

  useEffect(() => {
    if (!canUseClassContext || !currentUser) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedClassId) {
      next.set('classId', String(selectedClassId));
      localStorage.setItem(`study_last_selected_class_${currentUser.id}`, String(selectedClassId));
    } else {
      next.delete('classId');
      localStorage.removeItem(`study_last_selected_class_${currentUser.id}`);
    }
    setSearchParams(next, { replace: true });
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !canUseClassContext) {
      setAssignedSkills([]);
      setAssignedError(null);
      setAssignedLoading(false);
      return;
    }

    const loadAssignedCourses = async () => {
      setAssignedLoading(true);
      setAssignedError(null);
      const response = await studentCourseApi.getAssigned(selectedClassId);
      if (response.success && response.data) {
        setAssignedSkills(response.data.map(convertCourseToSkill));
      } else {
        setAssignedSkills([]);
        setAssignedError(response.error || t('errors.loadAssignedCourses'));
      }
      setAssignedLoading(false);
    };

    void loadAssignedCourses();
  }, [selectedClassId, canUseClassContext, i18n.language]);

  useEffect(() => {
    if (!initialCourseId || skills.length === 0) return;
    const matched = skills.find((item) => item.id === initialCourseId);
    if (matched) {
      onSkillSelect(matched);
    }
  }, [initialCourseId, skills, onSkillSelect]);

  // 加载状态
  if (loading) {
    return (
      <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-slate-500">{t('loadingCourses')}</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-danger-500" />
          <p className="text-slate-700 font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            {t('reload')}
          </button>
        </div>
      </div>
    );
  }

  const progressOffset = 226 - (226 * Math.min(100, Math.max(0, overview.overallProgressPercent))) / 100;
  const weekDays = [
    t('weekdays.sun'),
    t('weekdays.mon'),
    t('weekdays.tue'),
    t('weekdays.wed'),
    t('weekdays.thu'),
    t('weekdays.fri'),
    t('weekdays.sat'),
  ];

  return (
    <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      
      {/* 1. Welcome Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16"
      >
        <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                {t('welcomePrefix')} <span className="text-primary-600">{t('learner')}</span>
            </h1>
            <span className="text-sm font-medium text-slate-400">{t('demoDisclaimer')}</span>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Progress Orb */}
            <div className="card-surface rounded-3xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="226" strokeDashoffset={progressOffset} className="text-primary-500 transition-all" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                             <span className="text-xl font-bold">{overviewLoading ? '...' : overview.level}</span>
                             <span className="text-[10px] text-slate-400">{t('level')}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">{t('nextMilestone')}</h3>
                        <p className="mt-1 text-xs font-semibold text-primary-500" data-i18n-skip>{overview.levelName}</p>
                        {(overview.milestones || emptyLearningOverview.milestones).map((milestone) => {
                          const Icon = milestone.type === 'streak' ? Flame : Award;
                          const iconClass = milestone.type === 'streak' ? 'text-rose-500' : 'text-amber-500';
                          return (
                            <div key={milestone.type} className="flex items-center gap-2 mt-2">
                                 <Icon className={`w-5 h-5 ${iconClass}`} />
                                 <span className="text-sm text-slate-600">{t(`milestones.${milestone.type}`, { count: milestone.target })}</span>
                                 <span className="text-xs text-slate-400 ml-auto">{milestone.current}/{milestone.target}</span>
                            </div>
                          );
                        })}
                        {overviewError && (
                          <p className="mt-2 text-xs text-amber-600">{overviewError}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats + Daily Streak */}
            <div className="card-surface rounded-3xl p-5 flex flex-col justify-center">
                {/* 学习统计 */}
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">{skills.length}</div>
                        <div className="text-xs text-slate-500">{t('stats.availableCourses')}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-600">{overviewLoading ? '...' : overview.completedCourses}</div>
                        <div className="text-xs text-slate-500">{t('stats.completed')}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">{overviewLoading ? '...' : overview.inProgressCourses}</div>
                        <div className="text-xs text-slate-500">{t('stats.inProgress')}</div>
                    </div>
                </div>
                {/* 每日打卡 */}
                <div className="flex justify-between items-center px-3">
                    {weekDays.map((day, i) => {
                        const today = new Date().getDay();
                        const isToday = i === today;
                        return (
                            <div key={i} className="flex flex-col items-center gap-1.5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                                    isToday 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                                    : 'border-slate-100 text-slate-300'
                                }`}>
                                    {isToday && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>
                                <span className="text-[10px] text-slate-400">{day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Leaderboard */}
            <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-white p-6 shadow-[0_16px_42px_-30px_rgba(180,83,9,0.45)] overflow-hidden">
                <div className="space-y-3">
                    {leaderboardLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-10 h-3 rounded bg-slate-200 animate-pulse" />
                                    <span className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
                                    <span className="w-20 h-3 rounded bg-slate-200 animate-pulse" />
                                </div>
                                <span className="w-12 h-3 rounded bg-slate-200 animate-pulse" />
                            </div>
                        ))
                    ) : leaderboard.length > 0 ? (
                        leaderboard.map((u, i) => (
                        <div key={u.id} className={`flex items-center justify-between gap-3 p-2 rounded-xl ${u.isCurrentUser ? 'bg-amber-100/50 ring-1 ring-amber-200' : ''}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-slate-400 w-10 shrink-0">#{u.rank}</span>
                                {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.displayName} className="w-6 h-6 rounded-full object-cover shrink-0" data-i18n-skip />
                                ) : (
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${u.isCurrentUser ? 'bg-amber-500' : avatarColors[i % avatarColors.length]}`}>
                                        {getInitial(u.displayName || u.username)}
                                    </div>
                                )}
                                <span className={`text-sm font-bold truncate max-w-[120px] ${u.isCurrentUser ? 'text-amber-900' : 'text-slate-600'}`} data-i18n-skip>
                                    {u.displayName || u.username}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{u.skillsCount} {t('stats.skills')}</span>
                        </div>
                    ))
                    ) : (
                        <div className="h-[132px] rounded-2xl border border-dashed border-amber-200 bg-white/50 flex items-center justify-center text-sm text-slate-500">
                            {t('leaderboard.empty')}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </motion.div>

      {canUseClassContext && (
        <>
          {classesLoading ? (
            <section className="mb-8 flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 min-w-[150px] animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </section>
          ) : classError ? (
            <div className="mb-8 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{classError}</div>
          ) : (
            <ClassContextTabs
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              onSelectExplore={() => setSelectedClassId(null)}
            />
          )}

          {!classesLoading && classes.length === 0 && (
            <div className="card-surface mb-8 rounded-3xl p-6 text-center text-sm text-slate-500">
              {t('classes.emptyClasses')}
            </div>
          )}

          {selectedClass && (
            <>
              <StudyAssignmentsSection classId={selectedClassId} />
              <ClassCoursesSection
                skills={assignedSkills}
                loading={assignedLoading}
                error={assignedError}
                onSkillSelect={onSkillSelect}
              />
            </>
          )}
        </>
      )}

      {(!canUseClassContext || selectedClassId === null) && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('explore.title')}</h2>
                <p className="text-slate-500 text-sm mt-1">{t('explore.desc')}</p>
            </div>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('explore.empty')}</p>
          </div>
        ) : (
          <SkillGrid skills={skills} onSkillSelect={onSkillSelect} />
        )}
      </motion.div>
      )}

    </div>
  );
};

export default SkillList;
