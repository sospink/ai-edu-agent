import { Request, Response } from 'express';
import http from 'http';
import { LabService } from '../services/LabService';
import { LabSourceType } from '../models/UserLabSession';
import { sendSuccess, sendError } from '../utils/response';
import { docker } from '../utils/docker';
import { extractToken, verifyToken } from '../utils/jwt';

export class LabController {
  private static getGatewayUserId(req: Request): number | null {
    const headerToken = extractToken(req.headers.authorization);
    const queryToken = typeof req.query.authToken === 'string' ? req.query.authToken : '';
    const token = headerToken || queryToken;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload?.userId) return null;

    return Number(payload.userId);
  }

  /**
   * 获取可用的 Docker 镜像列表（供管理后台选择）
   * GET /api/lab/images
   */
  static async getImages(_req: Request, res: Response) {
    try {
      const images = await docker.listImages();
      
      // 过滤并格式化镜像列表
      const result = images
        .filter(img => img.RepoTags && img.RepoTags.length > 0 && img.RepoTags[0] !== '<none>:<none>')
        .map(img => ({
          id: img.Id.substring(7, 19),
          fullId: img.Id,
          name: img.RepoTags?.[0] || '',
          tags: img.RepoTags || [],
          size: img.Size,
          created: img.Created,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return sendSuccess(res, result);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '获取镜像列表失败');
    }
  }

  /**
   * 获取当前用户的活跃实验会话
   * GET /api/lab/active
   */
  static async getActiveSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      // 确保 userId 是数字类型
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const session = await LabService.getActiveSession(userIdNum);
      
      if (session) {
        const urls = LabService.getLabUrls(session);
        return sendSuccess(res, {
          session,
          urls,
        });
      }

      return sendSuccess(res, null);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '获取会话失败');
    }
  }

  /**
   * 获取用户所有实验会话历史
   * GET /api/lab/sessions
   */
  static async getUserSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      // 确保 userId 是数字类型
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const sessions = await LabService.getUserSessions(userIdNum);
      return sendSuccess(res, sessions);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '获取会话列表失败');
    }
  }

  /**
   * 创建实验环境
   * POST /api/lab/create
   * Body: { sourceType: 1|2, sourceId: number }
   */
  static async createSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      // 确保 userId 是数字类型
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      const { sourceType, sourceId } = req.body;

      if (!sourceType || !sourceId) {
        return sendError(res, '缺少必要参数', 400);
      }

      if (sourceType !== LabSourceType.COURSE && sourceType !== LabSourceType.PROJECT) {
        return sendError(res, '无效的来源类型', 400);
      }

      const result = await LabService.createLabSession(userIdNum, sourceType, sourceId);

      if (result.success && result.data) {
        const urls = LabService.getLabUrls(result.data);
        return sendSuccess(res, {
          session: result.data,
          urls,
        });
      }

      return sendError(res, result.error || '创建失败');
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '创建实验环境失败');
    }
  }

  /**
   * 停止实验环境
   * POST /api/lab/stop/:sessionId
   */
  static async stopSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      // 确保 userId 是数字类型
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      const sessionId = parseInt(req.params.sessionId);
      if (!sessionId) {
        return sendError(res, '无效的会话ID', 400);
      }

      const result = await LabService.stopLabSession(userIdNum, sessionId);

      if (result.success) {
        return sendSuccess(res, { message: '实验环境已停止' });
      }

      return sendError(res, result.error || '停止失败');
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '停止实验环境失败');
    }
  }

  /**
   * 获取实验环境访问 URL
   * GET /api/lab/urls/:sessionId
   */
  static async getSessionUrls(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      // 确保 userId 是数字类型
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      const session = await LabService.getActiveSession(userIdNum);
      if (!session) {
        return sendError(res, '没有活跃的实验环境', 404);
      }

      // 同步状态
      await LabService.syncSessionStatus(session.id);

      const urls = LabService.getLabUrls(session);
      return sendSuccess(res, urls);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '获取URL失败');
    }
  }

  /**
   * 在容器中执行命令
   * POST /api/lab/execute
   * Body: { command: string }
   */
  static async executeCommand(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const { command } = req.body;

      if (!command) {
        return sendError(res, '缺少命令参数', 400);
      }

      // 获取用户活跃会话
      const session = await LabService.getActiveSession(userIdNum);
      if (!session) {
        return sendError(res, '没有活跃的实验环境', 404);
      }

      // 执行命令
      const result = await LabService.executeCommand(session.containerId, command);
      return sendSuccess(res, result);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : '执行命令失败');
    }
  }

  /**
   * Gateway 代理（用于 iframe 同源嵌入）
   * ALL /api/lab/gateway/:sessionId/*
   */
  static async proxyGateway(req: Request, res: Response) {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) {
        return sendError(res, '无效的会话ID', 400);
      }

      const userId = LabController.getGatewayUserId(req);
      if (!userId) {
        return sendError(res, '未登录', 401);
      }

      const session = await LabService.getActiveSession(userId);
      if (!session || Number(session.id) !== sessionId) {
        return sendError(res, '实验会话不存在或已过期', 404);
      }

      if (!session.gatewayPort || session.gatewayPort <= 0) {
        return sendError(res, '当前会话未启用 Gateway', 400);
      }

      const dockerHost = process.env.DOCKER_HOST || '192.168.20.3';
      const routePrefix = `/api/lab/gateway/${sessionId}`;
      let suffix = req.originalUrl.startsWith(routePrefix)
        ? req.originalUrl.slice(routePrefix.length)
        : '/';
      if (!suffix) suffix = '/';

      const upstreamUrl = new URL(`http://${dockerHost}:${session.gatewayPort}${suffix}`);
      upstreamUrl.searchParams.delete('authToken');

      const outgoingHeaders: http.OutgoingHttpHeaders = {
        ...req.headers,
        host: `${dockerHost}:${session.gatewayPort}`,
      };
      delete outgoingHeaders.authorization;
      delete outgoingHeaders.connection;
      delete outgoingHeaders['proxy-connection'];
      delete outgoingHeaders['content-length'];

      const proxyReq = http.request(
        {
          protocol: 'http:',
          hostname: dockerHost,
          port: session.gatewayPort,
          method: req.method,
          path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
          headers: outgoingHeaders,
        },
        (proxyRes) => {
          const blockedHeaders = new Set([
            'x-frame-options',
            'frame-options',
            'content-security-policy',
            'content-security-policy-report-only',
          ]);

          const responseHeaders: http.OutgoingHttpHeaders = {};
          const proxyBase = `${req.protocol}://${req.get('host')}/api/lab/gateway/${sessionId}`;
          const upstreamOrigin = `http://${dockerHost}:${session.gatewayPort}`;

          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (value === undefined) continue;
            const lowerKey = key.toLowerCase();
            if (blockedHeaders.has(lowerKey)) continue;

            if (lowerKey === 'location' && typeof value === 'string') {
              let nextLocation = value;
              if (value.startsWith(upstreamOrigin)) {
                nextLocation = `${proxyBase}${value.slice(upstreamOrigin.length)}`;
              } else if (value.startsWith('/')) {
                nextLocation = `${proxyBase}${value}`;
              }
              responseHeaders[key] = nextLocation;
              continue;
            }

            responseHeaders[key] = value;
          }

          res.writeHead(proxyRes.statusCode || 502, responseHeaders);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (error) => {
        if (!res.headersSent) {
          sendError(res, `Gateway 代理失败: ${error.message}`, 502);
        } else {
          res.end();
        }
      });

      req.pipe(proxyReq);
    } catch (error: unknown) {
      return sendError(res, error instanceof Error ? error.message : 'Gateway 代理失败');
    }
  }
}
