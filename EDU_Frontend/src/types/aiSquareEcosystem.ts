export type ToolCategoryId =
  | 'ai-coding'
  | 'agent-orchestration'
  | 'mcp-ecosystem'
  | 'model-runtime'
  | 'prototype-docs';

export type ToolAccessBadge = '开源免费' | '免费额度' | '平台核心生态' | '本地免费';

export interface EcosystemTool {
  id: string;
  name: string;
  vendor: string;
  category: ToolCategoryId;
  tagline: string;
  accessBadge: ToolAccessBadge;
  courseLinkLabel: string;
  url: string;
  logoText: string;
  accentClass: string;
  /** 点击「教学用法」抽屉展示的实战指南 */
  teachingUsage: {
    summary: string;
    whenToUse: string;
    quickSteps: string[];
    commandHint?: string;
    relatedSkillSlugs: string[];
  };
}

export type CapabilityTrackId = 'all' | 'beginner' | 'orchestration' | 'engineering';

export interface CapabilityNode {
  id: string;
  layerId: string;
  code: string;
  title: string;
  subtitle: string;
  summary: string;
  masteryCriteria: string[];
  recommendedToolIds: string[];
  relatedSkillSlugs: string[];
  relatedCourseTitle: string;
  tracks: Exclude<CapabilityTrackId, 'all'>[];
}

export interface CapabilityLayer {
  id: string;
  level: string;
  title: string;
  subtitle: string;
  courseTitle: string;
  estimatedHours: string;
  accentColor: string;
  badgeClass: string;
  borderClass: string;
  nodes: CapabilityNode[];
}

export interface FoundationModelGuide {
  id: string;
  name: string;
  vendor: string;
  desc: string;
  logoText: string;
  iconClass: string;
  logoUrl?: string;
  url: string;
  strengthTags: string[];
  bestForLabs: string;
  apiBaseUrl: string;
  recommendedApiModel: string;
  apiKeyEnvVar: string;
}
