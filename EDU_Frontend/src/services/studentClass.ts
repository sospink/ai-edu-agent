import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';
import type { ClassItem } from './classroom';
import { ensureArray } from './classroom';

const studentApi = createScopedApi('/student');

export const studentClassApi = {
  async getMyClasses(): Promise<ApiResponse<ClassItem[]>> {
    const response = await studentApi.get<ClassItem[]>('/classes');
    return {
      ...response,
      data: ensureArray(response.data),
    };
  },
};
