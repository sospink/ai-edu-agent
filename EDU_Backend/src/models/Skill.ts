import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ type: 'varchar', length: 64, unique: true, default: '', comment: '技能名 (唯一)' })
  name!: string;

  @Column({ type: 'varchar', length: 32, default: 'General', comment: '分类 (如 Linux, Frontend)' })
  category!: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;
}
