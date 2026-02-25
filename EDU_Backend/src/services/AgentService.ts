import { AppDataSource } from '../config/database';
import { AgentManual } from '../models/AgentManual';
import { AgentStep } from '../models/AgentStep';
import { UserAgentProgress, ChatMessage } from '../models/UserAgentProgress';
import { verify, VerifyResult } from './VerificationService';

const manualRepo = () => AppDataSource.getRepository(AgentManual);
const stepRepo = () => AppDataSource.getRepository(AgentStep);
const progressRepo = () => AppDataSource.getRepository(UserAgentProgress);

// 获取手册（含所有步骤）
export async function getManual(sourceType: number, sourceId: number): Promise<AgentManual | null> {
  const manual = await manualRepo().findOne({
    where: { sourceType, sourceId, isPublished: 1 },
  });
  
  if (!manual) return null;
  
  // 单独查询步骤，避免 bigint 关联问题
  const steps = await stepRepo().find({
    where: { manualId: manual.id },
    order: { stepOrder: 'ASC' },
  });
  
  manual.steps = steps;
  return manual;
}

// 根据 ID 获取手册
export async function getManualById(manualId: number): Promise<AgentManual | null> {
  const manual = await manualRepo().findOne({
    where: { id: manualId },
  });
  
  if (!manual) return null;
  
  // 单独查询步骤
  const steps = await stepRepo().find({
    where: { manualId: manual.id },
    order: { stepOrder: 'ASC' },
  });
  
  manual.steps = steps;
  return manual;
}

// 获取用户进度
export async function getProgress(userId: number, manualId: number): Promise<UserAgentProgress | null> {
  return await progressRepo().findOne({
    where: { userId, manualId },
  });
}

// 获取或创建用户进度
export async function getOrCreateProgress(userId: number, manualId: number): Promise<UserAgentProgress> {
  let progress = await getProgress(userId, manualId);
  
  if (!progress) {
    progress = progressRepo().create({
      userId,
      manualId,
      currentStep: 0,
      completedSteps: [],
      chatHistory: [],
    });
    await progressRepo().save(progress);
  }
  
  return progress;
}

// 更新用户进度
export async function updateProgress(
  userId: number,
  manualId: number,
  data: {
    currentStep?: number;
    completedSteps?: number[];
    chatHistory?: ChatMessage[];
  }
): Promise<UserAgentProgress> {
  let progress = await getOrCreateProgress(userId, manualId);
  
  if (data.currentStep !== undefined) {
    progress.currentStep = data.currentStep;
  }
  if (data.completedSteps !== undefined) {
    progress.completedSteps = data.completedSteps;
  }
  if (data.chatHistory !== undefined) {
    progress.chatHistory = data.chatHistory;
  }
  
  return await progressRepo().save(progress);
}

// 验证步骤
export async function verifyStep(
  manualId: number,
  stepOrder: number,
  containerId: string
): Promise<VerifyResult> {
  // 获取步骤
  const step = await stepRepo().findOne({
    where: { manualId, stepOrder },
  });

  if (!step) {
    return { success: false, message: '步骤不存在' };
  }

  // 无需验证，直接通过
  if (!step.verification) {
    return { success: true, message: '无需验证，可以继续' };
  }

  // 执行验证
  return await verify(containerId, step.verification);
}

// 标记步骤完成
export async function completeStep(
  userId: number,
  manualId: number,
  stepOrder: number
): Promise<UserAgentProgress> {
  const progress = await getOrCreateProgress(userId, manualId);
  
  if (!progress.completedSteps.includes(stepOrder)) {
    progress.completedSteps.push(stepOrder);
    progress.completedSteps.sort((a, b) => a - b);
  }
  
  // 更新当前步骤到下一步
  progress.currentStep = stepOrder + 1;
  
  return await progressRepo().save(progress);
}

// ============ Admin Functions ============

// 获取手册（管理员，不检查发布状态）
export async function getManualForAdmin(sourceType: number, sourceId: number): Promise<AgentManual | null> {
  const manual = await manualRepo().findOne({
    where: { sourceType, sourceId },
  });
  
  if (!manual) return null;
  
  // 单独查询步骤，避免 bigint 关联问题
  const steps = await stepRepo().find({
    where: { manualId: manual.id },
    order: { stepOrder: 'ASC' },
  });
  
  manual.steps = steps;
  return manual;
}

// 创建手册
export async function createManual(data: {
  sourceType: number;
  sourceId: number;
  title: string;
  description?: string;
}): Promise<AgentManual> {
  // 检查是否已存在
  const existing = await manualRepo().findOne({
    where: { sourceType: data.sourceType, sourceId: data.sourceId },
  });
  if (existing) {
    throw new Error('手册已存在');
  }

  const manual = manualRepo().create({
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    title: data.title,
    description: data.description || '',
    isPublished: 0,
  });

  return await manualRepo().save(manual);
}

// 更新手册
export async function updateManual(
  manualId: number,
  data: { title?: string; description?: string; isPublished?: number }
): Promise<AgentManual> {
  const manual = await manualRepo().findOne({ where: { id: manualId } });
  if (!manual) {
    throw new Error('手册不存在');
  }

  if (data.title !== undefined) manual.title = data.title;
  if (data.description !== undefined) manual.description = data.description;
  if (data.isPublished !== undefined) manual.isPublished = data.isPublished;

  return await manualRepo().save(manual);
}

// 删除手册
export async function deleteManual(manualId: number): Promise<void> {
  const manual = await manualRepo().findOne({ where: { id: manualId } });
  if (!manual) {
    throw new Error('手册不存在');
  }
  await manualRepo().remove(manual);
}

// 批量更新步骤
export async function updateSteps(
  manualId: number,
  steps: Array<{
    title: string;
    content: object;
    quickQuestions?: string[];
    verification?: object | null;
  }>
): Promise<AgentStep[]> {
  const manual = await manualRepo().findOne({ where: { id: manualId } });
  if (!manual) {
    throw new Error('手册不存在');
  }

  // 删除旧步骤
  await stepRepo().delete({ manualId });

  // 创建新步骤
  const newSteps = steps.map((s, index) => {
    return stepRepo().create({
      manualId,
      stepOrder: index,
      title: s.title,
      content: s.content as any,
      quickQuestions: s.quickQuestions || [],
      verification: s.verification as any,
    });
  });

  return await stepRepo().save(newSteps);
}


// ============ Markdown 解析功能 ============

interface ParsedStep {
  title: string;
  content: Array<{
    type: 'text' | 'heading' | 'code' | 'list';
    text?: string;
    language?: string;
    code?: string;
    items?: string[];
    executable?: boolean;
  }>;
  quickQuestions: string[];
  verification: {
    type: 'file_exists' | 'command_output' | 'service_running';
    path?: string;
    command?: string;
    expect?: string;
    value?: string;
    port?: number;
  } | null;
}

interface ParsedManual {
  title: string;
  description: string;
  steps: ParsedStep[];
}

// 解析 Markdown 为 Agent 手册格式
export function parseMarkdown(markdown: string): ParsedManual {
  // 统一换行符，处理 Windows 的 \r\n
  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedMarkdown.split('\n');
  
  let title = '';
  let description = '';
  const steps: ParsedStep[] = [];
  
  let currentStep: ParsedStep | null = null;
  let currentContent: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeContent: string[] = [];
  
  const flushContent = () => {
    if (currentStep && currentContent.length > 0) {
      const text = currentContent.join('\n').trim();
      if (text) {
        currentStep.content.push({ type: 'text', text });
      }
      currentContent = [];
    }
  };
  
  const flushCodeBlock = () => {
    if (currentStep && codeContent.length > 0) {
      const code = codeContent.join('\n');
      const executable = codeLanguage === 'bash' || codeLanguage === 'shell';
      currentStep.content.push({
        type: 'code',
        language: codeLanguage || 'text',
        code,
        executable,
      });
      codeContent = [];
      codeLanguage = '';
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 代码块处理
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 结束代码块
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        // 开始代码块
        flushContent();
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }
    
    // 一级标题 - 手册标题
    if (line.startsWith('# ') && !title) {
      title = line.slice(2).trim();
      continue;
    }
    
    // 引用块 - 手册描述
    if (line.startsWith('> ') && !description && !currentStep) {
      description = line.slice(2).trim();
      continue;
    }
    
    // 二级标题 - 步骤
    const stepMatch = line.match(/^## 步骤\s*(\d+)\s*[:：]\s*(.+)$/);
    if (stepMatch) {
      // 保存上一个步骤
      if (currentStep) {
        flushContent();
        steps.push(currentStep);
      }
      
      currentStep = {
        title: stepMatch[2].trim(),
        content: [],
        quickQuestions: [],
        verification: null,
      };
      currentContent = [];
      continue;
    }
    
    // 三级标题 - 作为 heading 内容
    if (line.startsWith('### ') && currentStep) {
      flushContent();
      currentStep.content.push({
        type: 'heading',
        text: line.slice(4).trim(),
      });
      continue;
    }
    
    // HTML 注释 - 验证规则
    const verifyMatch = line.match(/<!--\s*verify:\s*(.+?)\s*-->/);
    if (verifyMatch && currentStep) {
      const verifyStr = verifyMatch[1];
      const verification = parseVerification(verifyStr);
      if (verification) {
        currentStep.verification = verification;
      }
      continue;
    }
    
    // HTML 注释 - 快捷问题
    const questionsMatch = line.match(/<!--\s*questions:\s*(.+?)\s*-->/);
    if (questionsMatch && currentStep) {
      currentStep.quickQuestions = questionsMatch[1].split('|').map(q => q.trim()).filter(q => q);
      continue;
    }
    
    // 普通内容
    if (currentStep) {
      // 列表项
      if (line.match(/^[-*]\s+/)) {
        const lastContent = currentStep.content[currentStep.content.length - 1];
        if (lastContent && lastContent.type === 'list') {
          lastContent.items!.push(line.replace(/^[-*]\s+/, '').trim());
        } else {
          flushContent();
          currentStep.content.push({
            type: 'list',
            items: [line.replace(/^[-*]\s+/, '').trim()],
          });
        }
        continue;
      }
      
      currentContent.push(line);
    }
  }
  
  // 保存最后一个步骤
  if (currentStep) {
    flushContent();
    steps.push(currentStep);
  }
  
  return { title, description, steps };
}

// 解析验证规则字符串
function parseVerification(str: string): ParsedStep['verification'] {
  // file_exists:path
  if (str.startsWith('file_exists:')) {
    return {
      type: 'file_exists',
      path: str.slice('file_exists:'.length).trim(),
    };
  }
  
  // command:cmd|expect|value
  if (str.startsWith('command:')) {
    const parts = str.slice('command:'.length).split('|');
    return {
      type: 'command_output',
      command: parts[0]?.trim(),
      expect: parts[1]?.trim() as any || 'not_empty',
      value: parts[2]?.trim(),
    };
  }
  
  // service:port
  if (str.startsWith('service:')) {
    return {
      type: 'service_running',
      port: parseInt(str.slice('service:'.length).trim()) || 0,
    };
  }
  
  return null;
}

// 从 Markdown 导入手册
export async function importFromMarkdown(
  sourceType: number,
  sourceId: number,
  markdown: string
): Promise<AgentManual> {
  const parsed = parseMarkdown(markdown);
  
  // 检查是否已存在手册
  let manual = await manualRepo().findOne({
    where: { sourceType, sourceId },
  });
  
  if (manual) {
    // 更新现有手册
    manual.title = parsed.title || manual.title;
    manual.description = parsed.description || manual.description;
    await manualRepo().save(manual);
    
    // 删除旧步骤
    await stepRepo().delete({ manualId: manual.id });
  } else {
    // 创建新手册
    manual = manualRepo().create({
      sourceType,
      sourceId,
      title: parsed.title || '导入的手册',
      description: parsed.description || '',
      isPublished: 0,
    });
    await manualRepo().save(manual);
  }
  
  // 创建步骤
  const newSteps = parsed.steps.map((s, index) => {
    return stepRepo().create({
      manualId: manual!.id,
      stepOrder: index,
      title: s.title,
      content: s.content as any,
      quickQuestions: s.quickQuestions,
      verification: s.verification as any,
    });
  });
  
  if (newSteps.length > 0) {
    await stepRepo().save(newSteps);
  }
  
  // 返回完整手册（单独查询步骤避免 bigint 关联问题）
  const result = await manualRepo().findOne({
    where: { id: manual.id },
  });
  
  if (result) {
    result.steps = await stepRepo().find({
      where: { manualId: result.id },
      order: { stepOrder: 'ASC' },
    });
  }
  
  return result!;
}
