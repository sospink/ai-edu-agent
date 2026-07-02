import React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setCurrentLocale } from '@/i18n';
import type { Locale } from '@/i18n/types';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const locales: Array<{ locale: Locale; labelKey: string; shortLabel: string }> = [
  { locale: 'zh-CN', labelKey: 'language.zh', shortLabel: 'ZH' },
  { locale: 'en-US', labelKey: 'language.en', shortLabel: 'EN' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { t, i18n } = useTranslation('common');
  const current = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/82 p-1 text-xs shadow-sm backdrop-blur ${compact ? '' : 'px-1.5'}`}
      aria-label={t('language.switcherLabel')}
      data-i18n-skip
    >
      {!compact && <Languages className="h-3.5 w-3.5 text-slate-500" />}
      {locales.map((item) => {
        const active = current === item.locale;
        return (
          <button
            key={item.locale}
            type="button"
            onClick={() => void setCurrentLocale(item.locale)}
            className={`rounded-full px-2 py-1 font-semibold transition ${
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-pressed={active}
          >
            {compact ? item.shortLabel : t(item.labelKey)}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
