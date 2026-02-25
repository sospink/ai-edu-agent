import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ type: 'varchar', length: 32, unique: true, default: '', comment: '标签名 (如 Linux, Java)' })
  name!: string;

  @Column({ name: 'style_color', type: 'varchar', length: 16, default: '#3B82F6', comment: '标签颜色' })
  styleColor!: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;
}
