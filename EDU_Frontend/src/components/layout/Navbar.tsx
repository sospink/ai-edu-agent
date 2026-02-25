import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import AILogoGif from '@/images/AI logo Foriday.gif';
import type { ViewState, User } from '@/types';
import { RoleType } from '@/types';

interface NavbarProps {
  onLoginClick?: () => void;
  onNavClick?: (view: ViewState) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLoginClick, onNavClick, currentUser, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const handleNav = (view: ViewState) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavClick) {
      onNavClick(view);
    }
  };

  // 根据当前路由判断是否激活
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // 点击外部关闭菜单
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
      case RoleType.ADMIN: return '管理员';
      case RoleType.TEACHER: return '教师';
      case RoleType.STUDENT: return '学生';
      default: return '用户';
    }
  };

  const getUserInitials = (user: User) => {
    if (user.fullName) {
      return user.fullName.slice(0, 2);
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  const navLinks = [
    { view: 'study' as ViewState, path: '/study', label: '学习' },
    { view: 'projects' as ViewState, path: '/projects', label: '项目' },
    { view: 'ai-square' as ViewState, path: '/ai-square', label: 'AI广场' },
  ];

  return (
    <nav className="w-full h-16 border-b border-default-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 transition-all duration-300">
      {/* Brand Logo */}
      <div className="flex items-center gap-2 cursor-pointer group" onClick={handleNav('home')}>
        <img src={AILogoGif} alt="Agent EDU" className="w-8 h-8 object-contain group-hover:scale-105 transition-transform" />
        <span className="font-bold text-xl tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-default-600">
          Agent EDU Lab
        </span>
      </div>

      {/* Center Navigation Menu */}
      <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        {navLinks.map((link) => (
          <a 
            key={link.view}
            href={link.path} 
            onClick={handleNav(link.view)} 
            className={`text-sm font-medium transition-colors ${
              isActive(link.path) 
                ? 'text-primary-600' 
                : 'text-default-600 hover:text-primary-600'
            }`}
          >
            {link.label}
          </a>
        ))}
      </div>
      
      {/* Right Action Button */}
      <div>
        {currentUser ? (
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">
                {getUserInitials(currentUser)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-slate-800">{currentUser.fullName || currentUser.username}</div>
                <div className="text-xs text-slate-500">{getRoleName(currentUser.roleType)}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-medium text-slate-800">{currentUser.fullName || currentUser.username}</div>
                  <div className="text-xs text-slate-500">{currentUser.email}</div>
                </div>
                <div className="py-1">
                  <button 
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavClick?.('profile');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <UserIcon className="w-4 h-4" />
                    个人中心
                  </button>
                  <button 
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={onLoginClick}
            className="bg-foreground text-background hover:bg-default-800 font-medium text-sm py-2 px-6 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            登录
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
