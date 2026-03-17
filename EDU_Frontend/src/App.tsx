import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Background } from '@/components/common/Background';
import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/home/Hero';
import { PainPoints, Solutions } from '@/components/home/Features';
import Ecosystem from '@/components/home/Ecosystem';
import { Curriculum, Platform, LearningModes } from '@/components/home/Curriculum';
import { Scenarios, MarketDemand, ServiceSupport, FinalCTA } from '@/components/home/InfoSections';
import Footer from '@/components/layout/Footer';
import LoginPage from '@/components/auth/LoginPage';
import AdminPanel from '@/components/admin/AdminPanel';
import BackToTop from '@/components/common/BackToTop';
import GuideHub from '@/components/guide/GuideHub';
import { ProfilePage } from '@/components/profile';
import { ProjectList, ProjectDetail } from '@/components/project';
import { SkillList, SkillDetail, LessonPage, LabPage } from '@/components/study';
import { AISquare } from '@/components/ai-square';
import OpenClawPage from '@/components/openclaw/OpenClawPage';
import DocsPage from '@/components/docs/DocsPage';
import { authService } from '@/services/auth';
import type { User } from '@/types';
import type { Project } from '@/types/project';
import type { Skill } from '@/types/skill';

// 懒加载 AgentWidget
const AgentWidget = lazy(() => import('@/components/agent/AgentWidget'));

// 首页组件
const HomePage: React.FC = () => (
  <>
    <Hero />
    <PainPoints />
    <Solutions />
    <Ecosystem />
    <Curriculum />
    <Platform />
    <LearningModes />
    <Scenarios />
    <MarketDemand />
    <ServiceSupport />
    <FinalCTA />
  </>
);

// 学习页面组件
interface StudyPageProps {
  currentUser: User | null;
}

const StudyPage: React.FC<StudyPageProps> = ({ currentUser }) => {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 当路由变化时重置选中的技能
  useEffect(() => {
    setSelectedSkill(null);
  }, [location.pathname]);

  const handleLoginRequired = () => {
    navigate('/login');
  };

  if (selectedSkill) {
    return (
      <SkillDetail 
        skill={selectedSkill} 
        onBack={() => setSelectedSkill(null)}
        currentUser={currentUser}
        onLoginRequired={handleLoginRequired}
      />
    );
  }

  return (
    <SkillList 
      onSkillSelect={(skill) => setSelectedSkill(skill)}
      currentUser={currentUser}
      onLoginRequired={handleLoginRequired}
    />
  );
};

// 项目页面组件
interface ProjectsPageProps {
  currentUser: User | null;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({ currentUser }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 当路由变化时重置选中的项目
  useEffect(() => {
    setSelectedProject(null);
  }, [location.pathname]);

  const handleLoginRequired = () => {
    navigate('/login');
  };

  if (selectedProject) {
    return (
      <ProjectDetail 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        currentUser={currentUser}
        onLoginRequired={handleLoginRequired}
      />
    );
  }

  return (
    <ProjectList 
      onProjectSelect={(project) => setSelectedProject(project)}
      currentUser={currentUser}
      onLoginRequired={handleLoginRequired}
    />
  );
};

// 主布局组件
interface MainLayoutProps {
  children: React.ReactNode;
  currentUser: User | null;
  onLogout: () => void;
  onLoginClick: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentUser, onLogout, onLoginClick }) => {
  const navigate = useNavigate();

  return (
    <div>
      <Background />
      <Navbar 
        onLoginClick={onLoginClick} 
        onNavClick={(view) => {
          switch (view) {
            case 'home':
              navigate('/');
              break;
            case 'study':
              navigate('/study');
              break;
            case 'projects':
              navigate('/projects');
              break;
            case 'ai-square':
              navigate('/ai-square');
              break;
            case 'profile':
              navigate('/profile');
              break;
            case 'docs':
              navigate('/docs');
              break;
            default:
              navigate('/');
          }
        }}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      
      <main className="relative z-10 min-h-[calc(100vh-64px)]">
        {children}
      </main>
      
      <Footer />
      <BackToTop />
      <GuideHub />
      
      {/* 全局 AI 助手 - 聊天模式 */}
      <Suspense fallback={null}>
        <AgentWidget mode="chat" />
      </Suspense>
    </div>
  );
};

// 登录页面包装组件
interface LoginWrapperProps {
  isAdmin?: boolean;
  onLoginSuccess: (user: User) => void;
}

const LoginWrapper: React.FC<LoginWrapperProps> = ({ isAdmin, onLoginSuccess }) => {
  const navigate = useNavigate();

  return (
    <LoginPage 
      isAdmin={isAdmin}
      onClose={() => navigate('/')} 
      onLoginSuccess={onLoginSuccess}
    />
  );
};

// 个人中心页面包装
interface ProfileWrapperProps {
  currentUser: User | null;
  onUserUpdate: (user: User) => void;
}

const ProfileWrapper: React.FC<ProfileWrapperProps> = ({ currentUser, onUserUpdate }) => {
  const navigate = useNavigate();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProfilePage 
      currentUser={currentUser} 
      onClose={() => navigate('/')}
      onUserUpdate={onUserUpdate}
    />
  );
};

// 管理后台路由保护
interface AdminRouteProps {
  currentUser: User | null;
  onLogout: () => void;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ currentUser, onLogout }) => {
  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
  }

  if (currentUser.roleType !== 10) {
    return <Navigate to="/" replace />;
  }

  return <AdminPanel onLogout={onLogout} currentUser={currentUser} />;
};

// 用户端路由保护 - 管理员不能访问用户端页面
interface UserRouteProps {
  currentUser: User | null;
  children: React.ReactNode;
}

const UserRoute: React.FC<UserRouteProps> = ({ currentUser, children }) => {
  // 如果是管理员，重定向到管理后台
  if (currentUser && currentUser.roleType === 10) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

// 应用主组件
const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 检查本地存储的用户信息
    const storedUser = authService.getStoredUser();
    if (storedUser && authService.isLoggedIn()) {
      setCurrentUser(storedUser);
    }
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    // 如果在管理后台，退出后跳转到首页
    if (location.pathname.startsWith('/admin')) {
      navigate('/');
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.roleType === 10) {
      navigate('/admin/dashboard');
    } else {
      navigate('/study');
    }
  };

  const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen font-sans text-foreground overflow-x-hidden bg-background">
      <AnimatePresence mode="sync" initial={false}>
        <Routes location={location}>
          {/* 用户登录 */}
          <Route 
            path="/login" 
            element={<LoginWrapper onLoginSuccess={handleLoginSuccess} />} 
          />
          
          {/* 管理员登录 */}
          <Route 
            path="/admin/login" 
            element={<LoginWrapper isAdmin onLoginSuccess={handleLoginSuccess} />} 
          />
          
          {/* 管理后台路由 */}
          <Route 
            path="/admin/*" 
            element={<AdminRoute currentUser={currentUser} onLogout={handleLogout} />} 
          />
          
          {/* 实训室页面 - 独立页面，无导航栏和Footer */}
          <Route 
            path="/lesson/:lessonId" 
            element={<LessonPage />} 
          />
          
          {/* 实验环境页面 - 独立页面，使用 URL 参数 ?sourceType=course|project&sourceId=xxx */}
          <Route 
            path="/lab" 
            element={<LabPage />} 
          />

          {/* OpenClaw 页面 - 独立页面，无导航栏和Footer，支持子路由 */}
          <Route
            path="/openclaw/*"
            element={<OpenClawPage />}
          />
          
          {/* 文档页面 - 独立页面，自定义导航 */}
          <Route
            path="/docs"
            element={<DocsPage />}
          />
          
          {/* 用户端路由 */}
          <Route 
            path="/*" 
            element={
              <UserRoute currentUser={currentUser}>
                <MainLayout 
                  currentUser={currentUser} 
                  onLogout={handleLogout}
                  onLoginClick={handleLoginClick}
                >
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/study" element={<StudyPage currentUser={currentUser} />} />
                    <Route path="/projects" element={<ProjectsPage currentUser={currentUser} />} />
                    <Route path="/ai-square" element={<AISquare />} />
                    <Route 
                      path="/profile" 
                      element={
                        <ProfileWrapper 
                          currentUser={currentUser} 
                          onUserUpdate={handleUserUpdate}
                        />
                      } 
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MainLayout>
              </UserRoute>
            } 
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
