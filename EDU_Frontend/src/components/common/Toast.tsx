import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

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
      className={`fixed top-4 right-4 z-[110] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${colors[type]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{message}</span>
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
    <AnimatePresence>
      {toast && <Toast message={toast.message} type={toast.type} onClose={onClose} />}
    </AnimatePresence>
  );
};

// Hook 用于管理 Toast 状态
export const useToast = () => {
  const [toast, setToast] = React.useState<ToastData | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const success = (message: string) => showToast(message, 'success');
  const error = (message: string) => showToast(message, 'error');
  const info = (message: string) => showToast(message, 'info');

  return {
    toast,
    showToast,
    hideToast,
    success,
    error,
    info,
  };
};

export default Toast;
