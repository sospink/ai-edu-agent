// 教学智能体组件导出
export { AgentWidget } from './AgentWidget';
export { CodeBlock } from './CodeBlock';
export { FloatingContinueButton } from './FloatingContinueButton';
export { StepProgress } from './StepProgress';
export { StructuredContent } from './StructuredContent';
export { VerificationDialog } from './VerificationDialog';
export { VerificationError } from './VerificationError';

// Hooks 导出
export { useScrollBehavior } from './hooks/useScrollBehavior';

// 类型导出
export type {
  ContentBlock,
  Step,
  Verification,
  ChatMessage,
  Lab,
  UserProgress,
  VerifyResult,
  ExecuteResult
} from './types';

export type {
  CheckItem,
  VerificationResult,
  VerificationDialogProps
} from './VerificationDialog';

export type {
  FloatingContinueButtonProps
} from './FloatingContinueButton';

export type {
  UseScrollBehaviorOptions,
  UseScrollBehaviorReturn
} from './hooks/useScrollBehavior';
