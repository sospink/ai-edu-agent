import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type {
  Course,
  CourseListQuery,
  CourseListResponse,
  CourseStage,
  CourseLesson,
  CreateCourseDTO,
  UpdateCourseDTO,
  CreateStageDTO,
  UpdateStageDTO,
  CreateLessonDTO,
  UpdateLessonDTO,
  LessonMaterial,
  UpdateMaterialDTO,
} from './course';

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

export const teacherCourseApi = {
  getList(query: CourseListQuery = {}): Promise<ApiResponse<CourseListResponse>> {
    return teacherApi.get<CourseListResponse>(`/courses${buildQuery(query)}`);
  },
  getById(id: number): Promise<ApiResponse<Course>> {
    return teacherApi.get<Course>(`/courses/${id}`);
  },
  create(data: CreateCourseDTO): Promise<ApiResponse<Course>> {
    return teacherApi.post<Course>('/courses', data);
  },
  update(id: number, data: UpdateCourseDTO): Promise<ApiResponse<Course>> {
    return teacherApi.put<Course>(`/courses/${id}`, data);
  },
  delete(id: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/courses/${id}`);
  },
  publish(id: number): Promise<ApiResponse<Course>> {
    return teacherApi.post<Course>(`/courses/${id}/publish`, {});
  },
  archive(id: number): Promise<ApiResponse<Course>> {
    return teacherApi.post<Course>(`/courses/${id}/archive`, {});
  },
  draft(id: number): Promise<ApiResponse<Course>> {
    return teacherApi.post<Course>(`/courses/${id}/draft`, {});
  },
};

export const teacherStageApi = {
  getList(courseId: number): Promise<ApiResponse<CourseStage[]>> {
    return teacherApi.get<CourseStage[]>(`/courses/${courseId}/stages`);
  },
  create(courseId: number, data: CreateStageDTO): Promise<ApiResponse<CourseStage>> {
    return teacherApi.post<CourseStage>(`/courses/${courseId}/stages`, data);
  },
  update(courseId: number, stageId: number, data: UpdateStageDTO): Promise<ApiResponse<CourseStage>> {
    return teacherApi.put<CourseStage>(`/courses/${courseId}/stages/${stageId}`, data);
  },
  delete(courseId: number, stageId: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/courses/${courseId}/stages/${stageId}`);
  },
  reorder(courseId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<CourseStage[]>> {
    return teacherApi.post<CourseStage[]>(`/courses/${courseId}/stages/reorder`, { orders });
  },
};

export const teacherLessonApi = {
  getList(courseId: number): Promise<ApiResponse<CourseLesson[]>> {
    return teacherApi.get<CourseLesson[]>(`/courses/${courseId}/lessons`);
  },
  getByStage(courseId: number, stageId: number): Promise<ApiResponse<CourseLesson[]>> {
    return teacherApi.get<CourseLesson[]>(`/courses/${courseId}/stages/${stageId}/lessons`);
  },
  create(courseId: number, stageId: number, data: CreateLessonDTO): Promise<ApiResponse<CourseLesson>> {
    return teacherApi.post<CourseLesson>(`/courses/${courseId}/stages/${stageId}/lessons`, data);
  },
  update(courseId: number, lessonId: number, data: UpdateLessonDTO): Promise<ApiResponse<CourseLesson>> {
    return teacherApi.put<CourseLesson>(`/courses/${courseId}/lessons/${lessonId}`, data);
  },
  delete(courseId: number, lessonId: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/courses/${courseId}/lessons/${lessonId}`);
  },
  reorder(courseId: number, stageId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<CourseLesson[]>> {
    return teacherApi.post<CourseLesson[]>(`/courses/${courseId}/stages/${stageId}/lessons/reorder`, { orders });
  },
};

export const teacherMaterialApi = {
  getList(lessonId: number): Promise<ApiResponse<LessonMaterial[]>> {
    return teacherApi.get<LessonMaterial[]>(`/courses/lessons/${lessonId}/materials`);
  },
  upload(lessonId: number, file: File, title?: string): Promise<ApiResponse<LessonMaterial>> {
    const formData = new FormData();
    formData.append('material', file);
    if (title) formData.append('title', title);
    return teacherApi.upload<LessonMaterial>(`/courses/lessons/${lessonId}/materials`, formData);
  },
  update(materialId: number, data: UpdateMaterialDTO): Promise<ApiResponse<LessonMaterial>> {
    return teacherApi.put<LessonMaterial>(`/courses/materials/${materialId}`, data);
  },
  delete(materialId: number): Promise<ApiResponse<null>> {
    return teacherApi.delete<null>(`/courses/materials/${materialId}`);
  },
  reorder(lessonId: number, orders: { id: number; sortOrder: number }[]): Promise<ApiResponse<LessonMaterial[]>> {
    return teacherApi.post<LessonMaterial[]>(`/courses/lessons/${lessonId}/materials/reorder`, { orders });
  },
};
