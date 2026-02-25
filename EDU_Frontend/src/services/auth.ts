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
    const response = await api.post<LoginResponse>('/auth/login', params);
    
    // 登录成功后保存 token
    if (response.success && response.data?.token) {
      console.log('[Auth] 登录成功，保存 token:', response.data.token.substring(0, 20) + '...');
      api.setToken(response.data.token);
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
      console.log('[Auth] Token 已保存，验证:', localStorage.getItem('authToken')?.substring(0, 20) + '...');
    } else {
      console.log('[Auth] 登录响应:', response);
    }
    
    return response;
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
