import { Request, Response } from 'express';
import { CourseService } from '../services/CourseService';
import { sendSuccess, sendError, sendCreated, sendNotFound, sendBadRequest } from '../utils/response';
import { CourseStatus } from '../models/Course';

const courseService = new CourseService();

export class CourseController {
  // ==================== 课程 CRUD ====================

  async getAll(req: Request, res: Response) {
    try {
      const { page, pageSize, keyword, status, difficulty } = req.query;
      const result = await courseService.findAll({
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 10,
        keyword: keyword as string,
        status: status !== undefined ? parseInt(status as string) : undefined,
        difficulty: difficulty !== undefined ? parseInt(difficulty as string) : undefined,
      });
      return sendSuccess(res, result, '获取课程列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课程列表失败';
      return sendError(res, message);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const course = await courseService.findById(id);
      if (!course) {
        return sendNotFound(res, '课程不存在');
      }
      return sendSuccess(res, course, '获取课程成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课程失败';
      return sendError(res, message);
    }
  }

  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const course = await courseService.findBySlug(slug);
      if (!course) {
        return sendNotFound(res, '课程不存在');
      }
      return sendSuccess(res, course, '获取课程成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课程失败';
      return sendError(res, message);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { title, slug, description, iconUrl, coverColor, difficulty, status, estimatedHours, envImage, ideImage } = req.body;

      if (!title || !slug) {
        return sendBadRequest(res, '课程名称和 Slug 不能为空');
      }

      const course = await courseService.create({
        title,
        slug,
        description,
        iconUrl,
        coverColor,
        difficulty,
        status,
        estimatedHours,
        envImage,
        ideImage,
      });

      return sendCreated(res, course, '课程创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建课程失败';
      return sendBadRequest(res, message);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title, slug, description, iconUrl, coverColor, difficulty, status, estimatedHours, envImage, ideImage } = req.body;

      const course = await courseService.update(id, {
        title,
        slug,
        description,
        iconUrl,
        coverColor,
        difficulty,
        status,
        estimatedHours,
        envImage,
        ideImage,
      });

      return sendSuccess(res, course, '课程更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新课程失败';
      return sendBadRequest(res, message);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await courseService.delete(id);
      return sendSuccess(res, null, '课程删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除课程失败';
      return sendBadRequest(res, message);
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const course = await courseService.updateStatus(id, CourseStatus.PUBLISHED);
      return sendSuccess(res, course, '课程已发布');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '发布课程失败';
      return sendBadRequest(res, message);
    }
  }

  async archive(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const course = await courseService.updateStatus(id, CourseStatus.ARCHIVED);
      return sendSuccess(res, course, '课程已下架');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '下架课程失败';
      return sendBadRequest(res, message);
    }
  }

  async draft(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const course = await courseService.updateStatus(id, CourseStatus.DRAFT);
      return sendSuccess(res, course, '课程已设为草稿');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '设置草稿失败';
      return sendBadRequest(res, message);
    }
  }


  // ==================== 阶段 CRUD ====================

  async getStages(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      const stages = await courseService.getCourseStages(courseId);
      return sendSuccess(res, stages, '获取阶段列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取阶段列表失败';
      return sendError(res, message);
    }
  }

  async createStage(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      const { title, description, sortOrder, levelLabel } = req.body;

      if (!title) {
        return sendBadRequest(res, '阶段名称不能为空');
      }

      const stage = await courseService.createStage({
        courseId,
        title,
        description,
        sortOrder,
        levelLabel,
      });

      return sendCreated(res, stage, '阶段创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建阶段失败';
      return sendBadRequest(res, message);
    }
  }

  async updateStage(req: Request, res: Response) {
    try {
      const stageId = parseInt(req.params.stageId);
      const { title, description, sortOrder, levelLabel } = req.body;

      const stage = await courseService.updateStage(stageId, {
        title,
        description,
        sortOrder,
        levelLabel,
      });

      return sendSuccess(res, stage, '阶段更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新阶段失败';
      return sendBadRequest(res, message);
    }
  }

  async deleteStage(req: Request, res: Response) {
    try {
      const stageId = parseInt(req.params.stageId);
      await courseService.deleteStage(stageId);
      return sendSuccess(res, null, '阶段删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除阶段失败';
      return sendBadRequest(res, message);
    }
  }

  async reorderStages(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      const { orders } = req.body;

      if (!orders || !Array.isArray(orders)) {
        return sendBadRequest(res, '排序数据格式错误');
      }

      const stages = await courseService.reorderStages(courseId, orders);
      return sendSuccess(res, stages, '阶段排序更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新排序失败';
      return sendBadRequest(res, message);
    }
  }

  // ==================== 课时 CRUD ====================

  async getLessons(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      const lessons = await courseService.getCourseLessons(courseId);
      return sendSuccess(res, lessons, '获取课时列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课时列表失败';
      return sendError(res, message);
    }
  }

  async getStageLessons(req: Request, res: Response) {
    try {
      const stageId = parseInt(req.params.stageId);
      const lessons = await courseService.getStageLessons(stageId);
      return sendSuccess(res, lessons, '获取课时列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课时列表失败';
      return sendError(res, message);
    }
  }

  async createLesson(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      const stageId = parseInt(req.params.stageId);
      const { title, type, durationMinutes, labIdentifier, points, sortOrder, skillIds } = req.body;

      if (!title) {
        return sendBadRequest(res, '课时标题不能为空');
      }

      const lesson = await courseService.createLesson({
        courseId,
        stageId,
        title,
        type,
        durationMinutes,
        labIdentifier,
        points,
        sortOrder,
        skillIds,
      });

      return sendCreated(res, lesson, '课时创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建课时失败';
      return sendBadRequest(res, message);
    }
  }

  async updateLesson(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const { title, type, durationMinutes, labIdentifier, points, sortOrder, skillIds } = req.body;

      const lesson = await courseService.updateLesson(lessonId, {
        title,
        type,
        durationMinutes,
        labIdentifier,
        points,
        sortOrder,
        skillIds,
      });

      return sendSuccess(res, lesson, '课时更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新课时失败';
      return sendBadRequest(res, message);
    }
  }

  async deleteLesson(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      await courseService.deleteLesson(lessonId);
      return sendSuccess(res, null, '课时删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除课时失败';
      return sendBadRequest(res, message);
    }
  }

  async reorderLessons(req: Request, res: Response) {
    try {
      const stageId = parseInt(req.params.stageId);
      const { orders } = req.body;

      if (!orders || !Array.isArray(orders)) {
        return sendBadRequest(res, '排序数据格式错误');
      }

      const lessons = await courseService.reorderLessons(stageId, orders);
      return sendSuccess(res, lessons, '课时排序更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新排序失败';
      return sendBadRequest(res, message);
    }
  }


  // ==================== 技能管理 ====================

  async getAllSkills(req: Request, res: Response) {
    try {
      const skills = await courseService.getAllSkills();
      return sendSuccess(res, skills, '获取技能列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取技能列表失败';
      return sendError(res, message);
    }
  }

  async getSkillsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const skills = await courseService.getSkillsByCategory(category);
      return sendSuccess(res, skills, '获取技能列表成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取技能列表失败';
      return sendError(res, message);
    }
  }

  async createSkill(req: Request, res: Response) {
    try {
      const { name, category } = req.body;

      if (!name) {
        return sendBadRequest(res, '技能名称不能为空');
      }

      const skill = await courseService.createSkill(name, category);
      return sendCreated(res, skill, '技能创建成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建技能失败';
      return sendBadRequest(res, message);
    }
  }

  async updateSkill(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, category } = req.body;

      const skill = await courseService.updateSkill(id, name, category);
      return sendSuccess(res, skill, '技能更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新技能失败';
      return sendBadRequest(res, message);
    }
  }

  async deleteSkill(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await courseService.deleteSkill(id);
      return sendSuccess(res, null, '技能删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除技能失败';
      return sendBadRequest(res, message);
    }
  }

  // ==================== 用户学习进度 ====================

  async getUserEnrollments(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const enrollments = await courseService.getUserEnrollments(userId);
      return sendSuccess(res, enrollments, '获取学习记录成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取学习记录失败';
      return sendError(res, message);
    }
  }

  async getContinueLearning(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const result = await courseService.getContinueLearning(userId);
      return sendSuccess(res, result, '获取继续学习信息成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取继续学习信息失败';
      return sendError(res, message);
    }
  }

  async enrollCourse(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const courseId = parseInt(req.params.id);
      const enrollment = await courseService.enrollCourse(userId, courseId);
      return sendSuccess(res, enrollment, '加入课程成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加入课程失败';
      return sendBadRequest(res, message);
    }
  }

  async getUserLessonRecords(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const courseId = parseInt(req.params.id);
      const records = await courseService.getUserLessonRecords(userId, courseId);
      return sendSuccess(res, records, '获取课时记录成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课时记录失败';
      return sendError(res, message);
    }
  }

  async startLesson(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const lessonId = parseInt(req.params.lessonId);
      const record = await courseService.startLesson(userId, lessonId);
      return sendSuccess(res, record, '开始学习成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '开始学习失败';
      return sendBadRequest(res, message);
    }
  }

  async completeLesson(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const lessonId = parseInt(req.params.lessonId);
      const { score } = req.body;
      
      // 完成课时
      const record = await courseService.completeLesson(userId, lessonId, score);
      
      // 获取课时信息以返回获得的经验值
      const lesson = await courseService.getLessonById(lessonId);
      const earnedXP = lesson?.points || 0;
      
      return sendSuccess(res, {
        record,
        earnedXP
      }, '完成学习成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '完成学习失败';
      return sendBadRequest(res, message);
    }
  }

  async getUserActivityLogs(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return sendBadRequest(res, '用户未登录');
      }

      const days = req.query.days ? parseInt(req.query.days as string) : 365;
      const logs = await courseService.getUserActivityLogs(userId, days);
      return sendSuccess(res, logs, '获取活跃记录成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取活跃记录失败';
      return sendError(res, message);
    }
  }

  async getLessonById(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const lesson = await courseService.getLessonById(lessonId);
      if (!lesson) {
        return sendNotFound(res, '课时不存在');
      }
      return sendSuccess(res, lesson, '获取课时成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取课时失败';
      return sendError(res, message);
    }
  }

  // ==================== 课时学习资料管理 ====================

  async getLessonMaterials(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const materials = await courseService.getLessonMaterials(lessonId);
      return sendSuccess(res, materials, '获取学习资料成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取学习资料失败';
      return sendError(res, message);
    }
  }

  async uploadMaterial(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const file = req.file;

      if (!file) {
        return sendBadRequest(res, '请选择要上传的文件');
      }

      const title = req.body.title || file.originalname;
      const materialType = courseService.getMaterialTypeFromExt(file.originalname);
      const fileUrl = `/uploads/materials/${file.filename}`;

      const material = await courseService.createMaterial({
        lessonId,
        title,
        type: materialType,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        sortOrder: req.body.sortOrder ? parseInt(req.body.sortOrder) : 0,
      });

      return sendCreated(res, material, '学习资料上传成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '上传学习资料失败';
      return sendBadRequest(res, message);
    }
  }

  async updateMaterial(req: Request, res: Response) {
    try {
      const materialId = parseInt(req.params.materialId);
      const { title, sortOrder } = req.body;

      const material = await courseService.updateMaterial(materialId, {
        title,
        sortOrder,
      });

      return sendSuccess(res, material, '学习资料更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新学习资料失败';
      return sendBadRequest(res, message);
    }
  }

  async deleteMaterial(req: Request, res: Response) {
    try {
      const materialId = parseInt(req.params.materialId);
      await courseService.deleteMaterial(materialId);
      return sendSuccess(res, null, '学习资料删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除学习资料失败';
      return sendBadRequest(res, message);
    }
  }

  async reorderMaterials(req: Request, res: Response) {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const { orders } = req.body;

      if (!orders || !Array.isArray(orders)) {
        return sendBadRequest(res, '排序数据格式错误');
      }

      const materials = await courseService.reorderMaterials(lessonId, orders);
      return sendSuccess(res, materials, '学习资料排序更新成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新排序失败';
      return sendBadRequest(res, message);
    }
  }
}
