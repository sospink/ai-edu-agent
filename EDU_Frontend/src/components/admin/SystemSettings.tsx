import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Bot, Cloud, Database, Loader2, RefreshCw, Settings, Shield, Upload } from 'lucide-react';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { adminSettingsService, type AdminAISetting, type AdminSettingsPayload } from '@/services/adminSettings';

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

const formatEnabled = (value: boolean) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-success-50 text-success-600' : 'bg-default-100 text-default-500'}`}>
    {value ? '已启用' : '未配置'}
  </span>
);

const SystemSettings: React.FC = () => {
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
      setError(settingsResponse.error || '获取系统设置失败');
    }
    if (aiResponse.success && aiResponse.data) setAISetting(aiResponse.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const allowedOrigins = useMemo(() => settings?.security.allowedOrigins.join(', ') || '未配置', [settings]);

  const toggleAI = async () => {
    if (!aiSetting) return;
    setSavingAI(true);
    const response = await adminSettingsService.updateAISettings(!aiSetting.enabled);
    setSavingAI(false);
    if (response.success && response.data) {
      setAISetting(response.data);
      success(response.data.enabled ? 'AI 辅助能力已启用' : 'AI 辅助能力已关闭');
    } else {
      showError(response.error || '更新 AI 设置失败');
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
          <h2 className="text-2xl font-bold text-foreground tracking-tight">系统设置</h2>
          <p className="text-default-500 text-sm mt-1">第一版提供只读配置观测与刷新，不支持在线修改</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => void load()}
            className="flex items-center gap-2 px-4 py-2.5 border border-default-200 text-default-600 rounded-xl font-medium hover:bg-default-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新配置
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
          暂无系统配置数据
        </div>
      )}

      {settings && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingCard title="应用信息" description="当前后端实例的基础信息" icon={Settings}>
          <div className="grid gap-3">
            <SettingItem label="应用名称" value={settings.app.name || '未设置'} />
            <SettingItem label="运行环境" value={settings.app.env || '未设置'} />
            <SettingItem label="版本号" value={settings.app.version || '未设置'} />
          </div>
        </SettingCard>

        <SettingCard title="安全基线" description="鉴权、默认管理员和 Origin 白名单" icon={Shield}>
          <div className="grid gap-3">
            <SettingItem label="JWT Issuer" value={settings.security.jwtIssuer || '未设置'} />
            <SettingItem label="JWT 过期时间" value={`${settings.security.jwtExpiresIn} 秒`} />
            <SettingItem label="默认管理员密码" value={formatEnabled(settings.security.defaultAdminConfigured)} />
            <SettingItem label="允许的 Origin" value={allowedOrigins} />
          </div>
        </SettingCard>

        <SettingCard title="运行时与集成" description="K8S、OpenClaw 与飞书集成状态" icon={Cloud}>
          <div className="grid gap-3">
            <SettingItem label="K8S Runtime" value={formatEnabled(settings.runtime.k8sEnabled)} />
            <SettingItem label="K8S Namespace" value={settings.runtime.k8sNamespace || '未设置'} />
            <SettingItem label="Runtime Namespace" value={settings.runtime.runtimeNamespace || '未设置'} />
            <SettingItem label="OpenClaw 网关" value={settings.runtime.openclawGateway || '未设置'} />
            <SettingItem label="OpenClaw 集成" value={formatEnabled(settings.runtime.openclawConfigured)} />
            <SettingItem label="飞书集成" value={formatEnabled(settings.runtime.feishuConfigured)} />
          </div>
        </SettingCard>

        <SettingCard title="AI 辅助能力" description="教师 AI 草稿、摘要和诊断的全局开关" icon={Bot}>
          <div className="card-surface-muted rounded-xl px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-foreground">{aiSetting?.enabled ? '已启用' : '已关闭'}</div>
                <div className="mt-1 text-xs text-default-500">关闭后教师端 AI 生成接口会返回不可用提示。</div>
              </div>
              <button
                onClick={() => void toggleAI()}
                disabled={!aiSetting || savingAI}
                className={`relative h-7 w-12 rounded-full transition-colors ${aiSetting?.enabled ? 'bg-success-500' : 'bg-default-300'} disabled:opacity-60`}
                aria-label="切换 AI 辅助能力"
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${aiSetting?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                {savingAI && <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-default-600" />}
              </button>
            </div>
            {aiSetting?.updatedAt && <div className="mt-3 text-xs text-default-400">更新时间：{new Date(aiSetting.updatedAt).toLocaleString('zh-CN')}</div>}
          </div>
        </SettingCard>

        <SettingCard title="服务与上传" description="服务监听和上传限制配置" icon={Database}>
          <div className="grid gap-3">
            <SettingItem label="服务地址" value={`${settings.server.host}:${settings.server.port}`} />
            <SettingItem label="读取超时" value={`${settings.server.readTimeout} 秒`} />
            <SettingItem label="写入超时" value={`${settings.server.writeTimeout} 秒`} />
            <SettingItem label="上传根目录" value={settings.uploads.root || '未设置'} />
          </div>
        </SettingCard>

        <SettingCard title="上传限制" description="图片与文件的容量阈值" icon={Upload}>
          <div className="grid gap-3">
            <SettingItem label="公开访问前缀" value={settings.uploads.publicBase || '未设置'} />
            <SettingItem label="最大图片大小" value={`${settings.uploads.maxImageMB} MB`} />
            <SettingItem label="最大文件大小" value={`${settings.uploads.maxFileMB} MB`} />
          </div>
        </SettingCard>
      </div>
      )}
    </motion.div>
  );
};

export default SystemSettings;
