/**
 * EDU_Backend 路由文件规范模板
 * 参考：src/routes/courseRoutes.ts
 */
import { Router } from 'express';
import { ExampleController } from '../controllers/ExampleController';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new ExampleController();

// ==================== 公开接口 ====================

// 获取列表（无需认证）
router.get('/', (req, res) => controller.getAll(req, res));

// 获取单个（无需认证）
router.get('/:id', (req, res) => controller.getById(req, res));

// ==================== 需要认证的接口 ====================

// 创建（需要认证）
router.post('/', authMiddleware, (req, res) => controller.create(req, res));

// 更新（需要认证）
router.put('/:id', authMiddleware, (req, res) => controller.update(req, res));

// 删除（需要认证）
router.delete('/:id', authMiddleware, (req, res) => controller.delete(req, res));

// ==================== 特殊操作 ====================

// 发布（需要认证）
router.post('/:id/publish', authMiddleware, (req, res) => controller.publish(req, res));

export default router;
