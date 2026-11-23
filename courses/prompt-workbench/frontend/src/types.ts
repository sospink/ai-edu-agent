export interface Prompt {
  instruction: string;
  context: string;
  input: string;
  outputRequirements: string;
  maxTokens: number;
}
export interface Draft extends Prompt {
  id: string;
  name: string;
  updatedAt: string;
}
export interface Sample {
  id: string;
  title: string;
  input: string;
  description: string;
}
export interface Config {
  configured: boolean;
  model: string;
  capabilities: { temperature: boolean; topP: boolean; maxTokens: boolean };
  maxOutputTokens: number;
}
export interface Validation {
  valid: boolean;
  parsed: Record<string, unknown> | null;
  issues: { path: string; message: string }[];
  checks: { name: string; passed: boolean }[];
}
export interface Experiment {
  id: string;
  createdAt: string;
  source: "live";
  requestId: string;
  model: string;
  latencyMs: number;
  prompt: Prompt;
  response: string;
  validation: Validation;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}
export type Translate = (zh: string, en: string) => string;

export function newPrompt(): Prompt {
  return {
    instruction:
      "你是校园云服务运维助手。请将报障内容整理为结构化信息，只依据原文，不猜测原因。",
    context:
      "面向校园云服务值班人员。原始报障可能缺少服务名称、发生时间或错误信息；将缺失信息列入 missing_fields。",
    input: "",
    outputRequirements:
      "只输出 JSON 对象，字段严格为 service:string、symptom:string、evidence:string[]、missing_fields:string[]，禁止额外字段。service 和 symptom 不得为空。evidence 每项必须直接引用原始输入。",
    maxTokens: 4096,
  };
}

export function promptOf(value: Prompt): Prompt {
  const { instruction, context, input, outputRequirements, maxTokens } = value;
  return { instruction, context, input, outputRequirements, maxTokens };
}
