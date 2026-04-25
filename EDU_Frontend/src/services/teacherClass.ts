import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type {
  ClassDetail,
  ClassMemberItem,
  ClassroomListQuery,
  ClassroomListResponse,
  CreateClassDTO,
  ImportMembersResult,
  TermItem,
  UpdateClassDTO,
} from './classroom';
import { buildQuery, ensureArray, normalizeClassroomListResponse } from './classroom';

const teacherApi = createScopedApi('/teacher');

export const teacherClassApi = {
  async getTerms(): Promise<ApiResponse<TermItem[]>> {
    const response = await teacherApi.get<TermItem[]>('/terms');
    return {
      ...response,
      data: ensureArray(response.data),
    };
  },
  async getList(query: ClassroomListQuery = {}): Promise<ApiResponse<ClassroomListResponse>> {
    const response = await teacherApi.get<ClassroomListResponse>(`/classes${buildQuery(query)}`);
    return {
      ...response,
      data: normalizeClassroomListResponse(response.data),
    };
  },
  getById(id: number): Promise<ApiResponse<ClassDetail>> {
    return teacherApi.get<ClassDetail>(`/classes/${id}`);
  },
  create(data: CreateClassDTO): Promise<ApiResponse<ClassDetail>> {
    return teacherApi.post<ClassDetail>('/classes', data);
  },
  update(id: number, data: UpdateClassDTO): Promise<ApiResponse<ClassDetail>> {
    return teacherApi.put<ClassDetail>(`/classes/${id}`, data);
  },
  async getMembers(id: number): Promise<ApiResponse<ClassMemberItem[]>> {
    const response = await teacherApi.get<ClassMemberItem[]>(`/classes/${id}/members`);
    return {
      ...response,
      data: ensureArray(response.data),
    };
  },
  importMembers(id: number, file: File): Promise<ApiResponse<ImportMembersResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return teacherApi.upload<ImportMembersResult>(`/classes/${id}/members/import`, formData);
  },
  removeMember(id: number, userId: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/classes/${id}/members/${userId}`);
  },
};
