import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  FolderGit2,
  Layers3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  Wifi,
  XCircle,
  X,
} from 'lucide-react';
import { useToast, ToastContainer } from '@/components/common/Toast';
import { ConfirmDialog, useConfirmDialog } from '@/components/common/ConfirmDialog';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import {
  dashboardService,
  type AuditLog,
  type DashboardHighlight,
  type DashboardIntegrationCard,
  type DashboardLogsPayload,
  type DashboardOverview,
  type DashboardRuntimeMode,
  type DashboardSession,
  type DashboardSessionDetail,
  type DashboardSessionFilters,
  type DashboardStatus,
  type DashboardTimeRange,
  type ResourceQuota,
  type ResourceQuotaInput,
  type ResourceQuotaScope,
  type RuntimeSessionEvent,
} from '@/services/dashboard';

type DrawerTab = 'summary' | 'events' | 'logs';

interface QuotaFormState {
  scopeType: ResourceQuotaScope;
  scopeId: string;
  name: string;
  maxConcurrentSessions: string;
  maxSessionMinutes: string;
  enabled: boolean;
}

const defaultQuotaForm: QuotaFormState = {
  scopeType: 'global',
  scopeId: '0',
  name: '',
  maxConcurrentSessions: '1',
  maxSessionMinutes: '120',
  enabled: true,
};

const pageSize = 12;

const statusStyles: Record<string, string> = {
  running: 'bg-success-50 text-success-700 border-success-200',
  creating: 'bg-primary-50 text-primary-700 border-primary-200',
  stopped: 'bg-default-100 text-default-600 border-default-200',
  error: 'bg-danger-50 text-danger-700 border-danger-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  neutral: 'bg-default-100 text-default-600 border-default-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
};

const kpiCards = [
  { key: 'activeSessions', label: '运行中会话', icon: PlayCircle, accent: 'text-primary-600', filter: { status: 'running' } },
  { key: 'creatingSessions', label: '创建中会话', icon: Clock3, accent: 'text-secondary-600', filter: { status: 'creating' } },
  { key: 'errorSessions', label: '异常会话', icon: XCircle, accent: 'text-danger-600', filter: { status: 'error' } },
  { key: 'openClawSessions', label: 'OpenClaw 会话', icon: Terminal, accent: 'text-secondary-600', filter: { runtimeMode: 'openclaw' } },
  { key: 'recent24h', label: '24 小时新增', icon: Activity, accent: 'text-success-600', filter: {} },
  { key: 'expiredPending', label: '待回收会话', icon: PauseCircle, accent: 'text-warning-600', filter: { status: 'creating' } },
] as const;

const sessionTabs: Array<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'running', label: '运行中' },
  { key: 'creating', label: '创建中' },
  { key: 'error', label: '异常' },
  { key: 'stopped', label: '已停止' },
];

const timeRangeOptions: Array<{ key: DashboardTimeRange; label: string }> = [
  { key: 'all', label: '全部时间' },
  { key: '24h', label: '最近 24 小时' },
  { key: '7d', label: '最近 7 天' },
  { key: '30d', label: '最近 30 天' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return '—';
  const target = new Date(value).getTime();
  const diff = Date.now() - target;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
};

const labelForStatus = (status: string) => {
  switch (status) {
    case 'running':
      return '运行中';
    case 'creating':
      return '创建中';
    case 'stopped':
      return '已停止';
    case 'error':
      return '异常';
    case 'warning':
      return '待关注';
    case 'success':
      return '正常';
    case 'danger':
      return '高风险';
    case 'neutral':
      return '未配置';
    default:
      return status;
  }
};

const labelForSource = (source: string) => {
  switch (source) {
    case 'course':
      return '课程';
    case 'project':
      return '项目';
    default:
      return source;
  }
};

const labelForRuntime = (runtime: DashboardRuntimeMode) => runtime === 'openclaw' ? 'OpenClaw' : 'Classic';

const StatusChip: React.FC<{ status: string; children?: React.ReactNode }> = ({ status, children }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.neutral}`}>
    {children || labelForStatus(status)}
  </span>
);

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-default-200/70 ${className}`} />
);

interface InspectorState {
  mode: 'session' | 'integration' | null;
  sessionId?: number;
  integration?: DashboardIntegrationCard;
}

const Dashboard: React.FC = () => {
  const { toast, success, error, info, hideToast } = useToast();
  const confirmDialog = useConfirmDialog();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [stoppingSessionId, setStoppingSessionId] = useState<number | null>(null);

  const [filters, setFilters] = useState<DashboardSessionFilters>({
    status: 'all',
    runtimeMode: 'all',
    sourceType: 'all',
    timeRange: 'all',
    q: '',
    page: 1,
    pageSize,
  });

  const [inspector, setInspector] = useState<InspectorState>({ mode: null });
  const [sessionDetail, setSessionDetail] = useState<DashboardSessionDetail | null>(null);
  const [sessionLogs, setSessionLogs] = useState<DashboardLogsPayload | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeSessionEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('summary');
  const [drawerError, setDrawerError] = useState('');
  const [healthCards, setHealthCards] = useState<DashboardIntegrationCard[]>([]);
  const [quotas, setQuotas] = useState<ResourceQuota[]>([]);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaSubmitting, setQuotaSubmitting] = useState(false);
  const [editingQuota, setEditingQuota] = useState<ResourceQuota | null>(null);
  const [quotaForm, setQuotaForm] = useState<QuotaFormState>(defaultQuotaForm);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditResultFilter, setAuditResultFilter] = useState('all');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true);
    const response = await dashboardService.getOverview();
    if (response.success && response.data) {
      setOverview(response.data);
    } else {
      error(response.error || '加载平台运行概览失败');
    }
    setLoadingOverview(false);
  }, [error]);

  const refreshSessions = useCallback(async (nextFilters: DashboardSessionFilters) => {
    setLoadingSessions(true);
    const response = await dashboardService.getSessions(nextFilters);
    if (response.success && response.data) {
      setSessions(response.data.list);
      setTotal(response.data.total);
    } else {
      error(response.error || '加载会话工作台失败');
    }
    setLoadingSessions(false);
  }, [error]);

  const refreshOperations = useCallback(async () => {
    setQuotaLoading(true);
    setAuditLoading(true);
    const [quotaResp, auditResp, healthResp] = await Promise.all([
      dashboardService.getResourceQuotas({ page: 1, pageSize: 20 }),
      dashboardService.getAuditLogs({ page: 1, pageSize: 12, result: auditResultFilter }),
      dashboardService.getIntegratedHealth(),
    ]);
    if (quotaResp.success && quotaResp.data) {
      setQuotas(quotaResp.data.list);
    } else {
      error(quotaResp.error || '加载资源配额失败');
    }
    if (auditResp.success && auditResp.data) {
      setAuditLogs(auditResp.data.list);
      setAuditTotal(auditResp.data.total);
    } else {
      error(auditResp.error || '加载审计日志失败');
    }
    if (healthResp.success && healthResp.data) {
      setHealthCards(healthResp.data);
    }
    setQuotaLoading(false);
    setAuditLoading(false);
  }, [auditResultFilter, error]);

  const refreshAll = useCallback(async (nextFilters: DashboardSessionFilters = filters) => {
    await Promise.all([refreshOverview(), refreshSessions(nextFilters), refreshOperations()]);
  }, [filters, refreshOverview, refreshSessions, refreshOperations]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    void refreshOperations();
  }, [refreshOperations]);

  useEffect(() => {
    void refreshSessions(filters);
  }, [filters, refreshSessions]);

  const openSessionInspector = useCallback(async (sessionId: number, nextTab: DrawerTab = 'summary') => {
    setInspector({ mode: 'session', sessionId });
    setDrawerTab(nextTab);
    setDetailLoading(true);
    setDrawerError('');
    setSessionLogs(null);
    setRuntimeEvents([]);

    const [response, eventsResponse] = await Promise.all([
      dashboardService.getSessionDetail(sessionId),
      dashboardService.getSessionEvents(sessionId),
    ]);
    if (response.success && response.data) {
      setSessionDetail(response.data);
    } else {
      setDrawerError(response.error || '加载会话详情失败');
      setSessionDetail(null);
    }
    if (eventsResponse.success && eventsResponse.data) {
      setRuntimeEvents(eventsResponse.data);
    }
    setDetailLoading(false);

    if (nextTab === 'logs') {
      setLogsLoading(true);
      const logsResponse = await dashboardService.getSessionLogs(sessionId);
      if (logsResponse.success && logsResponse.data) {
        setSessionLogs(logsResponse.data);
      } else {
        setDrawerError(logsResponse.error || '加载日志失败');
      }
      setLogsLoading(false);
    }
  }, []);

  const openIntegrationInspector = useCallback((integration: DashboardIntegrationCard) => {
    setInspector({ mode: 'integration', integration });
    setSessionDetail(null);
    setSessionLogs(null);
    setDrawerError('');
    setDrawerTab('summary');
  }, []);

  const closeInspector = () => {
    setInspector({ mode: null });
    setSessionDetail(null);
    setSessionLogs(null);
    setRuntimeEvents([]);
    setDrawerError('');
  };

  const handleFilterPatch = (patch: Partial<DashboardSessionFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 1,
    }));
  };

  const handleKpiClick = (patch: Partial<DashboardSessionFilters>) => {
    handleFilterPatch({
      status: patch.status || 'all',
      runtimeMode: patch.runtimeMode || 'all',
    });
  };

  const handleCopy = async (value: string, message = '已复制') => {
    if (!value) {
      info('当前没有可复制的信息');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      success(message);
    } catch {
      error('复制失败');
    }
  };

  const handleStopSession = (session: DashboardSession) => {
    confirmDialog.showConfirm({
      title: '停止会话',
      message: `确定停止 ${session.sourceName} 的运行会话吗？`,
      type: 'warning',
      onConfirm: async () => {
        setStoppingSessionId(session.id);
        const response = await dashboardService.stopSession(session.id);
        if (response.success && response.data) {
          if (response.data.stopped) {
            success('会话已停止');
          } else if (response.data.reason === 'already_stopped') {
            info('会话已处于停止状态');
          } else if (response.data.reason === 'not_found') {
            info('会话不存在，无需操作');
          } else {
            info('停止请求已处理');
          }
          await refreshAll(filters);
          if (inspector.mode === 'session' && inspector.sessionId === session.id) {
            closeInspector();
          }
        } else {
          error(response.error || '停止会话失败');
        }
        setStoppingSessionId(null);
      },
    });
  };

  const handleRefreshIntegration = async () => {
    await Promise.all([refreshOverview(), refreshOperations()]);
    success('状态已刷新');
  };

  const resetQuotaForm = () => {
    setEditingQuota(null);
    setQuotaForm(defaultQuotaForm);
  };

  const editQuota = (quota: ResourceQuota) => {
    setEditingQuota(quota);
    setQuotaForm({
      scopeType: quota.scopeType,
      scopeId: String(quota.scopeId),
      name: quota.name,
      maxConcurrentSessions: String(quota.maxConcurrentSessions),
      maxSessionMinutes: String(quota.maxSessionMinutes),
      enabled: quota.enabled,
    });
  };

  const submitQuota = async () => {
    const payload: ResourceQuotaInput = {
      scopeType: quotaForm.scopeType,
      scopeId: quotaForm.scopeType === 'global' ? 0 : Number(quotaForm.scopeId || 0),
      name: quotaForm.name.trim() || `${quotaForm.scopeType} 配额`,
      maxConcurrentSessions: Number(quotaForm.maxConcurrentSessions || 0),
      maxSessionMinutes: Number(quotaForm.maxSessionMinutes || 0),
      enabled: quotaForm.enabled,
    };
    if (payload.scopeType !== 'global' && !payload.scopeId) {
      error('班级或用户配额必须填写对象 ID');
      return;
    }
    if (payload.maxConcurrentSessions < 0 || payload.maxSessionMinutes <= 0) {
      error('请填写有效的并发数和运行时长');
      return;
    }
    setQuotaSubmitting(true);
    const response = editingQuota
      ? await dashboardService.updateResourceQuota(editingQuota.id, payload)
      : await dashboardService.createResourceQuota(payload);
    setQuotaSubmitting(false);
    if (response.success) {
      success(editingQuota ? '资源配额已更新' : '资源配额已创建');
      resetQuotaForm();
      await refreshOperations();
    } else {
      error(response.error || '保存资源配额失败');
    }
  };

  const toggleQuota = async (quota: ResourceQuota) => {
    const response = await dashboardService.updateResourceQuotaStatus(quota.id, !quota.enabled);
    if (response.success) {
      success(quota.enabled ? '资源配额已停用' : '资源配额已启用');
      await refreshOperations();
    } else {
      error(response.error || '更新资源配额状态失败');
    }
  };

  const loadLogsIfNeeded = useCallback(async () => {
    if (inspector.mode !== 'session' || !inspector.sessionId) return;
    if (sessionLogs) return;
    setLogsLoading(true);
    const response = await dashboardService.getSessionLogs(inspector.sessionId);
    if (response.success && response.data) {
      setSessionLogs(response.data);
      setDrawerError('');
    } else {
      setDrawerError(response.error || '加载日志失败');
    }
    setLogsLoading(false);
  }, [inspector, sessionLogs]);

  useEffect(() => {
    if (drawerTab === 'logs') {
      void loadLogsIfNeeded();
    }
  }, [drawerTab, loadLogsIfNeeded]);

  const highlightSessions = useMemo(() => {
    const map = new Map<number, DashboardHighlight[]>();
    overview?.highlights.forEach((item) => {
      if (!item.sessionId) return;
      const items = map.get(item.sessionId) || [];
      items.push(item);
      map.set(item.sessionId, items);
    });
    return map;
  }, [overview]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-600">
              <Layers3 className="h-4 w-4" />
              平台运行概览
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">K8S 实训运行工作台</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-default-500">
              聚焦平台相关命名空间、实训会话、运行时资源和外部集成状态。这里可以直接完成筛选、排障定位和单会话轻操作。
            </p>
          </div>
          <button
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-default-200 bg-white px-4 py-2 text-sm font-medium text-default-600 transition-colors hover:border-primary-200 hover:text-primary-600"
          >
            <RefreshCw className="h-4 w-4" />
            刷新工作台
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map(({ key, label, icon: Icon, accent, filter }) => (
          <button
            key={key}
            onClick={() => handleKpiClick(filter)}
            className="card-surface rounded-xl px-4 py-4 text-left transition-all hover:shadow-md"
          >
            {loadingOverview || !overview ? (
              <div className="space-y-3">
                <SkeletonBlock className="h-5 w-12" />
                <SkeletonBlock className="h-7 w-20" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${accent}`} />
                  <ArrowUpRight className="h-4 w-4 text-default-300" />
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                  {overview.kpis[key]}
                </div>
                <div className="mt-1 text-sm text-default-500">{label}</div>
              </>
            )}
          </button>
        ))}
      </section>

      <section className="card-surface rounded-2xl">
        <div className="flex items-center justify-between border-b border-default-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">最近活跃</h2>
            <p className="mt-1 text-sm text-default-500">优先看最近进入、最近异常或刚完成启动的会话。</p>
          </div>
        </div>
        <div className="px-6 py-5">
          {loadingOverview || !overview ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : overview.recentSessions.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {overview.recentSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => void openSessionInspector(session.id)}
                  className="card-surface-muted rounded-xl px-4 py-4 text-left transition-colors hover:bg-primary-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{session.sourceName}</div>
                      <div className="mt-1 text-xs text-default-400">#{session.id} · {session.fullName || session.userName || `用户 ${session.userId}`}</div>
                    </div>
                    <StatusChip status={session.statusText} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip status={session.runtimeText === 'openclaw' ? 'warning' : 'success'}>
                      {labelForRuntime(session.runtimeText)}
                    </StatusChip>
                    <span className="text-xs text-default-400">{formatRelativeTime(session.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyInline message="当前没有最近活跃的会话摘要。" />
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="card-surface rounded-2xl">
          <div className="flex items-center justify-between border-b border-default-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">运行时健康概览</h2>
              <p className="mt-1 text-sm text-default-500">聚焦平台命名空间、资源分布和镜像使用情况。</p>
            </div>
          </div>
          <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl bg-default-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-default-400">Namespace</div>
                {loadingOverview || !overview ? (
                  <div className="mt-3 space-y-2">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-4 w-40" />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-default-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Configured</span>
                      <span className="font-medium text-foreground">{overview.runtime.configuredNamespace || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Runtime</span>
                      <span className="font-medium text-foreground">{overview.runtime.runtimeNamespace || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Pods / Services</span>
                      <span className="font-medium text-foreground">
                        {overview.runtime.podCount} / {overview.runtime.serviceCount}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <StatGroup title="Pod 阶段分布" items={overview?.runtime.podPhases || []} loading={loadingOverview} />
              <StatGroup title="运行模式分布" items={overview?.runtime.runtimeModes || []} loading={loadingOverview} />
            </div>

            <div className="space-y-4">
              <StatGroup title="会话状态分布" items={overview?.runtime.sessionStatuses || []} loading={loadingOverview} />
              <div className="card-surface-muted rounded-xl px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Box className="h-4 w-4 text-primary-600" />
                  镜像使用 Top 5
                </div>
                <div className="mt-4 space-y-3">
                  {loadingOverview || !overview ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <SkeletonBlock key={index} className="h-10 w-full" />
                    ))
                  ) : overview.runtime.images.length > 0 ? (
                    overview.runtime.images.map((image) => (
                      <div key={image.image} className="flex items-start justify-between gap-3 rounded-lg bg-white px-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">{image.image}</div>
                        </div>
                        <StatusChip status="neutral">{image.count} 个</StatusChip>
                      </div>
                    ))
                  ) : (
                    <EmptyInline message="当前没有采集到镜像使用数据。" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface rounded-2xl">
          <div className="flex items-center justify-between border-b border-default-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">平台状态</h2>
              <p className="mt-1 text-sm text-default-500">外部集成和需要优先处理的运行信号。</p>
            </div>
          </div>
          <div className="space-y-6 px-6 py-6">
            <div className="space-y-3">
              {loadingOverview || !overview ? (
                Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-20 w-full" />)
              ) : (
                (healthCards.length > 0 ? healthCards : overview.integrations).map((integration) => (
                  <div
                    key={integration.key}
                    onClick={() => openIntegrationInspector(integration)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openIntegrationInspector(integration);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="card-surface-muted flex w-full cursor-pointer items-start justify-between rounded-xl px-4 py-4 text-left transition-colors hover:bg-primary-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">{integration.label}</div>
                        <StatusChip status={integration.status} />
                      </div>
                      <div className="mt-1 text-sm text-default-600">{integration.summary}</div>
                      <div className="mt-1 text-xs text-default-400">{integration.message}</div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRefreshIntegration();
                      }}
                      disabled={!integration.canRefresh}
                      className="rounded-lg p-2 text-default-400 transition-colors hover:bg-white hover:text-primary-600"
                      title="刷新状态"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-default-100 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-warning-600" />
                需要优先关注
              </div>
              <div className="mt-4 space-y-3">
                {loadingOverview || !overview ? (
                  Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-16 w-full" />)
                ) : overview.highlights.length > 0 ? (
                  overview.highlights.map((highlight) => (
                    <button
                      key={highlight.id}
                      onClick={() => highlight.sessionId && void openSessionInspector(highlight.sessionId)}
                      className="card-surface w-full rounded-xl px-4 py-4 text-left transition-colors hover:bg-primary-50/40"
                    >
                      <div className="flex items-center gap-2">
                        <StatusChip status={highlight.level} />
                        <div className="text-sm font-semibold text-foreground">{highlight.title}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-default-500">{highlight.description}</div>
                    </button>
                  ))
                ) : (
                  <EmptyInline message="当前没有需要升级处理的运行信号。" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface rounded-2xl">
          <div className="flex items-center justify-between border-b border-default-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">资源配额治理</h2>
              <p className="mt-1 text-sm text-default-500">配置全局、班级或用户的 Classic Lab 并发和单次运行时长。</p>
            </div>
            <button onClick={() => void refreshOperations()} className="rounded-lg border border-default-200 px-3 py-2 text-sm font-medium text-default-600 hover:text-primary-600">
              刷新
            </button>
          </div>
          <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {quotaLoading ? (
                Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-24 w-full" />)
              ) : quotas.length > 0 ? (
                quotas.map((quota) => (
                  <div key={quota.id} className="card-surface-muted rounded-xl px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-foreground">{quota.name}</div>
                          <StatusChip status={quota.enabled ? 'success' : 'neutral'}>{quota.enabled ? '启用' : '停用'}</StatusChip>
                          <StatusChip status="neutral">{quota.scopeType}:{quota.scopeId}</StatusChip>
                        </div>
                        <div className="mt-2 text-sm text-default-500">
                          并发 {quota.maxConcurrentSessions === 0 ? '不限' : quota.maxConcurrentSessions} 个 · 单次 {quota.maxSessionMinutes} 分钟
                        </div>
                        <div className="mt-1 text-xs text-default-400">更新于 {formatDateTime(quota.updatedAt)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => editQuota(quota)} className="rounded-lg border border-default-200 bg-white px-3 py-2 text-xs font-semibold text-default-600 hover:text-primary-600">
                          编辑
                        </button>
                        <button onClick={() => void toggleQuota(quota)} className="rounded-lg border border-default-200 bg-white px-3 py-2 text-xs font-semibold text-default-600 hover:text-primary-600">
                          {quota.enabled ? '停用' : '启用'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyInline message="当前没有资源配额。系统会自动准备一条全局默认配额。" />
              )}
            </div>

            <div className="card-surface-muted rounded-xl px-4 py-4">
              <div className="text-sm font-semibold text-foreground">{editingQuota ? '编辑配额' : '新增配额'}</div>
              <div className="mt-4 space-y-3">
                <ToolbarSelect
                  ariaLabel="配额作用域"
                  value={quotaForm.scopeType}
                  onChange={(value) => setQuotaForm((prev) => ({ ...prev, scopeType: value as ResourceQuotaScope, scopeId: value === 'global' ? '0' : prev.scopeId }))}
                  options={[
                    { key: 'global', label: '全局' },
                    { key: 'class', label: '班级' },
                    { key: 'user', label: '用户' },
                  ]}
                />
                <input
                  value={quotaForm.scopeId}
                  onChange={(event) => setQuotaForm((prev) => ({ ...prev, scopeId: event.target.value }))}
                  disabled={quotaForm.scopeType === 'global'}
                  placeholder="对象 ID"
                  className="h-10 w-full rounded-lg border border-default-200 bg-white px-3 text-sm outline-none focus:border-primary-400 disabled:bg-default-100"
                />
                <input
                  value={quotaForm.name}
                  onChange={(event) => setQuotaForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="配额名称"
                  className="h-10 w-full rounded-lg border border-default-200 bg-white px-3 text-sm outline-none focus:border-primary-400"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={quotaForm.maxConcurrentSessions}
                    onChange={(event) => setQuotaForm((prev) => ({ ...prev, maxConcurrentSessions: event.target.value }))}
                    placeholder="并发数"
                    type="number"
                    min="0"
                    className="h-10 rounded-lg border border-default-200 bg-white px-3 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    value={quotaForm.maxSessionMinutes}
                    onChange={(event) => setQuotaForm((prev) => ({ ...prev, maxSessionMinutes: event.target.value }))}
                    placeholder="分钟"
                    type="number"
                    min="1"
                    className="h-10 rounded-lg border border-default-200 bg-white px-3 text-sm outline-none focus:border-primary-400"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-default-600">
                  <input type="checkbox" checked={quotaForm.enabled} onChange={(event) => setQuotaForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
                  启用配额
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void submitQuota()}
                    disabled={quotaSubmitting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {quotaSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingQuota ? '保存' : '创建'}
                  </button>
                  {editingQuota ? (
                    <button onClick={resetQuotaForm} className="rounded-lg border border-default-200 px-4 py-2 text-sm font-semibold text-default-600">
                      取消
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface rounded-2xl">
          <div className="flex items-center justify-between border-b border-default-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">系统审计</h2>
              <p className="mt-1 text-sm text-default-500">系统域治理动作记录，不混入教学动作日志。</p>
            </div>
            <ToolbarSelect
              ariaLabel="按审计结果筛选"
              value={auditResultFilter}
              onChange={setAuditResultFilter}
              options={[
                { key: 'all', label: '全部结果' },
                { key: 'success', label: '成功' },
                { key: 'failed', label: '失败' },
                { key: 'noop', label: '无操作' },
              ]}
              className="w-44"
            />
          </div>
          <div className="space-y-3 px-6 py-6">
            {auditLoading ? (
              Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-16 w-full" />)
            ) : auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <div key={log.id} className="card-surface-muted rounded-xl px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{log.action}</div>
                      <div className="mt-1 text-sm text-default-500">{log.message || `${log.targetType} #${log.targetId}`}</div>
                      <div className="mt-1 text-xs text-default-400">操作者 #{log.actorId || 'system'} · {formatDateTime(log.createdAt)}</div>
                    </div>
                    <StatusChip status={log.result === 'success' ? 'success' : log.result === 'failed' ? 'danger' : 'neutral'}>{log.result || 'unknown'}</StatusChip>
                  </div>
                </div>
              ))
            ) : (
              <EmptyInline message="当前没有系统审计日志。" />
            )}
            <div className="text-xs text-default-400">共 {auditTotal} 条系统审计记录，当前展示最近 12 条。</div>
          </div>
        </div>
      </section>

      <section className="card-surface rounded-2xl">
        <div className="border-b border-default-100 px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">实训会话工作台</h2>
              <p className="mt-1 text-sm text-default-500">按状态、运行模式和来源快速定位会话，并在右侧抽屉中完成排障和轻操作。</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <ToolbarSearchField
                value={filters.q || ''}
                onChange={(value) => handleFilterPatch({ q: value })}
                placeholder="搜索会话、镜像、用户、来源"
                className="min-w-[220px]"
              />

              <ToolbarSelect
                ariaLabel="运行模式筛选"
                value={filters.runtimeMode || 'all'}
                onChange={(value) => handleFilterPatch({ runtimeMode: value })}
                options={[
                  { key: 'all', label: '全部运行模式' },
                  { key: 'classic', label: 'Classic' },
                  { key: 'openclaw', label: 'OpenClaw' },
                ]}
                className="xl:w-44"
              />

              <ToolbarSelect
                ariaLabel="来源筛选"
                value={filters.sourceType || 'all'}
                onChange={(value) => handleFilterPatch({ sourceType: value })}
                options={[
                  { key: 'all', label: '全部来源' },
                  { key: 'course', label: '课程' },
                  { key: 'project', label: '项目' },
                ]}
                className="xl:w-40"
              />

              <ToolbarSelect
                ariaLabel="时间范围筛选"
                value={filters.timeRange || 'all'}
                onChange={(value) => handleFilterPatch({ timeRange: value as DashboardTimeRange })}
                options={timeRangeOptions.map((option) => ({ key: option.key, label: option.label }))}
                className="xl:w-40"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {sessionTabs.map((tab) => {
              const active = (filters.status || 'all') === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleFilterPatch({ status: tab.key })}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-default-100 text-default-600 hover:bg-default-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-default-100">
            <colgroup>
              <col className="w-[42%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-default-50/70">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-default-400">
                <th className="px-6 py-4 font-semibold">会话</th>
                <th className="px-6 py-4 font-semibold">用户</th>
                <th className="px-6 py-4 font-semibold">运行模式</th>
                <th className="px-6 py-4 font-semibold">状态</th>
                <th className="px-6 py-4 font-semibold">最近更新</th>
                <th className="sticky right-0 z-10 border-l border-default-100 bg-default-50/95 px-6 py-4 font-semibold backdrop-blur">
                  轻操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-100 bg-white">
              {loadingSessions ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4" colSpan={6}>
                      <SkeletonBlock className="h-14 w-full" />
                    </td>
                  </tr>
                ))
              ) : sessions.length > 0 ? (
                sessions.map((session) => (
                  <tr key={session.id} className="transition-colors hover:bg-default-50/60">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
                          {session.sourceText === 'project' ? <FolderGit2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void openSessionInspector(session.id)}
                              className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary-600"
                            >
                              {session.sourceName}
                            </button>
                            <span className="text-xs text-default-400">#{session.id}</span>
                          </div>
                          <div className="mt-1 truncate text-sm text-default-500">{session.imageName}</div>
                          {highlightSessions.get(session.id)?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {highlightSessions.get(session.id)!.slice(0, 2).map((item) => (
                                <StatusChip key={item.id} status={item.level}>{item.title}</StatusChip>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div
                        className="truncate whitespace-nowrap text-sm text-default-500"
                        title={`${session.fullName || session.userName || `用户 ${session.userId}`} · @${session.userName || 'unknown'}`}
                      >
                        <span className="font-medium text-foreground">{session.fullName || session.userName || `用户 ${session.userId}`}</span>
                        <span className="mx-2 text-default-300">·</span>
                        <span>@{session.userName || 'unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <StatusChip status={session.runtimeText === 'openclaw' ? 'warning' : 'success'}>
                          {labelForRuntime(session.runtimeText)}
                        </StatusChip>
                        <div className="truncate text-xs text-default-400">{labelForSource(session.sourceText)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div
                        className="flex items-center gap-2 whitespace-nowrap"
                        title={session.expiresAt ? `到期 ${formatDateTime(session.expiresAt)}` : '未设置过期时间'}
                      >
                        <StatusChip status={session.statusText} />
                        <div className="truncate text-xs text-default-400">
                          {session.expiresAt ? `到期 ${formatDateTime(session.expiresAt)}` : '未设置过期时间'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div
                        className="truncate whitespace-nowrap text-sm text-default-500"
                        title={`${formatRelativeTime(session.updatedAt)} · ${formatDateTime(session.updatedAt)}`}
                      >
                        <span className="font-medium text-foreground">{formatRelativeTime(session.updatedAt)}</span>
                        <span className="mx-2 text-default-300">·</span>
                        <span>{formatDateTime(session.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="sticky right-0 z-[1] border-l border-default-100 bg-white px-6 py-4 align-middle shadow-[-12px_0_20px_-18px_rgba(15,23,42,0.2)]">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <IconButton label="详情" onClick={() => void openSessionInspector(session.id)}>
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="日志" onClick={() => void openSessionInspector(session.id, 'logs')}>
                          <FileText className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="复制地址" onClick={() => handleCopy(session.runtimeText === 'openclaw' ? session.gatewayToken || '' : session.containerName, '已复制关键信息')}>
                          <Copy className="h-4 w-4" />
                        </IconButton>
                        {session.statusText === 'running' || session.statusText === 'creating' ? (
                          <button
                            onClick={() => handleStopSession(session)}
                            disabled={stoppingSessionId === session.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-100 disabled:opacity-50"
                          >
                            {stoppingSessionId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            停止
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Server className="h-8 w-8 text-default-300" />
                      <div className="text-base font-semibold text-foreground">当前筛选下没有匹配的会话</div>
                      <div className="max-w-md text-sm text-default-500">调整状态、运行模式或关键字后，这里会自动展示对应的运行会话与轻操作入口。</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-default-100 px-6 py-4">
          <div className="text-sm text-default-500">共 {total} 条会话记录</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterPatch({ page: Math.max(1, (filters.page || 1) - 1) })}
              disabled={(filters.page || 1) <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-default-200 px-3 py-2 text-sm text-default-600 transition-colors hover:border-primary-200 hover:text-primary-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <div className="min-w-[72px] text-center text-sm text-default-500">
              {(filters.page || 1)} / {totalPages}
            </div>
            <button
              onClick={() => handleFilterPatch({ page: Math.min(totalPages, (filters.page || 1) + 1) })}
              disabled={(filters.page || 1) >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-default-200 px-3 py-2 text-sm text-default-600 transition-colors hover:border-primary-200 hover:text-primary-600 disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {inspector.mode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeInspector}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 z-50 h-screen w-full max-w-[480px] border-l border-default-200 bg-white shadow-2xl"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between border-b border-default-100 px-6 py-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-default-400">
                      {inspector.mode === 'session' ? '会话详情' : '集成详情'}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {inspector.mode === 'session'
                        ? sessionDetail?.session.sourceName || `会话 #${inspector.sessionId}`
                        : inspector.integration?.label || '平台状态'}
                    </div>
                    <div className="mt-1 text-sm text-default-500">
                      {inspector.mode === 'session'
                        ? '查看运行时资源、事件、访问地址和日志摘要。'
                        : inspector.integration?.message}
                    </div>
                  </div>
                  <button
                    onClick={closeInspector}
                    className="rounded-lg p-2 text-default-400 transition-colors hover:bg-default-100 hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {inspector.mode === 'session' ? (
                  <>
                    <div className="flex gap-2 border-b border-default-100 px-6 py-3">
                      {[
                        { key: 'summary', label: '摘要' },
                        { key: 'events', label: '事件' },
                        { key: 'logs', label: '日志' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setDrawerTab(tab.key as DrawerTab)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            drawerTab === tab.key
                              ? 'bg-primary-600 text-white'
                              : 'bg-default-100 text-default-600 hover:bg-default-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      {detailLoading ? (
                        <div className="space-y-4">
                          <SkeletonBlock className="h-24 w-full" />
                          <SkeletonBlock className="h-40 w-full" />
                          <SkeletonBlock className="h-24 w-full" />
                        </div>
                      ) : sessionDetail ? (
                        <>
                          {drawerError ? (
                            <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                              {drawerError}
                            </div>
                          ) : null}

                          {drawerTab === 'summary' ? (
                            <SessionSummary
                              detail={sessionDetail}
                              onCopy={handleCopy}
                              onOpenLink={(link) => link && window.open(link, '_blank', 'noopener,noreferrer')}
                            />
                          ) : null}

                          {drawerTab === 'events' ? (
                            <EventList events={sessionDetail.events} runtimeEvents={runtimeEvents} />
                          ) : null}

                          {drawerTab === 'logs' ? (
                            <LogPanel logs={sessionLogs} loading={logsLoading} errorText={drawerError} />
                          ) : null}
                        </>
                      ) : (
                        <EmptyInline message={drawerError || '当前没有可展示的会话详情。'} />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto px-6 py-6">
                    {inspector.integration ? (
                      <div className="space-y-4">
                        <div className="card-surface-muted rounded-xl px-4 py-4">
                          <div className="flex items-center gap-2">
                            <StatusChip status={inspector.integration.status} />
                            <span className="text-sm font-semibold text-foreground">{inspector.integration.summary}</span>
                          </div>
                          <div className="mt-3 text-sm leading-6 text-default-600">{inspector.integration.message}</div>
                          <div className="mt-3 text-xs text-default-400">最近检查：{formatDateTime(inspector.integration.lastCheck)}</div>
                        </div>
                        <div className="card-surface rounded-xl">
                          <div className="border-b border-default-100 px-4 py-3 text-sm font-semibold text-foreground">详细配置</div>
                          <div className="space-y-3 px-4 py-4">
                            {Object.entries(inspector.integration.details || {}).map(([key, value]) => (
                              <div key={key} className="flex items-start justify-between gap-3 text-sm">
                                <div className="text-default-500">{key}</div>
                                <div className="max-w-[60%] break-all text-right font-medium text-foreground">{String(value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ToastContainer toast={toast} onClose={hideToast} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onCancel={confirmDialog.hideConfirm}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  );
};

const StatGroup: React.FC<{ title: string; items: Array<{ name: string; count: number }>; loading?: boolean }> = ({ title, items, loading }) => (
  <div className="card-surface-muted rounded-xl px-4 py-4">
    <div className="text-sm font-semibold text-foreground">{title}</div>
    <div className="mt-4 space-y-3">
      {loading ? (
        Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-9 w-full" />)
      ) : items.length > 0 ? (
        items.map((item) => (
          <div key={item.name} className="card-surface flex items-center justify-between rounded-lg px-3 py-3">
            <div className="text-sm text-default-600">{item.name}</div>
            <div className="text-sm font-semibold text-foreground">{item.count}</div>
          </div>
        ))
      ) : (
        <EmptyInline message="暂无统计数据" />
      )}
    </div>
  </div>
);

const EmptyInline: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-lg border border-dashed border-default-200 bg-white px-4 py-5 text-sm text-default-400">{message}</div>
);

const IconButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button
    onClick={onClick}
    title={label}
    className="inline-flex items-center justify-center rounded-lg border border-default-200 bg-white p-2 text-default-500 transition-colors hover:border-primary-200 hover:text-primary-600"
  >
    {children}
  </button>
);

const SessionSummary: React.FC<{
  detail: DashboardSessionDetail;
  onCopy: (value: string, message?: string) => void;
  onOpenLink: (value: string) => void;
}> = ({ detail, onCopy, onOpenLink }) => (
  <div className="space-y-5">
    <div className="card-surface-muted rounded-xl px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={detail.session.statusText} />
        <StatusChip status={detail.session.runtimeText === 'openclaw' ? 'warning' : 'success'}>
          {labelForRuntime(detail.session.runtimeText)}
        </StatusChip>
        <StatusChip status="neutral">{labelForSource(detail.session.sourceText)}</StatusChip>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-default-600">
        <SummaryRow label="会话 ID" value={`#${detail.session.id}`} />
        <SummaryRow label="用户" value={detail.session.fullName || detail.session.userName || `用户 ${detail.session.userId}`} />
        <SummaryRow label="容器标识" value={detail.session.containerName} />
        <SummaryRow label="镜像" value={detail.session.imageName} />
        <SummaryRow label="创建时间" value={formatDateTime(detail.session.createdAt)} />
        <SummaryRow label="到期时间" value={formatDateTime(detail.session.expiresAt)} />
      </div>
    </div>

    <div className="card-surface rounded-xl">
      <div className="border-b border-default-100 px-4 py-3 text-sm font-semibold text-foreground">访问地址与通道</div>
      <div className="space-y-3 px-4 py-4">
        {[
          { key: 'Desktop', value: detail.urls.vncUrl },
          { key: 'IDE', value: detail.urls.ideUrl },
          { key: 'Gateway', value: detail.urls.gatewayUrl },
          { key: 'Terminal', value: detail.urls.sshInfo },
          ...((detail.urls.appUrls || []).map((item) => ({
            key: `App:${item.label || item.name}`,
            value: item.url,
          }))),
        ].map((item) => (
          <div key={item.key} className="rounded-lg bg-default-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{item.key}</div>
              <div className="flex items-center gap-2">
                <IconButton label="复制" onClick={() => onCopy(item.value, `${item.key} 信息已复制`)}>
                  <Copy className="h-4 w-4" />
                </IconButton>
                {item.value.startsWith('/') ? (
                  <IconButton label="打开" onClick={() => onOpenLink(item.value)}>
                    <ExternalLink className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
            </div>
            <div className="mt-2 break-all text-xs text-default-500">{item.value || '当前未提供'}</div>
          </div>
        ))}
      </div>
    </div>

    <div className="card-surface rounded-xl">
      <div className="border-b border-default-100 px-4 py-3 text-sm font-semibold text-foreground">运行时资源</div>
      <div className="space-y-4 px-4 py-4">
        <div className="rounded-lg bg-default-50 px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Server className="h-4 w-4 text-primary-600" />
            Pod
          </div>
          {detail.pod ? (
            <div className="mt-3 grid gap-2 text-sm text-default-600">
              <SummaryRow label="名称" value={detail.pod.name} />
              <SummaryRow label="Phase" value={detail.pod.phase} />
              <SummaryRow label="Ready" value={detail.pod.ready ? 'Yes' : 'No'} />
              <SummaryRow label="Pod IP" value={detail.pod.podIp || '—'} />
              <SummaryRow label="Node" value={detail.pod.nodeName || '—'} />
            </div>
          ) : (
            <div className="mt-3 text-sm text-default-400">当前没有读取到 Pod 详情。</div>
          )}
        </div>

        <div className="rounded-lg bg-default-50 px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Wifi className="h-4 w-4 text-secondary-600" />
            Service
          </div>
          {detail.service ? (
            <div className="mt-3 grid gap-2 text-sm text-default-600">
              <SummaryRow label="名称" value={detail.service.name} />
              <SummaryRow label="类型" value={detail.service.type} />
              <SummaryRow label="ClusterIP" value={detail.service.clusterIp || '—'} />
              <SummaryRow
                label="端口"
                value={detail.service.ports.map((port) => `${port.name}:${port.port}`).join(' / ') || '—'}
              />
            </div>
          ) : (
            <div className="mt-3 text-sm text-default-400">当前没有读取到 Service 详情。</div>
          )}
        </div>

        {detail.pod?.conditions?.length ? (
          <div className="rounded-lg bg-default-50 px-3 py-3">
            <div className="text-sm font-medium text-foreground">Pod 条件</div>
            <div className="mt-3 space-y-2">
              {detail.pod.conditions.map((condition) => (
                <div key={condition.type} className="flex items-start justify-between gap-3 rounded-lg bg-white px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{condition.type}</div>
                    <div className="mt-1 text-xs text-default-500">{condition.reason || condition.message || '—'}</div>
                  </div>
                  <StatusChip status={condition.status === 'True' ? 'success' : 'warning'}>{condition.status}</StatusChip>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="text-default-500">{label}</div>
    <div className="max-w-[62%] break-all text-right font-medium text-foreground">{value || '—'}</div>
  </div>
);

const EventList: React.FC<{ events: DashboardSessionDetail['events']; runtimeEvents: RuntimeSessionEvent[] }> = ({ events, runtimeEvents }) => (
  <div className="space-y-3">
    {runtimeEvents.length > 0 ? (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">平台事件流</div>
        {runtimeEvents.map((event) => (
          <div key={event.id} className="rounded-xl border border-default-100 bg-primary-50/40 px-4 py-4">
            <div className="flex items-center gap-2">
              <StatusChip status={event.status === 'blocked' || event.status === 'error' ? 'warning' : event.status === 'stopped' ? 'neutral' : 'success'}>
                {event.status || 'event'}
              </StatusChip>
              <div className="text-sm font-semibold text-foreground">{event.eventType}</div>
            </div>
            <div className="mt-2 text-sm leading-6 text-default-600">{event.message}</div>
            <div className="mt-3 text-xs text-default-400">{formatDateTime(event.createdAt)}</div>
          </div>
        ))}
      </div>
    ) : null}
    {runtimeEvents.length > 0 && events.length > 0 ? <div className="border-t border-default-100 pt-3 text-sm font-semibold text-foreground">K8S 事件</div> : null}
    {events.length > 0 ? (
      events.map((event, index) => (
        <div key={`${event.reason}-${index}`} className="rounded-xl border border-default-100 bg-default-50/70 px-4 py-4">
          <div className="flex items-center gap-2">
            <StatusChip status={event.type === 'Warning' ? 'warning' : 'success'}>
              {event.type || 'Normal'}
            </StatusChip>
            <div className="text-sm font-semibold text-foreground">{event.reason || '事件'}</div>
          </div>
          <div className="mt-2 text-sm leading-6 text-default-600">{event.message}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-default-400">
            <span>计数 {event.count}</span>
            <span>{formatDateTime(event.lastSeen || event.firstSeen)}</span>
          </div>
        </div>
      ))
    ) : (
      <EmptyInline message="当前没有可展示的事件记录。" />
    )}
  </div>
);

const LogPanel: React.FC<{ logs: DashboardLogsPayload | null; loading: boolean; errorText: string }> = ({ logs, loading, errorText }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }
  if (!logs) {
    return <EmptyInline message={errorText || '当前没有可展示的日志内容。'} />;
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-default-100 bg-default-50 px-4 py-3 text-sm text-default-500">
        容器 <span className="font-medium text-foreground">{logs.container}</span> · 最近 {logs.tail} 行 · 更新时间 {formatDateTime(logs.generatedAt)}
      </div>
      <pre className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
        {logs.logs || '暂无日志输出'}
      </pre>
    </div>
  );
};

export default Dashboard;
