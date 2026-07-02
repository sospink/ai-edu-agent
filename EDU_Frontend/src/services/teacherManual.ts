import { createScopedApi } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types';
import i18n from '@/i18n';

const teacherApi = createScopedApi('/teacher');

export interface TeacherManualListItem {
  id: number;
  sourceType: 1 | 2;
  sourceId: number;
  sourceName: string;
  title: string;
  description: string;
  isPublished: number;
  creatorId: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentManualAdmin {
  exists: boolean;
  id?: number;
  title?: string;
  description?: string;
  isPublished?: number;
  steps?: AgentStepAdmin[];
}

export interface AgentStepAdmin {
  id?: number;
  stepOrder: number;
  title: string;
  content: ContentBlock[];
  quickQuestions: string[];
  verification: Verification | null;
  skillTags?: string[];
}

export interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean;
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

export interface ParsedManualPreview {
  title: string;
  description: string;
  steps: Array<{
    stepOrder: number;
    title: string;
    content: ContentBlock[];
    quickQuestions: string[];
    verification: Verification | null;
  }>;
}

export interface ImportResult {
  success: boolean;
  id: number;
  title: string;
  description: string;
  isPublished: number;
  stepsCount: number;
}

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const teacherManualApi = {
  list(params: { page?: number; pageSize?: number; q?: string; sourceType?: number; published?: number } = {}) {
    return teacherApi.get<PaginatedResponse<TeacherManualListItem>>(`/manuals${buildQuery(params)}`);
  },
  async getManual(sourceType: number, sourceId: number): Promise<AgentManualAdmin> {
    const res = await teacherApi.get<AgentManualAdmin>(`/manuals/${sourceType}/${sourceId}`);
    if (res.error) return { exists: false };
    return res as unknown as AgentManualAdmin;
  },
  createManual(data: { sourceType: number; sourceId: number; title: string; description?: string }) {
    return teacherApi.post<{ id: number; title: string; description: string; isPublished: number }>('/manuals', data);
  },
  updateManual(manualId: number, data: { title?: string; description?: string; isPublished?: number }) {
    return teacherApi.put<unknown>(`/manuals/${manualId}`, data);
  },
  deleteManual(manualId: number) {
    return teacherApi.delete<unknown>(`/manuals/${manualId}`);
  },
  updateSteps(manualId: number, steps: Array<{ title: string; content: ContentBlock[]; quickQuestions?: string[]; verification?: Verification | null; skillTags?: string[] }>) {
    return teacherApi.post<{ steps: AgentStepAdmin[] }>(`/manuals/${manualId}/steps`, { steps });
  },
  parseMarkdownPreview(markdown: string) {
    return teacherApi.post<ParsedManualPreview>('/manuals/parse-preview', { markdown });
  },
  importMarkdown(sourceType: number, sourceId: number, markdown: string) {
    return teacherApi.post<ImportResult>('/manuals/import', { sourceType, sourceId, markdown });
  },
};

export async function readMarkdownFile(file: File): Promise<string> {
  return await file.text();
}

export function exportToMarkdown(manual: { title: string; description?: string; steps: AgentStepAdmin[] }): string {
  const lines: string[] = [];
  lines.push(`# ${manual.title}`);
  lines.push('');
  if (manual.description) {
    lines.push(`> ${manual.description}`);
    lines.push('');
  }
  manual.steps.forEach((step, index) => {
    lines.push(`## ${i18n.t('manualExport:step', { number: index + 1, title: step.title })}`);
    lines.push('');
    step.content.forEach(block => {
      switch (block.type) {
        case 'text':
          if (block.text) lines.push(block.text, '');
          break;
        case 'heading':
          if (block.text) lines.push(`### ${block.text}`, '');
          break;
        case 'code':
          if (block.code) lines.push(`\`\`\`${block.language || 'text'}`, block.code, '```', '');
          break;
        case 'list':
          block.items?.forEach(item => lines.push(`- ${item}`));
          if (block.items?.length) lines.push('');
          break;
        case 'image':
          if (block.src) lines.push(`![${i18n.t('manualExport:imageAlt')}](${block.src})`, '');
          break;
      }
    });
  });
  return lines.join('\n');
}

export function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
