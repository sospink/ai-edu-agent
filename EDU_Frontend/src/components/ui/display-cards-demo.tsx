"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import DisplayCards, { type DisplayCardProps } from '@/components/ui/display-cards';

const defaultCards: DisplayCardProps[] = [
  {
    icon: <Sparkles className="size-4 text-blue-300" />,
    title: 'Featured',
    description: 'Discover amazing content',
    date: 'Just now',
    iconClassName: 'text-blue-500',
    titleClassName: 'text-blue-500',
    className:
      "[grid-area:stack] hover:-translate-y-10 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:bg-blend-overlay before:outline before:outline-1 before:outline-border before:transition-opacity before:duration-700 before:content-[''] hover:before:opacity-0 hover:grayscale-0 grayscale-[100%]",
  },
  {
    icon: <Sparkles className="size-4 text-blue-300" />,
    title: 'Popular',
    description: 'Trending this week',
    date: '2 days ago',
    iconClassName: 'text-blue-500',
    titleClassName: 'text-blue-500',
    className:
      "[grid-area:stack] translate-x-12 translate-y-8 hover:-translate-y-1 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-xl before:bg-background/50 before:bg-blend-overlay before:outline before:outline-1 before:outline-border before:transition-opacity before:duration-700 before:content-[''] hover:before:opacity-0 hover:grayscale-0 grayscale-[100%]",
  },
  {
    icon: <Sparkles className="size-4 text-blue-300" />,
    title: 'New',
    description: 'Latest updates and features',
    date: 'Today',
    iconClassName: 'text-blue-500',
    titleClassName: 'text-blue-500',
    className: "[grid-area:stack] translate-x-24 translate-y-16 hover:translate-y-8",
  },
];

function DisplayCardsDemo() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center py-20">
      <div className="w-full max-w-3xl">
        <DisplayCards cards={defaultCards} />
      </div>
    </div>
  );
}

export { DisplayCardsDemo };
