import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type { ClassDetail, ClassStatus, ClassroomListQuery, ClassroomListResponse } from './classroom';
import { buildQuery, normalizeClassroomListResponse } from './classroom';

const adminApi = createScopedApi('/admin');

export const adminClassApi = {
  async getList(query: ClassroomListQuery = {}): Promise<ApiResponse<ClassroomListResponse>> {
    const response = await adminApi.get<ClassroomListResponse>(`/classes${buildQuery(query)}`);
    return {
      ...response,
      data: normalizeClassroomListResponse(response.data),
    };
  },
  getById(id: number): Promise<ApiResponse<ClassDetail>> {
    return adminApi.get<ClassDetail>(`/classes/${id}`);
  },
  updateStatus(id: number, status: ClassStatus): Promise<ApiResponse<ClassDetail>> {
    return adminApi.patch<ClassDetail>(`/classes/${id}/status`, { status });
  },
};
