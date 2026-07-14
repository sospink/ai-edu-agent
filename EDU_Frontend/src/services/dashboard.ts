import { api } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types';

export type DashboardStatus = 'creating' | 'running' | 'stopped' | 'error' | 'unknown';
export type DashboardSourceType = 'course' | 'project' | 'unknown';
export type DashboardTimeRange = 'all' | '24h' | '7d' | '30d';

export interface DashboardNamedCount {
  name: string;
  count: number;
}

export interface DashboardImageUsage {
  image: string;
  count: number;
}

export interface DashboardIntegrationCard {
  key: string;
  label: string;
  status: 'success' | 'warning' | 'danger' | 'neutral';
  summary: string;
  message: string;
  lastCheck: string;
  details?: Record<string, unknown>;
  canRefresh: boolean;
}

export interface DashboardHighlight {
  id: string;
  level: 'warning' | 'danger' | 'neutral';
  title: string;
  description: string;
  sessionId?: number;
}

export interface DashboardSession {
  id: number;
  userId: number;
  sourceType: number;
  sourceId: number;
  containerId: string;
  containerName: string;
  imageName: string;
  vncPort: number;
  idePort: number;
  sshPort: number;
  status: number;
  errorMessage: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string;
  fullName: string;
  sourceName: string;
  statusText: DashboardStatus;
  sourceText: DashboardSourceType;
}

export interface DashboardOverview {
  kpis: {
    activeSessions: number;
    creatingSessions: number;
    errorSessions: number;
    recent24h: number;
    expiredPending: number;
  };
  runtime: {
    configuredNamespace: string;
    runtimeNamespace: string;
    podCount: number;
    serviceCount: number;
    podPhases: DashboardNamedCount[];
    sessionStatuses: DashboardNamedCount[];
    images: DashboardImageUsage[];
  };
  integrations: DashboardIntegrationCard[];
  highlights: DashboardHighlight[];
  recentSessions: DashboardSession[];
}

export interface DashboardSessionDetail {
  session: DashboardSession;
  urls: {
    vncUrl: string;
    ideUrl: string;
    sshInfo: string;
    appUrls?: Array<{
      name: string;
      label: string;
      containerPort: number;
      servicePort: number;
      path: string;
      url: string;
      isDefault: boolean;
    }>;
  };
  pod?: {
    name: string;
    phase: string;
    podIp: string;
    nodeName: string;
    startTime?: string | null;
    ready: boolean;
    conditions: Array<{
      type: string;
      status: string;
      reason: string;
      message: string;
      lastTransitionTime?: string | null;
    }>;
  };
  service?: {
    name: string;
    type: string;
    clusterIp: string;
    ports: Array<{
      name: string;
      port: number;
      targetPort: string;
    }>;
  };
  events: Array<{
    type: string;
    reason: string;
    message: string;
    count: number;
    firstSeen?: string | null;
    lastSeen?: string | null;
  }>;
}

export interface DashboardLogsPayload {
  sessionId: number;
  podName: string;
  container: string;
  tail: number;
  logs: string;
  generatedAt: string;
}

export interface DashboardSessionListPayload extends PaginatedResponse<DashboardSession> {}

export interface RuntimeSessionEvent {
  id: number;
  sessionId: number;
  userId: number;
  eventType: string;
  status: string;
  message: string;
  metadata?: Record<string, unknown>;
  operatorId: number;
  createdAt: string;
}

export type ResourceQuotaScope = 'global' | 'class' | 'user';

export interface ResourceQuota {
  id: number;
  scopeType: ResourceQuotaScope;
  scopeId: number;
  name: string;
  maxConcurrentSessions: number;
  maxSessionMinutes: number;
  enabled: boolean;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceQuotaPayload extends PaginatedResponse<ResourceQuota> {}

export interface ResourceQuotaInput {
  scopeType: ResourceQuotaScope;
  scopeId: number;
  name: string;
  maxConcurrentSessions: number;
  maxSessionMinutes: number;
  enabled?: boolean;
}

export interface AuditLog {
  id: number;
  actorId: number;
  actorRole: number;
  action: string;
  targetType: string;
  targetId: number;
  result: string;
  message: string;
  metadata?: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface AuditLogPayload extends PaginatedResponse<AuditLog> {}

export interface DashboardSessionFilters {
  status?: string;
  sourceType?: string;
  timeRange?: DashboardTimeRange;
  q?: string;
  page?: number;
  pageSize?: number;
}

const buildQuery = (filters: object) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') {
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const dashboardService = {
  getOverview(): Promise<ApiResponse<DashboardOverview>> {
    return api.get<DashboardOverview>('/admin/dashboard/overview');
  },

  getSessions(filters: DashboardSessionFilters): Promise<ApiResponse<DashboardSessionListPayload>> {
    return api.get<DashboardSessionListPayload>(`/admin/dashboard/sessions${buildQuery(filters)}`);
  },

  getSessionDetail(sessionId: number): Promise<ApiResponse<DashboardSessionDetail>> {
    return api.get<DashboardSessionDetail>(`/admin/dashboard/sessions/${sessionId}`);
  },

  getSessionLogs(sessionId: number, tail = 200): Promise<ApiResponse<DashboardLogsPayload>> {
    return api.get<DashboardLogsPayload>(`/admin/dashboard/sessions/${sessionId}/logs?tail=${tail}`);
  },

  getSessionEvents(sessionId: number): Promise<ApiResponse<RuntimeSessionEvent[]>> {
    return api.get<RuntimeSessionEvent[]>(`/admin/runtime-sessions/${sessionId}/events`);
  },

  stopSession(sessionId: number): Promise<ApiResponse<{ sessionId: number; stopped: boolean; reason: string }>> {
    return api.post<{ sessionId: number; stopped: boolean; reason: string }>(`/admin/runtime-sessions/${sessionId}/stop`);
  },

  getResourceQuotas(filters: { scopeType?: string; enabled?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<ApiResponse<ResourceQuotaPayload>> {
    return api.get<ResourceQuotaPayload>(`/admin/resource-quotas${buildQuery(filters)}`);
  },

  createResourceQuota(input: ResourceQuotaInput): Promise<ApiResponse<ResourceQuota>> {
    return api.post<ResourceQuota>('/admin/resource-quotas', input);
  },

  updateResourceQuota(id: number, input: ResourceQuotaInput): Promise<ApiResponse<ResourceQuota>> {
    return api.put<ResourceQuota>(`/admin/resource-quotas/${id}`, input);
  },

  updateResourceQuotaStatus(id: number, enabled: boolean): Promise<ApiResponse<ResourceQuota>> {
    return api.patch<ResourceQuota>(`/admin/resource-quotas/${id}/status`, { enabled });
  },

  getAuditLogs(filters: { actorId?: number; action?: string; targetType?: string; result?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<ApiResponse<AuditLogPayload>> {
    return api.get<AuditLogPayload>(`/admin/audit-logs${buildQuery(filters)}`);
  },

  getIntegratedHealth(): Promise<ApiResponse<DashboardIntegrationCard[]>> {
    return api.get<DashboardIntegrationCard[]>('/admin/integrations/health');
  },
};
