import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 单元类型枚举
export enum UnitType {
  LAB = 1,
  CHALLENGE = 2,
}

// 模式分组枚举
export enum ModeGroup {
  GUIDED = 1,
  CHALLENGE = 2,
}

@Entity('project_units')
@Index('idx_project_mode', ['projectId', 'modeGroup', 'sortOrder'])
export class ProjectUnit {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 projects.id' })
  projectId!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '单元标题' })
  title!: string;

  @Column({ type: 'varchar', length: 512, default: '', comment: '单元简述' })
  description!: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: UnitType.LAB,
    comment: '类型: 1-实验(Lab), 2-挑战(Challenge)',
  })
  type!: UnitType;

  @Column({
    name: 'mode_group',
    type: 'tinyint',
    unsigned: true,
    default: ModeGroup.GUIDED,
    comment: '分组: 1-Guided Mode, 2-Challenge Mode',
  })
  modeGroup!: ModeGroup;

  @Column({ name: 'env_id', type: 'varchar', length: 64, default: '', comment: '关联的实验环境/镜像ID' })
  envId!: string;

  @Column({ name: 'time_limit', type: 'int', unsigned: true, default: 45, comment: '建议时长(分钟)' })
  timeLimit!: number;

  @Column({ type: 'int', unsigned: true, default: 0, comment: '完成奖励积分' })
  points!: number;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0, comment: '组内排序权重' })
  sortOrder!: number;

  @Column({ name: 'is_hidden', type: 'tinyint', unsigned: true, default: 0, comment: '是否隐藏' })
  isHidden!: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt!: Date;
}
