import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OverlayPortal } from '@/components/common/PageDialog';
import { useBodyScrollLock } from '@/components/common/bodyScrollLock';
import { useTranslation } from 'react-i18next';

interface PageDrawerProps {
  isOpen: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  panelClassName?: string;
  side?: 'right' | 'left';
  closeOnBackdrop?: boolean;
  zIndexClassName?: string;
}

export const PageDrawer: React.FC<PageDrawerProps> = ({
  isOpen,
  children,
  onClose,
  panelClassName,
  side = 'right',
  closeOnBackdrop = true,
  zIndexClassName = 'z-[9997]',
}) => {
  const { t } = useTranslation('common');
  useBodyScrollLock(isOpen);

  const isRight = side === 'right';

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <div className={`fixed inset-0 ${zIndexClassName}`}>
            <motion.button
              type="button"
              aria-label={t('actions.closeDrawer')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOnBackdrop ? onClose : undefined}
              className="absolute inset-0 h-full w-full cursor-default bg-slate-950/35 backdrop-blur-[4px]"
            />
            <motion.aside
              initial={{ x: isRight ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRight ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className={[
                'absolute top-0 h-full w-full overflow-y-auto bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]',
                isRight ? 'right-0 border-l border-slate-200' : 'left-0 border-r border-slate-200',
                panelClassName,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {children}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default PageDrawer;
