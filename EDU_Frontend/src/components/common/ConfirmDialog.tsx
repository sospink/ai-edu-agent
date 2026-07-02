import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useBodyScrollLock } from '@/components/common/bodyScrollLock';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('common');
  const resolvedConfirmText = confirmText || t('actions.confirm');
  const resolvedCancelText = cancelText || t('actions.cancel');
  useBodyScrollLock(isOpen);

  const typeStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
    },
    warning: {
      icon: 'bg-amber-100 text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
    },
    info: {
      icon: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
    },
  };

  const styles = typeStyles[type];

  if (!isOpen) return null;

  // 使用 Portal 渲染到 body，确保在最顶层
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop + Dialog Container */}
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10000 }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onCancel}
            />
            
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md mx-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                      <p className="text-sm text-slate-500 mt-1">{message}</p>
                    </div>
                    <button
                      onClick={onCancel}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    onClick={onCancel}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
              {resolvedCancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${styles.button}`}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {resolvedConfirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Hook for managing confirm dialog state
export const useConfirmDialog = () => {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {},
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }) => {
    setState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'danger',
      onConfirm: options.onConfirm,
    });
  };

  const hideConfirm = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    state.onConfirm();
    hideConfirm();
  };

  return {
    ...state,
    showConfirm,
    hideConfirm,
    handleConfirm,
  };
};

export default ConfirmDialog;
