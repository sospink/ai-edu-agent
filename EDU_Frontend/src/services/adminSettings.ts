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

export interface ModelSettings {
  provider: string;
  baseUrl: string;
  model: string;
  configured: boolean;
  source: 'none' | 'environment' | 'managed';
  version: number;
  updatedAt?: string;
}

export interface ModelSettingsInput {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  version: number;
  clearKey?: boolean;
}

export const adminSettingsService = {
  getModelSettings(): Promise<ApiResponse<ModelSettings>> {
    return adminApi.get<ModelSettings>('/model-settings');
  },
  saveModelSettings(input: ModelSettingsInput): Promise<ApiResponse<ModelSettings>> {
    return adminApi.put<ModelSettings>('/model-settings', input);
  },
  testModelSettings(input: ModelSettingsInput): Promise<ApiResponse<{ model: string; latencyMs: number }>> {
    return adminApi.post<{ model: string; latencyMs: number }>('/model-settings/test', input);
  },
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
