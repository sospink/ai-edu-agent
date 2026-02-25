// 教学智能体类型定义

export interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean;
}

export interface Step {
  id: number;
  title: string;
  description?: string;
  content: ContentBlock[];
  quickQuestions: string[];
  verification?: Verification;
}

export interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  path?: string;
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  port?: number;
  script?: string;
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string | ContentBlock[];
  type?: 'text' | 'code' | 'validation_success' | 'validation_error';
  timestamp?: Date;
}

export interface Lab {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  tags: string[];
  steps: Step[];
}

export interface UserProgress {
  userId: string;
  labId: string;
  currentStep: number;
  completedSteps: number[];
  startedAt: Date;
  lastActiveAt: Date;
  chatHistory: ChatMessage[];
}

export interface VerifyResult {
  success: boolean;
  message: string;
  details?: string;
}

export interface ExecuteResult {
  output: string;
  exitCode: number;
  error?: string;
}
