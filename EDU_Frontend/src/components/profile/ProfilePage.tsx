import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3,
  Save,
  Camera,
  GraduationCap,
  School,
  ShieldAlert,
  Mail,
  Calendar,
  Cpu,
  Terminal,
  CheckCircle2,
  Phone,
  X,
  Loader2,
} from 'lucide-react';
// GitHub icon - using custom SVG to avoid deprecated warning
const GitHubIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.85 4.85 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);
import type { User } from '@/types';
import { RoleType, UserStatus } from '@/types';
import { userService } from '@/services/user';
import { emptyLearningOverview, learningOverviewApi, type LearningOverview } from '@/services/learningOverview';

// GitHub 贡献数据类型
interface GitHubContribution {
  date: string;
  count: number;
  level: number; // 0-4
}

interface GitHubContributionsData {
  total: { [year: string]: number };
  contributions: GitHubContribution[];
}

// 从 GitHub 链接提取用户名
const extractGitHubUsername = (githubLink: string): string | null => {
  if (!githubLink) return null;
  // 支持格式: https://github.com/username 或 github.com/username 或 username
  const match = githubLink.match(/(?:github\.com\/)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/?$/);
  return match ? match[1] : null;
};

// GitHub 贡献图组件 - 亮色主题版
const GitHubContributionGraph: React.FC<{ githubLink?: string }> = ({
  githubLink,
}) => {
  const [contributions, setContributions] = useState<GitHubContribution[]>([]);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<GitHubContribution | null>(null);

  const username = useMemo(
    () => extractGitHubUsername(githubLink || ''),
    [githubLink]
  );

  useEffect(() => {
    if (!username) {
      setContributions([]);
      setError(null);
      return;
    }

    const fetchContributions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${username}?y=last`
        );
        if (!response.ok) {
          throw new Error('获取 GitHub 贡献数据失败');
        }
        const data: GitHubContributionsData = await response.json();
        setContributions(data.contributions || []);
        const total = Object.values(data.total || {}).reduce(
          (sum, val) => sum + val,
          0
        );
        setTotalContributions(total);
      } catch (err) {
        console.error('Failed to fetch GitHub contributions:', err);
        setError('无法加载 GitHub 贡献数据');
        setContributions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContributions();
  }, [username]);

  // 模拟数据
  const simulatedData = useMemo(() => {
    return Array.from({ length: 365 }).map((_, i) => {
      const rand = Math.random();
      let level = 0;
      if (rand > 0.92) level = 4;
      else if (rand > 0.85) level = 3;
      else if (rand > 0.75) level = 2;
      else if (rand > 0.6) level = 1;
      const date = new Date();
      date.setDate(date.getDate() - (365 - i));
      return {
        date: date.toISOString().split('T')[0],
        count: level * Math.floor(Math.random() * 5 + 1),
        level,
      };
    });
  }, []);

  const displayData =
    username && contributions.length > 0
      ? contributions.slice(-365)
      : simulatedData;

  // 按周组织数据（7天一列）
  const weeks = useMemo(() => {
    const result: GitHubContribution[][] = [];
    for (let i = 0; i < displayData.length; i += 7) {
      result.push(displayData.slice(i, i + 7));
    }
    return result.slice(-52); // 最近52周
  }, [displayData]);

  // 亮色主题的蓝色渐变色系（匹配项目 primary 色调）
  const getLevelStyle = (level: number) => {
    const colors = [
      { bg: '#e2e8f0', shadow: 'none' }, // level 0 - 浅灰
      { bg: '#93c5fd', shadow: '0 0 6px rgba(59, 130, 246, 0.3)' }, // level 1 - 浅蓝
      { bg: '#60a5fa', shadow: '0 0 8px rgba(59, 130, 246, 0.4)' }, // level 2 - 中蓝
      { bg: '#3b82f6', shadow: '0 0 10px rgba(59, 130, 246, 0.5)' }, // level 3 - 蓝
      { bg: '#2563eb', shadow: '0 0 12px rgba(37, 99, 235, 0.6)' }, // level 4 - 深蓝
    ];
    return colors[level] || colors[0];
  };

  // 加载动画
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-6 flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
              <GitHubIcon
                size={20}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500"
              />
            </div>
            <p className="text-primary-600 text-sm font-medium animate-pulse">
              正在同步 GitHub 数据...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(147, 197, 253, 0.4) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative p-6">
        {/* 头部信息 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-sm">
              <GitHubIcon size={20} className="text-primary-600" />
            </div>
            <div>
              <h4 className="text-foreground font-semibold text-sm">
                {username ? `@${username}` : 'Contribution Graph'}
              </h4>
              <p className="text-default-400 text-xs">
                {username ? '过去一年的代码贡献' : '模拟数据展示'}
              </p>
            </div>
          </div>
          {username && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200"
            >
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                {totalContributions.toLocaleString()}
              </span>
              <span className="text-default-500 text-xs font-medium">
                contributions
              </span>
            </motion.div>
          )}
        </div>

        {/* 贡献图网格 */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="flex gap-[3px] min-w-max justify-center">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {week.map((day, dayIdx) => {
                  const style = getLevelStyle(day.level);
                  return (
                    <motion.div
                      key={dayIdx}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: weekIdx * 0.008 + dayIdx * 0.003,
                        type: 'spring',
                        stiffness: 500,
                        damping: 25,
                      }}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className="w-[11px] h-[11px] rounded-[3px] cursor-pointer transition-all duration-200 hover:scale-150 hover:z-10"
                      style={{
                        background: style.bg,
                        boxShadow: style.shadow,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 悬浮提示 */}
        <AnimatePresence>
          {hoveredDay && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl z-20 bg-white shadow-xl border border-default-200"
            >
              <p className="text-foreground text-sm font-semibold">
                {hoveredDay.count} contributions
              </p>
              <p className="text-default-400 text-xs">{hoveredDay.date}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 图例和链接 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-default-100">
          <div className="flex items-center gap-2">
            <span className="text-default-400 text-xs">Less</span>
            {[0, 1, 2, 3, 4].map((level) => {
              const style = getLevelStyle(level);
              return (
                <div
                  key={level}
                  className="w-[11px] h-[11px] rounded-[3px]"
                  style={{
                    background: style.bg,
                    boxShadow: style.shadow,
                  }}
                />
              );
            })}
            <span className="text-default-400 text-xs">More</span>
          </div>
          {username ? (
            <a
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-600 transition-colors font-medium"
            >
              <span>View on GitHub</span>
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          ) : (
            <span className="text-xs text-default-400">
              设置 GitHub 链接显示真实数据
            </span>
          )}
        </div>

        {error && (
          <p className="text-center text-xs text-warning-500 mt-2">{error}</p>
        )}
      </div>
    </Card>
  );
};

interface ProfilePageProps {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (user: User) => void;
}

// 角色徽章组件
const RoleBadge: React.FC<{ type: RoleType }> = ({ type }) => {
  const config = {
    [RoleType.STUDENT]: { label: "学生", color: "bg-primary-50 text-primary-600 border-primary-100", icon: <GraduationCap size={14} /> },
    [RoleType.TEACHER]: { label: "教师", color: "bg-success-50 text-success-600 border-success-100", icon: <School size={14} /> },
    [RoleType.ADMIN]: { label: "管理员", color: "bg-danger-50 text-danger-600 border-danger-100", icon: <ShieldAlert size={14} /> },
  };
  const current = config[type] || config[RoleType.STUDENT];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${current.color}`}>
      {current.icon}
      {current.label}
    </span>
  );
};

// 状态徽章
const StatusBadge: React.FC<{ status: UserStatus }> = ({ status }) => {
  const config = {
    [UserStatus.ACTIVE]: { label: "正常", color: "bg-success" },
    [UserStatus.FROZEN]: { label: "冻结", color: "bg-warning-500" },
    [UserStatus.DELETED]: { label: "注销", color: "bg-default-400" },
  };
  const current = config[status] || config[UserStatus.ACTIVE];
  return (
    <span className={`w-3 h-3 rounded-full ${current.color} border-2 border-white`} title={current.label} />
  );
};

// 卡片组件
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`card-surface rounded-2xl backdrop-blur-xl ${className}`}>
    {children}
  </div>
);

// 输入框组件
const Input: React.FC<{
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, disabled, description, icon }) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-default-500">{label}</label>
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
      disabled 
        ? 'bg-default-100 border-default-100 text-default-400 cursor-not-allowed' 
        : 'bg-white border-default-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20'
    }`}>
      {icon && <div className="text-default-400">{icon}</div>}
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-default-400"
      />
    </div>
    {description && <p className="text-[10px] text-default-400">{description}</p>}
  </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, onClose, onUserUpdate }) => {
  const [user, setUser] = useState<User>(currentUser);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [overview, setOverview] = useState<LearningOverview>(emptyLearningOverview);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: currentUser.fullName || '',
    phone: currentUser.phone || '',
    bio: currentUser.bio || '',
    githubLink: currentUser.githubLink || '',
  });

  useEffect(() => {
    setUser(currentUser);
    setEditForm({
      fullName: currentUser.fullName || '',
      phone: currentUser.phone || '',
      bio: currentUser.bio || '',
      githubLink: currentUser.githubLink || '',
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser.roleType !== RoleType.STUDENT) {
      setOverview(emptyLearningOverview);
      setOverviewError(null);
      setOverviewLoading(false);
      return;
    }

    const fetchOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      const response = await learningOverviewApi.getOverview();
      if (response.success && response.data) {
        setOverview(response.data);
      } else {
        setOverview(emptyLearningOverview);
        setOverviewError(response.error || '学习概览暂时不可用');
      }
      setOverviewLoading(false);
    };

    void fetchOverview();
  }, [currentUser.id, currentUser.roleType]);

  // 自动隐藏消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await userService.updateUser(user.id, editForm);
      if (response.success && response.data) {
        setUser(response.data);
        onUserUpdate?.(response.data);
        setIsEditing(false);
        setMessage({ type: 'success', text: '个人资料更新成功！' });
      } else {
        setMessage({ type: 'error', text: response.error || '更新失败，请重试' });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: '网络错误，请稍后重试' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // 重置表单到原始值
    setEditForm({
      fullName: user.fullName || '',
      phone: user.phone || '',
      bio: user.bio || '',
      githubLink: user.githubLink || '',
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="relative min-h-[calc(100vh-64px)] px-4 pb-8 pt-24 md:px-8"
    >
      {/* 消息提示 */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg ${
              message.type === 'success' 
                ? 'bg-success-50 text-success-600 border border-success-200' 
                : 'bg-danger-50 text-danger-600 border border-danger-200'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl">
          
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">个人中心</h1>
              <p className="text-sm text-default-500 mt-1">管理您的账户和个人信息</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-default-600 hover:bg-default-100 rounded-xl transition-colors"
              >
                <X size={16} />
                返回
              </button>
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 text-sm font-medium rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <Edit3 size={16} />
                  编辑资料
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                    保存
                  </button>
                </>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* 左侧：身份信息 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-4 xl:col-span-3 space-y-4"
            >
              <Card className="p-0 overflow-hidden">
                {/* 封面图 - 浅蓝色渐变 */}
                <div 
                  className="h-24"
                  style={{
                    background: 'linear-gradient(to right, #60a5fa, #93c5fd, #bfdbfe)'
                  }}
                ></div>
                <div className="flex flex-col items-center gap-4 px-6 pb-6 -mt-12 text-center relative z-10">
                  {/* 头像 */}
                  <div className="relative group cursor-pointer">
                    <div className="p-1 bg-white rounded-full shadow-md">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 font-bold text-2xl">
                        {(user.fullName || user.username).slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <StatusBadge status={user.status} />
                    </div>
                    {isEditing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full m-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={24} />
                      </div>
                    )}
                  </div>

                  {/* 名称 */}
                  <div className="flex flex-col items-center gap-1 mt-2">
                    <h2 className="text-xl font-bold text-foreground">{user.fullName || user.username}</h2>
                    <p className="font-mono text-sm text-default-500">@{user.username}</p>
                  </div>

                  {/* 角色和ID */}
                  <div className="flex items-center gap-2">
                    <RoleBadge type={user.roleType} />
                    {user.studentId && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-default-100 text-default-600 border border-default-200">
                        {user.studentId}
                      </span>
                    )}
                  </div>

                  <hr className="border-default-200 w-full my-2" />

                  {/* 联系信息 */}
                  <div className="flex w-full flex-col gap-3 text-sm text-default-600">
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-default-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-default-400" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.githubLink && (
                      <div className="flex items-center gap-3">
                        <GitHubIcon size={16} className="text-default-400" />
                        <a href={user.githubLink} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary-600 transition-colors">
                          {user.githubLink.replace('https://github.com/', '')}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-default-400" />
                      <span>加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Agent Stats Card (Gamification) - 玻璃拟态浅蓝渐变效果 */}
              <div 
                className="rounded-2xl text-white shadow-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.9) 0%, rgba(147, 197, 253, 0.85) 50%, rgba(191, 219, 254, 0.8) 100%)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 10px 40px -10px rgba(59, 130, 246, 0.3)'
                }}
              >
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-white drop-shadow-sm">Agent Rank</h3>
                    <Cpu size={20} className="text-white/80" />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-white drop-shadow-sm">Lv. {overviewLoading ? '...' : overview.level}</span>
                    <span className="mb-1.5 text-sm font-medium text-white/90">{overview.levelName}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 relative h-2 w-full overflow-hidden rounded-full bg-white/30">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, overview.overallProgressPercent))}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                      className="absolute h-full bg-white rounded-full shadow-sm"
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/80 font-medium">
                    {overview.completedLessons} / {overview.totalLessons} 课时完成 · {overview.overallProgressPercent}%
                  </p>
                  {overviewError && (
                    <p className="mt-2 text-xs text-white/80">{overviewError}</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* 右侧：内容区 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6"
            >
              {/* Tabs */}
              <div className="border-b border-default-200">
                <div className="flex gap-8">
                  {[
                    { key: 'overview', label: '概览', icon: Terminal },
                    { key: 'settings', label: '设置', icon: Edit3 },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as 'overview' | 'settings')}
                      className={`relative pb-3 text-sm font-medium transition-colors ${
                        activeTab === tab.key ? 'text-primary-600' : 'text-default-500 hover:text-default-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <tab.icon size={18} />
                        {tab.label}
                      </div>
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 transition-transform duration-300 origin-left ${
                        activeTab === tab.key ? 'scale-x-100' : 'scale-x-0'
                      }`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 'overview' ? (
                  <motion.div 
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-6"
                  >
                    {/* 个人简介 */}
                    <Card>
                      <div className="px-6 pt-6 pb-2">
                        <p className="text-lg font-bold text-foreground">个人简介</p>
                      </div>
                      <div className="px-6 pb-6">
                        {isEditing ? (
                          <textarea 
                            className="w-full p-3 rounded-xl border border-default-200 bg-default-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none"
                            rows={4}
                            value={editForm.bio}
                            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                            placeholder="介绍一下自己..."
                          />
                        ) : (
                          <p className="text-default-600 leading-relaxed">
                            {user.bio || '这个人很懒，还没有填写简介~'}
                          </p>
                        )}
                      </div>
                    </Card>

	                    {/* 统计数据 */}
	                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
	                      {[
	                        { label: "完成课时", value: overviewLoading ? "..." : String(overview.completedLessons), icon: CheckCircle2, color: "text-success-600", bg: "bg-success-50" },
	                        { label: "提交成果", value: overviewLoading ? "..." : String(overview.outcomeSummary.submittedAssignments), icon: Terminal, color: "text-primary-600", bg: "bg-primary-50" },
	                        { label: "Agent 步骤", value: overviewLoading ? "..." : String(overview.outcomeSummary.agentCompletedSteps), icon: Cpu, color: "text-secondary-600", bg: "bg-secondary-50" },
	                      ].map((stat, idx) => (
                        <Card key={idx} className="hover:-translate-y-1 transition-transform duration-300">
                          <div className="flex items-center gap-4 p-5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                              <stat.icon size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-default-400 tracking-wider">{stat.label}</p>
                              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {/* 活动热力图 - 炸裂版 */}
                    <GitHubContributionGraph githubLink={user.githubLink} />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <div className="p-8 flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Input 
                            label="用户名" 
                            value={user.username} 
                            disabled 
                            description="用户名不可修改" 
                          />
                          <Input 
                            label="真实姓名" 
                            value={editForm.fullName}
                            onChange={(v) => setEditForm({ ...editForm, fullName: v })}
                            disabled={!isEditing}
                          />
                          <Input 
                            label="邮箱" 
                            value={user.email} 
                            disabled 
                            icon={<Mail size={16} />} 
                          />
                          <Input 
                            label="手机号" 
                            value={editForm.phone}
                            onChange={(v) => setEditForm({ ...editForm, phone: v })}
                            disabled={!isEditing}
                            icon={<Phone size={16} />} 
                          />
                          <Input 
                            label="学号/工号" 
                            value={user.studentId || ''} 
                            disabled 
                          />
                          <Input 
                            label="GitHub" 
                            value={editForm.githubLink}
                            onChange={(v) => setEditForm({ ...editForm, githubLink: v })}
                            disabled={!isEditing}
                            icon={<GitHubIcon size={16} />} 
                          />
                        </div>
                        {isEditing && (
                          <>
                            <hr className="border-default-200" />
                            <div className="flex justify-end">
                              <button 
                                onClick={handleSave}
                                disabled={isLoading}
                                className="px-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                              >
                                保存修改
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
    </motion.div>
  );
};

export default ProfilePage;
