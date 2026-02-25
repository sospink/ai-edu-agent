import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('lesson_skills')
@Index('uk_lesson_skill', ['lessonId', 'skillId'], { unique: true })
@Index('idx_skill_lesson', ['skillId'])
export class LessonSkill {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'lesson_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 course_lessons.id' })
  lessonId!: number;

  @Column({ name: 'skill_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 skills.id' })
  skillId!: number;
}
