import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const authController = new AuthController();

// 登录（无需认证）
router.post('/login', authController.login);

// 退出登录
router.post('/logout', authController.logout);

// 获取当前用户信息（支持 token 或 query 参数）
router.get('/me', optionalAuthMiddleware, authController.getCurrentUser);

// 刷新 Token（需要认证）
router.post('/refresh', authMiddleware, authController.refreshToken);

export default router;
