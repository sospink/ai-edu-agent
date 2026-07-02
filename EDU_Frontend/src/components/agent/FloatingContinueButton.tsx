import React from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * 悬浮继续按钮组件属性接口
 */
export interface FloatingContinueButtonProps {
  /** 是否显示按钮 */
  visible: boolean;
  /** 是否处于加载状态 */
  isLoading: boolean;
  /** 是否为最后一步 */
  isLastStep: boolean;
  /** 点击回调函数 */
  onClick: () => void;
}

/**
 * 悬浮继续按钮组件
 * 
 * 悬浮在对话区域右下角的继续按钮，方便用户在长对话后快速操作。
 * 
 * 设计特点：
 * - 蓝色背景、圆角、阴影（Requirements 2.4）
 * - 加载状态显示（Requirements 2.1）
 * - 最后一步显示"完成"，其他步骤显示"继续"
 * 
 * @example
 * ```tsx
 * <FloatingContinueButton
 *   visible={showFloatingButton}
 *   isLoading={isValidating}
 *   isLastStep={currentStep === steps.length - 1}
 *   onClick={handleContinue}
 * />
 * ```
 */
export const FloatingContinueButton: React.FC<FloatingContinueButtonProps> = ({
  visible,
  isLoading,
  isLastStep,
  onClick,
}) => {
  const { t } = useTranslation('agent');
  // 不可见时不渲染
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        fixed bottom-24 right-10 z-40
        px-6 py-3
        bg-primary text-white
        rounded-full
        shadow-lg hover:shadow-xl
        hover:bg-primary-600
        transition-all duration-300
        flex items-center gap-2
        animate-fade-in
        disabled:opacity-70 disabled:cursor-not-allowed
        font-medium
      `}
      aria-label={isLastStep ? t('complete') : t('continue')}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('checkingShort')}</span>
        </>
      ) : (
        <>
          <span>{isLastStep ? t('complete') : t('continue')}</span>
          <ChevronRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
};

export default FloatingContinueButton;
