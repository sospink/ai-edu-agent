import React from 'react';
import { Button } from '@heroui/react';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// 检查项接口
export interface CheckItem {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  message?: string;
}

// 验证结果接口
export interface VerificationResult {
  success: boolean;
  message: string;
  details?: string;
  checkItems?: CheckItem[];
  suggestion?: string;
}

// 组件属性接口
export interface VerificationDialogProps {
  open: boolean;
  result: VerificationResult | null;
  isLoading?: boolean;
  onRetry: () => void;
  onSkip: () => void;
  onClose: () => void;
}

/**
 * 验证结果弹窗组件
 * 参考 LabEx Labby 设计，以独立卡片形式显示环境检查结果
 */
export const VerificationDialog: React.FC<VerificationDialogProps> = ({
  open,
  result,
  isLoading = false,
  onRetry,
  onSkip,
  onClose,
}) => {
  // 不显示弹窗的情况
  if (!open) return null;

  // 加载状态
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 - 点击不关闭 */}
        <div className="absolute inset-0 bg-black/20" />
        
        {/* 加载卡片 */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-default-700 font-medium">正在检查环境...</p>
            <p className="text-default-500 text-sm mt-1">请稍候</p>
          </div>
        </div>
      </div>
    );
  }

  // 无结果时不显示
  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 - 点击不关闭弹窗（Requirements 3.6） */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* 弹窗卡片 - 白色背景、圆角、阴影（Requirements 3.5） */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden animate-enter">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default-100">
          <h3 className="text-lg font-bold text-default-900">检查结果</h3>
          <button 
            onClick={onClose} 
            className="p-1 text-default-400 hover:text-default-600 hover:bg-default-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* 检查项列表（Requirements 3.2） */}
        <div className="px-6 py-4 space-y-3 max-h-[300px] overflow-y-auto">
          {result.checkItems && result.checkItems.length > 0 ? (
            result.checkItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                {/* 状态图标 */}
                {item.status === 'passed' ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                ) : item.status === 'failed' ? (
                  <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-5 h-5 text-default-400 animate-spin shrink-0 mt-0.5" />
                )}
                {/* 检查项名称和说明 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    item.status === 'failed' ? 'text-danger' : 
                    item.status === 'passed' ? 'text-success-700' : 'text-default-700'
                  }`}>
                    {item.name}
                  </p>
                  {item.message && (
                    <p className="text-xs text-default-500 mt-1 break-words">{item.message}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            // 无检查项时显示总体结果
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-danger shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                result.success ? 'text-success-700' : 'text-danger'
              }`}>
                {result.message}
              </p>
            </div>
          )}
          
          {/* 错误详情展示区域 */}
          {!result.success && result.details && (
            <div className="mt-4 p-3 bg-danger-50 rounded-lg border border-danger-100">
              <p className="text-sm text-danger-700 whitespace-pre-wrap break-words">
                {result.details}
              </p>
            </div>
          )}

          {/* AI 建议 */}
          {result.suggestion && (
            <div className="mt-4 p-3 bg-warning-50 rounded-lg border border-warning-100">
              <p className="text-xs font-medium text-warning-700 mb-1">💡 建议</p>
              <p className="text-sm text-warning-800 whitespace-pre-wrap break-words">
                {result.suggestion}
              </p>
            </div>
          )}
        </div>
        
        {/* 操作按钮区（Requirements 3.4） */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-default-100 bg-default-50">
          {/* 跳过按钮 */}
          <Button 
            variant="flat" 
            onPress={onSkip}
            className="font-medium"
          >
            跳过
          </Button>
          {/* 重新检查按钮 */}
          <Button 
            color="primary" 
            onPress={onRetry}
            className="font-medium"
          >
            重新检查
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerificationDialog;
