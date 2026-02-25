import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

// 难度等级枚举
export enum ProjectDifficulty {
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
}

// 项目状态枚举
export enum ProjectStatus {
  DRAFT = 0,
  PUBLISHED = 1,
  ARCHIVED = 2,
}

@Entity('projects')
@Index('idx_status_diff', ['status', 'difficulty'])
export class Project {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '项目名称' })
  title!: string;

  @Column({ type: 'varchar', length: 128, unique: true, default: '', comment: 'URL Slug (唯一标识)' })
  slug!: string;

  @Column({ type: 'varchar', length: 255, default: '', comment: '一句话简介' })
  subtitle!: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, default: '', comment: '封面图' })
  coverUrl!: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: ProjectDifficulty.BEGINNER,
    comment: '难度: 1-初级, 2-中级, 3-高级',
  })
  difficulty!: ProjectDifficulty;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: ProjectStatus.DRAFT,
    comment: '状态: 0-草稿, 1-已发布, 2-下架',
  })
  status!: ProjectStatus;

  @Column({ type: 'mediumtext', nullable: true, comment: '项目详细介绍 (HTML/Markdown)' })
  description!: string;

  @Column({ name: 'learning_goals', type: 'json', nullable: true, comment: '学习目标 (JSON Array)' })
  learningGoals!: string[];

  @Column({ type: 'json', nullable: true, comment: '前置知识 (JSON Array)' })
  prerequisites!: string[];

  // 统计数据 (缓存字段)
  @Column({ name: 'labs_count', type: 'int', unsigned: true, default: 0, comment: '实验数' })
  labsCount!: number;

  @Column({ name: 'challenges_count', type: 'int', unsigned: true, default: 0, comment: '挑战数' })
  challengesCount!: number;

  @Column({ name: 'students_count', type: 'int', unsigned: true, default: 0, comment: '参与人数' })
  studentsCount!: number;

  // 实验环境配置
  @Column({ name: 'env_image', type: 'varchar', length: 256, default: '', comment: 'Ubuntu桌面环境镜像名称' })
  envImage!: string;

  @Column({ name: 'ide_image', type: 'varchar', length: 256, default: '', comment: 'WebIDE环境镜像名称' })
  ideImage!: string;

  // 审计
  @Column({ name: 'created_by', type: 'bigint', unsigned: true, default: 0, comment: '创建者ID' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, comment: '删除时间' })
  deletedAt!: Date | null;
}
