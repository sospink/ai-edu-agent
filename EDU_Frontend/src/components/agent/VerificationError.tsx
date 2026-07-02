import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { AlertCircle, Lightbulb, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VerificationErrorProps {
  message: string;
  details?: string;
  onGetSuggestion: () => Promise<string>;
  onDismiss: () => void;
}

export const VerificationError: React.FC<VerificationErrorProps> = ({
  message,
  details,
  onGetSuggestion,
  onDismiss,
}) => {
  const { t } = useTranslation('agent');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleGetSuggestion = async () => {
    setLoading(true);
    try {
      const result = await onGetSuggestion();
      setSuggestion(result);
    } catch (err) {
      setSuggestion(t('suggestionUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 overflow-hidden">
      {/* 错误信息 */}
      <div className="p-3 flex items-start gap-2">
        <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-danger-700">{message}</div>
          {details && (
            <div className="text-xs text-danger-600 mt-1 whitespace-pre-wrap">{details}</div>
          )}
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onDismiss}
          className="text-danger-400 hover:text-danger-600"
        >
          <X size={16} />
        </Button>
      </div>

      {/* AI 建议区域 */}
      {!suggestion && !loading && (
        <div className="px-3 pb-3">
          <Button
            size="sm"
            variant="flat"
            color="warning"
            onPress={handleGetSuggestion}
            className="w-full"
          >
            <Lightbulb size={14} />
            {t('getSuggestion')}
          </Button>
        </div>
      )}

      {loading && (
        <div className="px-3 pb-3 flex items-center gap-2 text-sm text-default-500">
          <Loader2 size={14} className="animate-spin" />
          {t('analyzing')}
        </div>
      )}

      {suggestion && (
        <div className="border-t border-danger-200 bg-warning-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-warning-700 mb-2">
            <Lightbulb size={14} />
            {t('aiSuggestion')}
          </div>
          <div className="text-sm text-warning-800 whitespace-pre-wrap">{suggestion}</div>
        </div>
      )}
    </div>
  );
};

export default VerificationError;
