import { Request, Response } from 'express';
import { ProjectService } from '../services/ProjectService';
import { sendSuccess, sendError, sendCreated, sendBadRequest } from '../utils/response';

const projectService = new ProjectService();

export class TagController {
  async getAll(req: Request, res: Response) {
    try {
      const tags = await projectService.getAllTags();
      return sendSuccess(res, tags, '获取标签列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取标签列表失败';
      return sendError(res, message);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, styleColor } = req.body;

      if (!name) {
        return sendBadRequest(res, '标签名称不能为空');
      }

      const tag = await projectService.createTag(name, styleColor);
      return sendCreated(res, tag, '标签创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建标签失败';
      return sendBadRequest(res, message);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, styleColor } = req.body;

      const tag = await projectService.updateTag(id, name, styleColor);
      return sendSuccess(res, tag, '标签更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新标签失败';
      return sendBadRequest(res, message);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await projectService.deleteTag(id);
      return sendSuccess(res, null, '标签删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除标签失败';
      return sendBadRequest(res, message);
    }
  }
}
