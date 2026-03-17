import { Request, Response } from 'express';
import * as AgentService from '../services/AgentService';
import * as QwenService from '../services/QwenService';

// GET /api/agent/manual/:sourceType/:sourceId
export async function getManual(req: Request, res: Response) {
  try {
    const sourceType = parseInt(req.params.sourceType);
    const sourceId = parseInt(req.params.sourceId);

    if (isNaN(sourceType) || isNaN(sourceId)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const manual = await AgentService.getManual(sourceType, sourceId);

    if (!manual) {
      return res.status(404).json({ error: '手册不存在或未发布' });
    }

    // 转换步骤格式，适配前端
    const steps = manual.steps.map(step => ({
      id: step.stepOrder,
      title: step.title,
      content: step.content,
      quickQuestions: step.quickQuestions || [],
      verification: step.verification,
    }));

    res.json({
      id: manual.id,
      title: manual.title,
      description: manual.description,
      steps,
    });
  } catch (error: any) {
    console.error('[AgentController] getManual error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/agent/verify
export async function verifyStep(req: Request, res: Response) {
  try {
    const { manualId, stepOrder, containerId } = req.body;

    if (!manualId || stepOrder === undefined || !containerId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await AgentService.verifyStep(manualId, stepOrder, containerId);

    // 验证成功，标记步骤完成
    if (result.success) {
      const userId = (req as any).user?.userId;
      if (userId) {
        await AgentService.completeStep(userId, manualId, stepOrder);
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('[AgentController] verifyStep error:', error);
    res.status(500).json({ success: false, message: '验证服务错误', details: error.message });
  }
}

// POST /api/agent/chat
export async function chat(req: Request, res: Response) {
  try {
    const { question, stepContext, chatHistory } = req.body;

    if (!question) {
      return res.status(400).json({ error: '请输入问题' });
    }

    const result = await QwenService.chat({ question, stepContext, chatHistory });
    res.json(result);
  } catch (error: any) {
    console.error('[AgentController] chat error:', error);
    res.status(500).json({ error: error.message || 'AI 服务暂时不可用' });
  }
}

// POST /api/agent/chat/stream
export async function chatStream(req: Request, res: Response) {
  try {
    const { question, stepContext, chatHistory } = req.body;

    if (!question) {
      res.status(400).json({ error: '请输入问题' });
      return;
    }

    await QwenService.chatStream({ question, stepContext, chatHistory }, res);
  } catch (error: any) {
    console.error('[AgentController] chatStream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
  }
}

// POST /api/agent/explain
export async function explainCode(req: Request, res: Response) {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: '请提供代码' });
    }

    const explanation = await QwenService.explainCode(code, language || 'text');
    res.json({ explanation });
  } catch (error: any) {
    console.error('[AgentController] explainCode error:', error);
    res.status(500).json({ error: error.message || 'AI 服务暂时不可用' });
  }
}

// GET /api/agent/progress/:sourceType/:sourceId
export async function getProgress(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const sourceType = parseInt(req.params.sourceType);
    const sourceId = parseInt(req.params.sourceId);

    if (!userId) {
      return res.status(401).json({ error: '请先登录' });
    }

    // 先获取手册
    const manual = await AgentService.getManual(sourceType, sourceId);
    if (!manual) {
      return res.status(404).json({ error: '手册不存在' });
    }

    const progress = await AgentService.getProgress(userId, Number(manual.id));

    if (!progress) {
      return res.json({
        currentStep: 0,
        completedSteps: [],
        chatHistory: [],
      });
    }

    res.json({
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      chatHistory: progress.chatHistory,
    });
  } catch (error: any) {
    console.error('[AgentController] getProgress error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/agent/progress
export async function updateProgress(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const { sourceType, sourceId, currentStep, completedSteps, chatHistory } = req.body;

    if (!userId) {
      return res.status(401).json({ error: '请先登录' });
    }

    // 先获取手册
    const manual = await AgentService.getManual(sourceType, sourceId);
    if (!manual) {
      return res.status(404).json({ error: '手册不存在' });
    }

    const progress = await AgentService.updateProgress(userId, Number(manual.id), {
      currentStep,
      completedSteps,
      chatHistory,
    });

    res.json({
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      chatHistory: progress.chatHistory,
    });
  } catch (error: any) {
    console.error('[AgentController] updateProgress error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}

// ============ Admin API ============

// GET /api/admin/agent/manual/:sourceType/:sourceId
export async function getManualForAdmin(req: Request, res: Response) {
  try {
    const sourceType = parseInt(req.params.sourceType);
    const sourceId = parseInt(req.params.sourceId);

    if (isNaN(sourceType) || isNaN(sourceId)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const manual = await AgentService.getManualForAdmin(sourceType, sourceId);

    if (!manual) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      id: manual.id,
      title: manual.title,
      description: manual.description,
      isPublished: manual.isPublished,
      steps: manual.steps.map(step => ({
        id: step.id,
        stepOrder: step.stepOrder,
        title: step.title,
        content: step.content,
        quickQuestions: step.quickQuestions || [],
        verification: step.verification,
      })),
    });
  } catch (error: any) {
    console.error('[AgentController] getManualForAdmin error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/admin/agent/manual
export async function createManual(req: Request, res: Response) {
  try {
    const { sourceType, sourceId, title, description } = req.body;

    if (!sourceType || !sourceId || !title) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const manual = await AgentService.createManual({
      sourceType,
      sourceId,
      title,
      description,
    });

    res.json({
      id: manual.id,
      title: manual.title,
      description: manual.description,
      isPublished: manual.isPublished,
    });
  } catch (error: any) {
    console.error('[AgentController] createManual error:', error);
    if (error.message === '手册已存在') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

// PUT /api/admin/agent/manual/:id
export async function updateManual(req: Request, res: Response) {
  try {
    const manualId = parseInt(req.params.id);
    const { title, description, isPublished } = req.body;

    if (isNaN(manualId)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const manual = await AgentService.updateManual(manualId, {
      title,
      description,
      isPublished,
    });

    res.json({
      id: manual.id,
      title: manual.title,
      description: manual.description,
      isPublished: manual.isPublished,
    });
  } catch (error: any) {
    console.error('[AgentController] updateManual error:', error);
    if (error.message === '手册不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

// DELETE /api/admin/agent/manual/:id
export async function deleteManual(req: Request, res: Response) {
  try {
    const manualId = parseInt(req.params.id);

    if (isNaN(manualId)) {
      return res.status(400).json({ error: '参数错误' });
    }

    await AgentService.deleteManual(manualId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AgentController] deleteManual error:', error);
    if (error.message === '手册不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/admin/agent/manual/:id/steps
export async function updateSteps(req: Request, res: Response) {
  try {
    const manualId = parseInt(req.params.id);
    const { steps } = req.body;

    if (isNaN(manualId)) {
      return res.status(400).json({ error: '参数错误' });
    }

    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: '步骤数据格式错误' });
    }

    const savedSteps = await AgentService.updateSteps(manualId, steps);

    res.json({
      steps: savedSteps.map(step => ({
        id: step.id,
        stepOrder: step.stepOrder,
        title: step.title,
        content: step.content,
        quickQuestions: step.quickQuestions || [],
        verification: step.verification,
      })),
    });
  } catch (error: any) {
    console.error('[AgentController] updateSteps error:', error);
    if (error.message === '手册不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/agent/suggestion
export async function getVerificationSuggestion(req: Request, res: Response) {
  try {
    const { stepTitle, stepContext, verificationType, errorMessage, errorDetails } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: '缺少错误信息' });
    }

    const suggestion = await QwenService.getVerificationHelp({
      stepTitle,
      stepContext,
      verificationType,
      errorMessage,
      errorDetails,
    });

    res.json({ suggestion });
  } catch (error: any) {
    console.error('[AgentController] getVerificationSuggestion error:', error);
    res.status(500).json({ error: 'AI 服务暂时不可用' });
  }
}

// POST /api/agent/prompt-enhance
export async function promptEnhance(req: Request, res: Response) {
  try {
    const { rawPrompt, mode } = req.body;

    if (!rawPrompt) {
      return res.status(400).json({ error: '请输入原始提示词' });
    }

    const result = await QwenService.promptEnhance({
      rawPrompt,
      mode: mode || '通用',
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[AgentController] promptEnhance error:', error);
    res.status(500).json({ error: error.message || 'AI 提示词优化服务暂时不可用' });
  }
}

// POST /api/admin/agent/import
export async function importMarkdown(req: Request, res: Response) {
  try {
    const { sourceType, sourceId, markdown } = req.body;

    if (!sourceType || !sourceId || !markdown) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const manual = await AgentService.importFromMarkdown(sourceType, sourceId, markdown);

    res.json({
      success: true,
      id: manual.id,
      title: manual.title,
      description: manual.description,
      isPublished: manual.isPublished,
      stepsCount: manual.steps.length,
    });
  } catch (error: any) {
    console.error('[AgentController] importMarkdown error:', error);
    res.status(500).json({ error: error.message || '导入失败' });
  }
}

// POST /api/admin/agent/parse-preview
export async function parseMarkdownPreview(req: Request, res: Response) {
  try {
    const { markdown } = req.body;

    if (!markdown) {
      return res.status(400).json({ error: '缺少 Markdown 内容' });
    }

    const parsed = AgentService.parseMarkdown(markdown);

    res.json({
      title: parsed.title,
      description: parsed.description,
      steps: parsed.steps.map((step, index) => ({
        stepOrder: index,
        title: step.title,
        content: step.content,
        quickQuestions: step.quickQuestions,
        verification: step.verification,
      })),
    });
  } catch (error: any) {
    console.error('[AgentController] parseMarkdownPreview error:', error);
    res.status(500).json({ error: '解析失败' });
  }
}
