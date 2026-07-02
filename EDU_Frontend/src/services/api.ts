import { API_BASE_URL } from '@/config';
import i18n, { getCurrentLocale } from '@/i18n';
import type { ApiResponse } from '@/types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // 获取存储的 Token
  private getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  // 设置 Token
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  // 清除 Token
  clearToken(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Locale': getCurrentLocale(),
    };

    // 添加 Authorization header
    const token = this.getToken();
    if (token) {
      (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const rawText = await response.text();
      let data: ApiResponse<T> = {
        success: false,
        error: i18n.t('errors:INVALID_RESPONSE'),
      };

      if (rawText) {
        try {
          data = JSON.parse(rawText) as ApiResponse<T>;
        } catch {
          data = {
            success: false,
            error: i18n.t('errors:INVALID_RESPONSE'),
          };
        }
      } else {
        data = {
          success: false,
          error: i18n.t('errors:EMPTY_RESPONSE', { status: response.status }),
        };
      }
      
      // 如果返回 401 且错误信息表明 token 无效或过期，才清除 token
      // 不要因为"未提供认证令牌"就清除（可能是页面刷新导致的临时问题）
      if (response.status === 401 && (data as ApiResponse<T>).error) {
        const errorMsg = ((data as ApiResponse<T>).error || '').toLowerCase();
        // 只有在 token 明确无效或过期时才清除
        if (errorMsg.includes('无效') || errorMsg.includes('过期') || errorMsg.includes('invalid') || errorMsg.includes('expired')) {
          console.warn('[API] Token无效或过期，清除token');
          this.clearToken();
        }
      }
      
      return data;
    } catch (error) {
      console.error('[API] 请求失败:', endpoint, error);
      return {
        success: false,
        error: i18n.t('errors:NETWORK_ERROR'),
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // 文件上传方法
  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {};
    headers['X-Locale'] = getCurrentLocale();
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // 注意：不要设置 Content-Type，让浏览器自动设置 multipart/form-data 和 boundary

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await response.json();
      
      // 如果返回 401 且错误信息表明 token 无效或过期，才清除 token
      if (response.status === 401 && data.error) {
        const errorMsg = data.error.toLowerCase();
        if (errorMsg.includes('无效') || errorMsg.includes('过期') || errorMsg.includes('invalid') || errorMsg.includes('expired')) {
          this.clearToken();
        }
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: i18n.t('errors:UPLOAD_FAILED'),
      };
    }
  }
}

export const api = new ApiService(API_BASE_URL);

export const createScopedApi = (scopePrefix: string) => {
  const prefix = scopePrefix.startsWith('/') ? scopePrefix : `/${scopePrefix}`;
  const join = (endpoint: string) => `${prefix}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  return {
    get<T>(endpoint: string) {
      return api.get<T>(join(endpoint));
    },
    post<T>(endpoint: string, body?: unknown) {
      return api.post<T>(join(endpoint), body);
    },
    put<T>(endpoint: string, body: unknown) {
      return api.put<T>(join(endpoint), body);
    },
    patch<T>(endpoint: string, body: unknown) {
      return api.patch<T>(join(endpoint), body);
    },
    delete<T>(endpoint: string) {
      return api.delete<T>(join(endpoint));
    },
    upload<T>(endpoint: string, formData: FormData) {
      return api.upload<T>(join(endpoint), formData);
    },
  };
};
