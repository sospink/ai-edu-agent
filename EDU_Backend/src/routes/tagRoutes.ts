import { Router } from 'express';
import { TagController } from '../controllers/TagController';

const router = Router();
const tagController = new TagController();

// 标签 CRUD
router.get('/', tagController.getAll);
router.post('/', tagController.create);
router.put('/:id', tagController.update);
router.delete('/:id', tagController.delete);

export default router;
