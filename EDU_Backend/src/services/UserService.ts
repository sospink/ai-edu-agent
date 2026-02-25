import { Repository, Like } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User, RoleType, UserStatus } from '../models/User';
import { hashPassword, comparePassword } from '../utils/crypto';

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  phone?: string;
  studentId?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  githubLink?: string;
  roleType?: RoleType;
}

export interface UpdateUserDto {
  phone?: string;
  studentId?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  githubLink?: string;
  roleType?: RoleType;
  status?: UserStatus;
}

export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  roleType?: RoleType;
  status?: UserStatus;
}

export class UserService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  async findAll(params: UserQueryParams = {}): Promise<{ list: User[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, roleType, status } = params;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (keyword) {
      queryBuilder.andWhere(
        '(user.username LIKE :keyword OR user.email LIKE :keyword OR user.fullName LIKE :keyword OR user.studentId LIKE :keyword)',
        { keyword: `%${keyword}%` }
      );
    }

    if (roleType !== undefined) {
      queryBuilder.andWhere('user.roleType = :roleType', { roleType });
    }

    if (status !== undefined) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    const [list, total] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOneBy({ username });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  async findByStudentId(studentId: string): Promise<User | null> {
    return this.userRepository.findOneBy({ studentId });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await hashPassword(dto.password);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      roleType: dto.roleType ?? RoleType.STUDENT,
      status: UserStatus.ACTIVE,
    });
    return this.userRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User | null> {
    await this.userRepository.update(id, dto);
    return this.findById(id);
  }

  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await hashPassword(newPassword);
    const result = await this.userRepository.update(id, { password: hashedPassword });
    return result.affected !== 0;
  }

  async delete(id: number): Promise<boolean> {
    // 软删除：更新状态为注销
    const result = await this.userRepository.update(id, { status: UserStatus.DELETED });
    return result.affected !== 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const result = await this.userRepository.delete(id);
    return result.affected !== 0;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return comparePassword(password, user.password);
  }

  async freeze(id: number): Promise<boolean> {
    const result = await this.userRepository.update(id, { status: UserStatus.FROZEN });
    return result.affected !== 0;
  }

  async activate(id: number): Promise<boolean> {
    const result = await this.userRepository.update(id, { status: UserStatus.ACTIVE });
    return result.affected !== 0;
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }

  // 初始化默认管理员
  async initDefaultAdmin(): Promise<void> {
    const count = await this.count();
    if (count === 0) {
      await this.create({
        username: 'admin',
        email: 'admin@edu.com',
        password: 'admin@123',
        fullName: '系统管理员',
        roleType: RoleType.ADMIN,
      });
    }
  }
}
