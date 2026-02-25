import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('user_activity_logs')
@Index('uk_user_date', ['userId', 'activityDate'], { unique: true })
export class UserActivityLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, default: 0, comment: '用户ID' })
  userId!: number;

  @Column({ name: 'activity_date', type: 'date', comment: '日期 (YYYY-MM-DD)' })
  activityDate!: string;

  @Column({ name: 'contribution_count', type: 'int', unsigned: true, default: 1, comment: '当日活跃次数(完成实验数)' })
  contributionCount!: number;
}
