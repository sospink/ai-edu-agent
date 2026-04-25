import { createScopedApi } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types';

const teacherApi = createScopedApi('/teacher');

export type TeacherProgressView = 'course' | 'project';

export interface TeacherProgressSummary {
  total: number;
  inProgress: number;
  completed: number;
}

export interface TeacherProgressItem {
  type: TeacherProgressView;
  resourceId: number;
  resourceTitle: string;
  userId: number;
  username: string;
  fullName: string;
  status: number;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  lastActiveAt?: string | null;
  completedAt?: string | null;
  currentResourceId: number;
}

export interface TeacherProgressPayload extends PaginatedResponse<TeacherProgressItem> {
  view: TeacherProgressView;
  summary: TeacherProgressSummary;
}

export const teacherProgressApi = {
  list(params: { view: TeacherProgressView; page?: number; pageSize?: number; q?: string }): Promise<ApiResponse<TeacherProgressPayload>> {
    const query = new URLSearchParams();
    query.set('view', params.view);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.q) query.set('q', params.q);
    return teacherApi.get<TeacherProgressPayload>(`/students/progress?${query.toString()}`);
  },
};
