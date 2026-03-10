import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock, User, Cpu, ShieldCheck, Network, Code2, Terminal, Sparkles, ShieldAlert, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth';
import type { User as UserType } from '@/types';

const TypingEffect = ({ words }: { words: string[] }) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const timeout2 = setTimeout(() => setBlink(!blink), 500);
    return () => clearTimeout(timeout2);
  }, [blink]);

  useEffect(() => {
    if (index >= words.length) { setIndex(0); return; }
    if (subIndex === words[index].length + 1 && !reverse) { setTimeout(() => setReverse(true), 2000); return; }
    if (subIndex === 0 && reverse) { setReverse(false); setIndex((prev) => (prev + 1) % words.length); return; }
    const timeout = setTimeout(() => setSubIndex((prev) => prev + (reverse ? -50 : 1)), reverse ? 50 : 100);
    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse, words]);

  return (
    <span className="font-mono text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600 font-bold min-h-[1.5em] inline-block">
      {words[index].substring(0, subIndex)}
      <span className={`${blink ? 'opacity-100' : 'opacity-0'} ml-1 text-primary-500`}>|</span>
    </span>
  );
};

interface LoginPageProps {
  onClose: () => void;
  isAdmin?: boolean;
  onLoginSuccess?: (user: UserType) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onClose, isAdmin = false, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // 加载记住的用户名
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({ username: username.trim(), password });
      
      if (response.success && response.data?.user) {
        const user = response.data.user;
        
        // 管理员登录检查
        if (isAdmin && user.roleType !== 10) {
          setError('该账号没有管理员权限');
          setIsLoading(false);
          return;
        }

        // 学生/教师登录检查（非管理员入口不允许管理员登录）
        if (!isAdmin && user.roleType === 10) {
          setError('管理员请使用管理员入口登录');
          setIsLoading(false);
          return;
        }

        // 检查用户状态
        if (user.status === 2) {
          setError('账号已被冻结，请联系管理员');
          setIsLoading(false);
          return;
        }

        if (user.status === 3) {
          setError('账号已注销');
          setIsLoading(false);
          return;
        }

        // 记住用户名
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }

        // Token 和用户信息已在 authService.login 中保存
        
        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      } else {
        setError(response.error || '登录失败，请检查用户名和密码');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-0 z-50 bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* 左侧面板 */}
      <div className="w-full md:w-[60%] relative overflow-hidden flex flex-col items-center justify-center bg-[#f8fafc] perspective-[2000px]">
        <div className="absolute inset-0 z-0 opacity-50">
          <motion.div animate={{ x: [0, 100, -50, 0], y: [0, -100, 50, 0], scale: [1, 1.2, 0.9, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-200 rounded-full blur-[120px] mix-blend-multiply" />
          <motion.div animate={{ x: [0, -70, 40, 0], y: [0, 80, -60, 0], scale: [1, 1.1, 0.9, 1] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-200 rounded-full blur-[100px] mix-blend-multiply" />
        </div>

        <motion.div animate={{ y: [-15, 15, -15] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[20%] left-[10%] z-10 hidden md:flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-16 h-16 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl flex items-center justify-center shadow-lg"><Network className="w-8 h-8 text-purple-600 drop-shadow-sm" /></div>
          <div className="px-3 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">神经网络</div>
        </motion.div>

        <motion.div animate={{ y: [15, -15, 15] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute bottom-[25%] right-[10%] z-10 hidden md:flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-16 h-16 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl flex items-center justify-center shadow-lg"><Code2 className="w-7 h-7 text-blue-600 drop-shadow-sm" /></div>
          <div className="px-3 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">代码生成</div>
        </motion.div>

        <div className="relative z-20 w-full h-[50vh] flex items-center justify-center transform-style-3d rotate-x-12">
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, type: "spring" }} className="relative z-20 flex items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute w-[400px] h-[400px] border border-slate-200/50 rounded-full" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute w-[280px] h-[280px] border border-dashed border-slate-300/60 rounded-full" />
            <div className={`absolute w-64 h-64 ${isAdmin ? 'bg-slate-800/20' : 'bg-primary-400/10'} rounded-full blur-3xl animate-pulse`} />
            <div className="relative w-40 h-40 bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(59,130,246,0.2)] flex items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/80 via-transparent to-transparent opacity-80 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-16 h-16 bg-gradient-to-br ${isAdmin ? 'from-slate-700 to-slate-900' : 'from-primary-500 to-blue-600'} rounded-2xl flex items-center justify-center shadow-lg text-white mb-1`}>
                  {isAdmin ? <ShieldAlert className="w-8 h-8" /> : <Cpu className="w-8 h-8" />}
                </div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase px-2 py-0.5 rounded-full">{isAdmin ? '系统管理' : '核心引擎'}</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative z-20 mt-[-20px] text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="inline-flex items-center gap-2 mb-3 bg-white/60 backdrop-blur-sm border border-white/60 px-4 py-1.5 rounded-full shadow-sm">
            <Sparkles className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{isAdmin ? '管理员专属通道' : '新一代 AI 实训平台'}</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-4 drop-shadow-sm">
            {isAdmin ? (<>管理<span className="text-transparent bg-clip-text bg-gradient-to-br from-slate-600 to-slate-900">控制台</span></>) : (<>Agent EDU <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary-600 to-violet-600">Lab</span></>)}
          </motion.h1>
          <div className="h-8 flex items-center justify-center">
            <p className="text-lg text-slate-600 font-medium flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="mr-2 text-slate-400">系统状态:</span>
              <TypingEffect words={isAdmin ? ["正在验证权限...", "建立安全连接...", "审计日志已启用"] : ["正在初始化智能体...", "加载知识库...", "连接云端服务..."]} />
            </p>
          </div>
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="w-full md:w-[40%] bg-white/80 backdrop-blur-2xl flex flex-col justify-center items-center p-8 md:p-12 relative z-50 shadow-[-20px_0_60px_rgba(0,0,0,0.03)] border-l border-white/50">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors group border border-slate-100" title="返回首页">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-[1.25rem] bg-gradient-to-br ${isAdmin ? 'from-slate-50 to-slate-200' : 'from-white to-slate-50'} border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6`}>
              {isAdmin ? <ShieldAlert className="w-7 h-7 text-slate-700" /> : <Lock className="w-7 h-7 text-slate-700" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{isAdmin ? '管理员登录' : '欢迎回来'}</h2>
            <p className="text-slate-500 mt-2 text-sm font-medium">{isAdmin ? '系统管理员安全访问通道' : '请验证身份以进入实验室'}</p>
          </div>

          <div className="min-h-[250px] md:min-h-[300px]">
            <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-medium text-center"
                >
                  {error}
                </motion.div>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">{isAdmin ? '管理员账号' : '学号 / 工号'}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" /></div>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isAdmin ? "admin" : "请输入学号或工号"} 
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-mono text-sm shadow-sm" 
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">{isAdmin ? '安全密钥' : '登录密码'}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" /></div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-mono text-sm shadow-sm" 
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border ${rememberMe ? 'bg-primary-500 border-primary-500' : 'border-slate-300 group-hover:border-primary-500'} bg-white transition-colors flex items-center justify-center`}>
                    {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">记住我</span>
                </label>
                <a href="#" className="text-xs font-bold text-primary-600 hover:text-primary-700">忘记密码？</a>
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full py-4 ${isAdmin ? 'bg-slate-800 hover:bg-slate-900' : 'bg-primary-600 hover:bg-primary-700'} text-white rounded-xl font-bold shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group mt-6 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    {isAdmin ? '进入控制台' : '进入实验室'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.form>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {isAdmin ? '需要管理员权限' : '加密连接 · 256位SSL安全'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LoginPage;
