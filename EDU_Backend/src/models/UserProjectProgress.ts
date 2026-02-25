import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// 学习进度状态枚举
export enum ProgressStatus {
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
}

@Entity('user_project_progress')
@Index('uk_user_project', ['userId', 'projectId'], { unique: true })
@Index('idx_user_last_active', ['userId', 'lastActiveAt'])
export class UserProjectProgress {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 sys_users.id' })
  userId!: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 projects.id' })
  projectId!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: ProgressStatus.NOT_STARTED,
    comment: '0-未开始, 1-进行中, 2-已完成',
  })
  status!: ProgressStatus;

  @Column({ name: 'current_unit_id', type: 'bigint', unsigned: true, default: 0, comment: '当前停留的单元ID' })
  currentUnitId!: number;

  @Column({ name: 'finished_units_count', type: 'int', unsigned: true, default: 0, comment: '已完成单元数' })
  finishedUnitsCount!: number;

  @Column({ name: 'progress_percent', type: 'tinyint', unsigned: true, default: 0, comment: '总进度%' })
  progressPercent!: number;

  @Column({ name: 'last_active_at', type: 'datetime', nullable: true, comment: '最后学习时间' })
  lastActiveAt!: Date | null;

  @Column({ name: 'started_at', type: 'datetime', nullable: true, comment: '开始学习时间' })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true, comment: '完成时间' })
  completedAt!: Date | null;
}
