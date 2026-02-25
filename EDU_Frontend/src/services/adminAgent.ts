import { api } from './api';

// 类型定义
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

// 获取手册（管理员）
export async function getManual(sourceType: number, sourceId: number): Promise<AgentManualAdmin> {
  const res = await api.get<AgentManualAdmin>(`/agent/admin/manual/${sourceType}/${sourceId}`);
  if (res.error) {
    return { exists: false };
  }
  return res as unknown as AgentManualAdmin;
}

// 创建手册
export async function createManual(data: {
  sourceType: number;
  sourceId: number;
  title: string;
  description?: string;
}): Promise<{ id: number; title: string; description: string; isPublished: number } | null> {
  const res = await api.post<any>('/agent/admin/manual', data);
  if (res.error) {
    throw new Error(res.error);
  }
  return res as any;
}

// 更新手册
export async function updateManual(
  manualId: number,
  data: { title?: string; description?: string; isPublished?: number }
): Promise<void> {
  const res = await api.put<any>(`/agent/admin/manual/${manualId}`, data);
  if (res.error) {
    throw new Error(res.error);
  }
}

// 删除手册
export async function deleteManual(manualId: number): Promise<void> {
  const res = await api.delete<any>(`/agent/admin/manual/${manualId}`);
  if (res.error) {
    throw new Error(res.error);
  }
}

// 批量更新步骤
export async function updateSteps(
  manualId: number,
  steps: Array<{
    title: string;
    content: ContentBlock[];
    quickQuestions?: string[];
    verification?: Verification | null;
  }>
): Promise<AgentStepAdmin[]> {
  const res = await api.post<{ steps: AgentStepAdmin[] }>(`/agent/admin/manual/${manualId}/steps`, { steps });
  if (res.error) {
    throw new Error(res.error);
  }
  return (res as any).steps || [];
}

// 获取 AI 验证建议
export async function getVerificationSuggestion(data: {
  stepTitle?: string;
  stepContext?: string;
  verificationType?: string;
  errorMessage: string;
  errorDetails?: string;
}): Promise<string> {
  const res = await api.post<{ suggestion: string }>('/agent/suggestion', data);
  if (res.error) {
    throw new Error(res.error);
  }
  return (res as any).suggestion || '';
}

// Markdown 解析预览
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

export async function parseMarkdownPreview(markdown: string): Promise<ParsedManualPreview> {
  const res = await api.post<ParsedManualPreview>('/agent/admin/parse-preview', { markdown });
  if (res.error) {
    throw new Error(res.error);
  }
  return res as unknown as ParsedManualPreview;
}

// 从 Markdown 导入手册
export interface ImportResult {
  success: boolean;
  id: number;
  title: string;
  description: string;
  isPublished: number;
  stepsCount: number;
}

export async function importMarkdown(
  sourceType: number,
  sourceId: number,
  markdown: string
): Promise<ImportResult> {
  const res = await api.post<ImportResult>('/agent/admin/import', { sourceType, sourceId, markdown });
  if (res.error) {
    throw new Error(res.error);
  }
  return res as unknown as ImportResult;
}

// ============ 步骤排序功能 ============

// 移动步骤位置
export function moveStep(
  steps: AgentStepAdmin[],
  fromIndex: number,
  toIndex: number
): AgentStepAdmin[] {
  if (fromIndex < 0 || fromIndex >= steps.length) return steps;
  if (toIndex < 0 || toIndex >= steps.length) return steps;
  if (fromIndex === toIndex) return steps;

  const newSteps = [...steps];
  const [movedStep] = newSteps.splice(fromIndex, 1);
  newSteps.splice(toIndex, 0, movedStep);

  // 重新计算 stepOrder
  return newSteps.map((step, index) => ({
    ...step,
    stepOrder: index,
  }));
}

// 上移步骤
export function moveStepUp(steps: AgentStepAdmin[], index: number): AgentStepAdmin[] {
  return moveStep(steps, index, index - 1);
}

// 下移步骤
export function moveStepDown(steps: AgentStepAdmin[], index: number): AgentStepAdmin[] {
  return moveStep(steps, index, index + 1);
}

// ============ Markdown 导出功能 ============

// 将手册导出为 Markdown 格式
export function exportToMarkdown(manual: {
  title: string;
  description?: string;
  steps: AgentStepAdmin[];
}): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${manual.title}`);
  lines.push('');

  // 描述
  if (manual.description) {
    lines.push(`> ${manual.description}`);
    lines.push('');
  }

  // 步骤
  manual.steps.forEach((step, index) => {
    lines.push(`## 步骤 ${index + 1}: ${step.title}`);
    lines.push('');

    // 内容块
    step.content.forEach(block => {
      switch (block.type) {
        case 'text':
          if (block.text) {
            lines.push(block.text);
            lines.push('');
          }
          break;
        case 'heading':
          if (block.text) {
            lines.push(`### ${block.text}`);
            lines.push('');
          }
          break;
        case 'code':
          if (block.code) {
            lines.push(`\`\`\`${block.language || 'text'}`);
            lines.push(block.code);
            lines.push('```');
            lines.push('');
          }
          break;
        case 'list':
          if (block.items && block.items.length > 0) {
            block.items.forEach(item => {
              lines.push(`- ${item}`);
            });
            lines.push('');
          }
          break;
        case 'image':
          if (block.src) {
            lines.push(`![image](${block.src})`);
            lines.push('');
          }
          break;
      }
    });

    // 验证规则
    if (step.verification) {
      const v = step.verification;
      let verifyLine = '';
      switch (v.type) {
        case 'file_exists':
          verifyLine = `<!-- verify: file_exists:${v.path || ''} -->`;
          break;
        case 'command_output':
          verifyLine = `<!-- verify: command:${v.command || ''}|${v.expect || 'not_empty'}|${v.value || ''} -->`;
          break;
        case 'service_running':
          verifyLine = `<!-- verify: service:${v.port || ''} -->`;
          break;
      }
      if (verifyLine) {
        lines.push(verifyLine);
      }
    }

    // 快捷问题
    if (step.quickQuestions && step.quickQuestions.length > 0) {
      lines.push(`<!-- questions: ${step.quickQuestions.join('|')} -->`);
    }

    lines.push('');
  });

  return lines.join('\n').trim();
}

// ============ 文件读取辅助函数 ============

// 读取本地 Markdown 文件内容
export function readMarkdownFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('无法读取文件内容'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

// 下载 Markdown 文件
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============ 步骤复制功能 ============

// 复制步骤
export function duplicateStep(
  steps: AgentStepAdmin[],
  index: number
): AgentStepAdmin[] {
  if (index < 0 || index >= steps.length) return steps;

  const stepToCopy = steps[index];
  const newStep: AgentStepAdmin = {
    ...stepToCopy,
    id: undefined, // 新步骤没有 ID
    stepOrder: index + 1,
    title: `${stepToCopy.title} (副本)`,
    content: JSON.parse(JSON.stringify(stepToCopy.content)), // 深拷贝
    quickQuestions: [...stepToCopy.quickQuestions],
    verification: stepToCopy.verification
      ? JSON.parse(JSON.stringify(stepToCopy.verification))
      : null,
  };

  const newSteps = [...steps];
  newSteps.splice(index + 1, 0, newStep);

  // 重新计算 stepOrder
  return newSteps.map((step, i) => ({
    ...step,
    stepOrder: i,
  }));
}

// ============ 验证规则辅助函数 ============

// 创建空的验证规则
export function createEmptyVerification(type: Verification['type']): Verification {
  switch (type) {
    case 'file_exists':
      return { type: 'file_exists', path: '' };
    case 'command_output':
      return { type: 'command_output', command: '', expect: 'not_empty', value: '' };
    case 'service_running':
      return { type: 'service_running', port: 8080 };
    case 'custom':
      return { type: 'custom', script: '' };
    default:
      return { type: 'file_exists', path: '' };
  }
}

// 验证规则描述
export function getVerificationDescription(verification: Verification | null): string {
  if (!verification) return '无验证';

  switch (verification.type) {
    case 'file_exists':
      return `检查文件: ${verification.path || '(未设置)'}`;
    case 'command_output':
      const expectText = {
        not_empty: '非空',
        contains: '包含',
        equals: '等于',
        regex: '匹配正则',
      }[verification.expect || 'not_empty'];
      return `执行命令: ${verification.command || '(未设置)'} → ${expectText} ${verification.value || ''}`;
    case 'service_running':
      return `检查服务端口: ${verification.port || '(未设置)'}`;
    case 'custom':
      return '自定义脚本验证';
    default:
      return '未知验证类型';
  }
}
