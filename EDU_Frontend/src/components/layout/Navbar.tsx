import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import AILogoGif from '@/images/AI logo Foriday.gif';
import type { User, ViewState } from '@/types';
import { RoleType } from '@/types';

interface NavbarProps {
  onLoginClick?: () => void;
  onNavClick?: (view: ViewState) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLoginClick, onNavClick, currentUser, onLogout }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const navItems = [
    { view: 'study' as ViewState, path: '/study', label: '学习中心' },
    { view: 'projects' as ViewState, path: '/projects', label: '项目实战' },
    { view: 'ai-square' as ViewState, path: '/ai-square', label: 'AI 广场' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (view: ViewState) => (event: React.MouseEvent) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    setShowUserMenu(false);
    onNavClick?.(view);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleName = (roleType: RoleType) => {
    switch (roleType) {
      case RoleType.ADMIN:
        return '管理员';
      case RoleType.TEACHER:
        return '教师';
      case RoleType.STUDENT:
        return '学生';
      default:
        return '用户';
    }
  };

  const getUserInitials = (user: User) => {
    if (user.fullName) return user.fullName.slice(0, 2);
    return user.username.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2">
      <motion.header
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
      <nav className="relative flex items-center justify-between rounded-full border border-slate-200/70 bg-white/72 px-3 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:px-4">
        <button type="button" onClick={handleNav('home')} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90">
            <img src={AILogoGif} alt="Agent EDU" className="h-6 w-6 object-contain" />
          </div>
          <span className="hidden bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-sm font-semibold tracking-tight text-transparent sm:block">
            Agent EDU Lab
          </span>
        </button>

        <div className="relative hidden items-center gap-1 md:flex">
          {navItems.map((item, index) => {
            const active = isActive(item.path);
            const showBg = hoveredIndex === index || (hoveredIndex === null && active);

            return (
              <button type="button"
                key={item.view}
                onClick={handleNav(item.view)}
                className={`relative px-4 py-2 text-sm transition-colors ${
                  active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {showBg && (
                  <motion.div
                    layoutId="navbar-hover"
                    className="absolute inset-0 rounded-full border border-slate-200/70 bg-white/90 shadow-sm"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex" ref={menuRef}>
          {currentUser ? (
            <>
              <button type="button"
                onClick={() => {
                  setShowUserMenu((prev) => !prev);
                  setMobileMenuOpen(false);
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur-md transition ${
                  showUserMenu
                    ? 'border-primary-100/70 bg-white/92 text-slate-900'
                    : 'border-slate-200/45 bg-slate-50/80 hover:border-slate-200/60 hover:bg-white/90 hover:text-slate-900'
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">
                  {getUserInitials(currentUser)}
                </span>
                <span className="max-w-[120px] truncate text-xs font-medium">{currentUser.fullName || currentUser.username}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200/50 bg-[linear-gradient(165deg,rgba(255,255,255,0.95),rgba(248,250,252,0.93))] p-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)] ring-1 ring-white/55 backdrop-blur-xl"
                  >
                    <div className="mb-2 rounded-xl border border-slate-200/55 bg-gradient-to-b from-white/95 to-slate-50/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      <div className="truncate text-sm font-medium text-slate-800">{currentUser.fullName || currentUser.username}</div>
                      <div className="truncate text-xs text-slate-500">{currentUser.email}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{getRoleName(currentUser.roleType)}</div>
                    </div>
                    <button type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavClick?.('profile');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
                    >
                      <UserIcon className="h-4 w-4" />
                      个人中心
                    </button>
                    <button type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout?.();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50/75"
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <>
              <button type="button"
                onClick={onLoginClick}
                className="rounded-full px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white hover:text-slate-900"
              >
                登录
              </button>
              <button type="button"
                onClick={() => onNavClick?.('study')}
                className="shimmer-btn rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                开始学习
              </button>
            </>
          )}
        </div>

        <button type="button"
          className="p-2 text-slate-500 transition hover:text-slate-900 md:hidden"
          onClick={() => {
            setMobileMenuOpen((prev) => !prev);
            setShowUserMenu(false);
          }}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200/80 bg-white/96 p-4 shadow-xl backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button type="button"
                  key={item.view}
                  onClick={handleNav(item.view)}
                  className={`rounded-lg px-4 py-3 text-sm transition-colors ${
                    isActive(item.path)
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <hr className="my-2 border-slate-200" />

              {currentUser ? (
                <>
                  <button type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavClick?.('profile');
                    }}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <UserIcon className="h-4 w-4" />
                    个人中心
                  </button>
                  <button type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout?.();
                    }}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <button type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLoginClick?.();
                    }}
                    className="rounded-lg px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    登录
                  </button>
                  <button type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavClick?.('study');
                    }}
                    className="shimmer-btn rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    开始学习
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.header>
    </div>
  );
};

export default Navbar;
