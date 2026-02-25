import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, Settings, LogOut, Bell, ChevronRight, Command, FolderGit, GraduationCap } from 'lucide-react';
import type { User } from '@/types';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import SystemSettings from './SystemSettings';
import ProjectManagement from './ProjectManagement';
import LearningManagement from './LearningManagement';

type AdminView = 'dashboard' | 'users' | 'settings' | 'projects' | 'learning';

interface NavItem {
  id: AdminView;
  path: string;
  label: string;
  icon: React.ElementType;
  category: '概览' | '教学管理' | '系统管理';
}

interface AdminPanelProps {
  onLogout: () => void;
  currentUser?: User | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { id: 'dashboard', path: '/admin/dashboard', label: '仪表盘', icon: LayoutDashboard, category: '概览' },
    { id: 'projects', path: '/admin/projects', label: '项目管理', icon: FolderGit, category: '教学管理' },
    { id: 'learning', path: '/admin/learning', label: '学习管理', icon: GraduationCap, category: '教学管理' },
    { id: 'users', path: '/admin/users', label: '用户管理', icon: Users, category: '系统管理' },
    { id: 'settings', path: '/admin/settings', label: '系统设置', icon: Settings, category: '系统管理' }
  ];

  // 获取当前激活的视图
  const getActiveView = (): AdminView => {
    const path = location.pathname;
    const item = navItems.find(i => path.startsWith(i.path));
    return item?.id || 'dashboard';
  };

  const activeView = getActiveView();

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
      <aside className="fixed left-0 top-0 w-60 h-screen flex flex-col border-r border-default-200/60 bg-white/95 backdrop-blur-sm z-20">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-default-100/50">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-primary-600/20">
            <Command className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-foreground">Agent EDU</span>
            <span className="text-[9px] font-bold text-default-400 uppercase tracking-widest">Admin Console</span>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          {/* 概览分组 */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-default-400 font-bold px-3 mb-3">概览</div>
            <div className="space-y-1">
              {navItems.filter(i => i.category === '概览').map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleNavClick(item.path)} 
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    activeView === item.id 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
                  }`}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeView === item.id 
                      ? 'text-primary-600' 
                      : 'text-default-400 group-hover:text-default-600'
                  }`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 教学管理分组 */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-default-400 font-bold px-3 mb-3">教学管理</div>
            <div className="space-y-1">
              {navItems.filter(i => i.category === '教学管理').map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleNavClick(item.path)} 
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    activeView === item.id 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
                  }`}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeView === item.id 
                      ? 'text-primary-600' 
                      : 'text-default-400 group-hover:text-default-600'
                  }`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 系统管理分组 */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-default-400 font-bold px-3 mb-3">系统管理</div>
            <div className="space-y-1">
              {navItems.filter(i => i.category === '系统管理').map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleNavClick(item.path)} 
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    activeView === item.id 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
                  }`}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${
                    activeView === item.id 
                      ? 'text-primary-600' 
                      : 'text-default-400 group-hover:text-default-600'
                  }`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* 用户信息和退出 */}
        <div className="p-4 border-t border-default-100/50">
          <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-default-50 border border-default-100">
            <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-xs">
              {currentUser ? (currentUser.fullName || currentUser.username).slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {currentUser?.fullName || currentUser?.username || 'Administrator'}
              </div>
              <div className="text-[10px] text-default-500 truncate">
                {currentUser?.email || 'Super User'}
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-danger-500 hover:bg-danger-50 hover:text-danger-600 transition-all"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 - 添加左边距为侧边栏留出空间 */}
      <main className="ml-60 flex-1 relative flex flex-col min-h-screen">
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
              {navItems.find(i => i.id === activeView)?.label || '控制台'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-default-100 text-default-500 hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>
        
        {/* 页面内容 */}
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="projects" element={<ProjectManagement />} />
              <Route path="learning" element={<LearningManagement />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="settings" element={<SystemSettings />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
