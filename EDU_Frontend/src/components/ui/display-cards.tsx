"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = <Sparkles className="size-4 text-blue-300" />,
  title = 'Featured',
  description = 'Discover amazing content',
  date = 'Just now',
  iconClassName = 'text-blue-500',
  titleClassName = 'text-blue-500',
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-36 w-[17.25rem] -skew-y-[6deg] select-none flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-3 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all duration-700 after:absolute after:-right-3 after:top-[-8%] after:h-[118%] after:w-[7rem] after:bg-gradient-to-l after:from-white/70 after:to-transparent after:content-[''] hover:border-primary-200 hover:shadow-[0_24px_60px_rgba(37,99,235,0.16)] sm:h-40 sm:w-[18.75rem]",
        className,
      )}
    >
      <div>
        <span className={cn("relative inline-flex rounded-full bg-blue-800/90 p-1.5 shadow-sm", iconClassName)}>
          {icon}
        </span>
        <p className={cn("text-base font-semibold tracking-tight sm:text-lg", titleClassName)}>{title}</p>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-slate-700 sm:text-base">{description}</p>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
  className?: string;
}

export default function DisplayCards({ cards, className }: DisplayCardsProps) {
  const defaultCards: DisplayCardProps[] = [
    {
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:bg-blend-overlay before:outline before:outline-1 before:outline-border before:transition-opacity before:duration-700 before:content-[''] hover:before:opacity-0 hover:grayscale-0 grayscale-[100%]",
    },
    {
      className:
        "[grid-area:stack] translate-x-12 translate-y-8 hover:-translate-y-1 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:bg-blend-overlay before:outline before:outline-1 before:outline-border before:transition-opacity before:duration-700 before:content-[''] hover:before:opacity-0 hover:grayscale-0 grayscale-[100%]",
    },
    {
      className: "[grid-area:stack] translate-x-24 translate-y-16 hover:translate-y-8",
    },
  ];

  const displayCards = cards || defaultCards;

  return (
    <div
      className={cn(
        "grid place-items-center [grid-template-areas:'stack'] animate-in fade-in-0 duration-700",
        className,
      )}
    >
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
