import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Languages } from 'lucide-react';
import type { Locale } from '@/i18n/types';

interface LocaleChangeDetail {
  from: Locale;
  to: Locale;
}

interface TransitionState extends LocaleChangeDetail {
  id: number;
}

const localeMeta: Record<Locale, { short: string; label: string }> = {
  'zh-CN': { short: 'ZH', label: '中文' },
  'en-US': { short: 'EN', label: 'English' },
};

const LocaleTransition: React.FC = () => {
  const [state, setState] = useState<TransitionState | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<LocaleChangeDetail>).detail;
      if (!detail?.to) return;
      window.clearTimeout(timer);
      setState({ ...detail, id: Date.now() });
      timer = window.setTimeout(() => setState(null), 720);
    };

    window.addEventListener('agent-edu-locale-change-start', handleStart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('agent-edu-locale-change-start', handleStart);
    };
  }, []);

  return (
    <AnimatePresence>
      {state && (
        <div className="pointer-events-none fixed inset-0 z-[10060]" aria-hidden="true" data-i18n-skip>
          <motion.div
            key={`wash-${state.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.58),rgba(255,255,255,0))]"
          />
          <motion.div
            key={`line-${state.id}`}
            initial={{ scaleX: 0, opacity: 0.9 }}
            animate={{ scaleX: 1, opacity: [0.9, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 h-0.5 w-full origin-left bg-slate-950"
          />
          <motion.div
            key={`pill-${state.id}`}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200/70 bg-white/92 px-4 py-2 text-xs font-bold text-slate-700 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white">
              <Languages className="h-3.5 w-3.5" />
            </span>
            <span className="text-slate-400">{localeMeta[state.from].short}</span>
            <motion.span
              initial={{ width: 14, opacity: 0.5 }}
              animate={{ width: 34, opacity: 1 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="h-px rounded-full bg-slate-300"
            />
            <span className="text-slate-950">{localeMeta[state.to].label}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LocaleTransition;
