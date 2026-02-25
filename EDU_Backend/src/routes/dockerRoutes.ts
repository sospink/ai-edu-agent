import { Router } from 'express';
import DockerController from '../controllers/DockerController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// 所有 Docker 路由都需要管理员权限
router.use(authMiddleware, adminMiddleware);

// Docker 系统信息
router.get('/info', DockerController.getInfo);

// 容器管理
router.get('/containers', DockerController.listContainers);
router.get('/containers/:id', DockerController.inspectContainer);
router.get('/containers/:id/logs', DockerController.getContainerLogs);
router.get('/containers/:id/stats', DockerController.getContainerStats);
router.post('/containers/:id/start', DockerController.startContainer);
router.post('/containers/:id/stop', DockerController.stopContainer);
router.post('/containers/:id/restart', DockerController.restartContainer);
router.delete('/containers/:id', DockerController.removeContainer);

// 镜像管理
router.get('/images', DockerController.listImages);
router.delete('/images/:id', DockerController.removeImage);

export default router;
