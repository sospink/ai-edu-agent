import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Shield, Database, Globe, Palette, Save, RotateCcw, CheckCircle } from 'lucide-react';

interface SettingCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const SettingCard: React.FC<SettingCardProps> = ({ title, description, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl border border-default-200 shadow-sm p-6">
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

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      {description && <div className="text-xs text-default-400 mt-0.5">{description}</div>}
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-default-200'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    twoFactorAuth: true,
    sessionTimeout: '30',
    autoBackup: true,
    backupFrequency: 'daily',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    theme: 'light',
    compactMode: false,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // 模拟保存
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({
      emailNotifications: true,
      pushNotifications: false,
      twoFactorAuth: true,
      sessionTimeout: '30',
      autoBackup: true,
      backupFrequency: 'daily',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      theme: 'light',
      compactMode: false,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }} 
      className="space-y-6"
    >
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">系统设置</h2>
          <p className="text-default-500 text-sm mt-1">管理系统配置和偏好设置</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 border border-default-200 text-default-600 rounded-xl font-medium hover:bg-default-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存' : '保存设置'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 通知设置 */}
        <SettingCard title="通知设置" description="配置系统通知方式" icon={Bell}>
          <div className="space-y-1 divide-y divide-default-100">
            <ToggleSwitch
              enabled={settings.emailNotifications}
              onChange={(v) => setSettings({ ...settings, emailNotifications: v })}
              label="邮件通知"
              description="接收重要系统通知邮件"
            />
            <ToggleSwitch
              enabled={settings.pushNotifications}
              onChange={(v) => setSettings({ ...settings, pushNotifications: v })}
              label="推送通知"
              description="浏览器推送通知"
            />
          </div>
        </SettingCard>

        {/* 安全设置 */}
        <SettingCard title="安全设置" description="账户安全和访问控制" icon={Shield}>
          <div className="space-y-4">
            <ToggleSwitch
              enabled={settings.twoFactorAuth}
              onChange={(v) => setSettings({ ...settings, twoFactorAuth: v })}
              label="双因素认证"
              description="登录时需要额外验证"
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">会话超时时间</label>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                className="w-full px-4 py-2.5 bg-default-50 border border-default-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="15">15 分钟</option>
                <option value="30">30 分钟</option>
                <option value="60">1 小时</option>
                <option value="120">2 小时</option>
              </select>
            </div>
          </div>
        </SettingCard>

        {/* 数据备份 */}
        <SettingCard title="数据备份" description="自动备份和恢复设置" icon={Database}>
          <div className="space-y-4">
            <ToggleSwitch
              enabled={settings.autoBackup}
              onChange={(v) => setSettings({ ...settings, autoBackup: v })}
              label="自动备份"
              description="定期自动备份系统数据"
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">备份频率</label>
              <select
                value={settings.backupFrequency}
                onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                className="w-full px-4 py-2.5 bg-default-50 border border-default-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                disabled={!settings.autoBackup}
              >
                <option value="hourly">每小时</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
          </div>
        </SettingCard>

        {/* 区域设置 */}
        <SettingCard title="区域设置" description="语言和时区配置" icon={Globe}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">系统语言</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full px-4 py-2.5 bg-default-50 border border-default-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁体中文</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">时区</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-2.5 bg-default-50 border border-default-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
                <option value="Asia/Tokyo">日本标准时间 (UTC+9)</option>
                <option value="America/New_York">美国东部时间 (UTC-5)</option>
                <option value="Europe/London">格林威治时间 (UTC+0)</option>
              </select>
            </div>
          </div>
        </SettingCard>

        {/* 外观设置 */}
        <SettingCard title="外观设置" description="界面主题和显示偏好" icon={Palette}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">主题模式</label>
              <div className="flex gap-3">
                {[
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                  { value: 'system', label: '跟随系统' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings({ ...settings, theme: option.value })}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      settings.theme === option.value
                        ? 'bg-primary-50 border-primary-200 text-primary-600'
                        : 'bg-default-50 border-default-200 text-default-600 hover:bg-default-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleSwitch
              enabled={settings.compactMode}
              onChange={(v) => setSettings({ ...settings, compactMode: v })}
              label="紧凑模式"
              description="减少界面间距，显示更多内容"
            />
          </div>
        </SettingCard>
      </div>
    </motion.div>
  );
};

export default SystemSettings;
