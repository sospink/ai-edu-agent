import { createScopedApi } from './api';
import type { ApiResponse } from '@/types';

const adminApi = createScopedApi('/admin');

export interface RBACPolicyRow {
  role: string;
  object: string;
  action: string;
}

export interface RBACInheritanceRow {
  from: string;
  to: string;
}

export interface RBACPoliciesPayload {
  roles: string[];
  policies: RBACPolicyRow[];
  inheritance: RBACInheritanceRow[];
  policyPath: string;
}

export const adminRbacApi = {
  getPolicies(): Promise<ApiResponse<RBACPoliciesPayload>> {
    return adminApi.get<RBACPoliciesPayload>('/rbac/policies');
  },
};
