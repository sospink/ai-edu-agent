import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, Globe, Code2, Layout, Server, Container, 
  Shield, Play, CheckCircle2, Flame, Award, Zap, ChevronRight,
  Loader2, AlertCircle, BookOpen, Clock, LucideIcon, LogIn
} from 'lucide-react';
import { courseApi, type Course } from '@/services/course';
import type { Skill, SkillStage } from '@/types/skill';
import type { User } from '@/types';
import { 
  CourseDifficulty, CourseStatus, LessonType,
  lessonTypeToString, formatDuration, levelLabelToLevel, getDifficultyName
} from '@/types/skill';

interface SkillListProps {
  onSkillSelect: (skill: Skill) => void;
  currentUser: User | null;
  onLoginRequired: () => void;
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
    isAdded: true,
    stages,
  };
};

const SkillList: React.FC<SkillListProps> = ({ onSkillSelect, currentUser, onLoginRequired }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!currentUser;

  // 处理需要登录的操作
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      onLoginRequired();
    } else {
      action();
    }
  };

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
          setError(response.error || '获取课程列表失败');
        }
      } catch (err) {
        console.error('获取课程列表失败:', err);
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-slate-500">加载课程中...</p>
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
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 获取第一个有进度的课程作为继续学习
  const continueSkill = skills.length > 0 ? skills[0] : null;

  return (
    <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      
      {/* 1. Welcome Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16"
      >
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-8">
            欢迎回来, <span className="text-primary-600">学习者!</span>
        </h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Progress Orb */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="226" strokeDashoffset="180" className="text-primary-500" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                             <span className="text-xl font-bold">1</span>
                             <span className="text-[10px] text-slate-400">Level</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">下一个里程碑</h3>
                        <div className="flex items-center gap-2 mt-2">
                             <Award className="w-5 h-5 text-amber-500" />
                             <span className="text-sm text-slate-600">完成 5 个课程</span>
                             <span className="text-xs text-slate-400 ml-auto">0/5</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                             <Flame className="w-5 h-5 text-rose-500" />
                             <span className="text-sm text-slate-600">连续学习 7 天</span>
                             <span className="text-xs text-slate-400 ml-auto">0/7</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats + Daily Streak */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center">
                {/* 学习统计 */}
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">{skills.length}</div>
                        <div className="text-xs text-slate-500">可学课程</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-600">0</div>
                        <div className="text-xs text-slate-500">已完成</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">0</div>
                        <div className="text-xs text-slate-500">进行中</div>
                    </div>
                </div>
                {/* 每日打卡 */}
                <div className="flex justify-between items-center px-3">
                    {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => {
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
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-3xl p-6 border border-amber-100/50 shadow-sm overflow-hidden">
                <div className="space-y-3">
                    {[
                        { name: "Babu M.", xp: "13 技能", rank: 68605, color: "bg-green-500" },
                        { name: "mzartler", xp: "13 技能", rank: 68606, color: "bg-purple-500" },
                        { name: "学习者", xp: "13 技能", rank: 68607, active: true },
                        { name: "Patrick W.", xp: "12 技能", rank: 68608, color: "bg-slate-700" }
                    ].map((u, i) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded-xl ${u.active ? 'bg-amber-100/50 ring-1 ring-amber-200' : ''}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-slate-400 w-10">{u.rank}</span>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${u.active ? 'bg-amber-500' : u.color}`}>
                                    {u.name[0]}
                                </div>
                                <span className={`text-sm font-bold ${u.active ? 'text-amber-900' : 'text-slate-600'}`}>{u.name}</span>
                            </div>
                            <span className="text-xs font-medium text-slate-400">{u.xp}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </motion.div>

      {/* 2. Continue Learning Section */}
      {continueSkill && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Play className="w-5 h-5 text-primary-600 fill-current" />
              推荐学习
          </h2>
          <div 
            className="bg-white rounded-3xl p-1 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:border-primary-100 hover:shadow-lg transition-all cursor-pointer" 
            onClick={() => onSkillSelect(continueSkill)}
          >
              <div className="flex flex-col md:flex-row p-6 gap-6 items-center">
                  <div className={`w-20 h-20 rounded-2xl ${continueSkill.color} flex items-center justify-center shadow-lg shrink-0`}>
                      <continueSkill.icon className="w-10 h-10" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                          <h3 className="text-xl font-bold text-slate-900">{continueSkill.title}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            continueSkill.difficulty === CourseDifficulty.BEGINNER ? 'bg-emerald-100 text-emerald-600' :
                            continueSkill.difficulty === CourseDifficulty.INTERMEDIATE ? 'bg-blue-100 text-blue-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {getDifficultyName(continueSkill.difficulty)}
                          </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{continueSkill.description}</p>
                      <div className="flex items-center justify-center md:justify-start gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {continueSkill.stats.skills} 技能
                          </span>
                          <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> {continueSkill.stats.lessons} 课时
                          </span>
                          <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {continueSkill.stats.hours}h
                          </span>
                      </div>
                  </div>
                  <button 
                    onClick={(e) => handleActionClick(e, () => onSkillSelect(continueSkill))}
                    className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 group-hover:bg-primary-700 transition-all hover:scale-105 active:scale-95 shrink-0"
                  >
                      {isLoggedIn ? (
                        <>
                          开始学习
                          <ChevronRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          登录后学习
                        </>
                      )}
                  </button>
              </div>
          </div>
        </motion.div>
      )}

      {/* 3. All Skill Trees Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">所有技能树</h2>
                <p className="text-slate-500 text-sm mt-1">通过 Agent EDU 技能树开始您的学习之旅</p>
            </div>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">暂无可用课程</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {skills.map((skill, i) => (
                  <motion.div
                      key={skill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => onSkillSelect(skill)}
                      className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-primary-100 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex items-center gap-5 group relative overflow-hidden"
                  >
                      {/* Progress Bar Bottom if active */}
                      {skill.progress !== undefined && skill.progress > 0 && (
                          <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50">
                              <div className="h-full bg-primary-500" style={{ width: `${skill.progress}%` }}></div>
                          </div>
                      )}

                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${skill.color} group-hover:scale-110 transition-transform`}>
                          <skill.icon className="w-7 h-7" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                              <h3 className="text-base font-bold text-slate-900 truncate mb-1">{skill.title}</h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                skill.difficulty === CourseDifficulty.BEGINNER ? 'bg-emerald-50 text-emerald-600' :
                                skill.difficulty === CourseDifficulty.INTERMEDIATE ? 'bg-blue-50 text-blue-600' :
                                'bg-purple-50 text-purple-600'
                              }`}>
                                  {getDifficultyName(skill.difficulty)}
                              </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                              <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> {skill.stats.skills} 技能
                              </span>
                              <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" /> {skill.stats.lessons} 课时
                              </span>
                              <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {skill.stats.hours}h
                              </span>
                          </div>
                      </div>
                  </motion.div>
              ))}
          </div>
        )}
      </motion.div>

    </div>
  );
};

export default SkillList;
