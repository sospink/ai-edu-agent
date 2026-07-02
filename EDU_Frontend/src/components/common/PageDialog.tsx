import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/components/common/bodyScrollLock';
import { useTranslation } from 'react-i18next';

export const OverlayPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

interface PageDialogProps {
  isOpen: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
  zIndexClassName?: string;
}

export const PageDialog: React.FC<PageDialogProps> = ({
  isOpen,
  children,
  onClose,
  panelClassName,
  closeOnBackdrop = true,
  zIndexClassName = 'z-[9998]',
}) => {
  const { t } = useTranslation('common');
  useBodyScrollLock(isOpen);

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <div className={`fixed inset-0 ${zIndexClassName}`}>
            <motion.button
              type="button"
              aria-label={t('actions.closeDialog')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOnBackdrop ? onClose : undefined}
              className="absolute inset-0 h-full w-full cursor-default bg-slate-950/55 backdrop-blur-[6px]"
            />
            <div className="relative flex min-h-full items-center justify-center px-4 py-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className={[
                  'pointer-events-auto relative isolate flex max-h-[calc(100vh-48px)] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-[0_36px_90px_rgba(15,23,42,0.24)]',
                  panelClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {children}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default PageDialog;
