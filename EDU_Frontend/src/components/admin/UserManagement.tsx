import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Select, SelectItem } from '@heroui/react';
import {
  AlertCircle,
  Eye,
  Filter,
  KeyRound,
  Loader2,
  Lock,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { adminUserService, type CreateUserParams, type UpdateUserParams, type UserQueryParams } from '@/services/adminUser';
import type { User } from '@/types';
import { RoleType, UserStatus } from '@/types';
import { ToastContainer, useToast } from '@/components/common/Toast';
import PageDialog, { OverlayPortal } from '@/components/common/PageDialog';
import { dialogSelectClassNames, dialogSelectItemClassNames } from '@/components/common/dialogSelectStyles';
import { ToolbarSearchField, ToolbarSelect } from '@/components/common/ToolbarControls';
import { useBodyScrollLock } from '@/components/common/bodyScrollLock';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserParams | UpdateUserParams) => Promise<void>;
  user?: User | null;
  isLoading: boolean;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isLoading: boolean;
}

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: User | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

interface UserDetailDrawerProps {
  user: User | null;
  onClose: () => void;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  accent: string;
}

const pageSizeOptions = [10, 20, 50];

const formatDateTime = (value?: string) => {
  if (!value) return '未记录';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN', { hour12: false });
};

const formatListDateTime = (value?: string) => {
  if (!value) return '未记录';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const getRoleName = (roleType: RoleType) => {
  switch (roleType) {
    case RoleType.ADMIN:
      return '管理员';
    case RoleType.TEACHER:
      return '教师';
    case RoleType.STUDENT:
      return '学生';
    default:
      return '未知';
  }
};

const getRoleColor = (roleType: RoleType) => {
  switch (roleType) {
    case RoleType.ADMIN:
      return 'bg-slate-900';
    case RoleType.TEACHER:
      return 'bg-sky-500';
    case RoleType.STUDENT:
      return 'bg-primary-500';
    default:
      return 'bg-default-400';
  }
};

const getStatusMeta = (status: UserStatus) => {
  switch (status) {
    case UserStatus.ACTIVE:
      return {
        label: '正常',
        badgeClass: 'bg-success-50 text-success-700',
        dotClass: 'bg-success-500',
      };
    case UserStatus.FROZEN:
      return {
        label: '冻结',
        badgeClass: 'bg-warning-50 text-warning-700',
        dotClass: 'bg-warning-500',
      };
    case UserStatus.DELETED:
      return {
        label: '注销',
        badgeClass: 'bg-default-100 text-default-500',
        dotClass: 'bg-default-400',
      };
    default:
      return {
        label: '未知',
        badgeClass: 'bg-default-100 text-default-500',
        dotClass: 'bg-default-400',
      };
  }
};

const StatusBadge: React.FC<{ status: UserStatus }> = ({ status }) => {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}></span>
      {meta.label}
    </span>
  );
};

const ModalShell: React.FC<{ children: React.ReactNode; panelClassName?: string; onClose?: () => void }> = ({ children, panelClassName, onClose }) => (
  <PageDialog isOpen onClose={onClose} panelClassName={panelClassName}>
    {children}
  </PageDialog>
);

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSubmit, user, isLoading }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    studentId: '',
    fullName: '',
    roleType: RoleType.STUDENT,
  });

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        phone: user.phone || '',
        studentId: user.studentId || '',
        fullName: user.fullName || '',
        roleType: user.roleType,
      });
      return;
    }
    setFormData({
      username: '',
      email: '',
      password: '',
      phone: '',
      studentId: '',
      fullName: '',
      roleType: RoleType.STUDENT,
    });
  }, [isOpen, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (user) {
      await onSubmit({
        phone: formData.phone,
        studentId: formData.studentId,
        fullName: formData.fullName,
        roleType: formData.roleType,
      });
      return;
    }
    await onSubmit(formData as CreateUserParams);
  };

  if (!isOpen) return null;

  return (
    <ModalShell panelClassName="max-w-2xl" onClose={onClose}>
      <div className="flex items-center justify-between border-b border-default-100 px-6 py-5">
        <div>
          <h3 className="text-lg font-bold text-foreground">{user ? '编辑用户' : '添加用户'}</h3>
          <p className="mt-1 text-sm text-default-500">{user ? '更新用户资料与角色信息' : '创建新的平台账号并分配初始角色'}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">用户名 *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
              disabled={!!user}
              required
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">邮箱 *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              disabled={!!user}
              required
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
            />
          </div>
        </div>

        {!user && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">初始密码 *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              required
              minLength={8}
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <div className="mt-1 text-xs text-default-400">建议至少 8 位，并包含字母与数字。</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">真实姓名</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">学号 / 工号</label>
            <input
              type="text"
              value={formData.studentId}
              onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-default-500">手机号</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-default-500">角色</label>
            <Select
              aria-label="选择用户角色"
              selectedKeys={[String(formData.roleType)]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                if (!selected) return;
                setFormData((prev) => ({ ...prev, roleType: Number(selected) as RoleType }));
              }}
              disallowEmptySelection
              size="md"
              variant="bordered"
              classNames={dialogSelectClassNames}
              listboxProps={{ itemClasses: dialogSelectItemClassNames }}
            >
              <SelectItem key={String(RoleType.STUDENT)}>学生</SelectItem>
              <SelectItem key={String(RoleType.TEACHER)}>教师</SelectItem>
              <SelectItem key={String(RoleType.ADMIN)}>管理员</SelectItem>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-default-100 pt-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-default-200 px-4 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-50">
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {user ? '保存修改' : '创建用户'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = '确认', isLoading }) => {
  if (!isOpen) return null;

  return (
    <ModalShell panelClassName="max-w-md p-6" onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-default-500">{message}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="rounded-xl border border-default-200 px-4 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-50">
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-danger-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmText}
        </button>
      </div>
    </ModalShell>
  );
};

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, user, isLoading, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirmPassword('');
    setLocalError('');
  }, [isOpen, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setLocalError('新密码至少需要 8 位');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('两次输入的新密码不一致');
      return;
    }
    setLocalError('');
    await onConfirm(password);
  };

  if (!isOpen || !user) return null;

  return (
    <ModalShell panelClassName="max-w-md p-6" onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">重置密码</h3>
          <p className="mt-1 text-sm text-default-500">为 {user.fullName || user.username} 设置新的登录密码</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-default-500">新密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="请输入新的密码"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-default-500">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="请再次输入新密码"
          />
        </div>
        {localError && (
          <div className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">{localError}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-default-200 px-4 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-50">
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            确认重置
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-default-100 bg-default-50/80 px-4 py-3">
    <div className="text-xs font-medium text-default-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-foreground break-all">{value}</div>
  </div>
);

const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({ user, onClose, onEdit, onResetPassword, onToggleStatus, onDelete }) => {
  useBodyScrollLock(Boolean(user));

  if (!user) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[9997]">
        <button
          type="button"
          aria-label="关闭用户详情"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[4px]"
        />
        <motion.div
          initial={{ x: 420 }}
          animate={{ x: 0 }}
          exit={{ x: 420 }}
          className="absolute right-0 top-0 isolate h-full w-full max-w-xl overflow-y-auto border-l border-default-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
        >
          <div className="sticky top-0 z-20 border-b border-default-100 bg-white/95 px-6 py-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-700">
                  {(user.fullName || user.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold text-foreground">{user.fullName || user.username}</div>
                  <div className="mt-1 truncate text-sm text-default-500">{user.email}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getRoleColor(user.roleType)}`}></span>
                    <span className="text-xs font-medium text-default-500">{getRoleName(user.roleType)}</span>
                    <StatusBadge status={user.status} />
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-default-400 transition hover:bg-default-100 hover:text-default-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="用户 ID" value={user.id} />
              <DetailItem label="用户名" value={user.username} />
              <DetailItem label="学号 / 工号" value={user.studentId || '未填写'} />
              <DetailItem label="手机号" value={user.phone || '未填写'} />
              <DetailItem label="创建时间" value={formatDateTime(user.createdAt)} />
              <DetailItem label="更新时间" value={formatDateTime(user.updatedAt)} />
            </div>

            <div className="rounded-3xl border border-default-200 bg-slate-50/80 p-5">
              <div className="text-sm font-semibold text-foreground">快捷操作</div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => onEdit(user)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100"
                >
                  <PencilLine className="h-4 w-4" />
                  编辑资料
                </button>
                <button
                  onClick={() => onResetPassword(user)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" />
                  重置密码
                </button>
                <button
                  onClick={() => onToggleStatus(user)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    user.status === UserStatus.ACTIVE
                      ? 'border border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100'
                      : 'border border-success-200 bg-success-50 text-success-700 hover:bg-success-100'
                  }`}
                >
                  {user.status === UserStatus.ACTIVE ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {user.status === UserStatus.ACTIVE ? '冻结账号' : '恢复账号'}
                </button>
                <button
                  onClick={() => onDelete(user)}
                  className="inline-flex items-center gap-2 rounded-full border border-danger-200 bg-danger-50 px-4 py-2 text-sm font-medium text-danger-700 transition hover:bg-danger-100"
                >
                  <Trash2 className="h-4 w-4" />
                  删除用户
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </OverlayPortal>
  );
};

const StatCard: React.FC<StatCardProps> = ({ title, value, description, accent }) => (
  <div className="card-surface rounded-3xl p-5">
    <div className="text-sm font-medium text-default-500">{title}</div>
    <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
    <div className="mt-1 text-xs text-default-400">{description}</div>
  </div>
);

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const { toast, success, error, hideToast, info } = useToast();
  const hasOverlayOpen = isFormOpen || !!deleteUser || !!detailUser || !!passwordUser;

  const fetchUsers = async () => {
    setIsLoading(true);
    setPageError('');
    try {
      const params: UserQueryParams = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (roleFilter) params.roleType = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await adminUserService.getUsers(params);
      if (response.success && response.data) {
        setUsers(response.data.list);
        setTotal(response.data.total);
        return;
      }
      setUsers([]);
      setTotal(0);
      setPageError(response.error || '获取用户列表失败');
    } catch (fetchError) {
      console.error('获取用户列表失败:', fetchError);
      setUsers([]);
      setTotal(0);
      setPageError('获取用户列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [page, pageSize, keyword, roleFilter, statusFilter]);

  useEffect(() => {
    if (!hasOverlayOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (deleteUser) {
        setDeleteUser(null);
        return;
      }

      if (passwordUser) {
        setPasswordUser(null);
        return;
      }

      if (isFormOpen) {
        setIsFormOpen(false);
        setEditingUser(null);
        return;
      }

      if (detailUser) {
        setDetailUser(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteUser, detailUser, hasOverlayOpen, isFormOpen, passwordUser]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stats = useMemo(() => {
    const visibleStudents = users.filter((user) => user.roleType === RoleType.STUDENT).length;
    const visibleTeachers = users.filter((user) => user.roleType === RoleType.TEACHER).length;
    const visibleAdmins = users.filter((user) => user.roleType === RoleType.ADMIN).length;
    const visibleFrozen = users.filter((user) => user.status === UserStatus.FROZEN).length;
    return { visibleStudents, visibleTeachers, visibleAdmins, visibleFrozen };
  }, [users]);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const openCreateForm = () => {
    setDeleteUser(null);
    setPasswordUser(null);
    setDetailUser(null);
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const openEditForm = (user: User) => {
    setDeleteUser(null);
    setPasswordUser(null);
    setDetailUser(null);
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const openPasswordModal = (user: User) => {
    setDeleteUser(null);
    setDetailUser(null);
    setPasswordUser(user);
  };

  const handleSearch = () => {
    setPage(1);
    setKeyword(searchKeyword.trim());
  };

  const resetFilters = () => {
    setSearchKeyword('');
    setKeyword('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const handleCreateOrUpdate = async (data: CreateUserParams | UpdateUserParams) => {
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const response = await adminUserService.updateUser(editingUser.id, data as UpdateUserParams);
        if (!response.success) {
          error(response.error || '用户更新失败');
          return;
        }
        success('用户更新成功');
        const updatedUser = response.data || editingUser;
        setDetailUser((current) => (current?.id === updatedUser.id ? { ...current, ...updatedUser } : current));
      } else {
        const response = await adminUserService.createUser(data as CreateUserParams);
        if (!response.success) {
          error(response.error || '用户创建失败');
          return;
        }
        success('用户创建成功');
      }
      closeForm();
      await fetchUsers();
    } catch (submitError) {
      console.error('用户保存失败:', submitError);
      error('用户保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setIsSubmitting(true);
    try {
      const response = await adminUserService.deleteUser(deleteUser.id);
      if (!response.success) {
        error(response.error || '删除失败');
        return;
      }
      success('用户已注销');
      if (detailUser?.id === deleteUser.id) {
        setDetailUser({ ...deleteUser, status: UserStatus.DELETED });
      }
      setDeleteUser(null);
      await fetchUsers();
    } catch (deleteError) {
      console.error('删除用户失败:', deleteError);
      error('删除失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    setIsSubmitting(true);
    try {
      const response =
        user.status === UserStatus.ACTIVE
          ? await adminUserService.freezeUser(user.id)
          : await adminUserService.activateUser(user.id);

      if (!response.success) {
        error(response.error || '状态更新失败');
        return;
      }

      const nextStatus = user.status === UserStatus.ACTIVE ? UserStatus.FROZEN : UserStatus.ACTIVE;
      success(nextStatus === UserStatus.FROZEN ? '用户已冻结' : '用户已恢复');
      if (detailUser?.id === user.id) {
        setDetailUser({ ...detailUser, status: nextStatus });
      }
      await fetchUsers();
    } catch (toggleError) {
      console.error('更新用户状态失败:', toggleError);
      error('状态更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!passwordUser) return;
    setIsSubmitting(true);
    try {
      const response = await adminUserService.updatePassword(passwordUser.id, password);
      if (!response.success) {
        error(response.error || '密码重置失败');
        return;
      }
      success('密码已重置');
      setPasswordUser(null);
    } catch (resetError) {
      console.error('重置密码失败:', resetError);
      error('密码重置失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteConfirm = (user: User) => {
    setPasswordUser(null);
    setDetailUser(null);
    setDeleteUser(user);
  };

  const openDetail = (user: User) => {
    setDeleteUser(null);
    setPasswordUser(null);
    setDetailUser(user);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <ToastContainer toast={toast} onClose={hideToast} />

      <UserFormModal isOpen={isFormOpen} onClose={closeForm} onSubmit={handleCreateOrUpdate} user={editingUser} isLoading={isSubmitting} />
      <ConfirmModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => void handleDeleteUser()}
        title="确认注销用户"
        message={`确定要将 "${deleteUser?.fullName || deleteUser?.username || ''}" 标记为注销吗？此操作会保留历史记录，但该用户将无法继续登录。`}
        confirmText="确认注销"
        isLoading={isSubmitting}
      />
      <ResetPasswordModal
        isOpen={!!passwordUser}
        user={passwordUser}
        isLoading={isSubmitting}
        onClose={() => setPasswordUser(null)}
        onConfirm={handleResetPassword}
      />
      <UserDetailDrawer
        user={detailUser}
        onClose={() => setDetailUser(null)}
        onEdit={(user) => {
          setDetailUser(null);
          openEditForm(user);
        }}
        onResetPassword={openPasswordModal}
        onToggleStatus={(user) => void handleToggleStatus(user)}
        onDelete={(user) => {
          setDetailUser(null);
          openDeleteConfirm(user);
        }}
      />

      <div className="card-surface rounded-[28px] p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
              <Users className="h-3.5 w-3.5" />
              用户工作台
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">用户管理</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">
              支持用户检索、角色筛选、状态维护、详情查看、资料编辑与密码重置。当前筛选结果共 <span className="font-semibold text-foreground">{total}</span> 条。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void fetchUsers()}
              className="inline-flex items-center gap-2 rounded-full border border-default-200 bg-white px-4 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新列表
            </button>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-full border border-default-200 bg-white px-4 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-50"
            >
              <Filter className="h-4 w-4" />
              重置筛选
            </button>
            <button
              onClick={() => {
                info('已打开新建用户弹窗');
                openCreateForm();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
            >
              <UserPlus className="h-4 w-4" />
              添加用户
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="筛选结果" value={total} description="符合当前搜索与筛选条件的总数" accent="text-slate-900" />
          <StatCard title="当前页学生" value={stats.visibleStudents} description="当前页可见学生账号数量" accent="text-primary-600" />
          <StatCard title="当前页教师 / 管理员" value={`${stats.visibleTeachers} / ${stats.visibleAdmins}`} description="当前页教学与管理角色分布" accent="text-sky-600" />
          <StatCard title="当前页冻结" value={stats.visibleFrozen} description="当前页处于冻结状态的账号" accent="text-warning-600" />
        </div>
      </div>

      <div className="card-surface rounded-[28px]">
        <div className="border-b border-default-100 px-8 py-6">
          <div className="flex w-full items-center gap-3">
            <ToolbarSearchField
              value={searchKeyword}
              onChange={setSearchKeyword}
              onEnter={handleSearch}
              placeholder="搜索姓名、用户名、邮箱或学号 / 工号"
              className="min-w-[320px] max-w-[480px] flex-[0.92]"
            />

            <ToolbarSelect
              ariaLabel="按角色筛选"
              value={roleFilter === '' ? 'all' : String(roleFilter)}
              onChange={(nextValue) => {
                setPage(1);
                setRoleFilter(nextValue === 'all' ? '' : Number(nextValue) as RoleType);
              }}
              options={[
                { key: 'all', label: '全部角色' },
                { key: String(RoleType.STUDENT), label: '学生' },
                { key: String(RoleType.TEACHER), label: '教师' },
                { key: String(RoleType.ADMIN), label: '管理员' },
              ]}
              className="w-[200px] shrink-0"
            />

            <ToolbarSelect
              ariaLabel="按状态筛选"
              value={statusFilter === '' ? 'all' : String(statusFilter)}
              onChange={(nextValue) => {
                setPage(1);
                setStatusFilter(nextValue === 'all' ? '' : Number(nextValue) as UserStatus);
              }}
              options={[
                { key: 'all', label: '全部状态' },
                { key: String(UserStatus.ACTIVE), label: '正常' },
                { key: String(UserStatus.FROZEN), label: '冻结' },
                { key: String(UserStatus.DELETED), label: '注销' },
              ]}
              className="w-[200px] shrink-0"
            />

            <ToolbarSelect
              ariaLabel="选择每页数量"
              value={String(pageSize)}
              onChange={(nextValue) => {
                setPage(1);
                setPageSize(Number(nextValue));
              }}
              options={pageSizeOptions.map((option) => ({
                key: String(option),
                label: `每页 ${option} 条`,
              }))}
              className="w-[200px] shrink-0"
            />

            <button
              onClick={handleSearch}
              className="inline-flex h-12 w-[120px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Search className="h-4 w-4" />
              搜索
            </button>
          </div>
        </div>

        {pageError && !isLoading ? (
          <div className="px-8 py-12">
            <div className="rounded-[28px] border border-danger-100 bg-danger-50/80 px-6 py-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-danger-500" />
              <div className="mt-4 text-base font-semibold text-danger-700">加载失败</div>
              <div className="mt-2 text-sm text-danger-600">{pageError}</div>
              <button
                onClick={() => void fetchUsers()}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-700"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 px-8 py-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-default-100"></div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-default-100 text-default-400">
              <Users className="h-8 w-8" />
            </div>
            <div className="mt-5 text-lg font-semibold text-foreground">当前没有匹配的用户</div>
            <div className="mt-2 text-sm text-default-500">可以尝试重置筛选条件，或直接创建新用户。</div>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={resetFilters} className="rounded-full border border-default-200 px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50">
                清空筛选
              </button>
              <button onClick={openCreateForm} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                添加用户
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto ${hasOverlayOpen ? 'pointer-events-none' : ''}`}>
              <table className="min-w-[1180px] text-left">
                <thead className={hasOverlayOpen ? 'bg-white shadow-[0_1px_0_rgba(241,245,249,1)]' : 'sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(241,245,249,1)]'}>
                  <tr className="text-xs font-bold uppercase tracking-wider text-default-400">
                    <th className="w-[360px] px-6 py-3">用户</th>
                    <th className="w-[110px] px-4 py-3">角色</th>
                    <th className="w-[110px] px-4 py-3">状态</th>
                    <th className="w-[150px] px-4 py-3">学号 / 工号</th>
                    <th className="w-[170px] px-4 py-3">更新时间</th>
                    <th className="sticky right-0 w-[280px] bg-white px-6 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-default-50/80">
                      <td className="px-6 py-3">
                        <button onClick={() => openDetail(user)} className="flex w-full min-w-0 items-center gap-3 text-left">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-default-100 to-default-200 text-xs font-bold text-default-700 shadow-inner">
                            {(user.fullName || user.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="truncate text-sm font-semibold text-foreground">{user.fullName || user.username}</span>
                              <span className="shrink-0 text-default-300">·</span>
                              <span className="truncate text-sm text-default-500">{user.email}</span>
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex whitespace-nowrap items-center gap-2 rounded-full bg-default-100 px-2.5 py-1 text-xs font-bold text-default-600">
                          <span className={`h-2 w-2 rounded-full ${getRoleColor(user.roleType)}`}></span>
                          {getRoleName(user.roleType)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="block truncate whitespace-nowrap font-mono text-sm text-default-500">{user.studentId || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block truncate whitespace-nowrap text-sm text-default-500">{formatListDateTime(user.updatedAt)}</span>
                      </td>
                      <td className="sticky right-0 bg-white px-6 py-3 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)]">
                        <div className="flex flex-nowrap justify-end gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => openDetail(user)}
                            className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2.5 py-1.5 text-xs font-medium text-default-600 transition hover:bg-default-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            详情
                          </button>
                          <button
                            onClick={() => openEditForm(user)}
                            className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-100"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            编辑
                          </button>
                          <button
                            onClick={() => openPasswordModal(user)}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            重置
                          </button>
                          <button
                            onClick={() => void handleToggleStatus(user)}
                            disabled={isSubmitting}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                              user.status === UserStatus.ACTIVE
                                ? 'bg-warning-50 text-warning-700 hover:bg-warning-100'
                                : 'bg-success-50 text-success-700 hover:bg-success-100'
                            }`}
                          >
                            {user.status === UserStatus.ACTIVE ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            {user.status === UserStatus.ACTIVE ? '冻结' : '激活'}
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(user)}
                            className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1.5 text-xs font-medium text-danger-700 transition hover:bg-danger-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            注销
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-default-100 px-8 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-default-500">
                显示 <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span> -{' '}
                <span className="font-semibold text-foreground">{Math.min(page * pageSize, total)}</span> / 共{' '}
                <span className="font-semibold text-foreground">{total}</span> 条
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="rounded-full border border-default-200 px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  首页
                </button>
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-default-200 px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-3 text-sm font-medium text-default-500">
                  第 <span className="text-foreground">{page}</span> / {totalPages} 页
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-full border border-default-200 px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一页
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="rounded-full border border-default-200 px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  末页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default UserManagement;
