import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

// 学习状态枚举
export enum EnrollmentStatus {
  IN_PROGRESS = 1,
  COMPLETED = 2,
}

@Entity('user_course_enrollments')
@Index('uk_user_course', ['userId', 'courseId'], { unique: true })
@Index('idx_user_recent', ['userId', 'lastActiveAt'])
export class UserCourseEnrollment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 sys_users.id' })
  userId!: number;

  @Column({ name: 'course_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 courses.id' })
  courseId!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: EnrollmentStatus.IN_PROGRESS,
    comment: '1-进行中, 2-已完成',
  })
  status!: EnrollmentStatus;

  @Column({ name: 'progress_percent', type: 'tinyint', unsigned: true, default: 0, comment: '0-100' })
  progressPercent!: number;

  @Column({ name: 'completed_lessons_count', type: 'int', unsigned: true, default: 0, comment: '已完成课时数' })
  completedLessonsCount!: number;

  @Column({ name: 'last_lesson_id', type: 'bigint', unsigned: true, default: 0, comment: '最后学习的课时ID' })
  lastLessonId!: number;

  @Column({ name: 'last_active_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '最后活跃时间' })
  lastActiveAt!: Date;

  @Column({ name: 'joined_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '加入时间' })
  joinedAt!: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true, comment: '完成时间' })
  completedAt!: Date | null;
}
