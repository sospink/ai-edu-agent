import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot } from 'lucide-react';
import { AgentManualEditor } from './AgentManualEditor';
import { useTranslation } from 'react-i18next';

interface UnitAgentModalProps {
  isOpen: boolean;
  unitId: number;
  unitTitle: string;
  onClose: () => void;
}

const UnitAgentModal: React.FC<UnitAgentModalProps> = ({
  isOpen,
  unitId,
  unitTitle,
  onClose,
}) => {
  const { t } = useTranslation('teacherEditors');
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={onClose}
          />

          {/* 弹窗内容 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            <div className="w-[90vw] max-w-[800px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{t('agentConfig')}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{unitTitle}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AgentManualEditor
                  sourceType={2}
                  sourceId={unitId}
                  sourceName={unitTitle}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default UnitAgentModal;
