import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// 课时类型枚举
export enum LessonType {
  LAB = 1,        // 实验
  CHALLENGE = 2,  // 挑战
  QUIZ = 3,       // 测验
  TEXT = 4,       // 文本
}

@Entity('course_lessons')
@Index('idx_stage_content', ['stageId', 'sortOrder'])
@Index('idx_course_lookup', ['courseId'])
export class CourseLesson {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'course_id', type: 'bigint', unsigned: true, default: 0, comment: '冗余字段，方便查询' })
  courseId!: number;

  @Column({ name: 'stage_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 course_stages.id' })
  stageId!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '课时标题' })
  title!: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: LessonType.LAB,
    comment: '类型: 1-实验(Lab), 2-挑战(Challenge), 3-测验(Quiz), 4-文本(Text)',
  })
  type!: LessonType;

  @Column({ name: 'duration_minutes', type: 'int', unsigned: true, default: 15, comment: '预计耗时(分钟)' })
  durationMinutes!: number;

  @Column({ name: 'lab_identifier', type: 'varchar', length: 64, default: '', comment: '关联的实验环境/题目ID' })
  labIdentifier!: string;

  @Column({ type: 'int', unsigned: true, default: 10, comment: '完成获得的经验值/技能点' })
  points!: number;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0, comment: '组内排序' })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;
}
