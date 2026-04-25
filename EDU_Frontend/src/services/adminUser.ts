import { createScopedApi } from './api';
import type { ApiResponse, PaginatedResponse, User } from '@/types';
import type { RoleType, UserStatus } from '@/types';
import type { CreateUserParams, UpdateUserParams, UserQueryParams } from './user';

const adminApi = createScopedApi('/admin');

const buildQuery = (params: UserQueryParams) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.roleType) query.set('roleType', String(params.roleType));
  if (params.status) query.set('status', String(params.status));
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

export const adminUserService = {
  getUsers(params: UserQueryParams = {}): Promise<ApiResponse<PaginatedResponse<User>>> {
    return adminApi.get<PaginatedResponse<User>>(`/users${buildQuery(params)}`);
  },

  getUserById(id: number): Promise<ApiResponse<User>> {
    return adminApi.get<User>(`/users/${id}`);
  },

  createUser(params: CreateUserParams): Promise<ApiResponse<User>> {
    return adminApi.post<User>('/users', params);
  },

  updateUser(id: number, params: UpdateUserParams): Promise<ApiResponse<User>> {
    return adminApi.put<User>(`/users/${id}`, params);
  },

  deleteUser(id: number): Promise<ApiResponse<null>> {
    return adminApi.delete<null>(`/users/${id}`);
  },

  updatePassword(id: number, newPassword: string): Promise<ApiResponse<null>> {
    return adminApi.put<null>(`/users/${id}/password`, { newPassword });
  },

  freezeUser(id: number): Promise<ApiResponse<null>> {
    return adminApi.put<null>(`/users/${id}/freeze`, {});
  },

  activateUser(id: number): Promise<ApiResponse<null>> {
    return adminApi.put<null>(`/users/${id}/activate`, {});
  },
};

export type { UserQueryParams, CreateUserParams, UpdateUserParams, RoleType, UserStatus };
