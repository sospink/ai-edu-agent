import React, { useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { OverlayPortal } from '@/components/common/PageDialog';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id?: string;
  message: string;
  type: ToastType;
}

interface ToastProps extends ToastData {
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-success-500 text-white',
    error: 'bg-danger-500 text-white',
    info: 'bg-primary-500 text-white',
  };

  const Icon = icons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`pointer-events-auto fixed right-4 top-4 z-[10050] flex max-w-[360px] items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${colors[type]}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// Toast 容器组件，用于管理多个 Toast
interface ToastContainerProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toast, onClose }) => {
  return (
    <OverlayPortal>
      <div className="pointer-events-none fixed inset-0 z-[10050]">
        <AnimatePresence>
          {toast && <Toast message={toast.message} type={toast.type} onClose={onClose} />}
        </AnimatePresence>
      </div>
    </OverlayPortal>
  );
};

// Hook 用于管理 Toast 状态
export const useToast = () => {
  const [toast, setToast] = React.useState<ToastData | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  return useMemo(() => ({
    toast,
    showToast,
    hideToast,
    success,
    error,
    info,
  }), [toast, showToast, hideToast, success, error, info]);
};

export default Toast;
