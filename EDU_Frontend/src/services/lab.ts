import { api } from './api';
import type { ApiResponse } from '@/types';

// 实验会话状态
export enum LabSessionStatus {
  CREATING = 0,
  RUNNING = 1,
  STOPPED = 2,
  ERROR = 3,
}

// 来源类型
export enum LabSourceType {
  COURSE = 1,
  PROJECT = 2,
}

// Docker 镜像接口
export interface DockerImage {
  id: string;
  fullId: string;
  name: string;
  tags: string[];
  size: number;
  created: number;
}

// 实验会话接口
export interface LabSession {
  id: number;
  userId: number;
  sourceType: LabSourceType;
  sourceId: number;
  containerId: string;
  containerName: string;
  imageName: string;
  vncPort: number;
  idePort: number;
  sshPort: number;
  gatewayPort: number;
  gatewayToken: string;
  desktopEnabled: boolean;
  appPorts: LabAppPort[];
  defaultAppPortName: string;
  runtimeMode: number; // 1-classic, 2-openclaw
  status: LabSessionStatus;
  errorMessage: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabAppPort {
  name: string;
  label: string;
  containerPort: number;
  path: string;
}

export interface LabAppUrl extends LabAppPort {
  servicePort: number;
  url: string;
  isDefault: boolean;
}

// 实验环境 URL
export interface LabUrls {
  vncUrl: string;
  ideUrl: string;
  sshInfo: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  runtimeMode?: 'classic' | 'openclaw';
  appUrls?: LabAppUrl[];
}

// 活跃会话响应
export interface ActiveSessionResponse {
  session: LabSession | null;
  urls?: LabUrls;
}

// 命令执行结果
export interface ExecuteResult {
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
}

// 实验室 API
export const labApi = {
  // 获取可用的 Docker 镜像列表（管理员）
  async getImages(): Promise<ApiResponse<DockerImage[]>> {
    return api.get<DockerImage[]>('/lab/images');
  },

  // 获取当前活跃会话
  async getActiveSession(): Promise<ApiResponse<ActiveSessionResponse>> {
    return api.get<ActiveSessionResponse>('/lab/active');
  },

  // 获取用户所有会话历史
  async getUserSessions(): Promise<ApiResponse<LabSession[]>> {
    return api.get<LabSession[]>('/lab/sessions');
  },

  // 创建实验环境
  async createSession(
    sourceType: LabSourceType,
    sourceId: number
  ): Promise<ApiResponse<{ session: LabSession; urls: LabUrls }>> {
    return api.post<{ session: LabSession; urls: LabUrls }>('/lab/create', { sourceType, sourceId });
  },

  // 停止实验环境
  async stopSession(sessionId: number): Promise<ApiResponse<{ message: string }>> {
    return api.post<{ message: string }>(`/lab/stop/${sessionId}`, {});
  },

  async renewLease(sessionId: number): Promise<ApiResponse<{ sessionId: number; leaseExpiresAt: string }>> {
    return api.post<{ sessionId: number; leaseExpiresAt: string }>(`/lab/heartbeat/${sessionId}`, {});
  },

  // 获取实验环境 URL
  async getSessionUrls(): Promise<ApiResponse<LabUrls>> {
    return api.get<LabUrls>('/lab/urls');
  },

  // 在容器中执行命令
  async executeCommand(command: string, context?: { manualId?: number; stepOrder?: number }): Promise<ApiResponse<ExecuteResult>> {
    return api.post<ExecuteResult>('/lab/execute', { command, ...context });
  },
};
