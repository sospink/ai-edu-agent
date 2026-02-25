import { Router } from 'express';
import { CourseController } from '../controllers/CourseController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new CourseController();

// 获取用户所有学习记录
router.get('/enrollments', authMiddleware, (req, res) => controller.getUserEnrollments(req, res));

// 获取继续学习信息
router.get('/continue', authMiddleware, (req, res) => controller.getContinueLearning(req, res));

// 获取用户活跃度/热力图数据
router.get('/activity', authMiddleware, (req, res) => controller.getUserActivityLogs(req, res));

export default router;
