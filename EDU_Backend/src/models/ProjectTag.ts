import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('project_tags')
@Index('uk_project_tag', ['projectId', 'tagId'], { unique: true })
@Index('idx_tag_project', ['tagId', 'projectId'])
export class ProjectTag {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 projects.id' })
  projectId!: number;

  @Column({ name: 'tag_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 tags.id' })
  tagId!: number;
}
