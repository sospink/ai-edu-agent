import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type { CreateTermDTO, TermItem, TermStatus, UpdateTermDTO } from './classroom';
import { buildQuery, ensureArray } from './classroom';

const adminApi = createScopedApi('/admin');

export const adminTermApi = {
  async getTerms(keyword = ''): Promise<ApiResponse<TermItem[]>> {
    const response = await adminApi.get<TermItem[]>(`/terms${buildQuery({ keyword })}`);
    return {
      ...response,
      data: ensureArray(response.data),
    };
  },
  create(data: CreateTermDTO): Promise<ApiResponse<TermItem>> {
    return adminApi.post<TermItem>('/terms', data);
  },
  update(id: number, data: UpdateTermDTO): Promise<ApiResponse<TermItem>> {
    return adminApi.put<TermItem>(`/terms/${id}`, data);
  },
  updateStatus(id: number, status: TermStatus): Promise<ApiResponse<TermItem>> {
    return adminApi.patch<TermItem>(`/terms/${id}/status`, { status });
  },
};
