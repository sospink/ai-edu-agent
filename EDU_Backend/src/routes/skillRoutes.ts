import { Router } from 'express';
import { CourseController } from '../controllers/CourseController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const controller = new CourseController();

// 获取所有技能
router.get('/', (req, res) => controller.getAllSkills(req, res));

// 按分类获取技能
router.get('/category/:category', (req, res) => controller.getSkillsByCategory(req, res));

// 创建技能 (需要认证)
router.post('/', authMiddleware, (req, res) => controller.createSkill(req, res));

// 更新技能 (需要认证)
router.put('/:id', authMiddleware, (req, res) => controller.updateSkill(req, res));

// 删除技能 (需要认证)
router.delete('/:id', authMiddleware, (req, res) => controller.deleteSkill(req, res));

export default router;
