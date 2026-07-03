import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Code2, Cpu, GraduationCap, Loader2, Lock, Network, ShieldAlert, ShieldCheck, Sparkles, Terminal, User, X } from 'lucide-react';
import { authService } from '@/services/auth';
import AILogoGif from '@/images/AI logo Foriday.gif';
import { RoleType, UserStatus, type User as UserType } from '@/types';
import { useTranslation } from 'react-i18next';

type LoginMode = 'student' | 'staff';
type StaffLoginTab = 'teacher' | 'admin';

interface LoginPageProps {
  onClose: () => void;
  mode?: LoginMode;
  isAdmin?: boolean;
  defaultStaffTab?: StaffLoginTab;
  onLoginSuccess?: (user: UserType, context?: { loginMode: LoginMode; staffTab?: StaffLoginTab }) => void;
}

const TypingEffect = ({ words }: { words: string[] }) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setBlink((value) => !value), 500);
    return () => clearTimeout(timeout);
  }, [blink]);

  useEffect(() => {
    if (index >= words.length) {
      setIndex(0);
      return;
    }
    if (subIndex === words[index].length + 1 && !reverse) {
      const timeout = setTimeout(() => setReverse(true), 2000);
      return () => clearTimeout(timeout);
    }
    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }
    const timeout = setTimeout(() => setSubIndex((prev) => prev + (reverse ? -1 : 1)), reverse ? 50 : 100);
    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse, words]);

  return (
    <span className="inline-block min-h-[1.5em] bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text font-mono font-bold text-transparent">
      {words[index].substring(0, subIndex)}
      <span className={`${blink ? 'opacity-100' : 'opacity-0'} ml-1 text-primary-500`}>|</span>
    </span>
  );
};

const LEGACY_REMEMBERED_USERNAME_KEY = 'rememberedUsername';
const REMEMBERED_USERNAME_KEY_PREFIX = 'agent-edu-remembered-username';

const getRememberContext = (loginMode: LoginMode, staffTab: StaffLoginTab): string => {
  if (loginMode === 'student') return 'student';
  return staffTab;
};

const getRememberedUsernameKey = (loginMode: LoginMode, staffTab: StaffLoginTab): string => {
  return `${REMEMBERED_USERNAME_KEY_PREFIX}:${getRememberContext(loginMode, staffTab)}`;
};

const getSavedUsername = (loginMode: LoginMode, staffTab: StaffLoginTab) => {
  if (typeof window === 'undefined') return '';
  const scopedUsername = localStorage.getItem(getRememberedUsernameKey(loginMode, staffTab)) || '';
  if (scopedUsername) return scopedUsername;

  // 兼容旧版本全局记住账号；读取一次后会在登录成功或取消勾选时迁移/清理。
  return localStorage.getItem(LEGACY_REMEMBERED_USERNAME_KEY) || '';
};

const clearRememberedUsername = (loginMode: LoginMode, staffTab: StaffLoginTab) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getRememberedUsernameKey(loginMode, staffTab));
  localStorage.removeItem(LEGACY_REMEMBERED_USERNAME_KEY);
};

const saveRememberedUsername = (loginMode: LoginMode, staffTab: StaffLoginTab, rememberMe: boolean, username: string) => {
  if (typeof window === 'undefined') return;
  if (rememberMe) {
    localStorage.setItem(getRememberedUsernameKey(loginMode, staffTab), username);
    localStorage.removeItem(LEGACY_REMEMBERED_USERNAME_KEY);
    return;
  }
  clearRememberedUsername(loginMode, staffTab);
};

const LoginPage: React.FC<LoginPageProps> = ({
  onClose,
  mode,
  isAdmin = false,
  defaultStaffTab,
  onLoginSuccess,
}) => {
  const { t } = useTranslation('auth');
  const loginMode: LoginMode = mode || (isAdmin ? 'staff' : 'student');
  const initialStaffTab = defaultStaffTab || (isAdmin ? 'admin' : 'teacher');
  const [staffTab, setStaffTab] = useState<StaffLoginTab>(initialStaffTab);
  const [username, setUsername] = useState(() => getSavedUsername(loginMode, initialStaffTab));
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(getSavedUsername(loginMode, initialStaffTab)));

  useEffect(() => {
    if (loginMode !== 'staff') return;
    setStaffTab(defaultStaffTab || (isAdmin ? 'admin' : 'teacher'));
  }, [defaultStaffTab, isAdmin, loginMode]);

  useEffect(() => {
    const savedUsername = getSavedUsername(loginMode, staffTab);
    setUsername(savedUsername);
    setRememberMe(Boolean(savedUsername));
    setPassword('');
  }, [loginMode, staffTab]);

  const validateUser = (user: UserType): string => {
    if (user.status === UserStatus.FROZEN) {
      return t('frozen');
    }

    if (user.status === UserStatus.DELETED) {
      return t('deleted');
    }

    if (loginMode === 'student') {
      return user.roleType === RoleType.STUDENT ? '' : t('useStaffEntry');
    }

    if (staffTab === 'teacher') {
      return user.roleType >= RoleType.TEACHER ? '' : t('teacherForbidden');
    }

    return user.roleType === RoleType.ADMIN ? '' : t('adminForbidden');
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password.trim()) {
      setError(t('required'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({ username: normalizedUsername, password });

      if (!response.success || !response.data?.user || !response.data.token) {
        setError(response.error || t('failed'));
        return;
      }

      const validationError = validateUser(response.data.user);
      if (validationError) {
        setError(validationError);
        return;
      }

      saveRememberedUsername(loginMode, staffTab, rememberMe, normalizedUsername);
      authService.saveSession(response.data);
      onLoginSuccess?.(response.data.user, {
        loginMode,
        staffTab: isStaff ? staffTab : undefined,
      });
    } catch (err) {
      setError(t('network'));
      console.error('登录失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isStaff = loginMode === 'staff';
  const isAdminTab = isStaff && staffTab === 'admin';
  const staffTabMeta: Record<StaffLoginTab, { label: string; title: string; subtitle: string; button: string }> = {
    teacher: { label: t('teacherTab'), title: t('teacherTitle'), subtitle: t('teacherSubtitle'), button: t('teacherAction') },
    admin: { label: t('adminTab'), title: t('adminTitle'), subtitle: t('adminSubtitle'), button: t('adminAction') },
  };
  const staffMeta = staffTabMeta[staffTab];
  const accountLabel = isStaff ? (isAdminTab ? t('adminAccount') : t('teacherAccount')) : t('studentAccount');
  const passwordLabel = isStaff ? (isAdminTab ? t('securityKey') : t('password')) : t('password');
  const accountPlaceholder = isStaff ? t('staffAccountPlaceholder') : t('studentAccountPlaceholder');
  const buttonText = isStaff ? staffMeta.button : t('studentAction');
  const primaryButtonClass = isAdminTab ? 'bg-slate-800 hover:bg-slate-900' : 'bg-primary-600 hover:bg-primary-700';
  const formSpacingClass = isStaff ? 'space-y-5' : 'space-y-4';
  const inputPaddingClass = isStaff ? 'py-4' : 'py-3';
  const buttonPaddingClass = isStaff ? 'py-4' : 'py-3';

  const handleRememberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextRememberMe = event.target.checked;
    setRememberMe(nextRememberMe);
    if (!nextRememberMe) {
      clearRememberedUsername(loginMode, staffTab);
    }
  };

  const loginForm = (
    <motion.form
      initial={{ opacity: 0, x: isStaff ? 20 : 0, y: isStaff ? 0 : 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.3 }}
      className={formSpacingClass}
      onSubmit={handleLogin}
    >
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm font-medium text-rose-600"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-1.5">
        <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{accountLabel}</label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <User className="h-5 w-5 text-slate-300 transition-colors group-focus-within:text-primary-500" />
          </div>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={accountPlaceholder}
            className={`block w-full rounded-xl border border-slate-200 bg-slate-50/50 ${inputPaddingClass} pl-12 pr-4 font-mono text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-300 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:cursor-not-allowed disabled:opacity-70`}
            disabled={isLoading}
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{passwordLabel}</label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Lock className="h-5 w-5 text-slate-300 transition-colors group-focus-within:text-primary-500" />
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('passwordPlaceholder')}
            className={`block w-full rounded-xl border border-slate-200 bg-slate-50/50 ${inputPaddingClass} pl-12 pr-4 font-mono text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-300 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:cursor-not-allowed disabled:opacity-70`}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1 pt-2">
        <label className="group flex cursor-pointer items-center gap-2 rounded-md text-left has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={handleRememberChange}
            disabled={isLoading}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-primary-600 accent-primary-600 focus:ring-2 focus:ring-primary-500/25 disabled:cursor-not-allowed"
          />
          <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">{t('rememberMe')}</span>
        </label>
        <span className="text-xs font-semibold text-slate-400">{t('forgotPassword')}</span>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl ${buttonPaddingClass} font-bold text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 ${primaryButtonClass}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loggingIn')}
          </>
        ) : (
          <>
            {buttonText}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </motion.form>
  );

  if (loginMode === 'student') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 px-4 py-8 backdrop-blur-[2px]"
        onMouseDown={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[420px] rounded-[1.6rem] border border-white/70 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:p-7"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full bg-slate-50 p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={t('closeDialog')}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-primary-500/15 ring-1 ring-slate-100">
              <img src={AILogoGif} alt="Agent EDU" className="h-9 w-9 object-contain" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Agent EDU Lab</h1>
            <p className="mt-2 text-xs font-semibold text-slate-500">{t('studentEntry')}</p>
          </div>

          {loginForm}

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {t('studentOnly')}
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 font-sans md:flex-row"
    >
      <div className="perspective-[2000px] relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#f8fafc] md:w-[60%]">
        <div className="absolute inset-0 z-0 opacity-50">
          <motion.div animate={{ x: [0, 100, -50, 0], y: [0, -100, 50, 0], scale: [1, 1.2, 0.9, 1] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute left-[-10%] top-[-10%] h-[800px] w-[800px] rounded-full bg-blue-200 blur-[120px] mix-blend-multiply" />
          <motion.div animate={{ x: [0, -70, 40, 0], y: [0, 80, -60, 0], scale: [1, 1.1, 0.9, 1] }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-purple-200 blur-[100px] mix-blend-multiply" />
        </div>

        <motion.div animate={{ y: [-15, 15, -15] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="pointer-events-none absolute left-[10%] top-[20%] z-10 hidden flex-col items-center gap-3 md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/60 bg-white/60 shadow-lg backdrop-blur-xl"><Network className="h-8 w-8 text-purple-600 drop-shadow-sm" /></div>
          <div className="rounded-full border border-white/50 bg-white/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-md">{t('neuralNetwork')}</div>
        </motion.div>

        <motion.div animate={{ y: [15, -15, 15] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="pointer-events-none absolute bottom-[25%] right-[10%] z-10 hidden flex-col items-center gap-3 md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/60 bg-white/60 shadow-lg backdrop-blur-xl"><Code2 className="h-7 w-7 text-blue-600 drop-shadow-sm" /></div>
          <div className="rounded-full border border-white/50 bg-white/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-md">{t('codeGeneration')}</div>
        </motion.div>

        <div className="transform-style-3d rotate-x-12 relative z-20 flex h-[50vh] w-full items-center justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, type: 'spring' }} className="relative z-20 flex items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="absolute h-[400px] w-[400px] rounded-full border border-slate-200/50" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute h-[280px] w-[280px] rounded-full border border-dashed border-slate-300/60" />
            <div className={`absolute h-64 w-64 ${isAdminTab ? 'bg-slate-800/20' : 'bg-primary-400/10'} animate-pulse rounded-full blur-3xl`} />
            <div className="group relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/60 shadow-[0_20px_60px_-15px_rgba(59,130,246,0.2)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/80 via-transparent to-transparent opacity-80" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className={`mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${isAdminTab ? 'from-slate-700 to-slate-900' : 'from-primary-500 to-blue-600'} text-white shadow-lg`}>
                  {isAdminTab ? <ShieldAlert className="h-8 w-8" /> : <Cpu className="h-8 w-8" />}
                </div>
                <div className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">{isAdminTab ? t('systemManagement') : t('teacherEngine')}</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative z-20 mt-[-20px] text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-1.5 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3 w-3 fill-yellow-500 text-yellow-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{isAdminTab ? t('adminChannel') : t('teacherChannel')}</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="mb-4 text-5xl font-black tracking-tight text-slate-900 drop-shadow-sm md:text-7xl">
            {isAdminTab ? (<>{t('management')}<span className="bg-gradient-to-br from-slate-600 to-slate-900 bg-clip-text text-transparent">{t('console')}</span></>) : (<>Agent EDU <span className="bg-gradient-to-br from-primary-600 to-violet-600 bg-clip-text text-transparent">Lab</span></>)}
          </motion.h1>
          <div className="flex h-8 items-center justify-center">
            <p className="flex items-center gap-2 text-lg font-medium text-slate-600">
              <Terminal className="h-4 w-4 text-slate-400" />
              <span className="mr-2 text-slate-400">{t('systemStatus')}</span>
              <TypingEffect words={t(isAdminTab ? 'statusAdmin' : 'statusTeacher', { returnObjects: true }) as unknown as string[]} />
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-50 flex w-full flex-col items-center justify-center border-l border-white/50 bg-white/80 p-8 shadow-[-20px_0_60px_rgba(0,0,0,0.03)] backdrop-blur-2xl md:w-[40%] md:p-12">
        <button onClick={onClose} className="group absolute right-8 top-8 rounded-full border border-slate-100 bg-slate-50 p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800" title={t('backHome')}>
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
        </button>

        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-slate-100 bg-gradient-to-br ${isAdminTab ? 'from-slate-50 to-slate-200' : 'from-white to-slate-50'} shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}>
              {isAdminTab ? <ShieldAlert className="h-7 w-7 text-slate-700" /> : <GraduationCap className="h-7 w-7 text-slate-700" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{staffMeta.title}</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">{staffMeta.subtitle}</p>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['teacher', 'admin'] as StaffLoginTab[]).map((tab) => {
              const selected = staffTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setStaffTab(tab);
                    setError('');
                  }}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
                    selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {staffTabMeta[tab].label}
                </button>
              );
            })}
          </div>

          <div className="min-h-[300px]">
            {loginForm}
          </div>

          <div className="mt-8 border-t border-slate-100 pt-8 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {t('roleCheck')}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LoginPage;
