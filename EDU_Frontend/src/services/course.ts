import { api } from './api';
import type { ApiResponse } from '@/types';

// ==================== 类型定义 ====================

export interface Skill {
  id: number;
  name: string;
  category: string;
  createdAt?: string;
}

export interface CourseLesson {
  id: number;
  courseId: number;
  stageId: number;
  title: string;
  type: number; // 1-实验, 2-挑战, 3-测验, 4-文本
  durationMinutes: number;
  labIdentifier: string;
  points: number;
  sortOrder: number;
  createdAt?: string;
  skills?: Skill[];
}

export interface CourseStage {
  id: number;
  courseId: number;
  title: string;
  description: string;
  sortOrder: number;
  levelLabel: string;
  createdAt?: string;
  lessons?: CourseLesson[];
}

export interface Course {
  id: number;
  title: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverColor: string;
  difficulty: number;
  totalLessons: number;
  totalSkills: number;
  estimatedHours: number;
  status: number; // 0-草稿, 1-已发布, 2-下架
  envImage: string;
  ideImage: string;
  createdAt: string;
  updatedAt: string;
  stages?: CourseStage[];
}

export interface CourseListResponse {
  list: Course[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CourseListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
  difficulty?: number;
}

export interface CreateCourseDTO {
  title: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  coverColor?: string;
  difficulty?: number;
  status?: number;
  estimatedHours?: number;
  envImage?: string;
  ideImage?: string;
}

export interface UpdateCourseDTO extends Partial<CreateCourseDTO> {}

export interface CreateStageDTO {
  title: string;
  description?: string;
  sortOrder?: number;
  levelLabel?: string;
}

export interface UpdateStageDTO extends Partial<CreateStageDTO> {}

export interface CreateLessonDTO {
  title: string;
  type?: number;
  durationMinutes?: number;
  labIdentifier?: string;
  points?: number;
  sortOrder?: number;
  skillIds?: number[];
}

export interface UpdateLessonDTO extends Partial<CreateLessonDTO> {}

// ==================== 学习资料类型 ====================

export interface LessonMaterial {
  id: number;
  lessonId: number;
  title: string;
  type: number; // 1-Markdown, 2-PDF, 3-思维导图
  fileUrl: string;
  fileName: string;
  fileSize: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateMaterialDTO {
  title?: string;
  sortOrder?: number;
}


// ==================== 课程 API ====================

export const courseApi = {
  // 获取课程列表
  async getList(query: CourseListQuery = {}): Promise<ApiResponse<CourseListResponse>> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.pageSize) params.append('pageSize', String(query.pageSize));
    if (query.keyword) params.append('keyword', query.keyword);
    if (query.status !== undefined) params.append('status', String(query.status));
    if (query.difficulty !== undefined) params.append('difficulty', String(query.difficulty));
    
    const queryString = params.toString();
    return api.get<CourseListResponse>(`/courses${queryString ? `?${queryString}` : ''}`);
  },

  // 获取单个课程
  async getById(id: number): Promise<ApiResponse<Course>> {
    return api.get<Course>(`/courses/${id}`);
  },

  // 根据 Slug 获取课程
  async getBySlug(slug: string): Promise<ApiResponse<Course>> {
    return api.get<Course>(`/courses/slug/${slug}`);
  },

  // 创建课程
  async create(data: CreateCourseDTO): Promise<ApiResponse<Course>> {
    return api.post<Course>('/courses', data);
  },

  // 更新课程
  async update(id: number, data: UpdateCourseDTO): Promise<ApiResponse<Course>> {
    return api.put<Course>(`/courses/${id}`, data);
  },

  // 删除课程
  async delete(id: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/courses/${id}`);
  },

  // 发布课程
  async publish(id: number): Promise<ApiResponse<Course>> {
    return api.post<Course>(`/courses/${id}/publish`, {});
  },

  // 下架课程
  async archive(id: number): Promise<ApiResponse<Course>> {
    return api.post<Course>(`/courses/${id}/archive`, {});
  },

  // 设为草稿
  async draft(id: number): Promise<ApiResponse<Course>> {
    return api.post<Course>(`/courses/${id}/draft`, {});
  },

  // 完成课时
  async completeLesson(lessonId: number): Promise<ApiResponse<CompleteLessonResponse>> {
    return completeLessonApi(lessonId);
  },

  // 开始学习课时
  async startLesson(lessonId: number): Promise<ApiResponse<LessonRecord>> {
    return startLessonApi(lessonId);
  },

  // 获取用户在该课程的学习记录
  async getUserLessonRecords(courseId: number): Promise<ApiResponse<LessonRecord[]>> {
    return getUserLessonRecordsApi(courseId);
  },
};

// ==================== 阶段 API ====================

export const stageApi = {
  // 获取课程阶段列表
  async getList(courseId: number): Promise<ApiResponse<CourseStage[]>> {
    return api.get<CourseStage[]>(`/courses/${courseId}/stages`);
  },

  // 创建阶段
  async create(courseId: number, data: CreateStageDTO): Promise<ApiResponse<CourseStage>> {
    return api.post<CourseStage>(`/courses/${courseId}/stages`, data);
  },

  // 更新阶段
  async update(courseId: number, stageId: number, data: UpdateStageDTO): Promise<ApiResponse<CourseStage>> {
    return api.put<CourseStage>(`/courses/${courseId}/stages/${stageId}`, data);
  },

  // 删除阶段
  async delete(courseId: number, stageId: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/courses/${courseId}/stages/${stageId}`);
  },

  // 重新排序
  async reorder(courseId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<CourseStage[]>> {
    return api.post<CourseStage[]>(`/courses/${courseId}/stages/reorder`, { orders });
  },
};

// ==================== 课时 API ====================

export const lessonApi = {
  // 获取课程所有课时
  async getList(courseId: number): Promise<ApiResponse<CourseLesson[]>> {
    return api.get<CourseLesson[]>(`/courses/${courseId}/lessons`);
  },

  // 获取阶段课时列表
  async getByStage(courseId: number, stageId: number): Promise<ApiResponse<CourseLesson[]>> {
    return api.get<CourseLesson[]>(`/courses/${courseId}/stages/${stageId}/lessons`);
  },

  // 创建课时
  async create(courseId: number, stageId: number, data: CreateLessonDTO): Promise<ApiResponse<CourseLesson>> {
    return api.post<CourseLesson>(`/courses/${courseId}/stages/${stageId}/lessons`, data);
  },

  // 更新课时
  async update(courseId: number, lessonId: number, data: UpdateLessonDTO): Promise<ApiResponse<CourseLesson>> {
    return api.put<CourseLesson>(`/courses/${courseId}/lessons/${lessonId}`, data);
  },

  // 删除课时
  async delete(courseId: number, lessonId: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/courses/${courseId}/lessons/${lessonId}`);
  },

  // 重新排序
  async reorder(courseId: number, stageId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<CourseLesson[]>> {
    return api.post<CourseLesson[]>(`/courses/${courseId}/stages/${stageId}/lessons/reorder`, { orders });
  },
};

// ==================== 技能 API ====================

export const skillApi = {
  // 获取所有技能
  async getAll(): Promise<ApiResponse<Skill[]>> {
    return api.get<Skill[]>('/skills');
  },

  // 按分类获取技能
  async getByCategory(category: string): Promise<ApiResponse<Skill[]>> {
    return api.get<Skill[]>(`/skills/category/${category}`);
  },

  // 创建技能
  async create(name: string, category?: string): Promise<ApiResponse<Skill>> {
    return api.post<Skill>('/skills', { name, category });
  },

  // 更新技能
  async update(id: number, name?: string, category?: string): Promise<ApiResponse<Skill>> {
    return api.put<Skill>(`/skills/${id}`, { name, category });
  },

  // 删除技能
  async delete(id: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/skills/${id}`);
  },
};

// ==================== 课时完成 API ====================

export interface CompleteLessonResponse {
  earnedXP: number;
  record: any;
}

// 课时记录状态
export enum LessonRecordStatus {
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
}

// 课时记录接口
export interface LessonRecord {
  id: number;
  userId: number;
  courseId: number;
  lessonId: number;
  status: LessonRecordStatus;
  score: number;
  startedAt: string | null;
  finishedAt: string | null;
}

// 完成课时
export const completeLessonApi = async (lessonId: number): Promise<ApiResponse<CompleteLessonResponse>> => {
  const response = await api.post<CompleteLessonResponse>(`/courses/lessons/${lessonId}/complete`, {});
  return response;
};

// 开始学习课时
export const startLessonApi = async (lessonId: number): Promise<ApiResponse<LessonRecord>> => {
  const response = await api.post<LessonRecord>(`/courses/lessons/${lessonId}/start`, {});
  return response;
};

// 获取用户在该课程的学习记录
export const getUserLessonRecordsApi = async (courseId: number): Promise<ApiResponse<LessonRecord[]>> => {
  const response = await api.get<LessonRecord[]>(`/courses/${courseId}/progress`);
  return response;
};

// ==================== 学习资料 API ====================

export const materialApi = {
  // 获取课时学习资料列表
  async getList(lessonId: number): Promise<ApiResponse<LessonMaterial[]>> {
    return api.get<LessonMaterial[]>(`/courses/lessons/${lessonId}/materials`);
  },

  // 上传学习资料
  async upload(lessonId: number, file: File, title?: string): Promise<ApiResponse<LessonMaterial>> {
    const formData = new FormData();
    formData.append('material', file);
    if (title) {
      formData.append('title', title);
    }
    return api.upload<LessonMaterial>(`/courses/lessons/${lessonId}/materials`, formData);
  },

  // 更新学习资料
  async update(materialId: number, data: UpdateMaterialDTO): Promise<ApiResponse<LessonMaterial>> {
    return api.put<LessonMaterial>(`/courses/materials/${materialId}`, data);
  },

  // 删除学习资料
  async delete(materialId: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/courses/materials/${materialId}`);
  },

  // 重新排序
  async reorder(lessonId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<LessonMaterial[]>> {
    return api.post<LessonMaterial[]>(`/courses/lessons/${lessonId}/materials/reorder`, { orders });
  },
};
