import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Select, SelectItem } from '@heroui/react';
import { Activity, AlertTriangle, CheckCircle2, FileSearch, FlaskConical, PencilLine, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import PageDialog from '@/components/common/PageDialog';
import PageDrawer from '@/components/common/PageDrawer';
import { ConfirmDialog, useConfirmDialog } from '@/components/common/ConfirmDialog';
import { dialogSelectClassNames, dialogSelectItemClassNames } from '@/components/common/dialogSelectStyles';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { ToastContainer, useToast } from '@/components/common/Toast';
import {
  adminLabTemplateApi,
  adminPublishAuditApi,
  type LabTemplate,
  type LabTemplateAppPort,
  type LabTemplateDTO,
  type LabTemplateExposedPort,
  type LabTemplateExposedPortType,
  type PublishAuditLog,
} from '@/services/publishing';
import i18n, { getCurrentLocale } from '@/i18n';

const tr = (key: string, options?: Record<string, unknown>) => i18n.t('adminContent:' + key, options);

type GovernanceTab = 'templates' | 'audit';

interface LabTemplateFormState extends Required<LabTemplateDTO> {}

const emptyTemplateForm: LabTemplateFormState = {
  name: '',
  code: '',
  description: '',
  runtimeMode: 'classic',
  envImage: '',
  ideImage: '',
  mainCpuRequest: '250m',
  mainMemoryRequest: '512Mi',
  mainCpuLimit: '2',
  mainMemoryLimit: '2Gi',
  ideCpuRequest: '100m',
  ideMemoryRequest: '256Mi',
  ideCpuLimit: '1',
  ideMemoryLimit: '1Gi',
  desktopEnabled: true,
  appPorts: [],
  defaultAppPortName: '',
  exposedPorts: [{ type: 'novnc', name: 'novnc', label: 'Desktop', containerPort: 6080, path: '', isDefault: false }],
  status: 1,
};

const appPortSummary = (ports?: LabTemplateAppPort[]) => {
  const list = Array.isArray(ports) ? ports : [];
  if (list.length === 0) return tr('notConfigured');
  return list.map((port) => `${port.label || port.name}:${port.containerPort}`).join(' / ');
};

const exposedPortSummary = (ports?: LabTemplateExposedPort[], fallbackAppPorts?: LabTemplateAppPort[], desktopEnabled = true) => {
  const list = normalizeExposedPortsForForm(ports, fallbackAppPorts, desktopEnabled);
  if (list.length === 0) return tr('notConfigured');
  return list.map((port) => {
    const prefix = port.type === 'novnc' ? 'Desktop' : (port.label || port.name);
    return `${prefix}:${port.containerPort}`;
  }).join(' / ');
};

const normalizeExposedPortsForForm = (
  ports?: LabTemplateExposedPort[],
  fallbackAppPorts?: LabTemplateAppPort[],
  desktopEnabled = true,
): LabTemplateExposedPort[] => {
  if (Array.isArray(ports) && ports.length > 0) {
    return ports.map((port) => ({
      type: port.type === 'novnc' ? 'novnc' : 'web',
      name: port.type === 'novnc' ? 'novnc' : (port.name || ''),
      label: port.label || (port.type === 'novnc' ? 'Desktop' : ''),
      containerPort: Number(port.containerPort || (port.type === 'novnc' ? 6080 : 3000)),
      path: port.type === 'novnc' ? '' : (port.path || '/'),
      isDefault: Boolean(port.isDefault),
    }));
  }
  const legacyPorts: LabTemplateExposedPort[] = [];
  if (desktopEnabled !== false) {
    legacyPorts.push({ type: 'novnc', name: 'novnc', label: 'Desktop', containerPort: 6080, path: '', isDefault: false });
  }
  (fallbackAppPorts || []).forEach((port) => {
    legacyPorts.push({
      type: 'web',
      name: port.name || '',
      label: port.label || '',
      containerPort: Number(port.containerPort || 3000),
      path: port.path || '/',
      isDefault: false,
    });
  });
  return legacyPorts;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(getCurrentLocale());
};

const templateStatusMeta = (status: number) => (
  status === 1
    ? { label: tr('active'), className: 'bg-emerald-50 text-emerald-700' }
    : { label: tr('disabled'), className: 'bg-slate-100 text-slate-600' }
);

const actionLabelMap: Record<string, string> = {
  check: tr('actions.check'),
  publish: tr('actions.publish'),
  archive: tr('actions.archive'),
  draft: tr('actions.draft'),
  template_create: tr('actions.templateCreate'),
  template_update: tr('actions.templateUpdate'),
  template_status: tr('actions.templateStatus'),
};

const resultLabelMap: Record<string, string> = {
  success: tr('results.success'),
  warning: tr('results.warning'),
  blocked: tr('results.blocked'),
};

const AdminContentGovernancePage: React.FC = () => {
  useTranslation('adminContent');
  const [activeTab, setActiveTab] = useState<GovernanceTab>('templates');
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | '1' | '2'>('all');
  const [templates, setTemplates] = useState<LabTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<LabTemplateFormState>(emptyTemplateForm);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [auditLogs, setAuditLogs] = useState<PublishAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize] = useState(20);
  const [auditContentType, setAuditContentType] = useState<'all' | 'course' | 'project' | 'manual' | 'lab_template'>('all');
  const [auditAction, setAuditAction] = useState<'all' | 'check' | 'publish' | 'archive' | 'draft' | 'template_create' | 'template_update' | 'template_status'>('all');
  const [auditResult, setAuditResult] = useState<'all' | 'success' | 'warning' | 'blocked'>('all');
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<PublishAuditLog | null>(null);
  const { toast, hideToast, success, error } = useToast();
  const confirmDialog = useConfirmDialog();

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesKeyword = !templateKeyword.trim()
        || template.name.toLowerCase().includes(templateKeyword.trim().toLowerCase())
        || template.code.toLowerCase().includes(templateKeyword.trim().toLowerCase())
        || template.envImage.toLowerCase().includes(templateKeyword.trim().toLowerCase());
      const matchesStatus = templateStatusFilter === 'all' || String(template.status) === templateStatusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [templateKeyword, templateStatusFilter, templates]);

  const totalAuditPages = useMemo(() => Math.max(1, Math.ceil(auditTotal / auditPageSize)), [auditPageSize, auditTotal]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    setTemplateError(null);
    const response = await adminLabTemplateApi.list();
    if (response.success && response.data) {
      setTemplates(response.data);
    } else {
      setTemplates([]);
      setTemplateError(response.error || tr('loadTemplatesFailed'));
    }
    setLoadingTemplates(false);
  };

  const loadAuditLogs = async (page = auditPage) => {
    setLoadingAudit(true);
    setAuditError(null);
    const response = await adminPublishAuditApi.list({
      page,
      pageSize: auditPageSize,
      contentType: auditContentType === 'all' ? undefined : auditContentType,
      action: auditAction === 'all' ? undefined : auditAction,
      result: auditResult === 'all' ? undefined : auditResult,
    });
    if (response.success && response.data) {
      setAuditLogs(response.data.list || []);
      setAuditTotal(response.data.total || 0);
      setAuditPage(response.data.page || page);
    } else {
      setAuditLogs([]);
      setAuditTotal(0);
      setAuditPage(page);
      setAuditError(response.error || tr('loadAuditFailed'));
    }
    setLoadingAudit(false);
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    void loadAuditLogs(1);
  }, [auditContentType, auditAction, auditResult]);

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (template: LabTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      code: template.code,
      description: template.description || '',
      runtimeMode: template.runtimeMode || 'classic',
      envImage: template.envImage,
      ideImage: template.ideImage || '',
      mainCpuRequest: template.mainCpuRequest,
      mainMemoryRequest: template.mainMemoryRequest,
      mainCpuLimit: template.mainCpuLimit,
      mainMemoryLimit: template.mainMemoryLimit,
      ideCpuRequest: template.ideCpuRequest,
      ideMemoryRequest: template.ideMemoryRequest,
      ideCpuLimit: template.ideCpuLimit,
      ideMemoryLimit: template.ideMemoryLimit,
      desktopEnabled: template.desktopEnabled ?? true,
      appPorts: Array.isArray(template.appPorts) ? template.appPorts : [],
      defaultAppPortName: template.defaultAppPortName || '',
      exposedPorts: normalizeExposedPortsForForm(template.exposedPorts, template.appPorts, template.desktopEnabled),
      status: template.status,
    });
    setTemplateDialogOpen(true);
  };

  const addTemplateExposedPort = () => {
    setTemplateForm((prev) => {
      const hasDesktop = prev.exposedPorts.some((port) => port.type === 'novnc');
      const nextPort: LabTemplateExposedPort = hasDesktop
        ? { type: 'web', name: '', label: '', containerPort: 3000, path: '/', isDefault: false }
        : { type: 'novnc', name: 'novnc', label: 'Desktop', containerPort: 6080, path: '', isDefault: false };
      return {
        ...prev,
        exposedPorts: [...prev.exposedPorts, nextPort],
      };
    });
  };

  const updateTemplateExposedPort = (index: number, patch: Partial<LabTemplateExposedPort>) => {
    setTemplateForm((prev) => {
      const exposedPorts: LabTemplateExposedPort[] = prev.exposedPorts.map((port, portIndex) => {
        if (portIndex !== index) return port;
        const next = { ...port, ...patch };
        if (patch.type === 'novnc') {
          return { ...next, type: 'novnc', name: 'novnc', label: next.label || 'Desktop', path: '' };
        }
        if (patch.type === 'web') {
          return { ...next, type: 'web', name: port.name === 'novnc' ? '' : next.name, path: next.path || '/' };
        }
        return next;
      });
      return {
        ...prev,
        exposedPorts,
      };
    });
  };

  const removeTemplateExposedPort = (index: number) => {
    setTemplateForm((prev) => {
      const exposedPorts = prev.exposedPorts.filter((_, portIndex) => portIndex !== index);
      return {
        ...prev,
        exposedPorts,
      };
    });
  };

  const setDefaultExposedPort = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      exposedPorts: prev.exposedPorts.map((port, portIndex) => ({
        ...port,
        isDefault: portIndex === index,
      })),
    }));
  };

  const handleTemplateSubmit = async () => {
    if (!templateForm.name.trim() || !templateForm.code.trim() || !templateForm.envImage.trim()) {
      error(tr('required'));
      return;
    }
    if (templateForm.exposedPorts.length === 0) {
      error(tr('portRequired'));
      return;
    }
    const normalizedExposedPorts = templateForm.exposedPorts.map((port) => ({
      type: port.type,
      name: port.type === 'novnc' ? 'novnc' : port.name.trim().toLowerCase(),
      label: port.label.trim() || (port.type === 'novnc' ? 'Desktop' : ''),
      containerPort: Number(port.containerPort),
      path: port.type === 'novnc' ? '' : (port.path.trim() || '/'),
      isDefault: Boolean(port.isDefault),
    }));
    const defaultCount = normalizedExposedPorts.filter((port) => port.isDefault).length;
    if (defaultCount > 1) {
      error(tr('singleDefault'));
      return;
    }
    const normalizedAppPorts = normalizedExposedPorts
      .filter((port) => port.type === 'web')
      .map((port) => ({
        name: port.name,
        label: port.label,
        containerPort: port.containerPort,
        path: port.path || '/',
      }));
    const defaultWebPort = normalizedExposedPorts.find((port) => port.type === 'web' && port.isDefault);

    setSavingTemplate(true);
    const payload: LabTemplateDTO = {
      ...templateForm,
      name: templateForm.name.trim(),
      code: templateForm.code.trim(),
      description: templateForm.description.trim(),
      envImage: templateForm.envImage.trim(),
      ideImage: templateForm.ideImage.trim(),
      desktopEnabled: normalizedExposedPorts.some((port) => port.type === 'novnc'),
      appPorts: normalizedAppPorts,
      defaultAppPortName: defaultWebPort?.name || '',
      exposedPorts: normalizedExposedPorts,
    };
    const response = editingTemplate
      ? await adminLabTemplateApi.update(editingTemplate.id, payload)
      : await adminLabTemplateApi.create(payload);
    setSavingTemplate(false);

    if (!response.success) {
      error(response.error || (editingTemplate ? tr('updateFailed') : tr('createFailed')));
      return;
    }

    success(editingTemplate ? tr('updated') : tr('created'));
    setTemplateDialogOpen(false);
    await loadTemplates();
    await loadAuditLogs(1);
  };

  const handleTemplateStatusChange = (template: LabTemplate, nextStatus: 1 | 2) => {
    const actionLabel = nextStatus === 1 ? tr('enable') : tr('disable');
    confirmDialog.showConfirm({
      title: tr('statusConfirmTitle', { action: actionLabel }),
      message: tr('statusConfirmMessage', { action: actionLabel, name: template.name }),
      type: nextStatus === 1 ? 'info' : 'warning',
      onConfirm: async () => {
        const response = await adminLabTemplateApi.updateStatus(template.id, nextStatus);
        if (!response.success) {
          error(response.error || tr('statusFailed', { action: actionLabel }));
          return;
        }
        success(tr('statusUpdated', { action: actionLabel }));
        await loadTemplates();
        await loadAuditLogs(1);
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <ToastContainer toast={toast} onClose={hideToast} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{tr('title')}</h2>
          <p className="mt-1 text-sm text-default-500">{tr('subtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'templates') void loadTemplates();
            else void loadAuditLogs(auditPage);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${(loadingTemplates || loadingAudit) ? 'animate-spin' : ''}`} />
          {tr('refresh')}
        </button>
      </div>

      <div className="card-surface inline-flex rounded-2xl p-1">
        {([
          { key: 'templates', label: tr('templatesTab'), icon: FlaskConical },
          { key: 'audit', label: tr('auditTab'), icon: ShieldCheck },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === item.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'templates' && (
        <div className="card-surface rounded-3xl p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <ToolbarSearchField
              value={templateKeyword}
              onChange={setTemplateKeyword}
              placeholder={tr('searchTemplates')}
              className="lg:flex-1"
            />
            <ToolbarSelect
              ariaLabel={tr('actions.templateStatus')}
              value={templateStatusFilter}
              onChange={(value) => setTemplateStatusFilter(value as 'all' | '1' | '2')}
              className="lg:w-52"
              options={[
                { key: 'all', label: tr('allStatuses') },
                { key: '1', label: tr('active') },
                { key: '2', label: tr('disabled') },
              ]}
            />
            <button
              onClick={openCreateTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              {tr('newTemplate')}
            </button>
          </div>

          {loadingTemplates && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {tr('loadingTemplates')}
            </div>
          )}

          {!loadingTemplates && templateError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{templateError}</div>
          )}

          {!loadingTemplates && !templateError && filteredTemplates.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {tr('emptyTemplates')}
            </div>
          )}

          {!loadingTemplates && !templateError && filteredTemplates.length > 0 && (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {filteredTemplates.map((template) => {
                const statusMeta = templateStatusMeta(template.status);
                return (
                  <div key={template.id} className="card-surface-muted rounded-3xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-lg font-bold text-slate-900">{template.name}</div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{template.code}</div>
                        <div className="mt-3 text-sm text-slate-600">{template.description || tr('noDescription')}</div>
                      </div>
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <PencilLine className="h-4 w-4" />
                        {tr('edit')}
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('envImage')}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-800">{template.envImage}</div>
                      </div>
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('ideImage')}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-800">{template.ideImage || tr('notConfigured')}</div>
                      </div>
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('mainResources')}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{template.mainCpuRequest} / {template.mainMemoryRequest}</div>
                      </div>
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('ideResources')}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{template.ideCpuRequest} / {template.ideMemoryRequest}</div>
                      </div>
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('imageEntry')}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-800">
                          {exposedPortSummary(template.exposedPorts, template.appPorts, template.desktopEnabled)}
                        </div>
                      </div>
                      <div className="card-surface rounded-2xl px-4 py-3">
                        <div className="text-xs text-slate-400">{tr('appPorts')}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-800">{appPortSummary(template.appPorts)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">{tr('recentlyUpdated', { value: formatDateTime(template.updatedAt) })}</div>
                      <button
                        onClick={() => handleTemplateStatusChange(template, template.status === 1 ? 2 : 1)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          template.status === 1
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <Activity className="h-4 w-4" />
                        {template.status === 1 ? tr('disableTemplate') : tr('enableTemplate')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card-surface rounded-3xl p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px_220px_220px]">
            <ToolbarSearchField
              value=""
              onChange={() => {}}
              placeholder={tr('auditSearch')}
              className="pointer-events-none opacity-60"
            />
            <ToolbarSelect
              ariaLabel={tr('contentTypeFilter')}
              value={auditContentType}
              onChange={(value) => setAuditContentType(value as typeof auditContentType)}
              options={[
                { key: 'all', label: tr('allContent') },
                { key: 'course', label: tr('contentTypes.course') },
                { key: 'project', label: tr('contentTypes.project') },
                { key: 'manual', label: tr('contentTypes.manual') },
                { key: 'lab_template', label: tr('templatesTab') },
              ]}
            />
            <ToolbarSelect
              ariaLabel={tr('actionFilter')}
              value={auditAction}
              onChange={(value) => setAuditAction(value as typeof auditAction)}
              options={[
                { key: 'all', label: tr('allActions') },
                { key: 'check', label: tr('actions.check') },
                { key: 'publish', label: tr('actions.publish') },
                { key: 'archive', label: tr('actions.archive') },
                { key: 'draft', label: tr('actions.draft') },
                { key: 'template_create', label: tr('actions.templateCreate') },
                { key: 'template_update', label: tr('actions.templateUpdate') },
                { key: 'template_status', label: tr('actions.templateStatus') },
              ]}
            />
            <ToolbarSelect
              ariaLabel={tr('resultFilter')}
              value={auditResult}
              onChange={(value) => setAuditResult(value as typeof auditResult)}
              options={[
                { key: 'all', label: tr('allResults') },
                { key: 'success', label: tr('results.success') },
                { key: 'warning', label: tr('results.warning') },
                { key: 'blocked', label: tr('results.blocked') },
              ]}
            />
          </div>

          {loadingAudit && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {tr('loadingAudit')}
            </div>
          )}

          {!loadingAudit && auditError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{auditError}</div>
          )}

          {!loadingAudit && !auditError && auditLogs.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {tr('emptyAudit')}
            </div>
          )}

          {!loadingAudit && !auditError && auditLogs.length > 0 && (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-4 py-3 font-medium">{tr('content')}</th>
                      <th className="px-4 py-3 font-medium">{tr('action')}</th>
                      <th className="px-4 py-3 font-medium">{tr('result')}</th>
                      <th className="px-4 py-3 font-medium">{tr('message')}</th>
                      <th className="px-4 py-3 font-medium">{tr('time')}</th>
                      <th className="px-4 py-3 font-medium text-right">{tr('details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      const isBlocked = log.result === 'blocked';
                      const hasWarnings = log.warnings && log.warnings.length > 0;
                      return (
                        <tr key={log.id} className="border-t border-slate-100">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900">{log.contentTitle || `#${log.contentId}`}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{log.contentType}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{actionLabelMap[log.action] || log.action}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isBlocked
                                ? 'bg-rose-50 text-rose-700'
                                : hasWarnings
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isBlocked ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              {resultLabelMap[log.result] || log.result}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{log.message}</td>
                          <td className="px-4 py-4 text-slate-500">{formatDateTime(log.createdAt)}</td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => setSelectedAudit(log)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              <FileSearch className="h-4 w-4" />
                              {tr('view')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">{tr('pagination', { total: auditTotal, page: auditPage, totalPages: totalAuditPages })}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void loadAuditLogs(Math.max(1, auditPage - 1))}
                    disabled={auditPage <= 1}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tr('previous')}
                  </button>
                  <button
                    onClick={() => void loadAuditLogs(Math.min(totalAuditPages, auditPage + 1))}
                    disabled={auditPage >= totalAuditPages}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tr('next')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <PageDialog
        isOpen={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        panelClassName="max-w-5xl"
      >
        <div className="flex min-h-0 flex-col bg-white">
          <div className="shrink-0 border-b border-slate-200 px-8 py-6">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500">{tr('templatesTab')}</div>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{editingTemplate ? tr('editTemplate') : tr('newTemplate')}</h3>
            <p className="mt-2 text-sm text-slate-500">{tr('templateHelp')}</p>
          </div>
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-8 py-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                {tr('templateName')}
                <input
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  placeholder={tr('templateNamePlaceholder')}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                {tr('templateCode')}
                <input
                  value={templateForm.code}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  placeholder="go-basic-classic"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                {tr('templateDescription')}
                <textarea
                  value={templateForm.description}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-2 min-h-[112px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  placeholder={tr('templateDescriptionPlaceholder')}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                {tr('runtimeMode', { ns: 'uiReview' })}
                <ToolbarSelect
                  ariaLabel={tr('runtimeMode', { ns: 'uiReview' })}
                  value={templateForm.runtimeMode}
                  onChange={(value) => setTemplateForm((prev) => ({ ...prev, runtimeMode: value }))}
                  options={[{ key: 'classic', label: 'classic' }]}
                  className="mt-2"
                />
              </label>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{tr('exposedPorts')}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{tr('exposedPortsHelp')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={addTemplateExposedPort}
                    className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {tr('addPort')}
                  </button>
                </div>
                {templateForm.exposedPorts.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {templateForm.exposedPorts.map((port, index) => (
                      <div key={`${index}-${port.type}-${port.name}`} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{tr('portNumber', { number: index + 1 })}</div>
                          <button
                            type="button"
                            onClick={() => removeTemplateExposedPort(index)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title={tr('deletePort')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">{tr('type')}</label>
                            <Select
                              aria-label={tr('selectPortType')}
                              selectedKeys={[port.type]}
                              onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as LabTemplateExposedPortType | undefined;
                                if (!selected) return;
                                if (selected === 'novnc' && templateForm.exposedPorts.some((item, itemIndex) => itemIndex !== index && item.type === 'novnc')) {
                                  error(tr('desktopLimit'));
                                  return;
                                }
                                updateTemplateExposedPort(index, { type: selected });
                              }}
                              disallowEmptySelection
                              size="md"
                              variant="bordered"
                              classNames={dialogSelectClassNames}
                              listboxProps={{ itemClasses: dialogSelectItemClassNames }}
                            >
                              <SelectItem key="novnc">Desktop/noVNC</SelectItem>
                              <SelectItem key="web">{tr('webApp')}</SelectItem>
                            </Select>
                          </div>
                          <label className="block min-w-0 text-xs font-semibold text-slate-500">
                            {tr('containerPort')}
                            <input
                              type="number"
                              min={1}
                              max={port.type === 'web' ? 45535 : 65535}
                              value={port.containerPort}
                              onChange={(event) => updateTemplateExposedPort(index, { containerPort: Number(event.target.value) })}
                              className="mt-1.5 h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                              placeholder={port.type === 'novnc' ? '6080' : '3000'}
                            />
                          </label>
                          {port.type === 'web' && (
                            <label className="block min-w-0 text-xs font-semibold text-slate-500">
                              {tr('name')}
                              <input
                                value={port.name}
                                onChange={(event) => updateTemplateExposedPort(index, { name: event.target.value })}
                                className="mt-1.5 h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                                placeholder="web"
                              />
                            </label>
                          )}
                          <label className="block min-w-0 text-xs font-semibold text-slate-500">
                            {tr('displayName')}
                            <input
                              value={port.label}
                              onChange={(event) => updateTemplateExposedPort(index, { label: event.target.value })}
                              className="mt-1.5 h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                              placeholder={port.type === 'novnc' ? 'Desktop' : tr('webService')}
                            />
                          </label>
                          {port.type === 'web' && (
                            <label className="block min-w-0 text-xs font-semibold text-slate-500">
                              {tr('defaultPath')}
                              <input
                                value={port.path}
                                onChange={(event) => updateTemplateExposedPort(index, { path: event.target.value })}
                                className="mt-1.5 h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                                placeholder="/"
                              />
                            </label>
                          )}
                          <label className="flex h-[46px] items-center gap-2 self-end rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                            <input
                              type="radio"
                              name="default-exposed-port"
                              checked={port.isDefault}
                              onChange={() => setDefaultExposedPort(index)}
                              className="h-4 w-4 accent-primary-600"
                            />
                            {tr('defaultEntry')}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                {tr('envImage')}
                <input
                  value={templateForm.envImage}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, envImage: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  placeholder="registry.example.com/agent-edu/go-basic:latest"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                {tr('ideImage')}
                <input
                  value={templateForm.ideImage}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, ideImage: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  placeholder={tr('optionalDefault')}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['mainCpuRequest', tr('resourceLabels.mainCpuRequest')],
                  ['mainMemoryRequest', tr('resourceLabels.mainMemoryRequest')],
                  ['mainCpuLimit', tr('resourceLabels.mainCpuLimit')],
                  ['mainMemoryLimit', tr('resourceLabels.mainMemoryLimit')],
                  ['ideCpuRequest', 'IDE CPU Request'],
                  ['ideMemoryRequest', tr('resourceLabels.ideMemoryRequest')],
                  ['ideCpuLimit', 'IDE CPU Limit'],
                  ['ideMemoryLimit', tr('resourceLabels.ideMemoryLimit')],
                ] as const).map(([field, label]) => (
                  <label key={field} className="block text-sm font-semibold text-slate-700">
                    {label}
                    <input
                      value={templateForm[field]}
                      onChange={(event) => setTemplateForm((prev) => ({ ...prev, [field]: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-8 py-5">
            <button
              onClick={() => setTemplateDialogOpen(false)}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              {tr('cancel')}
            </button>
            <button
              onClick={() => void handleTemplateSubmit()}
              disabled={savingTemplate}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {savingTemplate ? tr('saving') : editingTemplate ? tr('saveTemplate') : tr('createTemplate')}
            </button>
          </div>
        </div>
      </PageDialog>

      <PageDrawer
        isOpen={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
        panelClassName="max-w-2xl"
      >
        <div className="min-h-full bg-slate-50">
          {selectedAudit && (
            <>
              <div className="border-b border-slate-200 bg-white px-8 py-6">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500">{tr('auditDetail')}</div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{selectedAudit.contentTitle || `#${selectedAudit.contentId}`}</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedAudit.message}</p>
              </div>
              <div className="space-y-6 p-8">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="card-surface rounded-2xl p-4">
                    <div className="text-xs text-slate-400">{tr('contentType')}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{selectedAudit.contentType}</div>
                  </div>
                  <div className="card-surface rounded-2xl p-4">
                    <div className="text-xs text-slate-400">{tr('action')}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{actionLabelMap[selectedAudit.action] || selectedAudit.action}</div>
                  </div>
                  <div className="card-surface rounded-2xl p-4">
                    <div className="text-xs text-slate-400">{tr('result')}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{resultLabelMap[selectedAudit.result] || selectedAudit.result}</div>
                  </div>
                  <div className="card-surface rounded-2xl p-4">
                    <div className="text-xs text-slate-400">{tr('time')}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{formatDateTime(selectedAudit.createdAt)}</div>
                  </div>
                </div>

                <div className="card-surface rounded-3xl p-5">
                  <div className="mb-4 text-sm font-bold text-slate-800">{tr('errorsWarnings')}</div>
                  <div className="space-y-3">
                    {selectedAudit.errors?.map((item, index) => (
                      <div key={`error-${index}`} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <div className="font-semibold">{item.scope || item.code}</div>
                        <div className="mt-1">{item.message}</div>
                      </div>
                    ))}
                    {selectedAudit.warnings?.map((item, index) => (
                      <div key={`warning-${index}`} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        <div className="font-semibold">{item.scope || item.code}</div>
                        <div className="mt-1">{item.message}</div>
                      </div>
                    ))}
                    {(!selectedAudit.errors || selectedAudit.errors.length === 0) && (!selectedAudit.warnings || selectedAudit.warnings.length === 0) && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {tr('noIssues')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-surface rounded-3xl p-5">
                  <div className="mb-4 text-sm font-bold text-slate-800">{tr('snapshot')}</div>
                  <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                    {JSON.stringify(selectedAudit.snapshot || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </PageDrawer>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.hideConfirm}
      />
    </motion.div>
  );
};

export default AdminContentGovernancePage;
