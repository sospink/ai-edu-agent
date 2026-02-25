import { LucideIcon } from 'lucide-react';

// ==================== API 数据类型 ====================

// 课时类型枚举
export enum LessonType {
  LAB = 1,
  CHALLENGE = 2,
  QUIZ = 3,
  TEXT = 4,
}

// 课程难度枚举
export enum CourseDifficulty {
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
}

// 课程状态枚举
export enum CourseStatus {
  DRAFT = 0,
  PUBLISHED = 1,
  ARCHIVED = 2,
}

// 课时数据（来自API）
export interface ApiLesson {
  id: number;
  courseId: number;
  stageId: number;
  title: string;
  type: LessonType;
  durationMinutes: number;
  labIdentifier?: string;
  points: number;
  sortOrder: number;
  createdAt?: string;
}

// 阶段数据（来自API）
export interface ApiStage {
  id: number;
  courseId: number;
  title: string;
  description: string;
  sortOrder: number;
  levelLabel: string;
  createdAt?: string;
  lessons?: ApiLesson[];
}

// 课程数据（来自API）
export interface ApiCourse {
  id: number;
  title: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverColor: string;
  difficulty: CourseDifficulty;
  totalLessons: number;
  totalSkills: number;
  estimatedHours: number;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  stages?: ApiStage[];
}

// ==================== 前端展示类型 ====================

// 技能等级
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// 课程类型
export type CourseType = 'lab' | 'challenge' | 'quiz' | 'text';

// 技能课程（用于展示）
export interface SkillCourse {
  id: number;
  title: string;
  type: CourseType;
  time: string;
  level: SkillLevel;
  points: number;
  stageId: number;
}

// 技能阶段（用于展示）
export interface SkillStage {
  id: number;
  title: string;
  description: string;
  levelLabel: string;
  level: SkillLevel;
  lessons: SkillCourse[];
}

// 技能统计
export interface SkillStats {
  skills: number;
  lessons: number;
  hours: number;
}

// 技能（用于展示）
export interface Skill {
  id: number;
  title: string;
  slug: string;
  description: string;
  icon: LucideIcon;
  color: string;
  coverColor: string;
  difficulty: CourseDifficulty;
  stats: SkillStats;
  status: CourseStatus;
  progress?: number;
  isAdded?: boolean;
  stages?: SkillStage[];
}

// 排行榜用户
export interface LeaderboardUser {
  name: string;
  xp: string;
  rank: number;
  color?: string;
  active?: boolean;
}

// ==================== 工具函数 ====================

// 获取等级颜色
export const getLevelColor = (level: SkillLevel): string => {
  switch (level) {
    case 'Beginner':
      return 'from-emerald-500 to-teal-500';
    case 'Intermediate':
      return 'from-blue-500 to-indigo-500';
    case 'Advanced':
      return 'from-purple-500 to-violet-500';
    default:
      return 'from-slate-500 to-slate-700';
  }
};

// 获取等级背景样式
export const getLevelBg = (level: SkillLevel): string => {
  switch (level) {
    case 'Beginner':
      return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    case 'Intermediate':
      return 'bg-blue-50 border-blue-100 text-blue-700';
    case 'Advanced':
      return 'bg-purple-50 border-purple-100 text-purple-700';
    default:
      return 'bg-slate-50';
  }
};

// 获取等级中文名
export const getLevelName = (level: SkillLevel): string => {
  switch (level) {
    case 'Beginner':
      return '初级';
    case 'Intermediate':
      return '中级';
    case 'Advanced':
      return '高级';
  }
};

// 难度转等级
export const difficultyToLevel = (difficulty: CourseDifficulty): SkillLevel => {
  switch (difficulty) {
    case CourseDifficulty.BEGINNER:
      return 'Beginner';
    case CourseDifficulty.INTERMEDIATE:
      return 'Intermediate';
    case CourseDifficulty.ADVANCED:
      return 'Advanced';
    default:
      return 'Beginner';
  }
};

// 难度中文名
export const getDifficultyName = (difficulty: CourseDifficulty): string => {
  switch (difficulty) {
    case CourseDifficulty.BEGINNER:
      return '初级';
    case CourseDifficulty.INTERMEDIATE:
      return '中级';
    case CourseDifficulty.ADVANCED:
      return '高级';
    default:
      return '初级';
  }
};

// 课时类型转字符串
export const lessonTypeToString = (type: LessonType): CourseType => {
  switch (type) {
    case LessonType.LAB:
      return 'lab';
    case LessonType.CHALLENGE:
      return 'challenge';
    case LessonType.QUIZ:
      return 'quiz';
    case LessonType.TEXT:
      return 'text';
    default:
      return 'lab';
  }
};

// 课时类型中文名
export const getLessonTypeName = (type: LessonType): string => {
  switch (type) {
    case LessonType.LAB:
      return '实验';
    case LessonType.CHALLENGE:
      return '挑战';
    case LessonType.QUIZ:
      return '测验';
    case LessonType.TEXT:
      return '文本';
    default:
      return '实验';
  }
};

// 格式化时长
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

// 阶段标签转等级
export const levelLabelToLevel = (label: string): SkillLevel => {
  const upperLabel = label.toUpperCase();
  if (upperLabel.includes('BEGINNER')) return 'Beginner';
  if (upperLabel.includes('INTERMEDIATE')) return 'Intermediate';
  if (upperLabel.includes('ADVANCED')) return 'Advanced';
  return 'Beginner';
};

// 状态中文名
export const getStatusName = (status: CourseStatus): string => {
  switch (status) {
    case CourseStatus.DRAFT:
      return '草稿';
    case CourseStatus.PUBLISHED:
      return '已发布';
    case CourseStatus.ARCHIVED:
      return '已下架';
    default:
      return '未知';
  }
};
