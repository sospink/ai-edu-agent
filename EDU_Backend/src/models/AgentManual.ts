import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AgentStep } from './AgentStep';

// 来源类型枚举
export enum SourceType {
  COURSE_LESSON = 1,  // 课程课时
  PROJECT_UNIT = 2,   // 项目单元
}

@Entity('agent_manuals')
@Index('uk_source', ['sourceType', 'sourceId'], { unique: true })
export class AgentManual {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'source_type', type: 'tinyint', unsigned: true, comment: '1=课程课时, 2=项目单元' })
  sourceType!: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true })
  sourceId!: number;

  @Column({ type: 'varchar', length: 128 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ name: 'is_published', type: 'tinyint', unsigned: true, default: 0 })
  isPublished!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => AgentStep, step => step.manual)
  steps!: AgentStep[];
}
