import { Request, Response } from "express";
import { LabService } from "../services/LabService";
import { LabSourceType } from "../models/UserLabSession";
import { sendSuccess, sendError } from "../utils/response";
import { docker } from "../utils/docker";

export class LabController {
  /**
   * 获取可用的 Docker 镜像列表（供管理后台选择）
   * GET /api/lab/images
   */
  static async getImages(_req: Request, res: Response) {
    try {
      const images = await docker.listImages();

      // 过滤并格式化镜像列表
      const result = images
        .filter(
          (img) =>
            img.RepoTags &&
            img.RepoTags.length > 0 &&
            img.RepoTags[0] !== "<none>:<none>",
        )
        .map((img) => ({
          id: img.Id.substring(7, 19),
          fullId: img.Id,
          name: img.RepoTags?.[0] || "",
          tags: img.RepoTags || [],
          size: img.Size,
          created: img.Created,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return sendSuccess(res, result);
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "获取镜像列表失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      // 确保 userId 是数字类型
      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;
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
      return sendError(
        res,
        error instanceof Error ? error.message : "获取会话失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      // 确保 userId 是数字类型
      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;
      const sessions = await LabService.getUserSessions(userIdNum);
      return sendSuccess(res, sessions);
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "获取会话列表失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      // 确保 userId 是数字类型
      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;

      const { sourceType, sourceId } = req.body;

      if (!sourceType || !sourceId) {
        return sendError(res, "缺少必要参数", 400);
      }

      if (
        sourceType !== LabSourceType.COURSE &&
        sourceType !== LabSourceType.PROJECT
      ) {
        return sendError(res, "无效的来源类型", 400);
      }

      const result = await LabService.createLabSession(
        userIdNum,
        sourceType,
        sourceId,
      );

      if (result.success && result.data) {
        const urls = LabService.getLabUrls(result.data);
        return sendSuccess(res, {
          session: result.data,
          urls,
        });
      }

      return sendError(res, result.error || "创建失败");
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "创建实验环境失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      // 确保 userId 是数字类型
      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;

      const sessionId = parseInt(req.params.sessionId);
      if (!sessionId) {
        return sendError(res, "无效的会话ID", 400);
      }

      const result = await LabService.stopLabSession(userIdNum, sessionId);

      if (result.success) {
        return sendSuccess(res, { message: "实验环境已停止" });
      }

      return sendError(res, result.error || "停止失败");
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "停止实验环境失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      // 确保 userId 是数字类型
      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;

      const session = await LabService.getActiveSession(userIdNum);
      if (!session) {
        return sendError(res, "没有活跃的实验环境", 404);
      }

      // 同步状态
      await LabService.syncSessionStatus(session.id);

      const urls = LabService.getLabUrls(session);
      return sendSuccess(res, urls);
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "获取URL失败",
      );
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
        return sendError(res, "未登录", 401);
      }

      const userIdNum =
        typeof userId === "string" ? parseInt(userId, 10) : userId;
      const { command } = req.body;

      if (!command) {
        return sendError(res, "缺少命令参数", 400);
      }

      // 获取用户活跃会话
      const session = await LabService.getActiveSession(userIdNum);
      if (!session) {
        return sendError(res, "没有活跃的实验环境", 404);
      }

      // 执行命令
      const result = await LabService.executeCommand(
        session.containerId,
        command,
      );
      return sendSuccess(res, result);
    } catch (error: unknown) {
      return sendError(
        res,
        error instanceof Error ? error.message : "执行命令失败",
      );
    }
  }
}
