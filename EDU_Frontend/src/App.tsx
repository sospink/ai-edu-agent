import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
import TeacherPanel from '@/components/teacher/TeacherPanel';
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

const getInitialAuthUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const storedUser = authService.getStoredUser();
  if (storedUser && authService.isLoggedIn()) {
    return storedUser;
  }
  return null;
};

const AuthRestoreFallback: React.FC = () => {
  const { t } = useTranslation('auth');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card-surface rounded-3xl px-8 py-7 text-center">
        <div className="text-base font-semibold text-foreground">{t('restoringTitle')}</div>
        <div className="mt-2 text-sm text-default-500">{t('restoringDesc')}</div>
      </div>
    </div>
  );
};

const isSafeInternalRedirect = (redirect: string | null): redirect is string => {
  return Boolean(redirect && redirect.startsWith('/') && !redirect.startsWith('//'));
};

const isStudentRedirect = (redirect: string) => {
  return !redirect.startsWith('/admin') && !redirect.startsWith('/teacher');
};

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
  onLoginRequired: () => void;
}

const StudyPage: React.FC<StudyPageProps> = ({ currentUser, onLoginRequired }) => {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const location = useLocation();

  // 当路由变化时重置选中的技能
  useEffect(() => {
    setSelectedSkill(null);
  }, [location.pathname]);

  if (selectedSkill) {
    return (
      <SkillDetail
        skill={selectedSkill}
        onBack={() => setSelectedSkill(null)}
        currentUser={currentUser}
        onLoginRequired={onLoginRequired}
      />
    );
  }

  return (
    <SkillList
      onSkillSelect={(skill) => setSelectedSkill(skill)}
      currentUser={currentUser}
      onLoginRequired={onLoginRequired}
    />
  );
};

// 项目页面组件
interface ProjectsPageProps {
  currentUser: User | null;
  onLoginRequired: () => void;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({ currentUser, onLoginRequired }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const location = useLocation();

  // 当路由变化时重置选中的项目
  useEffect(() => {
    setSelectedProject(null);
  }, [location.pathname]);

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        currentUser={currentUser}
        onLoginRequired={onLoginRequired}
      />
    );
  }

  return (
    <ProjectList
      onProjectSelect={(project) => setSelectedProject(project)}
      currentUser={currentUser}
      onLoginRequired={onLoginRequired}
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
            case 'teacher':
              navigate('/teacher/dashboard');
              break;
            case 'admin':
              navigate('/admin/dashboard');
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
  onLoginSuccess: (user: User) => void;
}

const LoginWrapper: React.FC<LoginWrapperProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect');
  const defaultStaffTab = redirect?.startsWith('/teacher') ? 'teacher' : 'admin';

  return (
    <LoginPage
      mode="staff"
      defaultStaffTab={defaultStaffTab}
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
    return <Navigate to="/login?redirect=/profile" replace />;
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
  isAuthHydrated: boolean;
  onLogout: () => void;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ currentUser, isAuthHydrated, onLogout }) => {
  const location = useLocation();

  if (!isAuthHydrated && !currentUser) {
    return <AuthRestoreFallback />;
  }

  if (!currentUser) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    const redirect = target.startsWith('/admin/login') ? '/admin/dashboard' : target;
    return <Navigate to={`/admin/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (currentUser.roleType !== 10) {
    return <Navigate to="/" replace />;
  }

  return <AdminPanel onLogout={onLogout} currentUser={currentUser} />;
};

interface TeacherRouteProps {
  currentUser: User | null;
  isAuthHydrated: boolean;
  onLogout: () => void;
}

const TeacherRoute: React.FC<TeacherRouteProps> = ({ currentUser, isAuthHydrated, onLogout }) => {
  const location = useLocation();

  if (!isAuthHydrated && !currentUser) {
    return <AuthRestoreFallback />;
  }

  if (!currentUser) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    const redirect = target.startsWith('/teacher') ? target : '/teacher/dashboard';
    return <Navigate to={`/admin/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (currentUser.roleType < 2) {
    return <Navigate to="/study" replace />;
  }

  return <TeacherPanel onLogout={onLogout} currentUser={currentUser} />;
};

// 应用主组件
const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getInitialAuthUser());
  const [isAuthHydrated, setIsAuthHydrated] = useState(false);
  const [studentLoginOpen, setStudentLoginOpen] = useState(false);
  const [studentLoginRedirect, setStudentLoginRedirect] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    if (storedUser && authService.isLoggedIn()) {
      setCurrentUser(storedUser);
      void authService.getCurrentUser().then((response) => {
        if (response.success && response.data) {
          setCurrentUser(response.data);
          localStorage.setItem('currentUser', JSON.stringify(response.data));
        }
      });
    } else {
      setCurrentUser(null);
    }
    setIsAuthHydrated(true);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/login') return;

    const redirect = new URLSearchParams(location.search).get('redirect');
    if (currentUser) {
      if (isSafeInternalRedirect(redirect) && isStudentRedirect(redirect)) {
        navigate(redirect, { replace: true });
        return;
      }
      navigate('/study', { replace: true });
      return;
    }

    setStudentLoginRedirect(isSafeInternalRedirect(redirect) && isStudentRedirect(redirect) ? redirect : null);
    setStudentLoginOpen(true);
  }, [currentUser, location.pathname, location.search, navigate]);

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/teacher')) {
      navigate('/');
    }
  };

  const handleStaffLoginSuccess = (user: User, context?: { loginMode: 'student' | 'staff'; staffTab?: 'teacher' | 'admin' }) => {
    setCurrentUser(user);
    const redirect = new URLSearchParams(location.search).get('redirect');

    if (
      user.roleType === 10 &&
      context?.staffTab === 'admin' &&
      isSafeInternalRedirect(redirect) &&
      redirect.startsWith('/admin')
    ) {
      navigate(redirect, { replace: true });
      return;
    }

    if (
      user.roleType === 10 &&
      context?.staffTab === 'teacher' &&
      isSafeInternalRedirect(redirect) &&
      redirect.startsWith('/teacher')
    ) {
      navigate(redirect, { replace: true });
      return;
    }

    if (
      user.roleType >= 2 &&
      user.roleType !== 10 &&
      isSafeInternalRedirect(redirect) &&
      redirect.startsWith('/teacher')
    ) {
      navigate(redirect, { replace: true });
      return;
    }

    if (user.roleType === 10) {
      navigate('/admin/dashboard', { replace: true });
    } else if (user.roleType >= 2) {
      navigate('/teacher/dashboard', { replace: true });
    } else {
      navigate('/study', { replace: true });
    }
  };

  const openStudentLogin = useCallback((redirect?: string | null) => {
    const safeRedirect = isSafeInternalRedirect(redirect || null) && isStudentRedirect(redirect || '') ? redirect || null : null;

    if (currentUser) {
      if (safeRedirect) {
        navigate(safeRedirect);
      }
      return;
    }

    setStudentLoginRedirect(safeRedirect);
    setStudentLoginOpen(true);
  }, [currentUser, navigate]);

  const openStudentLoginForCurrentPage = useCallback(() => {
    openStudentLogin(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, openStudentLogin]);

  const closeStudentLogin = () => {
    setStudentLoginOpen(false);
    setStudentLoginRedirect(null);
    if (location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  };

  const handleStudentLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setStudentLoginOpen(false);

    if (studentLoginRedirect) {
      const target = studentLoginRedirect;
      setStudentLoginRedirect(null);
      navigate(target, { replace: true });
      return;
    }

    setStudentLoginRedirect(null);
    if (location.pathname === '/login') {
      navigate('/study', { replace: true });
    }
  };

  const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLoginClick = () => {
    openStudentLogin();
  };

  return (
    <div className="min-h-screen font-sans text-foreground overflow-x-hidden bg-background">
      <AnimatePresence mode="sync" initial={false}>
        <Routes location={location}>
          {/* 用户登录 */}
          <Route
            path="/login"
            element={
              <MainLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onLoginClick={handleLoginClick}
              >
                <HomePage />
              </MainLayout>
            }
          />

          {/* 教务/管理员统一登录 */}
          <Route
            path="/admin/login"
            element={<LoginWrapper onLoginSuccess={handleStaffLoginSuccess} />}
          />

          {/* 管理后台路由 */}
          <Route
            path="/admin/*"
            element={<AdminRoute currentUser={currentUser} isAuthHydrated={isAuthHydrated} onLogout={handleLogout} />}
          />

          <Route
            path="/teacher/*"
            element={<TeacherRoute currentUser={currentUser} isAuthHydrated={isAuthHydrated} onLogout={handleLogout} />}
          />

          {/* 实训室页面 - 独立页面，无导航栏和Footer */}
          <Route
            path="/lesson/:lessonId"
            element={<LessonPage />}
          />

          {/* 实验环境页面 - 独立页面，使用 URL 参数 ?sourceType=course|project&sourceId=xxx */}
          <Route
            path="/lab"
            element={<LabPage onLoginRequired={openStudentLoginForCurrentPage} />}
          />

          {/* OpenClaw 页面 - 独立页面，无导航栏和Footer，支持子路由 */}
          <Route
            path="/openclaw/*"
            element={<OpenClawPage onLoginRequired={openStudentLoginForCurrentPage} />}
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
              <MainLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onLoginClick={handleLoginClick}
              >
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/study" element={<StudyPage currentUser={currentUser} onLoginRequired={() => openStudentLogin('/study')} />} />
                  <Route path="/projects" element={<ProjectsPage currentUser={currentUser} onLoginRequired={() => openStudentLogin('/projects')} />} />
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
            }
          />
        </Routes>
      </AnimatePresence>
      <AnimatePresence>
        {studentLoginOpen && (
          <LoginPage
            mode="student"
            onClose={closeStudentLogin}
            onLoginSuccess={handleStudentLoginSuccess}
          />
        )}
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
