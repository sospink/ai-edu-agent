import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type {
  Project,
  ProjectListQuery,
  ProjectListResponse,
  ProjectUnit,
  Tag,
  CreateProjectDTO,
  UpdateProjectDTO,
  CreateUnitDTO,
  UpdateUnitDTO,
} from './project';
import { API_BASE_URL } from '@/config';

const teacherApi = createScopedApi('/teacher');

const buildQuery = (query: object) => {
  const params = new URLSearchParams();
  Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

export const teacherProjectApi = {
  getList(query: ProjectListQuery = {}): Promise<ApiResponse<ProjectListResponse>> {
    return teacherApi.get<ProjectListResponse>(`/projects${buildQuery(query)}`);
  },
  getById(id: number): Promise<ApiResponse<Project>> {
    return teacherApi.get<Project>(`/projects/${id}`);
  },
  create(data: CreateProjectDTO): Promise<ApiResponse<Project>> {
    return teacherApi.post<Project>('/projects', data);
  },
  update(id: number, data: UpdateProjectDTO): Promise<ApiResponse<Project>> {
    return teacherApi.put<Project>(`/projects/${id}`, data);
  },
  delete(id: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/projects/${id}`);
  },
  publish(id: number): Promise<ApiResponse<Project>> {
    return teacherApi.put<Project>(`/projects/${id}/publish`, {});
  },
  archive(id: number): Promise<ApiResponse<Project>> {
    return teacherApi.put<Project>(`/projects/${id}/archive`, {});
  },
  draft(id: number): Promise<ApiResponse<Project>> {
    return teacherApi.put<Project>(`/projects/${id}/draft`, {});
  },
};

export const teacherUnitApi = {
  getList(projectId: number): Promise<ApiResponse<ProjectUnit[]>> {
    return teacherApi.get<ProjectUnit[]>(`/projects/${projectId}/units`);
  },
  create(projectId: number, data: CreateUnitDTO): Promise<ApiResponse<ProjectUnit>> {
    return teacherApi.post<ProjectUnit>(`/projects/${projectId}/units`, data);
  },
  update(projectId: number, unitId: number, data: UpdateUnitDTO): Promise<ApiResponse<ProjectUnit>> {
    return teacherApi.put<ProjectUnit>(`/projects/${projectId}/units/${unitId}`, data);
  },
  delete(projectId: number, unitId: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/projects/${projectId}/units/${unitId}`);
  },
  reorder(projectId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<ProjectUnit[]>> {
    return teacherApi.put<ProjectUnit[]>(`/projects/${projectId}/units/reorder`, { orders });
  },
};

export const teacherTagApi = {
  getAll(): Promise<ApiResponse<Tag[]>> {
    return teacherApi.get<Tag[]>('/tags');
  },
  create(name: string, styleColor?: string): Promise<ApiResponse<Tag>> {
    return teacherApi.post<Tag>('/tags', { name, styleColor });
  },
  update(id: number, name?: string, styleColor?: string): Promise<ApiResponse<Tag>> {
    return teacherApi.put<Tag>(`/tags/${id}`, { name, styleColor });
  },
  delete(id: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/tags/${id}`);
  },
};

export const teacherUploadApi = {
  async uploadImage(file: File): Promise<ApiResponse<{ url: string; filename: string; originalname: string; size: number; mimetype: string }>> {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/upload/image`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      };
    }
  },
};
