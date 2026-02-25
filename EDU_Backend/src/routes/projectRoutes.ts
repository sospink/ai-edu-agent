import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';

const router = Router();
const projectController = new ProjectController();

// 项目 CRUD
router.get('/', projectController.getAll);
router.get('/slug/:slug', projectController.getBySlug); // 必须在 /:id 之前
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);

// 项目状态管理
router.put('/:id/publish', projectController.publish);
router.put('/:id/archive', projectController.archive);
router.put('/:id/draft', projectController.draft);

// 项目单元管理
router.get('/:id/units', projectController.getUnits);
router.post('/:id/units', projectController.createUnit);
router.put('/:id/units/reorder', projectController.reorderUnits); // 必须在 /:unitId 之前
router.put('/:id/units/:unitId', projectController.updateUnit);
router.delete('/:id/units/:unitId', projectController.deleteUnit);

export default router;
