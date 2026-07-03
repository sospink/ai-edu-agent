import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
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
  const layoutId = useId();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const current = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';

  return (
    <div
      className={`group inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/82 p-1 text-xs shadow-sm backdrop-blur transition hover:border-slate-300/80 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] ${compact ? '' : 'px-1.5'}`}
      aria-label={t('language.switcherLabel')}
      data-i18n-skip
    >
      {!compact && (
        <motion.span
          animate={{ rotate: pendingLocale ? 12 : 0, scale: pendingLocale ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className="flex h-5 w-5 items-center justify-center"
        >
          <Languages className="h-3.5 w-3.5 text-slate-500" />
        </motion.span>
      )}
      {locales.map((item) => {
        const active = current === item.locale;
        const pending = pendingLocale === item.locale;
        return (
          <button
            key={item.locale}
            type="button"
            onClick={() => {
              if (active || pendingLocale) return;
              setPendingLocale(item.locale);
              void setCurrentLocale(item.locale).finally(() => {
                window.setTimeout(() => setPendingLocale(null), 260);
              });
            }}
            disabled={Boolean(pendingLocale)}
            className={`relative isolate overflow-hidden rounded-full px-2 py-1 font-semibold transition ${
              active ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId={`locale-thumb-${layoutId}`}
                className="absolute inset-0 -z-10 rounded-full bg-slate-900 shadow-sm"
                transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
              />
            )}
            {!active && (
              <span className="absolute inset-0 -z-10 rounded-full bg-slate-100 opacity-0 transition group-hover:opacity-0" />
            )}
            <motion.span
              animate={{ y: pending ? -1 : 0, opacity: pending ? 0.72 : 1 }}
              transition={{ duration: 0.18 }}
              className="relative block"
            >
              {compact ? item.shortLabel : t(item.labelKey)}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
