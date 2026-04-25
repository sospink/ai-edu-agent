import { api } from './api';
import type { User, ApiResponse, PaginatedResponse, RoleType, UserStatus } from '@/types';

export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  roleType?: RoleType;
  status?: UserStatus;
}

export interface CreateUserParams {
  username: string;
  email: string;
  password: string;
  phone?: string;
  studentId?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  githubLink?: string;
  roleType?: RoleType;
}

export interface UpdateUserParams {
  phone?: string;
  studentId?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  githubLink?: string;
  roleType?: RoleType;
  status?: UserStatus;
}

export interface StudentLeaderboardItem {
  id: number;
  rank: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  skillsCount: number;
  completedLessons: number;
  enrolledCourses: number;
  lastActiveAt?: string;
  isCurrentUser: boolean;
}

export const userService = {
  async getUsers(params: UserQueryParams = {}): Promise<ApiResponse<PaginatedResponse<User>>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.keyword) query.append('keyword', params.keyword);
    if (params.roleType) query.append('roleType', String(params.roleType));
    if (params.status) query.append('status', String(params.status));
    
    return api.get<PaginatedResponse<User>>(`/users?${query.toString()}`);
  },

  async getUserById(id: number): Promise<ApiResponse<User>> {
    return api.get<User>(`/users/${id}`);
  },

  async getStudentLeaderboard(limit = 4): Promise<ApiResponse<StudentLeaderboardItem[]>> {
    return api.get<StudentLeaderboardItem[]>(`/users/student-leaderboard?limit=${limit}`);
  },

  async createUser(params: CreateUserParams): Promise<ApiResponse<User>> {
    return api.post<User>('/users', params);
  },

  async updateUser(id: number, params: UpdateUserParams): Promise<ApiResponse<User>> {
    return api.put<User>(`/users/${id}`, params);
  },

  async deleteUser(id: number): Promise<ApiResponse<null>> {
    return api.delete<null>(`/users/${id}`);
  },

  async updatePassword(id: number, oldPassword: string, newPassword: string): Promise<ApiResponse<null>> {
    return api.put<null>(`/users/${id}/password`, { oldPassword, newPassword });
  },

  async freezeUser(id: number): Promise<ApiResponse<null>> {
    return api.put<null>(`/users/${id}/freeze`, {});
  },

  async activateUser(id: number): Promise<ApiResponse<null>> {
    return api.put<null>(`/users/${id}/activate`, {});
  },
};
