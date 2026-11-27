import React from 'react';
import {
  BookOpen,
  Briefcase,
  Bug,
  Code2,
  Compass,
  FileCheck,
  Network,
  PenTool,
  Plug,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { SkillIconName } from '@/types/agentHub';

const ICON_MAP: Record<SkillIconName, React.ElementType> = {
  bug: Bug,
  code: Code2,
  compass: Compass,
  'book-open': BookOpen,
  'file-check': FileCheck,
  network: Network,
  sparkles: Sparkles,
  plug: Plug,
  'shield-alert': ShieldAlert,
  'pen-tool': PenTool,
  briefcase: Briefcase,
  'user-check': UserCheck,
};

interface SkillIconProps {
  name: SkillIconName;
  className?: string;
}

export const SkillIcon: React.FC<SkillIconProps> = ({ name, className = 'h-5 w-5' }) => {
  const Icon = ICON_MAP[name] || Sparkles;
  return <Icon className={className} />;
};
