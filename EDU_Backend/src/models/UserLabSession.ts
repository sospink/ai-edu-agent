import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 会话状态枚举
export enum LabSessionStatus {
  CREATING = 0,   // 创建中
  RUNNING = 1,    // 运行中
  STOPPED = 2,    // 已停止
  ERROR = 3,      // 错误
}

// 来源类型枚举
export enum LabSourceType {
  COURSE = 1,     // 课程
  PROJECT = 2,    // 项目
}

@Entity('user_lab_sessions')
@Index('idx_user_status', ['userId', 'status'])
@Index('idx_container', ['containerId'])
export class UserLabSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, comment: '用户ID' })
  userId!: number;

  @Column({
    name: 'source_type',
    type: 'tinyint',
    unsigned: true,
    comment: '来源类型: 1-课程, 2-项目',
  })
  sourceType!: LabSourceType;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true, comment: '来源ID (课程ID或项目ID)' })
  sourceId!: number;

  @Column({ name: 'container_id', type: 'varchar', length: 128, default: '', comment: 'Docker容器ID' })
  containerId!: string;

  @Column({ name: 'container_name', type: 'varchar', length: 128, default: '', comment: '容器名称' })
  containerName!: string;

  @Column({ name: 'image_name', type: 'varchar', length: 256, default: '', comment: '使用的镜像名称' })
  imageName!: string;

  @Column({ name: 'vnc_port', type: 'int', unsigned: true, default: 0, comment: 'VNC端口 (noVNC)' })
  vncPort!: number;

  @Column({ name: 'ide_port', type: 'int', unsigned: true, default: 0, comment: 'WebIDE端口' })
  idePort!: number;

  @Column({ name: 'ssh_port', type: 'int', unsigned: true, default: 0, comment: 'SSH端口' })
  sshPort!: number;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: LabSessionStatus.CREATING,
    comment: '状态: 0-创建中, 1-运行中, 2-已停止, 3-错误',
  })
  status!: LabSessionStatus;

  @Column({ name: 'error_message', type: 'varchar', length: 512, default: '', comment: '错误信息' })
  errorMessage!: string;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true, comment: '过期时间' })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt!: Date;
}
