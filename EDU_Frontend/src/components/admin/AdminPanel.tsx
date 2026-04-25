import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, Settings, LogOut, Bell, ChevronLeft, ChevronRight, Command, ShieldCheck, School2, FlaskConical, ClipboardList } from 'lucide-react';
import type { User } from '@/types';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import SystemSettings from './SystemSettings';
import RBACPoliciesPage from './RBACPoliciesPage';
import AdminClassesPage from './AdminClassesPage';
import AdminContentGovernancePage from './AdminContentGovernancePage';
import AdminAssignmentsPage from './AdminAssignmentsPage';

type AdminView = 'dashboard' | 'users' | 'classes' | 'assignments' | 'content-governance' | 'settings' | 'rbac';

interface NavItem {
  id: AdminView;
  path: string;
  label: string;
  icon: React.ElementType;
  category: '概览' | '系统管理';
}

interface AdminPanelProps {
  onLogout: () => void;
  currentUser?: User | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { id: 'dashboard', path: '/admin/dashboard', label: '仪表盘', icon: LayoutDashboard, category: '概览' },
    { id: 'classes', path: '/admin/classes', label: '班级组织', icon: School2, category: '系统管理' },
    { id: 'assignments', path: '/admin/assignments', label: '作业观测', icon: ClipboardList, category: '系统管理' },
    { id: 'content-governance', path: '/admin/content-governance', label: '内容治理', icon: FlaskConical, category: '系统管理' },
    { id: 'users', path: '/admin/users', label: '用户管理', icon: Users, category: '系统管理' },
    { id: 'settings', path: '/admin/settings', label: '系统设置', icon: Settings, category: '系统管理' },
    { id: 'rbac', path: '/admin/rbac', label: '权限矩阵', icon: ShieldCheck, category: '系统管理' }
  ];

  // 获取当前激活的视图
  const getActiveView = (): AdminView => {
    const path = location.pathname;
    const item = navItems.find(i => path.startsWith(i.path));
    return item?.id || 'dashboard';
  };

  const activeView = getActiveView();
  const sidebarWidthClass = sidebarCollapsed ? 'w-20' : 'w-60';
  const mainOffsetClass = sidebarCollapsed ? 'ml-20' : 'ml-60';
  const activeItemLabel = navItems.find(i => i.id === activeView)?.label || '控制台';
  const displayName = currentUser?.fullName || currentUser?.username || 'Administrator';
  const displayEmail = currentUser?.email || 'Super User';
  const initials = displayName.slice(0, 2).toUpperCase();

  // 如果访问 /admin，重定向到 /admin/dashboard
  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary-100 selection:text-primary-700">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary-100/40 rounded-full blur-[120px] mix-blend-multiply opacity-70" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary-100/40 rounded-full blur-[120px] mix-blend-multiply opacity-70" />
      </div>

      {/* 侧边栏 - 固定定位 */}
      <aside className={`fixed left-0 top-0 ${sidebarWidthClass} h-screen flex flex-col border-r border-default-200/60 bg-white/95 backdrop-blur-sm z-20 transition-[width] duration-300`}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-default-100/50 ${sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20 ${sidebarCollapsed ? '' : 'mr-3'}`}>
              <Command className="w-4 h-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-foreground">Agent EDU</span>
                <span className="text-[9px] font-bold text-default-400 uppercase tracking-widest">Admin Console</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(value => !value)}
            className={`${sidebarCollapsed ? 'absolute -right-3 top-5 bg-white shadow-md' : ''} flex h-7 w-7 items-center justify-center rounded-lg text-default-500 transition hover:bg-default-100 hover:text-foreground`}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className={`flex-1 py-6 overflow-y-auto ${sidebarCollapsed ? 'px-3 space-y-3' : 'px-4 space-y-6'}`}>
          {/* 概览分组 */}
          <div>
            {!sidebarCollapsed && <div className="text-[10px] uppercase tracking-widest text-default-400 font-bold px-3 mb-3">概览</div>}
            <div className="space-y-1">
              {navItems.filter(i => i.category === '概览').map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleNavClick(item.path)} 
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 group ${
                    sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
                  } ${
                    activeView === item.id 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeView === item.id 
                      ? 'text-primary-600' 
                      : 'text-default-400 group-hover:text-default-600'
                  }`} />
                  {!sidebarCollapsed && item.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 系统管理分组 */}
          <div>
            {!sidebarCollapsed && <div className="text-[10px] uppercase tracking-widest text-default-400 font-bold px-3 mb-3">系统管理</div>}
            <div className="space-y-1">
              {navItems.filter(i => i.category === '系统管理').map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleNavClick(item.path)} 
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 group ${
                    sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
                  } ${
                    activeView === item.id 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeView === item.id 
                      ? 'text-primary-600' 
                      : 'text-default-400 group-hover:text-default-600'
                  }`} />
                  {!sidebarCollapsed && item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* 主内容区 - 添加左边距为侧边栏留出空间 */}
      <main className={`${mainOffsetClass} flex-1 relative flex flex-col min-h-screen transition-[margin] duration-300`}>
        {/* 顶部导航栏 */}
        <header className="h-16 sticky top-0 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-default-200/60 z-10">
          <div className="flex items-center text-sm font-medium text-default-500">
            <div 
              className="flex items-center hover:text-foreground transition-colors cursor-pointer"
              onClick={() => navigate('/admin/dashboard')}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              控制台
            </div>
            <ChevronRight className="w-4 h-4 mx-2 text-default-300" />
            <span className="px-2 py-1 rounded-md bg-default-100/50 text-foreground">
              {activeItemLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-default-100 text-default-500 hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-px bg-default-200" />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-xs">
                {initials}
              </div>
              <div className="hidden min-w-0 text-right md:block">
                <div className="max-w-[150px] truncate text-sm font-semibold text-foreground">{displayName}</div>
                <div className="max-w-[150px] truncate text-[10px] text-default-500">{displayEmail}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger-500 transition hover:bg-danger-50 hover:text-danger-600"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">退出登录</span>
            </button>
          </div>
        </header>
        
        {/* 页面内容 */}
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="classes" element={<AdminClassesPage />} />
              <Route path="assignments" element={<AdminAssignmentsPage />} />
              <Route path="content-governance" element={<AdminContentGovernancePage />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="settings" element={<SystemSettings />} />
              <Route path="rbac" element={<RBACPoliciesPage />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
