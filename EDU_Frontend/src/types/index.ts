import { LucideIcon } from 'lucide-react';

// View state types
export type ViewState = 'home' | 'login' | 'study' | 'projects' | 'ai-square' | 'admin-login' | 'admin-panel' | 'profile';

// Feature types
export interface FeatureItem {
  title: string;
  description: string;
  details?: string[];
  icon?: LucideIcon;
}

// Course types
export interface CourseStage {
  title: string;
  label: string;
  duration: string;
  count: string;
  courses: string[];
}

// Platform types
export interface PlatformFeature {
  role: string;
  features: string[];
  icon: LucideIcon;
}

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  studentId?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  githubLink?: string;
  roleType: RoleType;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export enum RoleType {
  STUDENT = 1,
  TEACHER = 2,
  ADMIN = 10,
}

export enum UserStatus {
  ACTIVE = 1,
  FROZEN = 2,
  DELETED = 3,
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
