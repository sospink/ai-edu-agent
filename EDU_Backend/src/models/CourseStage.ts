import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('course_stages')
@Index('idx_course_order', ['courseId', 'sortOrder'])
export class CourseStage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'course_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 courses.id' })
  courseId!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '阶段名称' })
  title!: string;

  @Column({ type: 'varchar', length: 512, default: '', comment: '阶段描述' })
  description!: string;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0, comment: '排序权重 (从小到大)' })
  sortOrder!: number;

  @Column({ name: 'level_label', type: 'varchar', length: 32, default: '', comment: '难度标签 (如 BEGINNER)' })
  levelLabel!: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;
}
