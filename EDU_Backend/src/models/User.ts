import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

// 角色类型枚举
export enum RoleType {
  STUDENT = 1,
  TEACHER = 2,
  ADMIN = 10,
}

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 1,
  FROZEN = 2,
  DELETED = 3,
}

@Entity('sys_users')
@Index('idx_role_status', ['roleType', 'status'])
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, comment: '主键ID' })
  id!: number;

  // ==========================================
  // 1. 账号与安全 (Authentication)
  // ==========================================
  @Column({ type: 'varchar', length: 64, unique: true, default: '', comment: '用户名 (唯一)' })
  username!: string;

  @Column({ type: 'varchar', length: 128, unique: true, default: '', comment: '邮箱 (唯一，用于登录/通知)' })
  email!: string;

  @Column({ type: 'varchar', length: 255, default: '', comment: '加密密码 (BCrypt/Argon2)' })
  password!: string;

  @Column({ type: 'varchar', length: 20, default: '', comment: '手机号' })
  phone!: string;

  // ==========================================
  // 2. 业务身份与档案 (Profile Identity)
  // ==========================================
  @Index('idx_student_id')
  @Column({ name: 'student_id', type: 'varchar', length: 64, default: '', comment: '学号/工号 (业务唯一标识)' })
  studentId!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 64, default: '', comment: '真实姓名' })
  fullName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, default: '', comment: '头像URL' })
  avatarUrl!: string;

  @Column({ type: 'varchar', length: 1024, default: '', comment: '个人简介' })
  bio!: string;

  @Column({ name: 'github_link', type: 'varchar', length: 255, default: '', comment: 'GitHub主页链接' })
  githubLink!: string;

  // ==========================================
  // 3. 状态与权限 (Status & Role)
  // ==========================================
  @Column({ name: 'role_type', type: 'tinyint', unsigned: true, default: RoleType.STUDENT, comment: '角色: 1-学生, 2-教师, 10-管理员' })
  roleType!: RoleType;

  @Column({ type: 'tinyint', unsigned: true, default: UserStatus.ACTIVE, comment: '状态: 1-正常(Active), 2-冻结, 3-注销' })
  status!: UserStatus;

  // ==========================================
  // 4. 审计与时间 (Audit)
  // ==========================================
  @CreateDateColumn({ name: 'created_at', comment: '注册时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt!: Date;
}
