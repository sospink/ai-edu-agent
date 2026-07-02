"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface WorkSceneFolderItem {
  title: string;
  subtitle: string;
  description: string;
  directories: string[];
  accentClassName: string;
  icon: React.ReactNode;
}

interface WorkSceneFolderProps {
  items: WorkSceneFolderItem[];
  className?: string;
  onIndexChange?: (index: number) => void;
}

export default function WorkSceneFolder({ items, className, onIndexChange }: WorkSceneFolderProps) {
  const { t } = useTranslation('common');
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const activeItem = items[activeIndex];

  useEffect(() => {
    setIsOpen(false);
    onIndexChange?.(activeIndex);
  }, [activeIndex, onIndexChange]);

  const counter = useMemo(() => {
    return `${String(activeIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  }, [activeIndex, items.length]);

  const paginate = (nextDirection: -1 | 1) => {
    setDirection(nextDirection);
    setActiveIndex((current) => (current + nextDirection + items.length) % items.length);
  };

  if (!activeItem) {
    return null;
  }

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Header: title area */}
      <div className="mb-6 px-1">
        <p className="text-base font-bold tracking-tight text-slate-900">{t('workScene.title')}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {t('workScene.description')}
        </p>
      </div>

      {/* Main folder area - relative for floating buttons */}
      <div className="relative mx-auto w-full max-w-[420px] px-2 sm:px-4">
        {/* Floating left button */}
        <button
          type="button"
          aria-label={t('workScene.previous')}
          onClick={() => paginate(-1)}
          className="absolute -left-2 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:border-primary-300 hover:text-primary-600 active:scale-95 sm:-left-6"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Floating right button */}
        <button
          type="button"
          aria-label={t('workScene.next')}
          onClick={() => paginate(1)}
          className="absolute -right-2 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:border-primary-300 hover:text-primary-600 active:scale-95 sm:-right-6"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Content container */}
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeItem.title}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 48 : -48, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction >= 0 ? -48 : 48, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6"
          >
            {/* Info card */}
            <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100/85 p-5 shadow-[0_16px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm after:absolute after:-right-2 after:top-[-8%] after:h-[116%] after:w-[48%] after:bg-gradient-to-l after:from-white/75 after:to-transparent after:content-['']">
              {/* Counter inside the card */}
              <div className="absolute right-4 top-4 z-20 whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold tabular-nums tracking-[0.14em] text-slate-500 shadow-[0_6px_12px_-8px_rgba(15,23,42,0.45)]">
                {counter}
              </div>

              <div className="relative z-10 mb-3.5 flex items-start gap-4 pr-16">
                <span className={cn("inline-flex rounded-2xl p-3 text-white shadow-[0_10px_18px_-10px_rgba(15,23,42,0.65)]", activeItem.accentClassName)}>
                  {activeItem.icon}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-base font-bold tracking-tight text-slate-900">{activeItem.title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{activeItem.subtitle}</p>
                </div>
              </div>
              <p className="relative z-10 text-[13px] leading-relaxed text-slate-600">{activeItem.description}</p>
            </div>

            {/* Folder Component (Matching Reference) */}
            <div
              onClick={() => setIsOpen(!isOpen)}
              className="relative mx-auto mt-10 h-52 w-80 cursor-pointer group"
            >
                {/* Folder Back */}
                <div
                  className="folder-back relative mx-auto flex h-full w-[87.5%] justify-center overflow-visible rounded-xl border border-[#D1D1D1] bg-[#EBEBEB]"
                >
                  {/* Cards inside folder */}
                  {[
                    {
                      initial: { rotate: -3, x: -38, y: 2 },
                      open: { rotate: -8, x: -70, y: -75 },
                      transition: {
                        type: "spring" as const,
                        bounce: 0.15,
                        stiffness: 160,
                        damping: 22,
                      },
                      className: "z-10",
                    },
                    {
                      initial: { rotate: 0, x: 0, y: 0 },
                      open: { rotate: 1, x: 2, y: -95 },
                      transition: {
                        type: "spring" as const,
                        duration: 0.55,
                        bounce: 0.12,
                        stiffness: 190,
                        damping: 24,
                      },
                      className: "z-20",
                    },
                    {
                      initial: { rotate: 3.5, x: 42, y: 1 },
                      open: { rotate: 9, x: 75, y: -80 },
                      transition: {
                        type: "spring" as const,
                        duration: 0.58,
                        bounce: 0.17,
                        stiffness: 170,
                        damping: 21,
                      },
                      className: "z-10",
                    },
                  ].map((pageParams, i) => (
                    <motion.div
                      key={i}
                      initial={pageParams.initial}
                      animate={isOpen ? pageParams.open : pageParams.initial}
                      transition={pageParams.transition}
                      className={`absolute top-2 h-fit w-36 rounded-xl shadow-sm ${pageParams.className}`}
                    >
                      <PageCard
                        title={activeItem.directories[i] || activeItem.directories[activeItem.directories.length - 1]}
                        accentClassName={activeItem.accentClassName}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Folder Front (SVG format from reference) */}
                <motion.div
                  animate={{ rotateX: isOpen ? -35 : 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                  className="absolute inset-x-0 -bottom-px z-30 h-44 rounded-3xl origin-bottom flex justify-center items-center overflow-visible"
                >
                  <div className="relative w-full h-full">
                    <svg
                      className="w-full h-full overflow-visible"
                      viewBox="0 0 235 121"
                      fill="none"
                      preserveAspectRatio="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M104.615 0.350494L33.1297 0.838776C32.7542 0.841362 32.3825 0.881463 32.032 0.918854C31.6754 0.956907 31.3392 0.992086 31.0057 0.992096H31.0047C30.6871 0.99235 30.3673 0.962051 30.0272 0.929596C29.6927 0.897686 29.3384 0.863802 28.9803 0.866119L13.2693 0.967682H13.2527L13.2352 0.969635C13.1239 0.981406 13.0121 0.986674 12.9002 0.986237H9.91388C8.33299 0.958599 6.76052 1.22345 5.27423 1.76651H5.27325C4.33579 2.11246 3.48761 2.66213 2.7879 3.37393L2.49689 3.68839L2.492 3.69424C1.62667 4.73882 1.00023 5.96217 0.656067 7.27725C0.653324 7.28773 0.654065 7.29886 0.652161 7.30948C0.3098 8.62705 0.257231 10.0048 0.499817 11.3446L12.2147 114.399L12.2156 114.411L12.2176 114.423C12.6046 116.568 13.7287 118.508 15.3934 119.902C17.058 121.297 19.1572 122.056 21.3231 122.049V122.05H215.379C217.76 122.02 220.064 121.192 221.926 119.698V119.697C223.657 118.384 224.857 116.485 225.305 114.35L225.307 114.339L235.914 53.3798L235.968 53.1093L235.97 53.0985L235.971 53.0888C236.134 51.8978 236.044 50.685 235.705 49.5321C235.307 48.1669 234.63 46.9005 233.717 45.8144L233.383 45.4296C232.58 44.5553 231.614 43.8449 230.539 43.3398C229.311 42.7628 227.971 42.4685 226.616 42.4774H146.746C144.063 42.4705 141.423 41.8004 139.056 40.5263C136.691 39.2522 134.671 37.4127 133.175 35.1689L113.548 5.05948L113.544 5.05362L113.539 5.04776C112.545 3.65165 111.238 2.51062 109.722 1.72061C108.266 0.886502 106.627 0.422235 104.952 0.365143V0.364166L104.633 0.350494H104.615Z"
                        fill="#F2F2F2"
                        stroke="#D1D1D1"
                        strokeWidth="1.5"
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                      <div className="flex gap-11 mb-2.5">
                        <div className="w-2.5 h-2.5 bg-neutral-600/40 rounded-full" />
                        <div className="w-2.5 h-2.5 bg-neutral-600/40 rounded-full" />
                      </div>
                      <div className="w-9 h-1 bg-neutral-600/40 rounded-full" />
                      
                      {/* Click hint */}
                      <p className="mt-4 text-[10px] font-medium text-slate-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {isOpen ? t('workScene.collapse') : t('workScene.expand')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

      </div>
    </div>
  );
}

/**
 * Page card that flies out of the folder when opened.
 * Matches the reference component's design.
 */
function PageCard({
  title,
  accentClassName,
}: {
  title: string;
  accentClassName: string;
}) {
  const { t } = useTranslation('common');

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border-2 border-slate-200/90 bg-slate-100/80 px-2.5 py-2 backdrop-blur-sm shadow-[0_14px_28px_-18px_rgba(15,23,42,0.6)] transition-all duration-500 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[55%] after:bg-gradient-to-l after:from-white/70 after:to-transparent after:content-[''] group-hover:border-white/70 group-hover:bg-slate-100/95">
      <div className="relative z-10 flex h-full flex-col justify-between">
        {/* Mini header */}
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full text-white", accentClassName)}>
            <FolderOpen className="h-2.5 w-2.5" />
          </span>
          <p className="truncate text-[10px] font-semibold leading-tight text-slate-700">{title}</p>
        </div>

        {/* Content lines */}
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="h-1.5 w-full rounded-full bg-white/90" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-1.5">
              <div className="h-1.5 flex-[2] rounded-full bg-white/80" />
              <div className="h-1.5 flex-1 rounded-full bg-white/80" />
            </div>
          ))}
        </div>

        <p className="mt-1 text-[9px] font-medium tracking-wide text-slate-400">{t('workspaceCard', { ns: 'uiReview' })}</p>
      </div>
    </div>
  );
}
