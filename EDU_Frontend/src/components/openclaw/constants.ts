export const WORK_SCENE_PROMPT_KEYS = [
  'scene.presalesPrompt',
  'scene.marketingPrompt',
  'scene.developmentPrompt',
  'scene.qaPrompt',
] as const;

// OpenClaw 外部消息协议标记保持原样，不作为界面文案翻译。
export const OPENCLAW_FILE_MESSAGE_PREFIX = '[文件] ';
export const OPENCLAW_CARD_MESSAGE_MARKER = '[卡片消息]';
