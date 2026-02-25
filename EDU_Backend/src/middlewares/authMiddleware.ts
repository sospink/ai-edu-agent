import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken, TokenPayload } from '../utils/jwt';
import { sendUnauthorized } from '../utils/response';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// 验证 Token 中间件
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    sendUnauthorized(res, '未提供认证令牌');
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    sendUnauthorized(res, '认证令牌无效或已过期');
    return;
  }

  req.user = payload;
  next();
};

// 可选认证中间件（不强制要求登录）
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req.headers.authorization);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
};

// 管理员权限中间件
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendUnauthorized(res, '请先登录');
    return;
  }

  if (req.user.roleType !== 10) {
    sendUnauthorized(res, '需要管理员权限');
    return;
  }

  next();
};
