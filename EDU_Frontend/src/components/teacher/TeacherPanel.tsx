import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, BookOpen, Bot, ClipboardCheck, ClipboardList, FolderGit, GraduationCap, LayoutDashboard, LogOut, ScrollText, ChevronLeft, ChevronRight, School2, Users2 } from 'lucide-react';
import type { User } from '@/types';
import LearningManagement from '@/components/admin/LearningManagement';
import ProjectManagement from '@/components/admin/ProjectManagement';
import TeacherDashboard from './TeacherDashboard';
import TeacherStudentsPage from './TeacherStudentsPage';
import TeacherManualsPage from './TeacherManualsPage';
import TeacherClassesPage from './TeacherClassesPage';
import TeacherAssignmentsPage from './TeacherAssignmentsPage';
import TeacherSubmissionsPage from './TeacherSubmissionsPage';
import TeacherSubmissionDetailPage from './TeacherSubmissionDetailPage';
import TeacherGradesPage from './TeacherGradesPage';
import TeacherAgentObservatoryPage from './TeacherAgentObservatoryPage';

interface TeacherPanelProps {
  currentUser?: User | null;
  onLogout: () => void;
}

const TeacherPanel: React.FC<TeacherPanelProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { id: 'dashboard', path: '/teacher/dashboard', label: '仪表盘', icon: LayoutDashboard },
    { id: 'classes', path: '/teacher/classes', label: '班级管理', icon: Users2 },
    { id: 'assignments', path: '/teacher/assignments', label: '作业任务', icon: ClipboardList },
    { id: 'submissions', path: '/teacher/submissions', label: '批改队列', icon: ClipboardCheck },
    { id: 'grades', path: '/teacher/grades', label: '成绩簿', icon: Award },
    { id: 'agent-observatory', path: '/teacher/agent-observatory', label: 'Agent 观察台', icon: Bot },
    { id: 'courses', path: '/teacher/courses', label: '课程管理', icon: BookOpen },
    { id: 'projects', path: '/teacher/projects', label: '项目管理', icon: FolderGit },
    { id: 'manuals', path: '/teacher/manuals', label: '实训手册', icon: ScrollText },
    { id: 'students', path: '/teacher/students', label: '学生进度', icon: GraduationCap },
  ] as const;

  useEffect(() => {
    if (location.pathname === '/teacher' || location.pathname === '/teacher/') {
      navigate('/teacher/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const active = navItems.find(item => location.pathname.startsWith(item.path))?.id || 'dashboard';
  const sidebarWidthClass = sidebarCollapsed ? 'w-20' : 'w-60';
  const mainOffsetClass = sidebarCollapsed ? 'ml-20' : 'ml-60';
  const displayName = currentUser?.fullName || currentUser?.username || '教师';
  const displayEmail = currentUser?.email || 'teacher@edu.com';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed left-0 top-0 z-20 flex h-screen ${sidebarWidthClass} flex-col border-r border-default-200/60 bg-white/95 backdrop-blur-sm transition-[width] duration-300`}>
        <div className={`relative flex h-16 items-center border-b border-default-100/50 ${sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white ${sidebarCollapsed ? '' : 'mr-3'}`}>
              <School2 className="h-4 w-4" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="font-bold text-foreground">Agent EDU</div>
                <div className="text-[10px] uppercase tracking-widest text-default-400">Teacher Portal</div>
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
        <nav className={`flex-1 py-6 ${sidebarCollapsed ? 'space-y-3 px-3' : 'space-y-1 px-4'}`}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center rounded-lg text-sm font-medium transition ${
                sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
              } ${
                active === item.id ? 'bg-primary-50 text-primary-700' : 'text-default-500 hover:bg-default-100 hover:text-foreground'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4.5 w-4.5" />
              {!sidebarCollapsed && item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className={`${mainOffsetClass} min-h-screen transition-[margin] duration-300`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-default-200/60 bg-white/80 px-8 backdrop-blur-md">
          <div className="flex items-center text-sm text-default-500">
            <span className="font-medium">教务端</span>
            <ChevronRight className="mx-2 h-4 w-4 text-default-300" />
            <span className="rounded-md bg-default-100/60 px-2 py-1 text-foreground">
              {navItems.find(item => item.id === active)?.label || '仪表盘'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-6 w-px bg-default-200" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
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

        <div className="mx-auto max-w-7xl p-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Routes>
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="classes" element={<TeacherClassesPage />} />
              <Route path="assignments" element={<TeacherAssignmentsPage />} />
              <Route path="submissions" element={<TeacherSubmissionsPage />} />
              <Route path="submissions/:id" element={<TeacherSubmissionDetailPage />} />
              <Route path="grades" element={<TeacherGradesPage />} />
              <Route path="agent-observatory" element={<TeacherAgentObservatoryPage />} />
              <Route path="courses" element={<LearningManagement />} />
              <Route path="projects" element={<ProjectManagement />} />
              <Route path="manuals" element={<TeacherManualsPage />} />
              <Route path="students" element={<TeacherStudentsPage />} />
              <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
            </Routes>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default TeacherPanel;
