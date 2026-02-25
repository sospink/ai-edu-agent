import { Request, Response } from 'express';
import { ProjectService } from '../services/ProjectService';
import { sendSuccess, sendError, sendCreated, sendNotFound, sendBadRequest } from '../utils/response';
import { ProjectStatus } from '../models/Project';

const projectService = new ProjectService();

export class ProjectController {
  // ==================== 项目 CRUD ====================

  async getAll(req: Request, res: Response) {
    try {
      const { page, pageSize, keyword, status, difficulty, tagId } = req.query;
      const result = await projectService.findAll({
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 10,
        keyword: keyword as string,
        status: status !== undefined ? parseInt(status as string) : undefined,
        difficulty: difficulty !== undefined ? parseInt(difficulty as string) : undefined,
        tagId: tagId ? parseInt(tagId as string) : undefined,
      });
      return sendSuccess(res, result, '获取项目列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取项目列表失败';
      return sendError(res, message);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const project = await projectService.findById(id);
      if (!project) {
        return sendNotFound(res, '项目不存在');
      }
      return sendSuccess(res, project, '获取项目成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取项目失败';
      return sendError(res, message);
    }
  }

  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const project = await projectService.findBySlug(slug);
      if (!project) {
        return sendNotFound(res, '项目不存在');
      }
      return sendSuccess(res, project, '获取项目成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取项目失败';
      return sendError(res, message);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { title, slug, subtitle, coverUrl, difficulty, status, description, learningGoals, prerequisites, tagIds, envImage, ideImage } =
        req.body;

      if (!title || !slug) {
        return sendBadRequest(res, '项目名称和 Slug 不能为空');
      }

      // 从认证中间件获取当前用户ID
      const createdBy = req.user?.userId || 0;

      const project = await projectService.create({
        title,
        slug,
        subtitle,
        coverUrl,
        difficulty,
        status,
        description,
        learningGoals,
        prerequisites,
        tagIds,
        createdBy,
        envImage,
        ideImage,
      });

      return sendCreated(res, project, '项目创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建项目失败';
      return sendBadRequest(res, message);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title, slug, subtitle, coverUrl, difficulty, status, description, learningGoals, prerequisites, tagIds, envImage, ideImage } =
        req.body;

      const project = await projectService.update(id, {
        title,
        slug,
        subtitle,
        coverUrl,
        difficulty,
        status,
        description,
        learningGoals,
        prerequisites,
        tagIds,
        envImage,
        ideImage,
      });

      return sendSuccess(res, project, '项目更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新项目失败';
      return sendBadRequest(res, message);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await projectService.delete(id);
      return sendSuccess(res, null, '项目删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除项目失败';
      return sendBadRequest(res, message);
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const project = await projectService.updateStatus(id, ProjectStatus.PUBLISHED);
      return sendSuccess(res, project, '项目已发布');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '发布项目失败';
      return sendBadRequest(res, message);
    }
  }

  async archive(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const project = await projectService.updateStatus(id, ProjectStatus.ARCHIVED);
      return sendSuccess(res, project, '项目已下架');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '下架项目失败';
      return sendBadRequest(res, message);
    }
  }

  async draft(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const project = await projectService.updateStatus(id, ProjectStatus.DRAFT);
      return sendSuccess(res, project, '项目已设为草稿');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '设置草稿失败';
      return sendBadRequest(res, message);
    }
  }

  // ==================== 项目单元 CRUD ====================

  async getUnits(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const units = await projectService.getProjectUnits(projectId);
      return sendSuccess(res, units, '获取单元列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取单元列表失败';
      return sendError(res, message);
    }
  }

  async createUnit(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const { title, description, type, modeGroup, envId, timeLimit, points, sortOrder, isHidden } = req.body;

      if (!title) {
        return sendBadRequest(res, '单元标题不能为空');
      }

      const unit = await projectService.createUnit({
        projectId,
        title,
        description,
        type,
        modeGroup,
        envId,
        timeLimit,
        points,
        sortOrder,
        isHidden,
      });

      return sendCreated(res, unit, '单元创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建单元失败';
      return sendBadRequest(res, message);
    }
  }

  async updateUnit(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.unitId);
      const { title, description, type, modeGroup, envId, timeLimit, points, sortOrder, isHidden } = req.body;

      const unit = await projectService.updateUnit(unitId, {
        title,
        description,
        type,
        modeGroup,
        envId,
        timeLimit,
        points,
        sortOrder,
        isHidden,
      });

      return sendSuccess(res, unit, '单元更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新单元失败';
      return sendBadRequest(res, message);
    }
  }

  async deleteUnit(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.unitId);
      await projectService.deleteUnit(unitId);
      return sendSuccess(res, null, '单元删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除单元失败';
      return sendBadRequest(res, message);
    }
  }

  async reorderUnits(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const { orders } = req.body; // [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]

      if (!orders || !Array.isArray(orders)) {
        return sendBadRequest(res, '排序数据格式错误');
      }

      const units = await projectService.reorderUnits(projectId, orders);
      return sendSuccess(res, units, '单元排序更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新排序失败';
      return sendBadRequest(res, message);
    }
  }
}
