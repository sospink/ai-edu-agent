export type AgentHubCategory =
  | 'coding' | 'academic' | 'agent-dev' | 'career'
  | 'data' | 'teaching' | 'product' | 'evaluation' | 'blockchain' | 'media';

export type RecommendedModel = 'deepseek-r1' | 'deepseek-v3';

export type SkillKind = 'prompt' | 'workflow' | 'mcp';

export type SkillDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type AnatomySectionType =
  | 'role'
  | 'objective'
  | 'input'
  | 'guardrails'
  | 'output'
  | 'few_shot';

export type SkillIconName =
  | 'bug'
  | 'code'
  | 'compass'
  | 'book-open'
  | 'file-check'
  | 'network'
  | 'sparkles'
  | 'plug'
  | 'shield-alert'
  | 'pen-tool'
  | 'briefcase'
  | 'user-check';

export interface SkillInputField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
}

/** 原理拆解区块：支撑 Tab 2 的逐块高亮与教学批注 */
export interface PromptAnatomyBlock {
  id: string;
  section: AnatomySectionType;
  title: string;
  snippet: string;
  whyItWorks: string;
  withoutIt: string;
  principleTag: string;
}

/** 预置演示案例：支持一键填入示例与零成本演示模式 */
export interface SkillDemoPreset {
  id: string;
  label: string;
  inputs: Record<string, string>;
  sampleReasoning?: string;
  sampleOutput: string;
}

export interface AgentHubSkill {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: AgentHubCategory;
  kind: SkillKind;
  difficulty: SkillDifficulty;
  recommendedModel: RecommendedModel;
  iconName: SkillIconName;
  accentClass: string;
  tags: string[];
  inputs: SkillInputField[];
  userPromptTemplate: string;
  systemPrompt: string;
  anatomyBlocks: PromptAnatomyBlock[];
  demoPresets: SkillDemoPreset[];
  relatedCourseTitle: string;
  relatedCourseQuery?: string;
  labChallenge: string;
  isFeaturedOnSquare?: boolean;
}
