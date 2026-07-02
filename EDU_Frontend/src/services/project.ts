import { api } from './api';
import { API_BASE_URL } from '@/config';
import i18n, { getCurrentLocale } from '@/i18n';
import type { ApiResponse } from '@/types';

// ==================== 类型定义 ====================

export interface Tag {
  id: number;
  name: string;
  styleColor: string;
  createdAt?: string;
}

export interface ProjectUnit {
  id: number;
  projectId: number;
  title: string;
  description: string;
  type: number; // 1-实验, 2-挑战
  modeGroup: number; // 1-Guided, 2-Challenge
  envId: string;
  timeLimit: number;
  points: number;
  sortOrder: number;
  isHidden: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  coverUrl: string;
  difficulty: number;
  status: number;
  description: string;
  learningGoals: string[];
  prerequisites: string[];
  labsCount: number;
  challengesCount: number;
  studentsCount: number;
  envImage: string;
  ideImage: string;
  labTemplateId: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  labRuntimeMode?: 'classic' | 'openclaw';
  tags?: Tag[];
  units?: ProjectUnit[];
}

export interface ProjectListResponse {
  list: Project[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
  difficulty?: number;
  tagId?: number;
}

export interface CreateProjectDTO {
  title: string;
  slug: string;
  subtitle?: string;
  coverUrl?: string;
  difficulty?: number;
  status?: number;
  description?: string;
  learningGoals?: string[];
  prerequisites?: string[];
  tagIds?: number[];
  envImage?: string;
  ideImage?: string;
  labTemplateId?: number;
}

export interface UpdateProjectDTO extends Partial<CreateProjectDTO> {}

export interface CreateUnitDTO {
  title: string;
  description?: string;
  type?: number;
  modeGroup?: number;
  envId?: string;
  timeLimit?: number;
  points?: number;
  sortOrder?: number;
  isHidden?: number;
}

export interface UpdateUnitDTO extends Partial<CreateUnitDTO> {}

export interface UploadResponse {
  url: string;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}

// ==================== 项目 API ====================

export const projectApi = {
  // 获取项目列表
  async getList(query: ProjectListQuery = {}): Promise<ApiResponse<ProjectListResponse>> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.pageSize) params.append('pageSize', String(query.pageSize));
    if (query.keyword) params.append('keyword', query.keyword);
    if (query.status !== undefined) params.append('status', String(query.status));
    if (query.difficulty !== undefined) params.append('difficulty', String(query.difficulty));
    if (query.tagId) params.append('tagId', String(query.tagId));
    
    const queryString = params.toString();
    return api.get<ProjectListResponse>(`/projects${queryString ? `?${queryString}` : ''}`);
  },

  // 获取单个项目
  async getById(id: number): Promise<ApiResponse<Project>> {
    return api.get<Project>(`/projects/${id}`);
  },

  // 根据 Slug 获取项目
  async getBySlug(slug: string): Promise<ApiResponse<Project>> {
    return api.get<Project>(`/projects/slug/${slug}`);
  },

  // 创建项目
  async create(data: CreateProjectDTO): Promise<ApiResponse<Project>> {
    return api.post<Project>('/projects', data);
  },

  // 更新项目
  async update(id: number, data: UpdateProjectDTO): Promise<ApiResponse<Project>> {
    return api.put<Project>(`/projects/${id}`, data);
  },

  // 删除项目
  async delete(id: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/projects/${id}`);
  },

  // 发布项目
  async publish(id: number): Promise<ApiResponse<Project>> {
    return api.put<Project>(`/projects/${id}/publish`, {});
  },

  // 下架项目
  async archive(id: number): Promise<ApiResponse<Project>> {
    return api.put<Project>(`/projects/${id}/archive`, {});
  },

  // 设为草稿
  async draft(id: number): Promise<ApiResponse<Project>> {
    return api.put<Project>(`/projects/${id}/draft`, {});
  },
};

// ==================== 项目单元 API ====================

export const unitApi = {
  // 获取项目单元列表
  async getList(projectId: number): Promise<ApiResponse<ProjectUnit[]>> {
    return api.get<ProjectUnit[]>(`/projects/${projectId}/units`);
  },

  // 创建单元
  async create(projectId: number, data: CreateUnitDTO): Promise<ApiResponse<ProjectUnit>> {
    return api.post<ProjectUnit>(`/projects/${projectId}/units`, data);
  },

  // 更新单元
  async update(projectId: number, unitId: number, data: UpdateUnitDTO): Promise<ApiResponse<ProjectUnit>> {
    return api.put<ProjectUnit>(`/projects/${projectId}/units/${unitId}`, data);
  },

  // 删除单元
  async delete(projectId: number, unitId: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/projects/${projectId}/units/${unitId}`);
  },

  // 重新排序
  async reorder(projectId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<ProjectUnit[]>> {
    return api.put<ProjectUnit[]>(`/projects/${projectId}/units/reorder`, { orders });
  },
};

// ==================== 标签 API ====================

export const tagApi = {
  // 获取所有标签
  async getAll(): Promise<ApiResponse<Tag[]>> {
    return api.get<Tag[]>('/tags');
  },

  // 创建标签
  async create(name: string, styleColor?: string): Promise<ApiResponse<Tag>> {
    return api.post<Tag>('/tags', { name, styleColor });
  },

  // 更新标签
  async update(id: number, name?: string, styleColor?: string): Promise<ApiResponse<Tag>> {
    return api.put<Tag>(`/tags/${id}`, { name, styleColor });
  },

  // 删除标签
  async delete(id: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/tags/${id}`);
  },
};

// ==================== 文件上传 API ====================

export const uploadApi = {
  // 上传单个图片
  async uploadImage(file: File): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'X-Locale': getCurrentLocale() };
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
        error: error instanceof Error ? error.message : i18n.t('errors:UPLOAD_FAILED'),
      };
    }
  },

  // 删除文件
  async deleteFile(filePath: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`/upload/file?filePath=${encodeURIComponent(filePath)}`);
  },
};
