import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 聊天消息类型
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

@Entity('user_agent_progress')
@Index('uk_user_manual', ['userId', 'manualId'], { unique: true })
export class UserAgentProgress {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: number;

  @Column({ name: 'manual_id', type: 'bigint', unsigned: true })
  manualId!: number;

  @Column({ name: 'current_step', type: 'int', default: 0 })
  currentStep!: number;

  @Column({ name: 'completed_steps', type: 'json' })
  completedSteps!: number[];

  @Column({ name: 'chat_history', type: 'json' })
  chatHistory!: ChatMessage[];

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @UpdateDateColumn({ name: 'last_active_at' })
  lastActiveAt!: Date;
}
