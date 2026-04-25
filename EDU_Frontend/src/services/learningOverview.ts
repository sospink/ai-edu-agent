import { api } from './api';
import type { ApiResponse } from '@/types';

export type LearningMilestoneType = 'courses' | 'lessons' | 'streak';

export interface LearningMilestone {
  type: LearningMilestoneType;
  label: string;
  current: number;
  target: number;
}

export interface LearningOutcomeSummary {
  submittedAssignments: number;
  gradedAssignments: number;
  publishedGrades: number;
  agentManualsInProgress: number;
  agentCompletedSteps: number;
}

export interface LearningOverview {
  level: number;
  levelName: string;
  overallProgressPercent: number;
  completedCourses: number;
  inProgressCourses: number;
  completedLessons: number;
  totalLessons: number;
  currentStreakDays: number;
  activeDaysLast7: number;
  milestones: LearningMilestone[];
  outcomeSummary: LearningOutcomeSummary;
}

export const emptyLearningOverview: LearningOverview = {
  level: 1,
  levelName: 'Explorer',
  overallProgressPercent: 0,
  completedCourses: 0,
  inProgressCourses: 0,
  completedLessons: 0,
  totalLessons: 0,
  currentStreakDays: 0,
  activeDaysLast7: 0,
  milestones: [
    { type: 'courses', label: '完成 3 个课程', current: 0, target: 3 },
    { type: 'lessons', label: '完成 10 个课时', current: 0, target: 10 },
    { type: 'streak', label: '连续学习 7 天', current: 0, target: 7 },
  ],
  outcomeSummary: {
    submittedAssignments: 0,
    gradedAssignments: 0,
    publishedGrades: 0,
    agentManualsInProgress: 0,
    agentCompletedSteps: 0,
  },
};

export const learningOverviewApi = {
  getOverview(): Promise<ApiResponse<LearningOverview>> {
    return api.get<LearningOverview>('/learning/overview');
  },
};
