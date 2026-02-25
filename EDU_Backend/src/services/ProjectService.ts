import { AppDataSource } from '../config/database';
import { Project, ProjectStatus } from '../models/Project';
import { ProjectUnit, UnitType } from '../models/ProjectUnit';
import { Tag } from '../models/Tag';
import { ProjectTag } from '../models/ProjectTag';
import { Like, In, IsNull } from 'typeorm';

const projectRepo = () => AppDataSource.getRepository(Project);
const unitRepo = () => AppDataSource.getRepository(ProjectUnit);
const tagRepo = () => AppDataSource.getRepository(Tag);
const projectTagRepo = () => AppDataSource.getRepository(ProjectTag);

export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
  difficulty?: number;
  tagId?: number;
}

export interface CreateProjectDTO {
  title: string;
  slug: string;
  subtitle?: string;
  coverUrl?: string;
  difficulty?: number;
  status?: number;
  description?: string;
  learningGoals?: string[];
  prerequisites?: string[];
  tagIds?: number[];
  createdBy?: number;
  envImage?: string;
  ideImage?: string;
}

export interface UpdateProjectDTO {
  title?: string;
  slug?: string;
  subtitle?: string;
  coverUrl?: string;
  difficulty?: number;
  status?: number;
  description?: string;
  learningGoals?: string[];
  prerequisites?: string[];
  tagIds?: number[];
  envImage?: string;
  ideImage?: string;
}

export interface CreateUnitDTO {
  projectId: number;
  title: string;
  description?: string;
  type?: number;
  modeGroup?: number;
  envId?: string;
  timeLimit?: number;
  points?: number;
  sortOrder?: number;
  isHidden?: number;
}

export interface UpdateUnitDTO {
  title?: string;
  description?: string;
  type?: number;
  modeGroup?: number;
  envId?: string;
  timeLimit?: number;
  points?: number;
  sortOrder?: number;
  isHidden?: number;
}

export class ProjectService {
  // ==================== 项目 CRUD ====================

  async findAll(query: ProjectListQuery) {
    const { page = 1, pageSize = 10, keyword, status, difficulty, tagId } = query;
    const skip = (page - 1) * pageSize;

    const qb = projectRepo()
      .createQueryBuilder('p')
      .where('p.deleted_at IS NULL');

    // 关键词搜索
    if (keyword) {
      qb.andWhere('(p.title LIKE :keyword OR p.slug LIKE :keyword OR p.subtitle LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    // 状态筛选
    if (status !== undefined) {
      qb.andWhere('p.status = :status', { status });
    }

    // 难度筛选
    if (difficulty !== undefined) {
      qb.andWhere('p.difficulty = :difficulty', { difficulty });
    }

    // 标签筛选
    if (tagId) {
      qb.innerJoin(ProjectTag, 'pt', 'pt.project_id = p.id')
        .andWhere('pt.tag_id = :tagId', { tagId });
    }

    const [list, total] = await qb
      .orderBy('p.updated_at', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    // 获取每个项目的标签
    const projectIds = list.map((p) => p.id);
    const projectTags = projectIds.length > 0 
      ? await this.getProjectsTags(projectIds) 
      : {};

    const listWithTags = list.map((p) => ({
      ...p,
      tags: projectTags[p.id] || [],
    }));

    return { list: listWithTags, total, page, pageSize };
  }

  async findById(id: number) {
    const project = await projectRepo().findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!project) return null;

    // 获取标签
    const tags = await this.getProjectTags(id);
    // 获取单元
    const units = await this.getProjectUnits(id);

    return { ...project, tags, units };
  }

  async findBySlug(slug: string) {
    const project = await projectRepo().findOne({
      where: { slug, deletedAt: IsNull() },
    });

    if (!project) return null;

    const tags = await this.getProjectTags(project.id);
    const units = await this.getProjectUnits(project.id);

    return { ...project, tags, units };
  }

  async create(data: CreateProjectDTO) {
    const { tagIds, ...projectData } = data;

    // 检查 slug 唯一性
    const existing = await projectRepo().findOne({ where: { slug: data.slug } });
    if (existing) {
      throw new Error('Slug 已存在');
    }

    const project = projectRepo().create(projectData);
    const saved = await projectRepo().save(project);

    // 处理标签关联
    if (tagIds && tagIds.length > 0) {
      await this.updateProjectTags(saved.id, tagIds);
    }

    return saved;
  }

  async update(id: number, data: UpdateProjectDTO) {
    const { tagIds, ...projectData } = data;

    const project = await projectRepo().findOne({ where: { id, deletedAt: IsNull() } });
    if (!project) {
      throw new Error('项目不存在');
    }

    // 检查 slug 唯一性
    if (data.slug && data.slug !== project.slug) {
      const existing = await projectRepo().findOne({ where: { slug: data.slug } });
      if (existing) {
        throw new Error('Slug 已存在');
      }
    }

    Object.assign(project, projectData);
    const saved = await projectRepo().save(project);

    // 处理标签关联
    if (tagIds !== undefined) {
      await this.updateProjectTags(id, tagIds);
    }

    return saved;
  }

  async delete(id: number) {
    const project = await projectRepo().findOne({ where: { id, deletedAt: IsNull() } });
    if (!project) {
      throw new Error('项目不存在');
    }

    // 软删除
    project.deletedAt = new Date();
    await projectRepo().save(project);
    return true;
  }

  async updateStatus(id: number, status: ProjectStatus) {
    const project = await projectRepo().findOne({ where: { id, deletedAt: IsNull() } });
    if (!project) {
      throw new Error('项目不存在');
    }

    project.status = status;
    return await projectRepo().save(project);
  }

  // ==================== 项目单元 CRUD ====================

  async getProjectUnits(projectId: number) {
    return await unitRepo().find({
      where: { projectId },
      order: { modeGroup: 'ASC', sortOrder: 'ASC' },
    });
  }

  async createUnit(data: CreateUnitDTO) {
    const unit = unitRepo().create(data);
    const saved = await unitRepo().save(unit);

    // 更新项目统计
    await this.updateProjectCounts(data.projectId);

    return saved;
  }

  async updateUnit(id: number, data: UpdateUnitDTO) {
    const unit = await unitRepo().findOne({ where: { id } });
    if (!unit) {
      throw new Error('单元不存在');
    }

    Object.assign(unit, data);
    return await unitRepo().save(unit);
  }

  async deleteUnit(id: number) {
    const unit = await unitRepo().findOne({ where: { id } });
    if (!unit) {
      throw new Error('单元不存在');
    }

    const projectId = unit.projectId;
    await unitRepo().remove(unit);

    // 更新项目统计
    await this.updateProjectCounts(projectId);

    return true;
  }

  async reorderUnits(projectId: number, unitOrders: { id: number; sortOrder: number }[]) {
    for (const item of unitOrders) {
      await unitRepo().update(item.id, { sortOrder: item.sortOrder });
    }
    return await this.getProjectUnits(projectId);
  }

  // ==================== 标签管理 ====================

  async getAllTags() {
    return await tagRepo().find({ order: { name: 'ASC' } });
  }

  async createTag(name: string, styleColor?: string) {
    const existing = await tagRepo().findOne({ where: { name } });
    if (existing) {
      throw new Error('标签已存在');
    }

    const tag = tagRepo().create({ name, styleColor: styleColor || '#3B82F6' });
    return await tagRepo().save(tag);
  }

  async updateTag(id: number, name?: string, styleColor?: string) {
    const tag = await tagRepo().findOne({ where: { id } });
    if (!tag) {
      throw new Error('标签不存在');
    }

    if (name) tag.name = name;
    if (styleColor) tag.styleColor = styleColor;

    return await tagRepo().save(tag);
  }

  async deleteTag(id: number) {
    const tag = await tagRepo().findOne({ where: { id } });
    if (!tag) {
      throw new Error('标签不存在');
    }

    // 删除关联
    await projectTagRepo().delete({ tagId: id });
    await tagRepo().remove(tag);

    return true;
  }

  // ==================== 辅助方法 ====================

  private async getProjectTags(projectId: number) {
    const projectTags = await projectTagRepo().find({ where: { projectId } });
    if (projectTags.length === 0) return [];

    const tagIds = projectTags.map((pt) => pt.tagId);
    return await tagRepo().find({ where: { id: In(tagIds) } });
  }

  private async getProjectsTags(projectIds: number[]) {
    const projectTags = await projectTagRepo().find({
      where: { projectId: In(projectIds) },
    });

    const tagIds = [...new Set(projectTags.map((pt) => pt.tagId))];
    const tags = tagIds.length > 0 ? await tagRepo().find({ where: { id: In(tagIds) } }) : [];
    const tagMap = new Map(tags.map((t) => [t.id, t]));

    const result: Record<number, Tag[]> = {};
    for (const pt of projectTags) {
      if (!result[pt.projectId]) result[pt.projectId] = [];
      const tag = tagMap.get(pt.tagId);
      if (tag) result[pt.projectId].push(tag);
    }

    return result;
  }

  private async updateProjectTags(projectId: number, tagIds: number[]) {
    // 先删除旧关联
    await projectTagRepo().delete({ projectId });

    // 批量插入新关联
    if (tagIds.length > 0) {
      const projectTags = tagIds.map((tagId) => ({ projectId, tagId }));
      await projectTagRepo().insert(projectTags);
    }
  }

  private async updateProjectCounts(projectId: number) {
    const units = await unitRepo().find({ where: { projectId } });

    const labsCount = units.filter((u) => u.type === UnitType.LAB).length;
    const challengesCount = units.filter((u) => u.type === UnitType.CHALLENGE).length;

    await projectRepo().update(projectId, { labsCount, challengesCount });
  }
}
