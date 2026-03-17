import { Request, Response } from 'express';
import crypto from 'crypto';
import { OpenclawViewScope, OpenclawViewService } from '../services/OpenclawViewService';
import { FeishuClient } from '../services/FeishuClient';
import { OpenClawClient } from '../services/OpenClawClient';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';

const viewService = new OpenclawViewService();
const feishuClient = new FeishuClient();
const openClawClient = new OpenClawClient();

export class OpenclawViewController {
  static async getThinking(req: Request, res: Response) {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      if (!sessionId) {
        return OpenclawViewController.sendApiError(res, '缺少 sessionId 参数', 'INVALID_SESSION_ID', 400);
      }

      const limitRaw = Number(req.query.limit || 20);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
      const scope = OpenclawViewController.parseScope(req.query.scope);
      const sinceTs = OpenclawViewController.parseSinceTs(req.query.sinceTs);

      const data = await viewService.getThinkingView(sessionId, limit, { scope, sinceTs });
      return sendSuccess(res, data);
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'OPENCLAW_THINKING_FAILED');
    }
  }

  static async getExecuting(req: Request, res: Response) {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      if (!sessionId) {
        return OpenclawViewController.sendApiError(res, '缺少 sessionId 参数', 'INVALID_SESSION_ID', 400);
      }
      const scope = OpenclawViewController.parseScope(req.query.scope);
      const sinceTs = OpenclawViewController.parseSinceTs(req.query.sinceTs);

      const data = await viewService.getExecutingView(sessionId, { scope, sinceTs });
      return sendSuccess(res, data);
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'OPENCLAW_EXECUTING_FAILED');
    }
  }

  static async getCompleted(req: Request, res: Response) {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      if (!sessionId) {
        return OpenclawViewController.sendApiError(res, '缺少 sessionId 参数', 'INVALID_SESSION_ID', 400);
      }
      const scope = OpenclawViewController.parseScope(req.query.scope);
      const sinceTs = OpenclawViewController.parseSinceTs(req.query.sinceTs);

      const data = await viewService.getCompletedView(sessionId, { scope, sinceTs });
      return sendSuccess(res, data);
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'OPENCLAW_COMPLETED_FAILED');
    }
  }

  /**
   * 获取当前阶段（用于前端自动流转）
   * 逻辑：有完成产出物→completed；有执行事件→executing；否则→thinking
   */
  static async getPhase(req: Request, res: Response) {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      if (!sessionId) {
        return OpenclawViewController.sendApiError(res, '缺少 sessionId 参数', 'INVALID_SESSION_ID', 400);
      }
      const scope = OpenclawViewController.parseScope(req.query.scope);
      const sinceTs = OpenclawViewController.parseSinceTs(req.query.sinceTs);

      // 并行获取执行和完成的视图数据
      const [executingView, completedView] = await Promise.all([
        viewService.getExecutingView(sessionId, { scope, sinceTs }).catch(() => null),
        viewService.getCompletedView(sessionId, { scope, sinceTs }).catch(() => null),
      ]);

      // 判断阶段：完成态优先（有产出物）→执行态（有事件）→思考态
      let phase: 'thinking' | 'executing' | 'completed' = 'thinking';

      const hasArtifacts = (completedView?.artifacts?.length || 0) > 0;
      const hasCompletedSummary = completedView?.summary && completedView.summary !== '执行完成，暂无总结内容';

      const hasEvents = (executingView?.events?.length || 0) > 0;
      const progress = executingView?.progress || 0;

      if (hasArtifacts || (hasCompletedSummary && progress >= 100)) {
        phase = 'completed';
      } else if (hasEvents && progress > 0) {
        phase = 'executing';
      }

      return sendSuccess(res, {
        phase,
        progress,
        eventsCount: executingView?.events?.length || 0,
        artifactsCount: completedView?.artifacts?.length || 0,
      });
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'OPENCLAW_PHASE_FAILED');
    }
  }

  static async getOpenClawHealth(_req: Request, res: Response) {
    try {
      const data = await viewService.getOpenClawHealth();
      return sendSuccess(res, data);
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'OPENCLAW_HEALTH_FAILED');
    }
  }

  static async getFeishuHealth(_req: Request, res: Response) {
    try {
      const data = await viewService.getFeishuHealth();
      return sendSuccess(res, data);
    } catch (error) {
      return OpenclawViewController.handleError(res, error, 'FEISHU_HEALTH_FAILED');
    }
  }

  private static handleError(res: Response, error: unknown, code: string) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = OpenclawViewController.resolveStatusCode(message);
    return OpenclawViewController.sendApiError(res, message, code, statusCode, error);
  }

  private static resolveStatusCode(message: string): number {
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes('未配置')
      || lowerMessage.includes('config')
      || lowerMessage.includes('missing')
      || lowerMessage.includes('invalid_session_id')
    ) {
      return 400;
    }

    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('认证')) {
      return 401;
    }

    return 500;
  }

  private static parseScope(raw: unknown): OpenclawViewScope {
    const value = String(raw || '').trim().toLowerCase();
    return value === 'all' ? 'all' : 'latest_turn';
  }

  private static parseSinceTs(raw: unknown): number | undefined {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed > 1e12 ? parsed : parsed * 1000;
  }

  private static sendApiError(
    res: Response,
    message: string,
    code: string,
    statusCode: number,
    error?: unknown,
  ) {
    const traceId = crypto.randomUUID();
    logger.error(`[OpenclawViewController] traceId=${traceId} code=${code} message=${message}`, error);

    return res.status(statusCode).json({
      success: false,
      error: message,
      code,
      traceId,
    });
  }

  static async downloadFile(req: Request, res: Response) {
    try {
      const messageId = String(req.params.messageId || '').trim();
      const fileKey = String(req.params.fileKey || '').trim();
      const fileName = String(req.query.name || 'download').trim();

      if (!messageId || !fileKey) {
        return OpenclawViewController.sendApiError(res, '缺少 messageId 或 fileKey', 'INVALID_PARAMS', 400);
      }

      const result = await feishuClient.getMessageResource(messageId, fileKey, 'file');

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', result.data.length);
      return res.send(result.data);
    } catch (error) {
      return OpenclawViewController.sendApiError(res, '文件下载失败', 'FILE_DOWNLOAD_ERROR', 500, error);
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) {
        return OpenclawViewController.sendApiError(res, '消息内容不能为空', 'EMPTY_MESSAGE', 400);
      }

      const chatId = (process.env.FEISHU_CHAT_ID || '').trim();
      if (!chatId) {
        return OpenclawViewController.sendApiError(res, '未配置飞书群组 ID', 'MISSING_CHAT_ID', 500);
      }

      // session key 格式: agent:main:feishu:group:{chatId}
      const sessionKey = `agent:main:feishu:group:${chatId}`;

      // 通过 OpenClaw HTTP /chat 接口发送，作为用户指令处理（Bot 会在飞书群里回复）
      const result = await openClawClient.sendChatMessage(sessionKey, text);
      return sendSuccess(res, result);
    } catch (error) {
      return OpenclawViewController.sendApiError(res, '发送消息失败', 'SEND_MESSAGE_ERROR', 500, error);
    }
  }
}
