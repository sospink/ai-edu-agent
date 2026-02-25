import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AgentManual } from './AgentManual';

// 内容块类型
export interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean;
}

// 验证规则类型
export interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  path?: string;
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  port?: number;
  script?: string;
}

@Entity('agent_steps')
@Index('uk_manual_step', ['manualId', 'stepOrder'], { unique: true })
export class AgentStep {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'manual_id', type: 'bigint', unsigned: true })
  manualId!: number;

  @Column({ name: 'step_order', type: 'int', unsigned: true })
  stepOrder!: number;

  @Column({ type: 'varchar', length: 128 })
  title!: string;

  @Column({ type: 'json', comment: 'ContentBlock[]' })
  content!: ContentBlock[];

  @Column({ name: 'quick_questions', type: 'json', nullable: true })
  quickQuestions!: string[] | null;

  @Column({ type: 'json', nullable: true, comment: '验证规则，null表示无需验证' })
  verification!: Verification | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => AgentManual, manual => manual.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manual_id' })
  manual!: AgentManual;
}
