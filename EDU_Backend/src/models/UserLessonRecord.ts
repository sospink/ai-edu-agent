import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

// 课时学习状态枚举
export enum LessonRecordStatus {
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
}

@Entity('user_lesson_records')
@Index('uk_user_lesson', ['userId', 'lessonId'], { unique: true })
@Index('idx_course_stats', ['userId', 'courseId', 'status'])
export class UserLessonRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, default: 0, comment: '用户ID' })
  userId!: number;

  @Column({ name: 'course_id', type: 'bigint', unsigned: true, default: 0, comment: '冗余，方便按课程统计' })
  courseId!: number;

  @Column({ name: 'lesson_id', type: 'bigint', unsigned: true, default: 0, comment: '课时ID' })
  lessonId!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: LessonRecordStatus.NOT_STARTED,
    comment: '0-未开始, 1-进行中, 2-已完成',
  })
  status!: LessonRecordStatus;

  @Column({ type: 'int', unsigned: true, default: 0, comment: '得分/评级' })
  score!: number;

  @Column({ name: 'started_at', type: 'datetime', nullable: true, comment: '开始时间' })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true, comment: '完成时间' })
  finishedAt!: Date | null;
}
