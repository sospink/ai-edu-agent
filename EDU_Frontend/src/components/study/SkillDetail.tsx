import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Share2, Award, BookOpen, Terminal, 
  CheckCircle2, Lock, MessageSquare, ChevronRight,
  Layout, Zap, Clock, Loader2, AlertCircle, LogIn, Circle, PlayCircle
} from 'lucide-react';
import { courseApi, LessonRecordStatus, type LessonRecord } from '@/services/course';
import type { Skill, SkillStage, SkillLevel } from '@/types/skill';
import type { User } from '@/types';
import { 
  CourseDifficulty, LessonType, 
  lessonTypeToString, formatDuration, levelLabelToLevel, getDifficultyName
} from '@/types/skill';

interface SkillDetailProps {
  skill: Skill;
  onBack: () => void;
  currentUser: User | null;
  onLoginRequired: () => void;
}

const SkillDetail: React.FC<SkillDetailProps> = ({ skill: initialSkill, onBack, currentUser, onLoginRequired }) => {
  const [skill, setSkill] = useState<Skill>(initialSkill);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessonRecords, setLessonRecords] = useState<Record<number, LessonRecord>>({});
  const [loadingRecords, setLoadingRecords] = useState(false);

  const isLoggedIn = !!currentUser;

  // 处理需要登录的操作
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      onLoginRequired();
    }
  };

  // 加载完整课程数据（包含阶段和课时）
  useEffect(() => {
    const fetchCourseDetail = async () => {
      // 如果已经有阶段数据，不需要重新加载
      if (skill.stages && skill.stages.length > 0) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await courseApi.getById(skill.id);
        
        if (response.success && response.data) {
          const course = response.data;
          // 转换阶段和课时数据
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

          setSkill(prev => ({
            ...prev,
            stages,
          }));
        } else {
          setError(response.error || '获取课程详情失败');
        }
      } catch (err) {
        console.error('获取课程详情失败:', err);
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseDetail();
  }, [skill.id]);

  // 加载用户学习记录
  useEffect(() => {
    const fetchLessonRecords = async () => {
      if (!isLoggedIn) {
        setLessonRecords({});
        return;
      }

      try {
        setLoadingRecords(true);
        const response = await courseApi.getUserLessonRecords(skill.id);
        
        if (response.success && response.data) {
          // 将数组转换为以 lessonId 为 key 的对象
          const recordsMap: Record<number, LessonRecord> = {};
          response.data.forEach((record: LessonRecord) => {
            recordsMap[record.lessonId] = record;
          });
          setLessonRecords(recordsMap);
        }
      } catch (err) {
        console.error('获取学习记录失败:', err);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchLessonRecords();
  }, [skill.id, isLoggedIn]);

  // 获取课时状态
  const getLessonStatus = (lessonId: number): LessonRecordStatus => {
    const record = lessonRecords[lessonId];
    return record ? record.status : LessonRecordStatus.NOT_STARTED;
  };

  // 计算总体进度
  const calculateProgress = () => {
    if (!skill.stages || skill.stages.length === 0) {
      return { completed: 0, inProgress: 0, notStarted: 0, total: 0 };
    }

    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let total = 0;

    skill.stages.forEach(stage => {
      stage.lessons.forEach(lesson => {
        total++;
        const status = getLessonStatus(lesson.id);
        if (status === LessonRecordStatus.COMPLETED) {
          completed++;
        } else if (status === LessonRecordStatus.IN_PROGRESS) {
          inProgress++;
        } else {
          notStarted++;
        }
      });
    });

    return { completed, inProgress, notStarted, total };
  };

  // 处理开始学习
  const handleStartLesson = async (lessonId: number, lessonTitle: string, lessonType: string) => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }

    // 如果课时未开始，先调用开始学习接口
    const status = getLessonStatus(lessonId);
    if (status === LessonRecordStatus.NOT_STARTED) {
      try {
        await courseApi.startLesson(lessonId);
        // 更新本地记录
        setLessonRecords(prev => ({
          ...prev,
          [lessonId]: {
            id: 0,
            userId: currentUser?.id || 0,
            courseId: skill.id,
            lessonId,
            status: LessonRecordStatus.IN_PROGRESS,
            score: 0,
            startedAt: new Date().toISOString(),
            finishedAt: null,
          }
        }));
      } catch (err) {
        console.error('开始学习失败:', err);
      }
    }

    // 跳转到对应页面
    const params = new URLSearchParams({
      skillName: skill.title,
      lessonName: lessonTitle,
      courseId: skill.id.toString(),
    });

    if (lessonType === 'text') {
      window.open(`/lesson/${lessonId}?${params.toString()}`, '_blank');
    } else {
      const labParams = new URLSearchParams({
        sourceType: 'course',
        sourceId: skill.id.toString(),
        lessonId: lessonId.toString(),
        lessonName: lessonTitle,
      });
      window.open(`/lab?${labParams.toString()}`, '_blank');
    }
  };

  const progress = calculateProgress();

  const getLevelBgClass = (level: SkillLevel) => {
    switch(level) {
      case 'Beginner': return 'bg-emerald-50 border-emerald-100';
      case 'Intermediate': return 'bg-blue-50 border-blue-100';
      case 'Advanced': return 'bg-purple-50 border-purple-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const getLevelTextClass = (level: SkillLevel) => {
    switch(level) {
      case 'Beginner': return 'text-emerald-700';
      case 'Intermediate': return 'text-blue-700';
      case 'Advanced': return 'text-purple-700';
      default: return 'text-slate-700';
    }
  };

  const getLevelIconClass = (level: SkillLevel) => {
    switch(level) {
      case 'Beginner': return 'text-emerald-600';
      case 'Intermediate': return 'text-blue-600';
      case 'Advanced': return 'text-purple-600';
      default: return 'text-slate-600';
    }
  };

  const getCourseTypeIcon = (type: string) => {
    switch(type) {
      case 'challenge': return Award;
      case 'text': return BookOpen;
      case 'quiz': return CheckCircle2;
      default: return Terminal;
    }
  };

  const getCourseTypeClass = (type: string) => {
    switch(type) {
      case 'challenge': return 'bg-amber-50 border-amber-100 text-amber-500';
      case 'text': return 'bg-slate-50 border-slate-200 text-slate-400';
      case 'quiz': return 'bg-purple-50 border-purple-100 text-purple-500';
      default: return 'bg-primary-50 border-primary-100 text-primary-500';
    }
  };

  const getCourseTypeName = (type: string) => {
    switch(type) {
      case 'challenge': return '挑战';
      case 'text': return '文本';
      case 'quiz': return '测验';
      default: return '实验';
    }
  };

  return (
    <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      
      {/* Header Area */}
      <div className="flex flex-col items-center text-center mb-16 relative">
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="absolute left-0 top-0 p-3 rounded-full border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-24 h-24 rounded-3xl ${skill.color} flex items-center justify-center shadow-2xl shadow-slate-900/10 mb-6 transform rotate-3`}
          >
              <skill.icon className="w-12 h-12" />
          </motion.div>

          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl font-black text-slate-900 tracking-tight mb-4"
          >
              {skill.title}
          </motion.h1>

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-500 max-w-2xl leading-relaxed mb-6"
          >
              {skill.description}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-6 text-sm font-medium text-slate-500 mb-8"
          >
              <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> {skill.stats.skills} 技能</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {skill.stats.lessons} 课时</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {skill.stats.hours} 小时</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                skill.difficulty === CourseDifficulty.BEGINNER ? 'bg-emerald-100 text-emerald-600' :
                skill.difficulty === CourseDifficulty.INTERMEDIATE ? 'bg-blue-100 text-blue-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                {getDifficultyName(skill.difficulty)}
              </span>
          </motion.div>

          <div className="flex gap-4">
              <button 
                onClick={handleActionClick}
                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-xl shadow-primary-600/20 hover:scale-105 transition-transform"
              >
                  {isLoggedIn ? (
                    <>
                      开始学习
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      登录后学习
                    </>
                  )}
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                  <Share2 className="w-4 h-4" />
                  分享技能树
              </button>
          </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-slate-500">加载课程内容...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-12 h-12 text-danger-500 mb-4" />
          <p className="text-slate-700 font-medium">{error}</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left Column: Syllabus (Grouped by Stage) */}
            <div className="lg:col-span-2 space-y-12">
                
                {(!skill.stages || skill.stages.length === 0) ? (
                  <div className="text-center py-16">
                    <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">暂无课程内容</p>
                  </div>
                ) : (
                  skill.stages.map((stage, stageIndex) => (
                    <motion.div 
                        key={stage.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: stageIndex * 0.1 }}
                    >
                        {/* Stage Header Card */}
                        <div className={`relative rounded-3xl p-8 mb-6 overflow-hidden shadow-lg group hover:shadow-xl transition-all ${getLevelBgClass(stage.level)}`}>
                            {/* Decorative Background Icon */}
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <skill.icon className={`w-32 h-32 transform rotate-12 translate-x-10 -translate-y-10 ${getLevelIconClass(stage.level)}`} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider bg-white/60 backdrop-blur border border-white/40 ${getLevelTextClass(stage.level)}`}>
                                        {stage.levelLabel}
                                    </span>
                                </div>
                                <h3 className={`text-2xl font-bold mb-2 ${getLevelTextClass(stage.level)}`}>
                                    {stage.title}
                                </h3>
                                <p className="text-sm text-slate-500/80 font-medium">
                                    {stage.description}
                                </p>
                            </div>
                        </div>

                        {/* Lessons List */}
                        <div className="card-surface rounded-3xl p-2 relative">
                             {/* Connector Line to next stage */}
                             {stageIndex < (skill.stages?.length || 0) - 1 && (
                                 <div className="absolute left-1/2 bottom-[-48px] w-px h-12 bg-slate-200 -z-10 hidden lg:block"></div>
                             )}

                            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                                <span className="text-sm font-bold text-slate-500">
                                    {stage.lessons.length} 课时
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
                            </div>

                            <div className="divide-y divide-slate-50">
                                {stage.lessons.map((lesson) => {
                                    const TypeIcon = getCourseTypeIcon(lesson.type);
                                    const lessonStatus = getLessonStatus(lesson.id);
                                    
                                    return (
                                        <div 
                                            key={lesson.id} 
                                            className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group cursor-pointer rounded-xl mx-2 my-1"
                                        >
                                            {/* 左侧：课时信息 */}
                                            <div className="flex items-center gap-4">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${getCourseTypeClass(lesson.type)}`}>
                                                    <TypeIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium transition-colors text-slate-600 group-hover:text-slate-900">
                                                        {lesson.title}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                         <span className="text-[10px] uppercase font-bold text-slate-400">{getCourseTypeName(lesson.type)}</span>
                                                         <span className="text-[10px] text-slate-300">•</span>
                                                         <span className="text-[10px] text-slate-400">{lesson.time}</span>
                                                         <span className="text-[10px] text-slate-300">•</span>
                                                         <span className="text-[10px] text-amber-500 font-medium">+{lesson.points} XP</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* 右侧：开始按钮 + 进度圈圈 */}
                                            <div className="flex items-center gap-3">
                                                {/* 开始按钮 - 鼠标悬停显示 */}
                                                <button 
                                                  onClick={() => handleStartLesson(lesson.id, lesson.title, lesson.type)}
                                                  className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    开始
                                                </button>
                                                
                                                {/* 进度圈圈 - 始终显示 */}
                                                {lessonStatus === LessonRecordStatus.COMPLETED ? (
                                                  // 已完成 - 绿色勾选
                                                  <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                  </div>
                                                ) : lessonStatus === LessonRecordStatus.IN_PROGRESS ? (
                                                  // 进行中 - 蓝色播放图标
                                                  <div className="w-6 h-6 rounded-full border-2 border-blue-500 bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                      <PlayCircle className="w-4 h-4 text-blue-500" />
                                                  </div>
                                                ) : (
                                                  // 未开始 - 灰色空心圆
                                                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center flex-shrink-0">
                                                      <Circle className="w-3 h-3 text-slate-300" />
                                                  </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                  ))
                )}

                {/* Related Projects Section */}
                <div className="mt-16 pt-16 border-t border-slate-200/60">
                    <h2 className="text-2xl font-bold text-slate-900 mb-8">
                        {skill.title} 实战项目
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="card-surface rounded-3xl p-6 hover:shadow-lg transition-all group cursor-pointer">
                             <div className="h-32 bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-2xl mb-6 relative overflow-hidden">
                                 <div className="absolute right-4 bottom-4 w-16 h-16 bg-white/50 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                                     <Layout className="w-8 h-8 text-violet-500" />
                                 </div>
                             </div>
                             <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2 block">Project</span>
                             <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                                 使用 {skill.title} 构建实战项目
                             </h3>
                             <div className="flex items-center gap-2 mt-4">
                                 <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold text-slate-500">{skill.title}</span>
                                 <span className="ml-auto text-xs text-slate-400">初级</span>
                             </div>
                         </div>

                         <div className="card-surface rounded-3xl p-6 hover:shadow-lg transition-all group cursor-pointer">
                             <div className="h-32 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-2xl mb-6 relative overflow-hidden">
                                 <div className="absolute right-4 bottom-4 w-16 h-16 bg-white/50 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
                                     <Terminal className="w-8 h-8 text-emerald-500" />
                                 </div>
                             </div>
                             <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2 block">Project</span>
                             <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                                 {skill.title} 进阶实战
                             </h3>
                             <div className="flex items-center gap-2 mt-4">
                                 <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold text-slate-500">{skill.title}</span>
                                 <span className="ml-auto text-xs text-slate-400">中级</span>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Sidebar */}
            <div className="lg:col-span-1 space-y-8">
                
                {/* Course Info Widget */}
                <div className="card-surface rounded-3xl p-6">
                    <h4 className="font-bold text-slate-900 mb-4">课程信息</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">难度等级</span>
                            <span className={`text-sm font-bold ${
                              skill.difficulty === CourseDifficulty.BEGINNER ? 'text-emerald-600' :
                              skill.difficulty === CourseDifficulty.INTERMEDIATE ? 'text-blue-600' :
                              'text-purple-600'
                            }`}>
                              {getDifficultyName(skill.difficulty)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">总课时</span>
                            <span className="text-sm font-bold text-slate-700">{skill.stats.lessons} 节</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">预计时长</span>
                            <span className="text-sm font-bold text-slate-700">{skill.stats.hours} 小时</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-500">技能点</span>
                            <span className="text-sm font-bold text-slate-700">{skill.stats.skills} 个</span>
                        </div>
                    </div>
                </div>

                {/* Certificate Widget */}
                <div className="card-surface-muted rounded-3xl p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 text-slate-300">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-slate-900 mb-1">课程证书</h4>
                        <p className="text-xs text-slate-500 mb-6">完成所有课程以解锁证书</p>
                        <button className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed">
                            完成课程获取证书
                        </button>
                    </div>
                </div>

                {/* Progress Widget - 根据真实数据显示 */}
                <div className="card-surface rounded-3xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-900 text-sm">总体进度</h4>
                        <Award className="w-4 h-4 text-amber-500" />
                    </div>
                    
                    {loadingRecords ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {skill.stages?.flatMap(stage => stage.lessons).slice(0, 14).map((lesson) => {
                                const status = getLessonStatus(lesson.id);
                                return (
                                    <div 
                                      key={lesson.id} 
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                        status === LessonRecordStatus.COMPLETED 
                                          ? 'bg-emerald-50 border border-emerald-200' 
                                          : status === LessonRecordStatus.IN_PROGRESS
                                          ? 'bg-blue-50 border border-blue-200'
                                          : 'bg-slate-50 border border-slate-200'
                                      }`}
                                    >
                                        {status === LessonRecordStatus.COMPLETED ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : status === LessonRecordStatus.IN_PROGRESS ? (
                                          <PlayCircle className="w-4 h-4 text-blue-500" />
                                        ) : (
                                          <Circle className="w-3 h-3 text-slate-300" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 
                              已完成 {progress.completed}
                            </div>
                            <span className="mx-1">•</span>
                            <div className="flex items-center gap-1">
                              <PlayCircle className="w-3 h-3 text-blue-500" /> 
                              进行中 {progress.inProgress}
                            </div>
                            <span className="mx-1">•</span>
                            <div className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> 
                              未开始 {progress.notStarted}
                            </div>
                        </div>
                      </>
                    )}
                </div>

                {/* Community Widget */}
                <div className="bg-[#5865F2] rounded-3xl p-6 text-white text-center shadow-lg shadow-[#5865F2]/20">
                    <h4 className="font-bold mb-2">加入学习社区</h4>
                    <p className="text-sm text-white/80 mb-4">与其他学习者一起交流讨论</p>
                    <button className="w-full py-2.5 bg-white text-[#5865F2] rounded-xl text-sm font-bold hover:bg-opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        加入讨论
                    </button>
                </div>

            </div>
        </div>
      )}
    </div>
  );
};

export default SkillDetail;
