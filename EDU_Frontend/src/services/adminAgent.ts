import { api } from './api';
import i18n from '@/i18n';
import {
  downloadMarkdown,
  exportToMarkdown,
  readMarkdownFile,
  teacherManualApi,
  type AgentManualAdmin,
  type AgentStepAdmin,
  type ContentBlock,
  type ImportResult,
  type ParsedManualPreview,
  type Verification,
} from './teacherManual';

export type {
  AgentManualAdmin,
  AgentStepAdmin,
  ContentBlock,
  ImportResult,
  ParsedManualPreview,
  Verification,
};

export async function getManual(sourceType: number, sourceId: number): Promise<AgentManualAdmin> {
  return teacherManualApi.getManual(sourceType, sourceId);
}

export async function createManual(data: {
  sourceType: number;
  sourceId: number;
  title: string;
  description?: string;
}) {
  const response = await teacherManualApi.createManual(data);
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data || null;
}

export async function updateManual(
  manualId: number,
  data: { title?: string; description?: string; isPublished?: number }
): Promise<void> {
  const response = await teacherManualApi.updateManual(manualId, data);
  if (response.error) {
    throw new Error(response.error);
  }
}

export async function deleteManual(manualId: number): Promise<void> {
  const response = await teacherManualApi.deleteManual(manualId);
  if (response.error) {
    throw new Error(response.error);
  }
}

export async function updateSteps(
  manualId: number,
  steps: Array<{
    title: string;
    content: ContentBlock[];
    quickQuestions?: string[];
    verification?: Verification | null;
    skillTags?: string[];
  }>
): Promise<AgentStepAdmin[]> {
  const response = await teacherManualApi.updateSteps(manualId, steps);
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data?.steps || [];
}

export async function getVerificationSuggestion(data: {
  stepTitle?: string;
  stepContext?: string;
  verificationType?: string;
  errorMessage: string;
  errorDetails?: string;
}): Promise<string> {
  const response = await api.post<{ suggestion: string }>('/agent/suggestion', data);
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data?.suggestion || '';
}

export async function parseMarkdownPreview(markdown: string): Promise<ParsedManualPreview> {
  const response = await teacherManualApi.parseMarkdownPreview(markdown);
  const preview = response.data || (response as unknown as ParsedManualPreview);
  if (response.error || !preview || !Array.isArray(preview.steps)) {
    throw new Error(response.error || i18n.t('agentManualEditor:parseFailed'));
  }
  return preview;
}

export async function importMarkdown(
  sourceType: number,
  sourceId: number,
  markdown: string
): Promise<ImportResult> {
  const response = await teacherManualApi.importMarkdown(sourceType, sourceId, markdown);
  const result = response.data || (response as unknown as ImportResult);
  if (response.error || !result || !result.id) {
    throw new Error(response.error || i18n.t('agentManualEditor:importFailed'));
  }
  return result;
}

export { downloadMarkdown, exportToMarkdown, readMarkdownFile };
