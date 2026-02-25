import { Router } from 'express';
import { UserController } from '../controllers/UserController';

const router = Router();
const userController = new UserController();

// 用户 CRUD
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

// 密码管理
router.put('/:id/password', userController.updatePassword);

// 状态管理
router.put('/:id/freeze', userController.freeze);
router.put('/:id/activate', userController.activate);

export default router;
