import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, Users, BarChart, Play, Award, MessageSquare,
  CheckCircle2, FileText, Share2, Star, ChevronLeft, ChevronRight, Tag, Loader2, LogIn
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EnergyRobotGif from '@/images/Energy Robot.gif';
import type { Project, ProjectUnit } from '@/types/project';
import type { User } from '@/types';
import { getDifficultyLevel, getDifficultyColor } from '@/types/project';
import { projectApi } from '@/services/project';
import { getImageUrlCandidates, handleImageFallback } from '@/config';
import { useTranslation } from 'react-i18next';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  currentUser: User | null;
  onLoginRequired: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project: initialProject, onBack, currentUser, onLoginRequired }) => {
  const { t, i18n } = useTranslation('project');
  const [activeTab, setActiveTab] = useState<'intro' | 'syllabus'>('intro');
  const [project, setProject] = useState<Project>(initialProject);
  const [units, setUnits] = useState<ProjectUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const isLoggedIn = !!currentUser;

  // 加载项目详情（包含单元）
  useEffect(() => {
    const loadProjectDetail = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await projectApi.getById(Number(initialProject.id));
        if (result.success && result.data) {
          const data = result.data as Project & { units?: ProjectUnit[] };
          setProject(data);
          setUnits(data.units || []);
        } else {
          setLoadError(result.error || t('detailsFailed'));
        }
      } catch (error) {
        console.error('加载项目详情失败:', error);
        setLoadError(t('detailsFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadProjectDetail();
  }, [initialProject.id, i18n.language]);

  const level = getDifficultyLevel(project.difficulty);
  const { color } = getDifficultyColor(project.difficulty);
  const coverCandidates = getImageUrlCandidates(project.coverUrl);
  const openTrainingEntry = (unit?: ProjectUnit) => {
    const targetUnit = unit || units[0];

    if (!targetUnit) {
      alert(t('noUnits'));
      return;
    }

    const labParams = new URLSearchParams({
      sourceType: 'project',
      sourceId: project.id.toString(),
      unitId: targetUnit.id.toString(),
      unitName: targetUnit.title,
    });
    window.open(`/lab?${labParams.toString()}`, '_blank');
  };

  // 计算预估时长
  const getEstimatedDuration = (): string => {
    const totalMinutes = (project.labsCount || 0) * 15 + (project.challengesCount || 0) * 30;
    if (totalMinutes === 0) {
      // 根据单元计算
      const unitMinutes = units.reduce((sum, u) => sum + (u.timeLimit || 0), 0);
      if (unitMinutes < 60) return t('durationMinutes', { minutes: unitMinutes || 30 });
      const hours = Math.floor(unitMinutes / 60);
      const mins = unitMinutes % 60;
      return mins > 0 ? t('durationHoursMinutes', { hours, minutes: mins }) : t('durationHours', { hours });
    }
    if (totalMinutes < 60) return t('durationMinutes', { minutes: totalMinutes });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? t('durationHoursMinutes', { hours, minutes: mins }) : t('durationHours', { hours });
  };

  // 获取难度中文名
  const getLevelName = () => {
    switch (level) {
      case 'Beginner': return t('beginner');
      case 'Intermediate': return t('intermediate');
      case 'Advanced': return t('advanced');
    }
  };

  return (
    <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      {/* Top Breadcrumb */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="flex items-center text-sm font-medium text-slate-400 hover:text-slate-800 mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        {t('backList')}
      </motion.button>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-slate-500">{t('loadingDetails')}</span>
        </div>
      )}

      {!loading && loadError && (
        <div className="py-20 text-center">
          <div className="text-lg font-bold text-danger-600">{loadError}</div>
          <button type="button" onClick={onBack} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{t('backList')}</button>
        </div>
      )}

      {!loading && !loadError && (
        /* Main Grid Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* LEFT COLUMN: Content */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Project Header Title */}
              <div className="mb-6">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
                  {project.title}
                </h1>
                <p className="text-lg text-slate-500 leading-relaxed font-light">
                  {project.subtitle || t('noDescription')}
                </p>
              </div>

              {/* Meta Info Bar */}
              <div className="flex flex-wrap gap-6 mb-8 pb-8 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${color} bg-opacity-20`}>
                    <BarChart className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">{getLevelName()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">{getEstimatedDuration()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">{t('learners', { count: project.studentsCount || 0 })}</span>
                </div>
              </div>

              {/* Nav & Tags Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400 mr-1" />
                  {project.tags && project.tags.length > 0 ? (
                    project.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer"
                        style={{ 
                          backgroundColor: `${tag.styleColor}20`, 
                          color: tag.styleColor 
                        }}
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">{t('noTags')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    <ChevronLeft className="w-3 h-3" />
                    {t('previousCourse')}
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors">
                    {t('nextCourse')}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-8 border-b border-slate-200/60 mb-8 relative">
                {(['intro', 'syllabus'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-base font-bold transition-colors relative ${
                      activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab === 'intro' ? t('intro') : t('syllabus')}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === 'intro' ? (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        {t('learningGoals')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(project.learningGoals && project.learningGoals.length > 0 ? project.learningGoals : t('defaultGoals', { returnObjects: true }) as unknown as string[]).map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-4">{t('background')}</h3>
                      <div className="prose prose-slate prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-p:text-slate-600 prose-p:leading-7 prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-700 prose-code:text-primary-600 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-ul:text-slate-600 prose-ol:text-slate-600 prose-li:marker:text-slate-400 prose-blockquote:border-l-primary-500 prose-blockquote:text-slate-500 prose-hr:border-slate-200">
                        {project.description ? (
                          <ReactMarkdown>{project.description}</ReactMarkdown>
                        ) : project.prerequisites && project.prerequisites.length > 0 ? (
                          project.prerequisites.map((p, i) => <p key={i}>{p}</p>)
                        ) : (
                          <>
                            <p>
                              {t('defaultBackground1')}
                            </p>
                            <p className="mt-4">
                              {t('defaultBackground2')}
                            </p>
                          </>
                        )}
                      </div>
                    </section>
                  </motion.div>
                ) : (
                  <motion.div
                    key="syllabus"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {units.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('noCourseUnits')}</p>
                      </div>
                    ) : (
                      units.map((unit) => (
                        <div
                          key={unit.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLoggedIn) {
                              onLoginRequired();
                            } else {
                              openTrainingEntry(unit);
                            }
                          }}
                          className="group card-surface flex items-center justify-between p-5 rounded-2xl hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                unit.type === 2 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                              }`}
                            >
                              {unit.type === 2 ? <Award className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-primary-600 transition-colors">
                                {unit.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="uppercase font-bold tracking-wider">
                                  {unit.type === 2 ? 'CHALLENGE' : 'LAB'}
                                </span>
                                <span>•</span>
                                <span>{t('durationMinutes', { minutes: unit.timeLimit || 45 })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-slate-300 group-hover:text-primary-500">
                            <Play className="w-4 h-4 fill-current" />
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              {/* Start Card */}
              <div className="card-surface rounded-3xl overflow-hidden flex flex-col group hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] transition-all duration-300">
                <div className="relative h-40 w-full">
                  <img
                    src={coverCandidates[0]}
                  alt={t('projectCover', { ns: 'uiReview' })}
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageFallback(e, coverCandidates)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 text-white">
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">{t('interactiveProject')}</div>
                    <div className="text-lg font-bold">{t('startChallenge')}</div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-6">
                    <span>{t('studyingNow', { count: project.studentsCount || 0 })}</span>
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold"
                        >
                          U{i}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLoggedIn) {
                        onLoginRequired();
                      } else {
                        openTrainingEntry(units[0]);
                      }
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    {isLoggedIn ? (
                      <>
                        <span>{t('startLearning')}</span>
                        <Play className="w-4 h-4 fill-current" />
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{t('loginToLearn')}</span>
                      </>
                    )}
                  </button>

                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <button className="text-xs font-bold text-slate-500 hover:text-slate-800">{t('learnLater')}</button>
                  </div>
                </div>
              </div>

              {/* Certificate Card */}
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-100 p-6 flex items-center gap-4 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-amber-400/10 rounded-bl-full z-0"></div>
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm z-10 group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
                <div className="z-10">
                  <h4 className="font-bold text-slate-800 text-sm">{t('certificate')}</h4>
                  <p className="text-xs text-slate-500 mt-1">{t('certificateDesc')}</p>
                </div>
              </div>

              {/* Community Card */}
              <div className="bg-[#5865F2]/5 rounded-3xl border border-[#5865F2]/10 p-6 flex items-center gap-4 hover:bg-[#5865F2]/10 transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-[#5865F2] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:rotate-12 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-[#5865F2] text-sm">{t('joinDiscussion')}</h4>
                  <p className="text-xs text-slate-500 mt-1">{t('discussionDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Info */}
      {!loading && !loadError && (
        <div className="mt-16 pt-12 border-t border-slate-200/60 max-w-3xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">{t('instructor')}</h3>
          <div className="flex items-center gap-4">
            <img src={EnergyRobotGif} alt="ZG EDU Agent" className="w-12 h-12 object-contain" />
            <div>
              <div className="font-bold text-slate-900">ZG EDU AGENT</div>
              <div className="text-xs text-slate-500 mt-0.5">{t('instructorDesc')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
