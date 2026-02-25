import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Filter, Plus, Trash2, Edit2, Lock, Unlock, Loader2, X, AlertCircle } from 'lucide-react';
import { userService, type UserQueryParams, type CreateUserParams, type UpdateUserParams } from '@/services/user';
import type { User } from '@/types';
import { RoleType, UserStatus } from '@/types';
import { ToastContainer, useToast } from '@/components/common/Toast';

// 用户表单弹窗组件
interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserParams | UpdateUserParams) => Promise<void>;
  user?: User | null;
  isLoading: boolean;
}

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
    } else {
      setFormData({
        username: '',
        email: '',
        password: '',
        phone: '',
        studentId: '',
        fullName: '',
        roleType: RoleType.STUDENT,
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      const updateData: UpdateUserParams = {
        phone: formData.phone,
        studentId: formData.studentId,
        fullName: formData.fullName,
        roleType: formData.roleType,
      };
      await onSubmit(updateData);
    } else {
      await onSubmit(formData as CreateUserParams);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-default-100">
          <h3 className="text-lg font-bold text-foreground">{user ? '编辑用户' : '添加用户'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-default-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-default-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">用户名 *</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!user}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:opacity-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">邮箱 *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!user}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:opacity-50"
                required
              />
            </div>
          </div>
          {!user && (
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">密码 *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                required={!user}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">真实姓名</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">学号/工号</label>
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">手机号</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-default-500 mb-1.5">角色</label>
              <select
                value={formData.roleType}
                onChange={(e) => setFormData({ ...formData, roleType: Number(e.target.value) as RoleType })}
                className="w-full px-3 py-2.5 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value={RoleType.STUDENT}>学生</option>
                <option value={RoleType.TEACHER}>教师</option>
                <option value={RoleType.ADMIN}>管理员</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-default-200 text-default-600 rounded-lg font-medium hover:bg-default-50 transition-colors">
              取消
            </button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {user ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};


// 确认删除弹窗
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-danger-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-default-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-default-200 text-default-600 rounded-lg font-medium hover:bg-default-50 transition-colors">
            取消
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-danger-600 text-white rounded-lg font-medium hover:bg-danger-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            确认
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// 用户管理主组件
const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const { toast, success, error, hideToast } = useToast();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params: UserQueryParams = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (roleFilter) params.roleType = roleFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await userService.getUsers(params);
      if (response.success && response.data) {
        setUsers(response.data.list);
        setTotal(response.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      error('获取用户列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleCreateUser = async (data: CreateUserParams | UpdateUserParams) => {
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const response = await userService.updateUser(editingUser.id, data as UpdateUserParams);
        if (response.success) {
          success('用户更新成功');
          setIsFormOpen(false);
          setEditingUser(null);
          fetchUsers();
        } else {
          error(response.error || '更新失败');
        }
      } else {
        const response = await userService.createUser(data as CreateUserParams);
        if (response.success) {
          success('用户创建成功');
          setIsFormOpen(false);
          fetchUsers();
        } else {
          error(response.error || '创建失败');
        }
      }
    } catch (err) {
      error('操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setIsSubmitting(true);
    try {
      const response = await userService.deleteUser(deleteUser.id);
      if (response.success) {
        success('用户已删除');
        setDeleteUser(null);
        fetchUsers();
      } else {
        error(response.error || '删除失败');
      }
    } catch (err) {
      error('删除失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const response = user.status === UserStatus.ACTIVE 
        ? await userService.freezeUser(user.id)
        : await userService.activateUser(user.id);
      if (response.success) {
        success(user.status === UserStatus.ACTIVE ? '用户已冻结' : '用户已激活');
        fetchUsers();
      } else {
        error(response.error || '操作失败');
      }
    } catch (err) {
      error('操作失败');
    }
  };

  const getRoleName = (roleType: RoleType) => {
    switch (roleType) {
      case RoleType.ADMIN: return '管理员';
      case RoleType.TEACHER: return '教师';
      case RoleType.STUDENT: return '学生';
      default: return '未知';
    }
  };

  const getRoleColor = (roleType: RoleType) => {
    switch (roleType) {
      case RoleType.ADMIN: return 'bg-default-800';
      case RoleType.TEACHER: return 'bg-secondary-500';
      case RoleType.STUDENT: return 'bg-primary-500';
      default: return 'bg-default-400';
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border bg-success-50 text-success-600 border-success-100">正常</span>;
      case UserStatus.FROZEN:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border bg-warning-50 text-warning-600 border-warning-100">冻结</span>;
      case UserStatus.DELETED:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border bg-default-100 text-default-500 border-default-200">注销</span>;
      default:
        return null;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }} 
      className="bg-white rounded-3xl border border-default-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]"
    >
      <ToastContainer toast={toast} onClose={hideToast} />
      
      <UserFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingUser(null); }}
        onSubmit={handleCreateUser}
        user={editingUser}
        isLoading={isSubmitting}
      />
      
      <ConfirmModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDeleteUser}
        title="确认删除"
        message={`确定要删除用户 "${deleteUser?.username}" 吗？此操作将把用户状态设为注销。`}
        isLoading={isSubmitting}
      />

      {/* 头部 */}
      <div className="p-8 pb-4 border-b border-default-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">用户管理</h2>
            <p className="text-default-500 text-sm mt-1">共 {total} 个用户</p>
          </div>
          <button 
            onClick={() => { setEditingUser(null); setIsFormOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-full shadow-lg shadow-primary-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" /><span>添加用户</span>
          </button>
        </div>
        
        {/* 搜索和筛选 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-default-400 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索姓名、邮箱或学号..." 
              className="w-full pl-11 pr-4 py-2.5 bg-default-50/50 border border-default-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all hover:bg-white hover:shadow-sm" 
            />
          </div>
          <button 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-full text-sm font-medium transition-all ${showFilterPanel ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-default-200 text-default-600 hover:bg-default-50 hover:border-default-300'}`}
          >
            <Filter className="w-4 h-4" /><span>筛选</span>
          </button>
          <button onClick={handleSearch} className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:bg-default-800 transition-all">
            <Search className="w-4 h-4" /><span>搜索</span>
          </button>
        </div>
        
        {/* 筛选面板 */}
        {showFilterPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 flex gap-4">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleType | '')}
              className="px-4 py-2 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">全部角色</option>
              <option value={RoleType.STUDENT}>学生</option>
              <option value={RoleType.TEACHER}>教师</option>
              <option value={RoleType.ADMIN}>管理员</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
              className="px-4 py-2 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">全部状态</option>
              <option value={UserStatus.ACTIVE}>正常</option>
              <option value={UserStatus.FROZEN}>冻结</option>
              <option value={UserStatus.DELETED}>注销</option>
            </select>
          </motion.div>
        )}
      </div>
      
      {/* 用户列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-default-400">
            <Users className="w-12 h-12 mb-4" />
            <p>暂无用户数据</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_rgba(241,245,249,1)]">
              <tr>
                <th className="px-8 py-5 text-xs font-bold text-default-400 uppercase tracking-wider w-[30%]">用户</th>
                <th className="px-6 py-5 text-xs font-bold text-default-400 uppercase tracking-wider">角色</th>
                <th className="px-6 py-5 text-xs font-bold text-default-400 uppercase tracking-wider">状态</th>
                <th className="px-6 py-5 text-xs font-bold text-default-400 uppercase tracking-wider">学号/工号</th>
                <th className="px-8 py-5 text-right text-xs font-bold text-default-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-50">
              {users.map((user) => (
                <tr key={user.id} className="group hover:bg-default-50/80 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-default-100 to-default-200 flex items-center justify-center text-default-600 font-bold text-sm shadow-inner ring-2 ring-white">
                        {(user.fullName || user.username).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-sm">{user.fullName || user.username}</div>
                        <div className="text-default-400 text-xs mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${getRoleColor(user.roleType)}`}></span>
                      <span className="text-sm font-medium text-default-600">{getRoleName(user.roleType)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">{getStatusBadge(user.status)}</td>
                  <td className="px-6 py-6">
                    <span className="text-sm text-default-500 font-mono">{user.studentId || '-'}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggleStatus(user)}
                        className={`p-2 rounded-lg transition-colors ${user.status === UserStatus.ACTIVE ? 'text-default-400 hover:text-warning-600 hover:bg-warning-50' : 'text-default-400 hover:text-success-600 hover:bg-success-50'}`}
                        title={user.status === UserStatus.ACTIVE ? '冻结用户' : '激活用户'}
                      >
                        {user.status === UserStatus.ACTIVE ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => { setEditingUser(user); setIsFormOpen(true); }}
                        className="p-2 text-default-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteUser(user)}
                        className="p-2 text-default-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="px-8 py-4 border-t border-default-100 flex items-center justify-between">
          <span className="text-sm text-default-500">
            第 {page} 页，共 {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-default-200 rounded-lg text-sm font-medium text-default-600 hover:bg-default-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-default-200 rounded-lg text-sm font-medium text-default-600 hover:bg-default-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default UserManagement;
