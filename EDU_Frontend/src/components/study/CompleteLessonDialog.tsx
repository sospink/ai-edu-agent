import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Zap, Award } from 'lucide-react';

interface CompleteLessonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lessonName: string;
  earnedXP: number;
}

const CompleteLessonDialog: React.FC<CompleteLessonDialogProps> = ({
  isOpen,
  onClose,
  lessonName,
  earnedXP,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Dialog 内容 */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden pointer-events-auto"
            >
              {/* 顶部装饰 */}
              <div className="relative h-32 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 overflow-hidden">
                {/* 动画背景 */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl animate-pulse delay-300"></div>
                </div>
                
                {/* 成功图标 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </motion.div>
                </div>

                {/* 关闭按钮 */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 内容区域 */}
              <div className="p-8 text-center">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-slate-900 mb-2"
                >
                  恭喜完成实验
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-slate-600 mb-6"
                >
                  {lessonName}
                </motion.p>

                {/* 经验值奖励 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 mb-6"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-medium text-amber-700 mb-0.5">获得经验值</div>
                    <div className="text-2xl font-bold text-amber-600">+{earnedXP} XP</div>
                  </div>
                </motion.div>

                {/* 成就提示 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6"
                >
                  <Award className="w-4 h-4 text-purple-500" />
                  <span>继续学习，解锁更多成就</span>
                </motion.div>

                {/* 按钮 */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={onClose}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                >
                  继续学习
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CompleteLessonDialog;
