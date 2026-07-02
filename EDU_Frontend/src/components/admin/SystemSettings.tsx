import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bot, Cloud, Database, Loader2, RefreshCw, Settings, Shield, Upload } from 'lucide-react';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { adminSettingsService, type AdminAISetting, type AdminSettingsPayload } from '@/services/adminSettings';
import { getCurrentLocale } from '@/i18n';

interface SettingCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const SettingCard: React.FC<SettingCardProps> = ({ title, description, icon: Icon, children }) => (
  <div className="card-surface rounded-2xl p-6">
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary-600" />
      </div>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="text-sm text-default-500 mt-0.5">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

interface SettingItemProps {
  label: string;
  value: React.ReactNode;
  description?: string;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, value, description }) => (
  <div className="card-surface-muted rounded-xl px-4 py-3">
    <div className="text-xs font-medium text-default-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-foreground break-all">{value}</div>
    {description && <div className="mt-1 text-xs text-default-400">{description}</div>}
  </div>
);

const formatEnabled = (value: boolean, enabled: string, notConfigured: string) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-success-50 text-success-600' : 'bg-default-100 text-default-500'}`}>
    {value ? enabled : notConfigured}
  </span>
);

const SystemSettings: React.FC = () => {
  const { t } = useTranslation('adminSettings');
  const [settings, setSettings] = useState<AdminSettingsPayload | null>(null);
  const [aiSetting, setAISetting] = useState<AdminAISetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [error, setError] = useState('');
  const { toast, hideToast, success, error: showError } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    const [settingsResponse, aiResponse] = await Promise.all([
      adminSettingsService.getSettings(),
      adminSettingsService.getAISettings(),
    ]);
    if (settingsResponse.success && settingsResponse.data) {
      setSettings(settingsResponse.data);
    } else {
      setSettings(null);
      setError(settingsResponse.error || t('loadFailed'));
    }
    if (aiResponse.success && aiResponse.data) setAISetting(aiResponse.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const allowedOrigins = useMemo(() => settings?.security.allowedOrigins.join(', ') || t('notConfigured'), [settings, t]);

  const toggleAI = async () => {
    if (!aiSetting) return;
    setSavingAI(true);
    const response = await adminSettingsService.updateAISettings(!aiSetting.enabled);
    setSavingAI(false);
    if (response.success && response.data) {
      setAISetting(response.data);
      success(response.data.enabled ? t('aiEnabledToast') : t('aiDisabledToast'));
    } else {
      showError(response.error || t('aiUpdateFailed'));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }} 
      className="space-y-6"
    >
      <ToastContainer toast={toast} onClose={hideToast} />
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{t('title')}</h2>
          <p className="text-default-500 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => void load()}
            className="flex items-center gap-2 px-4 py-2.5 border border-default-200 text-default-600 rounded-xl font-medium hover:bg-default-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger-100 bg-danger-50/80 px-5 py-4 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {loading && !settings && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card-surface h-56 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && !settings && !error && (
        <div className="card-surface rounded-2xl px-6 py-10 text-center text-default-500">
          {t('empty')}
        </div>
      )}

      {settings && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingCard title={t('appInfo')} description={t('appInfoDesc')} icon={Settings}>
          <div className="grid gap-3">
            <SettingItem label={t('appName')} value={settings.app.name || t('notSet')} />
            <SettingItem label={t('environment')} value={settings.app.env || t('notSet')} />
            <SettingItem label={t('version')} value={settings.app.version || t('notSet')} />
          </div>
        </SettingCard>

        <SettingCard title={t('security')} description={t('securityDesc')} icon={Shield}>
          <div className="grid gap-3">
            <SettingItem label="JWT Issuer" value={settings.security.jwtIssuer || t('notSet')} />
            <SettingItem label={t('jwtExpiry')} value={t('seconds', { count: settings.security.jwtExpiresIn })} />
            <SettingItem label={t('defaultAdminPassword')} value={formatEnabled(settings.security.defaultAdminConfigured, t('enabled'), t('notConfigured'))} />
            <SettingItem label={t('allowedOrigins')} value={allowedOrigins} />
          </div>
        </SettingCard>

        <SettingCard title={t('runtime')} description={t('runtimeDesc')} icon={Cloud}>
          <div className="grid gap-3">
            <SettingItem label="K8S Runtime" value={formatEnabled(settings.runtime.k8sEnabled, t('enabled'), t('notConfigured'))} />
            <SettingItem label="K8S Namespace" value={settings.runtime.k8sNamespace || t('notSet')} />
            <SettingItem label="Runtime Namespace" value={settings.runtime.runtimeNamespace || t('notSet')} />
            <SettingItem label={t('openclawGateway')} value={settings.runtime.openclawGateway || t('notSet')} />
            <SettingItem label={t('openclawIntegration')} value={formatEnabled(settings.runtime.openclawConfigured, t('enabled'), t('notConfigured'))} />
            <SettingItem label={t('feishuIntegration')} value={formatEnabled(settings.runtime.feishuConfigured, t('enabled'), t('notConfigured'))} />
          </div>
        </SettingCard>

        <SettingCard title={t('ai')} description={t('aiDesc')} icon={Bot}>
          <div className="card-surface-muted rounded-xl px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-foreground">{aiSetting?.enabled ? t('enabled') : t('disabled')}</div>
                <div className="mt-1 text-xs text-default-500">{t('aiHelp')}</div>
              </div>
              <button
                onClick={() => void toggleAI()}
                disabled={!aiSetting || savingAI}
                className={`relative h-7 w-12 rounded-full transition-colors ${aiSetting?.enabled ? 'bg-success-500' : 'bg-default-300'} disabled:opacity-60`}
                aria-label={t('toggleAI')}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${aiSetting?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                {savingAI && <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-default-600" />}
              </button>
            </div>
            {aiSetting?.updatedAt && <div className="mt-3 text-xs text-default-400">{t('updatedAt', { value: new Date(aiSetting.updatedAt).toLocaleString(getCurrentLocale()) })}</div>}
          </div>
        </SettingCard>

        <SettingCard title={t('serverUploads')} description={t('serverUploadsDesc')} icon={Database}>
          <div className="grid gap-3">
            <SettingItem label={t('serverAddress')} value={`${settings.server.host}:${settings.server.port}`} />
            <SettingItem label={t('readTimeout')} value={t('seconds', { count: settings.server.readTimeout })} />
            <SettingItem label={t('writeTimeout')} value={t('seconds', { count: settings.server.writeTimeout })} />
            <SettingItem label={t('uploadRoot')} value={settings.uploads.root || t('notSet')} />
          </div>
        </SettingCard>

        <SettingCard title={t('uploadLimits')} description={t('uploadLimitsDesc')} icon={Upload}>
          <div className="grid gap-3">
            <SettingItem label={t('publicBase')} value={settings.uploads.publicBase || t('notSet')} />
            <SettingItem label={t('maxImageSize')} value={`${settings.uploads.maxImageMB} MB`} />
            <SettingItem label={t('maxFileSize')} value={`${settings.uploads.maxFileMB} MB`} />
          </div>
        </SettingCard>
      </div>
      )}
    </motion.div>
  );
};

export default SystemSettings;
