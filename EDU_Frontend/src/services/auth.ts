import { api } from './api';
import type { User, ApiResponse } from '@/types';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export const authService = {
  // 登录
  async login(params: LoginParams): Promise<ApiResponse<LoginResponse>> {
    return api.post<LoginResponse>('/auth/login', params);
  },

  // 保存已通过前端入口校验的登录态
  saveSession(session: LoginResponse): void {
    api.setToken(session.token);
    localStorage.setItem('currentUser', JSON.stringify(session.user));
  },

  // 退出登录
  async logout(): Promise<ApiResponse<null>> {
    const response = await api.post<null>('/auth/logout');
    
    // 无论成功与否都清除本地存储
    api.clearToken();
    
    return response;
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return api.get<User>('/auth/me');
  },

  // 刷新 Token
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await api.post<{ token: string }>('/auth/refresh');
    
    if (response.success && response.data?.token) {
      api.setToken(response.data.token);
    }
    
    return response;
  },

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!localStorage.getItem('authToken');
  },

  // 获取本地存储的用户信息
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  // 清除登录状态
  clearAuth(): void {
    api.clearToken();
  },
};
