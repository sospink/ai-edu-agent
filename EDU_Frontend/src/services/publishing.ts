import { api, createScopedApi } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types';

const teacherApi = createScopedApi('/teacher');
const adminApi = createScopedApi('/admin');

export interface CheckIssue {
  code: string;
  severity: 'error' | 'warning' | string;
  message: string;
  scope?: string;
  resourceId?: number;
  resourceName?: string;
}

export interface PublishCheckResult {
  checkId?: number;
  contentType: 'course' | 'project' | 'manual' | string;
  contentId: number;
  canPublish: boolean;
  errors: CheckIssue[];
  warnings: CheckIssue[];
  summary: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  checkedAt: string;
}

export interface LabTemplateAppPort {
  name: string;
  label: string;
  containerPort: number;
  path: string;
}

export type LabTemplateExposedPortType = 'novnc' | 'web';

export interface LabTemplateExposedPort {
  type: LabTemplateExposedPortType;
  name: string;
  label: string;
  containerPort: number;
  path: string;
  isDefault: boolean;
}

export interface LabTemplate {
  id: number;
  name: string;
  code: string;
  description: string;
  envImage: string;
  ideImage: string;
  mainCpuRequest: string;
  mainMemoryRequest: string;
  mainCpuLimit: string;
  mainMemoryLimit: string;
  ideCpuRequest: string;
  ideMemoryRequest: string;
  ideCpuLimit: string;
  ideMemoryLimit: string;
  desktopEnabled: boolean;
  appPorts: LabTemplateAppPort[];
  defaultAppPortName: string;
  exposedPorts: LabTemplateExposedPort[];
  status: 1 | 2 | number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface LabTemplateDTO {
  name: string;
  code: string;
  description?: string;
  envImage: string;
  ideImage?: string;
  mainCpuRequest?: string;
  mainMemoryRequest?: string;
  mainCpuLimit?: string;
  mainMemoryLimit?: string;
  ideCpuRequest?: string;
  ideMemoryRequest?: string;
  ideCpuLimit?: string;
  ideMemoryLimit?: string;
  desktopEnabled?: boolean;
  appPorts?: LabTemplateAppPort[];
  defaultAppPortName?: string;
  exposedPorts?: LabTemplateExposedPort[];
  status?: number;
}

export interface PublishAuditLog {
  id: number;
  contentType: string;
  contentId: number;
  contentTitle: string;
  action: string;
  actorId: number;
  result: string;
  message: string;
  checkId: number;
  errors: CheckIssue[];
  warnings: CheckIssue[];
  snapshot: Record<string, unknown>;
  createdAt: string;
}

const unwrapBlockedCheck = <T>(response: ApiResponse<T>): PublishCheckResult | null => {
  if (response.success) return null;
  const maybeData = response.data as unknown;
  if (maybeData && typeof maybeData === 'object' && 'canPublish' in maybeData) {
    return maybeData as PublishCheckResult;
  }
  return null;
};

export const teacherPublishingApi = {
  checkCourse(id: number): Promise<ApiResponse<PublishCheckResult>> {
    return teacherApi.post<PublishCheckResult>(`/courses/${id}/publish-check`, {});
  },
  checkProject(id: number): Promise<ApiResponse<PublishCheckResult>> {
    return teacherApi.post<PublishCheckResult>(`/projects/${id}/publish-check`, {});
  },
  checkManual(id: number): Promise<ApiResponse<PublishCheckResult>> {
    return teacherApi.post<PublishCheckResult>(`/manuals/${id}/publish-check`, {});
  },
  async getLabTemplates(): Promise<ApiResponse<LabTemplate[]>> {
    const response = await teacherApi.get<LabTemplate[]>('/lab-templates');
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data : [],
    };
  },
  extractBlockedCheck: unwrapBlockedCheck,
};

export const adminLabTemplateApi = {
  async list(): Promise<ApiResponse<LabTemplate[]>> {
    const response = await adminApi.get<LabTemplate[]>('/lab-templates');
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data : [],
    };
  },
  create(data: LabTemplateDTO): Promise<ApiResponse<LabTemplate>> {
    return adminApi.post<LabTemplate>('/lab-templates', data);
  },
  update(id: number, data: LabTemplateDTO): Promise<ApiResponse<LabTemplate>> {
    return adminApi.put<LabTemplate>(`/lab-templates/${id}`, data);
  },
  updateStatus(id: number, status: number): Promise<ApiResponse<LabTemplate>> {
    return adminApi.patch<LabTemplate>(`/lab-templates/${id}/status`, { status });
  },
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const adminPublishAuditApi = {
  list(params: { page?: number; pageSize?: number; contentType?: string; action?: string; result?: string } = {}) {
    return api.get<PaginatedResponse<PublishAuditLog>>(`/admin/publish-audit-logs${buildQuery(params)}`);
  },
};
