import { Request, Response, NextFunction } from 'express';
import { UserService, CreateUserDto, UpdateUserDto, UserQueryParams } from '../services/UserService';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from '../utils/response';
import { AppError } from '../middlewares/errorHandler';
import { RoleType, UserStatus } from '../models/User';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // 获取用户列表（分页+筛选）
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params: UserQueryParams = {
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 10,
        keyword: req.query.keyword as string,
        roleType: req.query.roleType ? parseInt(req.query.roleType as string) : undefined,
        status: req.query.status ? parseInt(req.query.status as string) : undefined,
      };

      const { list, total } = await this.userService.findAll(params);

      // 移除密码字段
      const safeList = list.map(({ password, ...user }) => user);

      sendSuccess(res, { list: safeList, total, page: params.page, pageSize: params.pageSize }, '获取用户列表成功');
    } catch (error) {
      next(error);
    }
  };

  // 获取单个用户
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const user = await this.userService.findById(id);
      if (!user) {
        sendNotFound(res, '用户不存在');
        return;
      }

      const { password, ...safeUser } = user;
      sendSuccess(res, safeUser, '获取用户成功');
    } catch (error) {
      next(error);
    }
  };

  // 创建用户
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, email, password, phone, studentId, fullName, avatarUrl, bio, githubLink, roleType } = req.body;

      if (!username || !email || !password) {
        sendBadRequest(res, '用户名、邮箱和密码为必填项');
        return;
      }

      // 检查用户名是否已存在
      const existingUsername = await this.userService.findByUsername(username);
      if (existingUsername) {
        throw new AppError('用户名已存在', 400);
      }

      // 检查邮箱是否已存在
      const existingEmail = await this.userService.findByEmail(email);
      if (existingEmail) {
        throw new AppError('邮箱已存在', 400);
      }

      const dto: CreateUserDto = {
        username,
        email,
        password,
        phone,
        studentId,
        fullName,
        avatarUrl,
        bio,
        githubLink,
        roleType,
      };

      const user = await this.userService.create(dto);
      const { password: _, ...safeUser } = user;
      sendCreated(res, safeUser, '用户创建成功');
    } catch (error) {
      next(error);
    }
  };

  // 更新用户
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const { phone, studentId, fullName, avatarUrl, bio, githubLink, roleType, status } = req.body;

      const dto: UpdateUserDto = {
        phone,
        studentId,
        fullName,
        avatarUrl,
        bio,
        githubLink,
        roleType,
        status,
      };

      // 移除 undefined 字段
      Object.keys(dto).forEach((key) => {
        if (dto[key as keyof UpdateUserDto] === undefined) {
          delete dto[key as keyof UpdateUserDto];
        }
      });

      const user = await this.userService.update(id, dto);
      if (!user) {
        sendNotFound(res, '用户不存在');
        return;
      }

      const { password, ...safeUser } = user;
      sendSuccess(res, safeUser, '用户更新成功');
    } catch (error) {
      next(error);
    }
  };

  // 修改密码
  updatePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        sendBadRequest(res, '旧密码和新密码为必填项');
        return;
      }

      const user = await this.userService.findById(id);
      if (!user) {
        sendNotFound(res, '用户不存在');
        return;
      }

      const isValid = await this.userService.validatePassword(user, oldPassword);
      if (!isValid) {
        throw new AppError('旧密码错误', 400);
      }

      await this.userService.updatePassword(id, newPassword);
      sendSuccess(res, null, '密码修改成功');
    } catch (error) {
      next(error);
    }
  };

  // 删除用户（软删除）
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const deleted = await this.userService.delete(id);
      if (!deleted) {
        sendNotFound(res, '用户不存在');
        return;
      }

      sendSuccess(res, null, '用户删除成功');
    } catch (error) {
      next(error);
    }
  };

  // 冻结用户
  freeze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const success = await this.userService.freeze(id);
      if (!success) {
        sendNotFound(res, '用户不存在');
        return;
      }

      sendSuccess(res, null, '用户已冻结');
    } catch (error) {
      next(error);
    }
  };

  // 激活用户
  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        sendBadRequest(res, '无效的用户ID');
        return;
      }

      const success = await this.userService.activate(id);
      if (!success) {
        sendNotFound(res, '用户不存在');
        return;
      }

      sendSuccess(res, null, '用户已激活');
    } catch (error) {
      next(error);
    }
  };
}
