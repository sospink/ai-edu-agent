import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { sendSuccess, sendBadRequest } from '../utils/response';
import { AppError } from '../middlewares/errorHandler';
import { UserStatus } from '../models/User';
import { generateToken } from '../utils/jwt';

export class AuthController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // 用户登录
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        sendBadRequest(res, '用户名和密码为必填项');
        return;
      }

      // 支持用户名、邮箱或学号/工号登录
      let user = await this.userService.findByUsername(username);
      if (!user) {
        user = await this.userService.findByEmail(username);
      }
      if (!user) {
        user = await this.userService.findByStudentId(username);
      }

      if (!user) {
        throw new AppError('用户名或密码错误', 401);
      }

      // 检查用户状态
      if (user.status === UserStatus.FROZEN) {
        throw new AppError('账号已被冻结，请联系管理员', 403);
      }

      if (user.status === UserStatus.DELETED) {
        throw new AppError('账号已注销', 403);
      }

      // 验证密码
      const isValid = await this.userService.validatePassword(user, password);
      if (!isValid) {
        throw new AppError('用户名或密码错误', 401);
      }

      // 生成 Token
      const token = generateToken({
        userId: user.id,
        username: user.username,
        roleType: user.roleType,
      });

      // 返回用户信息（不含密码）和 Token
      const { password: _, ...safeUser } = user;

      sendSuccess(res, { user: safeUser, token }, '登录成功');
    } catch (error) {
      next(error);
    }
  };

  // 退出登录
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // JWT 是无状态的，客户端删除 token 即可
      // 如果需要服务端黑名单，可以在这里实现
      sendSuccess(res, null, '退出登录成功');
    } catch (error) {
      next(error);
    }
  };

  // 获取当前用户信息
  getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 优先从 token 中获取用户信息
      if (req.user) {
        const user = await this.userService.findById(req.user.userId);
        if (!user) {
          throw new AppError('用户不存在', 404);
        }
        const { password, ...safeUser } = user;
        sendSuccess(res, safeUser, '获取用户信息成功');
        return;
      }

      // 兼容旧的 query 参数方式
      const userId = req.query.userId as string;
      if (!userId) {
        sendBadRequest(res, '缺少用户ID');
        return;
      }

      const user = await this.userService.findById(parseInt(userId));
      if (!user) {
        throw new AppError('用户不存在', 404);
      }

      const { password, ...safeUser } = user;
      sendSuccess(res, safeUser, '获取用户信息成功');
    } catch (error) {
      next(error);
    }
  };

  // 刷新 Token
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('请先登录', 401);
      }

      const user = await this.userService.findById(req.user.userId);
      if (!user) {
        throw new AppError('用户不存在', 404);
      }

      // 检查用户状态
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError('账号状态异常', 403);
      }

      // 生成新 Token
      const token = generateToken({
        userId: user.id,
        username: user.username,
        roleType: user.roleType,
      });

      sendSuccess(res, { token }, 'Token 刷新成功');
    } catch (error) {
      next(error);
    }
  };
}
