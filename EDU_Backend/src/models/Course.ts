import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 难度等级枚举
export enum CourseDifficulty {
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
}

// 课程状态枚举
export enum CourseStatus {
  DRAFT = 0,
  PUBLISHED = 1,
  ARCHIVED = 2,
}

@Entity('courses')
@Index('idx_status_sort', ['status'])
export class Course {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '课程标题 (如 Shell)' })
  title!: string;

  @Column({ type: 'varchar', length: 128, unique: true, default: '', comment: 'URL Slug (唯一, 如 shell-programming)' })
  slug!: string;

  @Column({ type: 'varchar', length: 512, default: '', comment: '简短介绍' })
  description!: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 512, default: '', comment: '图标/Logo URL' })
  iconUrl!: string;

  @Column({ name: 'cover_color', type: 'varchar', length: 32, default: '#3b82f6', comment: '主题色 (UI卡片背景色)' })
  coverColor!: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: CourseDifficulty.BEGINNER,
    comment: '难度: 1-初级, 2-中级, 3-高级',
  })
  difficulty!: CourseDifficulty;

  @Column({ name: 'total_lessons', type: 'int', unsigned: true, default: 0, comment: '包含的总课程单元数' })
  totalLessons!: number;

  @Column({ name: 'total_skills', type: 'int', unsigned: true, default: 0, comment: '包含的技能点数' })
  totalSkills!: number;

  @Column({ name: 'estimated_hours', type: 'int', unsigned: true, default: 0, comment: '预计学习时长(小时)' })
  estimatedHours!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: CourseStatus.DRAFT,
    comment: '状态: 0-草稿, 1-发布, 2-下架',
  })
  status!: CourseStatus;

  @Column({ name: 'env_image', type: 'varchar', length: 256, default: '', comment: 'Ubuntu桌面环境镜像名称' })
  envImage!: string;

  @Column({ name: 'ide_image', type: 'varchar', length: 256, default: '', comment: 'WebIDE环境镜像名称' })
  ideImage!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6, comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6, comment: '更新时间' })
  updatedAt!: Date;
}
