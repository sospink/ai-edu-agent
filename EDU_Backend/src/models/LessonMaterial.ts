import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 资料类型枚举
export enum MaterialType {
  MARKDOWN = 1,   // Markdown 文档
  PDF = 2,        // PDF 文件
  MINDMAP = 3,    // 思维导图 (xmind, mm 等)
}

@Entity('lesson_materials')
@Index('idx_lesson_materials', ['lessonId', 'sortOrder'])
export class LessonMaterial {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'lesson_id', type: 'bigint', unsigned: true, default: 0, comment: '关联 course_lessons.id' })
  lessonId!: number;

  @Column({ type: 'varchar', length: 128, default: '', comment: '资料标题' })
  title!: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: MaterialType.MARKDOWN,
    comment: '类型: 1-Markdown, 2-PDF, 3-思维导图',
  })
  type!: MaterialType;

  @Column({ name: 'file_url', type: 'varchar', length: 512, default: '', comment: '文件URL路径' })
  fileUrl!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 256, default: '', comment: '原始文件名' })
  fileName!: string;

  @Column({ name: 'file_size', type: 'int', unsigned: true, default: 0, comment: '文件大小(字节)' })
  fileSize!: number;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0, comment: '排序权重' })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt!: Date;
}
