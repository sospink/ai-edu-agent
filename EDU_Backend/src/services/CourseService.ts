import { AppDataSource } from '../config/database';
import { Course, CourseStatus } from '../models/Course';
import { CourseStage } from '../models/CourseStage';
import { CourseLesson, LessonType } from '../models/CourseLesson';
import { Skill } from '../models/Skill';
import { LessonSkill } from '../models/LessonSkill';
import { LessonMaterial, MaterialType } from '../models/LessonMaterial';
import { UserCourseEnrollment, EnrollmentStatus } from '../models/UserCourseEnrollment';
import { UserLessonRecord, LessonRecordStatus } from '../models/UserLessonRecord';
import { UserActivityLog } from '../models/UserActivityLog';
import { In } from 'typeorm';
import path from 'path';
import fs from 'fs';

const courseRepo = () => AppDataSource.getRepository(Course);
const stageRepo = () => AppDataSource.getRepository(CourseStage);
const lessonRepo = () => AppDataSource.getRepository(CourseLesson);
const skillRepo = () => AppDataSource.getRepository(Skill);
const lessonSkillRepo = () => AppDataSource.getRepository(LessonSkill);
const materialRepo = () => AppDataSource.getRepository(LessonMaterial);
const enrollmentRepo = () => AppDataSource.getRepository(UserCourseEnrollment);
const lessonRecordRepo = () => AppDataSource.getRepository(UserLessonRecord);
const activityLogRepo = () => AppDataSource.getRepository(UserActivityLog);

// ==================== DTO 定义 ====================

export interface CourseListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
  difficulty?: number;
}

export interface CreateCourseDTO {
  title: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  coverColor?: string;
  difficulty?: number;
  status?: number;
  estimatedHours?: number;
  envImage?: string;
  ideImage?: string;
}

export interface UpdateCourseDTO {
  title?: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  coverColor?: string;
  difficulty?: number;
  status?: number;
  estimatedHours?: number;
  envImage?: string;
  ideImage?: string;
}

export interface CreateStageDTO {
  courseId: number;
  title: string;
  description?: string;
  sortOrder?: number;
  levelLabel?: string;
}

export interface UpdateStageDTO {
  title?: string;
  description?: string;
  sortOrder?: number;
  levelLabel?: string;
}

export interface CreateLessonDTO {
  courseId: number;
  stageId: number;
  title: string;
  type?: number;
  durationMinutes?: number;
  labIdentifier?: string;
  points?: number;
  sortOrder?: number;
  skillIds?: number[];
}

export interface UpdateLessonDTO {
  title?: string;
  type?: number;
  durationMinutes?: number;
  labIdentifier?: string;
  points?: number;
  sortOrder?: number;
  skillIds?: number[];
}

export interface CreateMaterialDTO {
  lessonId: number;
  title: string;
  type: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  sortOrder?: number;
}

export interface UpdateMaterialDTO {
  title?: string;
  sortOrder?: number;
}


export class CourseService {
  // ==================== 课程 CRUD ====================

  async findAll(query: CourseListQuery) {
    const { page = 1, pageSize = 10, keyword, status, difficulty } = query;
    const skip = (page - 1) * pageSize;

    const qb = courseRepo().createQueryBuilder('c');

    if (keyword) {
      qb.andWhere('(c.title LIKE :keyword OR c.slug LIKE :keyword OR c.description LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    if (status !== undefined) {
      qb.andWhere('c.status = :status', { status });
    }

    if (difficulty !== undefined) {
      qb.andWhere('c.difficulty = :difficulty', { difficulty });
    }

    const [list, total] = await qb
      .orderBy('c.updated_at', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return { list, total, page, pageSize };
  }

  async findById(id: number) {
    const course = await courseRepo().findOne({ where: { id } });
    if (!course) return null;

    const stages = await this.getCourseStages(id);
    const lessons = await this.getCourseLessons(id);

    // 组装树形结构
    const stagesWithLessons = stages.map(stage => ({
      ...stage,
      lessons: lessons.filter(l => l.stageId === stage.id),
    }));

    return { ...course, stages: stagesWithLessons };
  }

  async findBySlug(slug: string) {
    const course = await courseRepo().findOne({ where: { slug } });
    if (!course) return null;

    const stages = await this.getCourseStages(course.id);
    const lessons = await this.getCourseLessons(course.id);

    const stagesWithLessons = stages.map(stage => ({
      ...stage,
      lessons: lessons.filter(l => l.stageId === stage.id),
    }));

    return { ...course, stages: stagesWithLessons };
  }

  async create(data: CreateCourseDTO) {
    const existing = await courseRepo().findOne({ where: { slug: data.slug } });
    if (existing) {
      throw new Error('Slug 已存在');
    }

    const course = courseRepo().create(data);
    return await courseRepo().save(course);
  }

  async update(id: number, data: UpdateCourseDTO) {
    const course = await courseRepo().findOne({ where: { id } });
    if (!course) {
      throw new Error('课程不存在');
    }

    if (data.slug && data.slug !== course.slug) {
      const existing = await courseRepo().findOne({ where: { slug: data.slug } });
      if (existing) {
        throw new Error('Slug 已存在');
      }
    }

    Object.assign(course, data);
    return await courseRepo().save(course);
  }

  async delete(id: number) {
    const course = await courseRepo().findOne({ where: { id } });
    if (!course) {
      throw new Error('课程不存在');
    }

    // 删除关联的阶段和课时
    await lessonRepo().delete({ courseId: id });
    await stageRepo().delete({ courseId: id });
    await courseRepo().remove(course);

    return true;
  }

  async updateStatus(id: number, status: CourseStatus) {
    const course = await courseRepo().findOne({ where: { id } });
    if (!course) {
      throw new Error('课程不存在');
    }

    course.status = status;
    return await courseRepo().save(course);
  }

  // ==================== 阶段 CRUD ====================

  async getCourseStages(courseId: number) {
    return await stageRepo().find({
      where: { courseId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createStage(data: CreateStageDTO) {
    const stage = stageRepo().create(data);
    return await stageRepo().save(stage);
  }

  async updateStage(id: number, data: UpdateStageDTO) {
    const stage = await stageRepo().findOne({ where: { id } });
    if (!stage) {
      throw new Error('阶段不存在');
    }

    Object.assign(stage, data);
    return await stageRepo().save(stage);
  }

  async deleteStage(id: number) {
    const stage = await stageRepo().findOne({ where: { id } });
    if (!stage) {
      throw new Error('阶段不存在');
    }

    // 删除阶段下的所有课时
    await lessonRepo().delete({ stageId: id });
    await stageRepo().remove(stage);

    // 更新课程统计
    await this.updateCourseStats(stage.courseId);

    return true;
  }

  async reorderStages(courseId: number, orders: { id: number; sortOrder: number }[]) {
    for (const item of orders) {
      await stageRepo().update(item.id, { sortOrder: item.sortOrder });
    }
    return await this.getCourseStages(courseId);
  }


  // ==================== 课时 CRUD ====================

  async getCourseLessons(courseId: number) {
    const lessons = await lessonRepo().find({
      where: { courseId },
      order: { sortOrder: 'ASC' },
    });

    // 获取每个课时的技能
    const lessonIds = lessons.map(l => l.id);
    const lessonSkills = lessonIds.length > 0 ? await this.getLessonsSkills(lessonIds) : {};

    return lessons.map(l => ({
      ...l,
      skills: lessonSkills[l.id] || [],
    }));
  }

  async getLessonById(lessonId: number) {
    return await lessonRepo().findOne({ where: { id: lessonId } });
  }

  async getStageLessons(stageId: number) {
    return await lessonRepo().find({
      where: { stageId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createLesson(data: CreateLessonDTO) {
    const { skillIds, ...lessonData } = data;

    const lesson = lessonRepo().create(lessonData);
    const saved = await lessonRepo().save(lesson);

    // 处理技能关联
    if (skillIds && skillIds.length > 0) {
      await this.updateLessonSkills(saved.id, skillIds);
    }

    // 更新课程统计
    await this.updateCourseStats(data.courseId);

    return saved;
  }

  async updateLesson(id: number, data: UpdateLessonDTO) {
    const { skillIds, ...lessonData } = data;

    const lesson = await lessonRepo().findOne({ where: { id } });
    if (!lesson) {
      throw new Error('课时不存在');
    }

    Object.assign(lesson, lessonData);
    const saved = await lessonRepo().save(lesson);

    // 处理技能关联
    if (skillIds !== undefined) {
      await this.updateLessonSkills(id, skillIds);
    }

    return saved;
  }

  async deleteLesson(id: number) {
    const lesson = await lessonRepo().findOne({ where: { id } });
    if (!lesson) {
      throw new Error('课时不存在');
    }

    const courseId = lesson.courseId;

    // 删除技能关联
    await lessonSkillRepo().delete({ lessonId: id });
    await lessonRepo().remove(lesson);

    // 更新课程统计
    await this.updateCourseStats(courseId);

    return true;
  }

  async reorderLessons(stageId: number, orders: { id: number; sortOrder: number }[]) {
    for (const item of orders) {
      await lessonRepo().update(item.id, { sortOrder: item.sortOrder });
    }
    return await this.getStageLessons(stageId);
  }

  // ==================== 技能管理 ====================

  async getAllSkills() {
    return await skillRepo().find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async getSkillsByCategory(category: string) {
    return await skillRepo().find({ where: { category }, order: { name: 'ASC' } });
  }

  async createSkill(name: string, category?: string) {
    const existing = await skillRepo().findOne({ where: { name } });
    if (existing) {
      throw new Error('技能已存在');
    }

    const skill = skillRepo().create({ name, category: category || 'General' });
    return await skillRepo().save(skill);
  }

  async updateSkill(id: number, name?: string, category?: string) {
    const skill = await skillRepo().findOne({ where: { id } });
    if (!skill) {
      throw new Error('技能不存在');
    }

    if (name) skill.name = name;
    if (category) skill.category = category;

    return await skillRepo().save(skill);
  }

  async deleteSkill(id: number) {
    const skill = await skillRepo().findOne({ where: { id } });
    if (!skill) {
      throw new Error('技能不存在');
    }

    // 删除关联
    await lessonSkillRepo().delete({ skillId: id });
    await skillRepo().remove(skill);

    return true;
  }


  // ==================== 用户学习进度 ====================

  async getUserEnrollments(userId: number) {
    const enrollments = await enrollmentRepo().find({
      where: { userId },
      order: { lastActiveAt: 'DESC' },
    });

    // 获取课程信息
    const courseIds = enrollments.map(e => e.courseId);
    if (courseIds.length === 0) return [];

    const courses = await courseRepo().find({ where: { id: In(courseIds) } });
    const courseMap = new Map(courses.map(c => [c.id, c]));

    return enrollments.map(e => ({
      ...e,
      course: courseMap.get(e.courseId) || null,
    }));
  }

  async getContinueLearning(userId: number) {
    const enrollment = await enrollmentRepo().findOne({
      where: { userId, status: EnrollmentStatus.IN_PROGRESS },
      order: { lastActiveAt: 'DESC' },
    });

    if (!enrollment) return null;

    const course = await courseRepo().findOne({ where: { id: enrollment.courseId } });
    if (!course) return null;

    // 获取下一个课时
    let nextLesson = null;
    if (enrollment.lastLessonId) {
      const lastLesson = await lessonRepo().findOne({ where: { id: enrollment.lastLessonId } });
      if (lastLesson) {
        // 查找下一个课时
        nextLesson = await lessonRepo()
          .createQueryBuilder('l')
          .where('l.course_id = :courseId', { courseId: course.id })
          .andWhere('l.sort_order > :sortOrder', { sortOrder: lastLesson.sortOrder })
          .orderBy('l.sort_order', 'ASC')
          .getOne();
      }
    }

    if (!nextLesson) {
      // 如果没有下一个，获取第一个课时
      nextLesson = await lessonRepo().findOne({
        where: { courseId: course.id },
        order: { sortOrder: 'ASC' },
      });
    }

    return {
      enrollment,
      course,
      nextLesson,
    };
  }

  async enrollCourse(userId: number, courseId: number) {
    const existing = await enrollmentRepo().findOne({ where: { userId, courseId } });
    if (existing) {
      // 更新最后活跃时间
      existing.lastActiveAt = new Date();
      return await enrollmentRepo().save(existing);
    }

    const enrollment = enrollmentRepo().create({
      userId,
      courseId,
      status: EnrollmentStatus.IN_PROGRESS,
      progressPercent: 0,
      completedLessonsCount: 0,
      lastActiveAt: new Date(),
      joinedAt: new Date(),
    });

    return await enrollmentRepo().save(enrollment);
  }

  async getUserLessonRecords(userId: number, courseId: number) {
    return await lessonRecordRepo().find({
      where: { userId, courseId },
    });
  }

  async completeLesson(userId: number, lessonId: number, score?: number) {
    const lesson = await lessonRepo().findOne({ where: { id: lessonId } });
    if (!lesson) {
      throw new Error('课时不存在');
    }

    const courseId = lesson.courseId;

    // 更新或创建课时记录
    let record = await lessonRecordRepo().findOne({ where: { userId, lessonId } });
    if (record) {
      record.status = LessonRecordStatus.COMPLETED;
      record.finishedAt = new Date();
      if (score !== undefined) record.score = score;
    } else {
      record = lessonRecordRepo().create({
        userId,
        courseId,
        lessonId,
        status: LessonRecordStatus.COMPLETED,
        score: score || 0,
        startedAt: new Date(),
        finishedAt: new Date(),
      });
    }
    await lessonRecordRepo().save(record);

    // 更新活跃度
    await this.updateActivityLog(userId);

    // 更新课程进度
    await this.updateEnrollmentProgress(userId, courseId, lessonId);

    return record;
  }

  async startLesson(userId: number, lessonId: number) {
    const lesson = await lessonRepo().findOne({ where: { id: lessonId } });
    if (!lesson) {
      throw new Error('课时不存在');
    }

    let record = await lessonRecordRepo().findOne({ where: { userId, lessonId } });
    if (!record) {
      record = lessonRecordRepo().create({
        userId,
        courseId: lesson.courseId,
        lessonId,
        status: LessonRecordStatus.IN_PROGRESS,
        startedAt: new Date(),
      });
    } else if (record.status === LessonRecordStatus.NOT_STARTED) {
      record.status = LessonRecordStatus.IN_PROGRESS;
      record.startedAt = new Date();
    }

    return await lessonRecordRepo().save(record);
  }


  // ==================== 活跃度/热力图 ====================

  async getUserActivityLogs(userId: number, days: number = 365) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return await activityLogRepo()
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.activity_date >= :startDate', { startDate: startDateStr })
      .orderBy('a.activity_date', 'ASC')
      .getMany();
  }

  // ==================== 课时学习资料管理 ====================

  async getLessonMaterials(lessonId: number) {
    return await materialRepo().find({
      where: { lessonId },
      order: { sortOrder: 'ASC' },
    });
  }

  async getMaterialById(id: number) {
    return await materialRepo().findOne({ where: { id } });
  }

  async createMaterial(data: CreateMaterialDTO) {
    const lesson = await lessonRepo().findOne({ where: { id: data.lessonId } });
    if (!lesson) {
      throw new Error('课时不存在');
    }

    // 只有知识型课时（文本类型）才能添加学习资料
    if (lesson.type !== LessonType.TEXT) {
      throw new Error('只有知识型课时才能添加学习资料');
    }

    const material = materialRepo().create({
      lessonId: data.lessonId,
      title: data.title,
      type: data.type,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      sortOrder: data.sortOrder || 0,
    });

    return await materialRepo().save(material);
  }

  async updateMaterial(id: number, data: UpdateMaterialDTO) {
    const material = await materialRepo().findOne({ where: { id } });
    if (!material) {
      throw new Error('资料不存在');
    }

    if (data.title !== undefined) material.title = data.title;
    if (data.sortOrder !== undefined) material.sortOrder = data.sortOrder;

    return await materialRepo().save(material);
  }

  async deleteMaterial(id: number) {
    const material = await materialRepo().findOne({ where: { id } });
    if (!material) {
      throw new Error('资料不存在');
    }

    // 删除物理文件
    if (material.fileUrl) {
      const filePath = path.join(process.cwd(), 'public', material.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await materialRepo().remove(material);
    return true;
  }

  async reorderMaterials(lessonId: number, orders: { id: number; sortOrder: number }[]) {
    for (const item of orders) {
      await materialRepo().update(item.id, { sortOrder: item.sortOrder });
    }
    return await this.getLessonMaterials(lessonId);
  }

  // 根据文件扩展名判断资料类型
  getMaterialTypeFromExt(filename: string): MaterialType {
    const ext = path.extname(filename).toLowerCase();
    if (['.md', '.markdown'].includes(ext)) {
      return MaterialType.MARKDOWN;
    } else if (ext === '.pdf') {
      return MaterialType.PDF;
    } else if (['.xmind', '.mm', '.xmm'].includes(ext)) {
      return MaterialType.MINDMAP;
    }
    return MaterialType.MARKDOWN; // 默认
  }

  // ==================== 辅助方法 ====================

  private async getLessonsSkills(lessonIds: number[]) {
    const lessonSkills = await lessonSkillRepo().find({
      where: { lessonId: In(lessonIds) },
    });

    const skillIds = [...new Set(lessonSkills.map(ls => ls.skillId))];
    const skills = skillIds.length > 0 ? await skillRepo().find({ where: { id: In(skillIds) } }) : [];
    const skillMap = new Map(skills.map(s => [s.id, s]));

    const result: Record<number, Skill[]> = {};
    for (const ls of lessonSkills) {
      if (!result[ls.lessonId]) result[ls.lessonId] = [];
      const skill = skillMap.get(ls.skillId);
      if (skill) result[ls.lessonId].push(skill);
    }

    return result;
  }

  private async updateLessonSkills(lessonId: number, skillIds: number[]) {
    // 先删除旧关联
    await lessonSkillRepo().delete({ lessonId });

    // 批量插入新关联
    if (skillIds.length > 0) {
      const lessonSkills = skillIds.map(skillId => ({ lessonId, skillId }));
      await lessonSkillRepo().insert(lessonSkills);
    }
  }

  private async updateCourseStats(courseId: number) {
    const lessons = await lessonRepo().find({ where: { courseId } });
    const totalLessons = lessons.length;

    // 计算总时长（分钟转小时）
    const totalMinutes = lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
    const estimatedHours = Math.ceil(totalMinutes / 60);

    // 计算技能数
    const lessonIds = lessons.map(l => l.id);
    let totalSkills = 0;
    if (lessonIds.length > 0) {
      const lessonSkills = await lessonSkillRepo().find({ where: { lessonId: In(lessonIds) } });
      const uniqueSkillIds = new Set(lessonSkills.map(ls => ls.skillId));
      totalSkills = uniqueSkillIds.size;
    }

    await courseRepo().update(courseId, { totalLessons, estimatedHours, totalSkills });
  }

  private async updateEnrollmentProgress(userId: number, courseId: number, lastLessonId: number) {
    const course = await courseRepo().findOne({ where: { id: courseId } });
    if (!course) return;

    // 计算已完成课时数
    const completedCount = await lessonRecordRepo().count({
      where: { userId, courseId, status: LessonRecordStatus.COMPLETED },
    });

    // 计算进度百分比
    const progressPercent = course.totalLessons > 0
      ? Math.round((completedCount / course.totalLessons) * 100)
      : 0;

    // 判断是否完成
    const isCompleted = completedCount >= course.totalLessons && course.totalLessons > 0;

    let enrollment = await enrollmentRepo().findOne({ where: { userId, courseId } });
    if (!enrollment) {
      enrollment = enrollmentRepo().create({
        userId,
        courseId,
        status: isCompleted ? EnrollmentStatus.COMPLETED : EnrollmentStatus.IN_PROGRESS,
        progressPercent,
        completedLessonsCount: completedCount,
        lastLessonId,
        lastActiveAt: new Date(),
        joinedAt: new Date(),
        completedAt: isCompleted ? new Date() : null,
      });
    } else {
      enrollment.status = isCompleted ? EnrollmentStatus.COMPLETED : EnrollmentStatus.IN_PROGRESS;
      enrollment.progressPercent = progressPercent;
      enrollment.completedLessonsCount = completedCount;
      enrollment.lastLessonId = lastLessonId;
      enrollment.lastActiveAt = new Date();
      if (isCompleted && !enrollment.completedAt) {
        enrollment.completedAt = new Date();
      }
    }

    await enrollmentRepo().save(enrollment);
  }

  private async updateActivityLog(userId: number) {
    const today = new Date().toISOString().split('T')[0];

    let log = await activityLogRepo().findOne({
      where: { userId, activityDate: today },
    });

    if (log) {
      log.contributionCount += 1;
    } else {
      log = activityLogRepo().create({
        userId,
        activityDate: today,
        contributionCount: 1,
      });
    }

    await activityLogRepo().save(log);
  }
}
