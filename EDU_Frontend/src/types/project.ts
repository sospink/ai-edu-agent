// 项目难度等级
export type ProjectDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

// 项目状态
export enum ProjectStatus {
  DRAFT = 0,
  PUBLISHED = 1,
  ARCHIVED = 2,
}

// 单元类型
export enum UnitType {
  LAB = 1,
  CHALLENGE = 2,
}

// 单元分组
export enum UnitModeGroup {
  GUIDED = 1,
  CHALLENGE = 2,
}

// 项目接口
export interface Project {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  coverUrl: string;
  difficulty: number; // 1-初级, 2-中级, 3-高级
  status: ProjectStatus;
  description?: string;
  learningGoals?: string[];
  prerequisites?: string[];
  labsCount: number;
  durationMinutes?: number;
  challengesCount: number;
  studentsCount: number;
  envImage?: string;
  ideImage?: string;
  labTemplateId?: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // 关联数据
  tags?: Tag[];
}

// 项目单元
export interface ProjectUnit {
  id: number;
  projectId: number;
  title: string;
  description: string;
  type: UnitType;
  modeGroup: UnitModeGroup;
  envId: string;
  timeLimit: number;
  points: number;
  sortOrder: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

// 标签
export interface Tag {
  id: number;
  name: string;
  styleColor: string;
  createdAt: string;
}

// 用户项目进度
export interface UserProjectProgress {
  id: number;
  userId: number;
  projectId: number;
  status: number; // 0-未开始, 1-进行中, 2-已完成
  currentUnitId: number;
  finishedUnitsCount: number;
  progressPercent: number;
  lastActiveAt?: string;
  startedAt?: string;
  completedAt?: string;
}

// 前端展示用的项目类型（包含计算属性）
export interface ProjectDisplay extends Project {
  level: ProjectDifficulty;
  color: string;
  accentColor: string;
  duration: string;
}

// 难度映射工具函数
export const getDifficultyLevel = (difficulty: number): ProjectDifficulty => {
  switch (difficulty) {
    case 1: return 'Beginner';
    case 2: return 'Intermediate';
    case 3: return 'Advanced';
    default: return 'Beginner';
  }
};

export const getDifficultyColor = (difficulty: number): { color: string; accentColor: string } => {
  switch (difficulty) {
    case 1:
      return { color: 'bg-emerald-50 text-emerald-600', accentColor: 'from-emerald-400 to-teal-500' };
    case 2:
      return { color: 'bg-blue-50 text-blue-600', accentColor: 'from-blue-400 to-cyan-500' };
    case 3:
      return { color: 'bg-amber-50 text-amber-600', accentColor: 'from-amber-400 to-yellow-500' };
    default:
      return { color: 'bg-slate-50 text-slate-600', accentColor: 'from-slate-400 to-slate-600' };
  }
};
