import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';

const adminApi = createScopedApi('/admin');

export interface AdminSettingsPayload {
  app: {
    name: string;
    env: string;
    version: string;
  };
  security: {
    allowedOrigins: string[];
    defaultAdminConfigured: boolean;
    jwtIssuer: string;
    jwtExpiresIn: number;
  };
  server: {
    host: string;
    port: number;
    readTimeout: number;
    writeTimeout: number;
  };
  runtime: {
    k8sEnabled: boolean;
    k8sNamespace: string;
    runtimeNamespace: string;
  };
  uploads: {
    root: string;
    publicBase: string;
    maxImageMB: number;
    maxFileMB: number;
  };
}

export interface AdminAISetting {
  id: number;
  enabled: boolean;
  updatedBy: number;
  updatedAt: string;
}

export const adminSettingsService = {
  getSettings(): Promise<ApiResponse<AdminSettingsPayload>> {
    return adminApi.get<AdminSettingsPayload>('/settings');
  },
  getAISettings(): Promise<ApiResponse<AdminAISetting>> {
    return adminApi.get<AdminAISetting>('/ai-settings');
  },
  updateAISettings(enabled: boolean): Promise<ApiResponse<AdminAISetting>> {
    return adminApi.patch<AdminAISetting>('/ai-settings', { enabled });
  },
};
