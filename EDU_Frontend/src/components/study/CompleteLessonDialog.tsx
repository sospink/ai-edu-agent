import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Clock, Zap, X } from 'lucide-react';

interface CompleteLessonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lessonName: string;
  earnedXP: number;
  actionText?: string;
  /** 完成耗时文本（可选） */
  duration?: string;
  /** 准确率/评分（可选，0-100） */
  accuracy?: number;
}

const CompleteLessonDialog: React.FC<CompleteLessonDialogProps> = ({
  isOpen,
  onClose,
  lessonName,
  earnedXP,
  actionText = '返回项目',
  duration = '—',
  accuracy = 100,
}) => {
  const [animateContent, setAnimateContent] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimateContent(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateContent(false);
    }
  }, [isOpen]);

  // ESC 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 - 毛玻璃 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[4px] z-[100]"
          />

          {/* Dialog 容器 */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-6">
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.96, opacity: 0, y: 32 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 32 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200/60 overflow-hidden pointer-events-auto"
            >
              {/* 核心指标区域 */}
              <div className="px-8 pt-12 pb-6 text-center">
                <div className={`flex flex-col items-center transition-all duration-700 delay-100 ${animateContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-[#1677FF]" />
                    <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400">
                      评估结果
                    </span>
                  </div>

                  <div className="relative inline-flex items-baseline gap-1">
                    <h1 className="text-6xl font-extrabold text-slate-900 tracking-tighter tabular-nums">
                      {accuracy}
                    </h1>
                    <span className="text-2xl font-bold text-slate-400 -ml-1">%</span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {lessonName}
                  </p>
                </div>
              </div>

              {/* 元数据栅格 */}
              <div className="px-8 pb-8 space-y-6">
                <div className={`grid grid-cols-2 gap-px bg-slate-100 rounded-xl border border-slate-100 overflow-hidden transition-all duration-700 delay-200 ${animateContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  {/* 用时 */}
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">训练耗时</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">{duration}</div>
                  </div>

                  {/* 经验增长 */}
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">经验增长</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">+{earnedXP} XP</div>
                  </div>
                </div>

                {/* 底部分隔线 */}
                <div className={`flex items-center justify-center gap-2 transition-all duration-700 delay-300 ${animateContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-medium text-slate-400 px-2 italic">恭喜完成实验 🎉</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* 按钮动作组 */}
                <div className={`flex flex-col gap-3 transition-all duration-700 delay-[400ms] ${animateContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <button
                    onClick={onClose}
                    className="relative inline-flex items-center justify-center w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200 bg-[#1677FF] text-white hover:bg-[#0057D9] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(22,119,255,0.2)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1677FF]"
                  >
                    {actionText}
                  </button>
                </div>
              </div>

              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all duration-200"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CompleteLessonDialog;
