import { Router } from 'express';
import { LabController } from '../controllers/LabController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// 获取镜像列表（管理员）
router.get('/images', authMiddleware, adminMiddleware, LabController.getImages);

// 以下路由需要登录
router.use(authMiddleware);

// 获取当前活跃会话
router.get('/active', LabController.getActiveSession);

// 获取用户所有会话历史
router.get('/sessions', LabController.getUserSessions);

// 创建实验环境
router.post('/create', LabController.createSession);

// 停止实验环境
router.post('/stop/:sessionId', LabController.stopSession);

// 获取实验环境访问 URL
router.get('/urls', LabController.getSessionUrls);

// 在容器中执行命令
router.post('/execute', LabController.executeCommand);

export default router;
