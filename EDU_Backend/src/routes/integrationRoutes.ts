import { Router } from 'express';
import { OpenclawViewController } from '../controllers/OpenclawViewController';
import { adminMiddleware, authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/openclaw/health', OpenclawViewController.getOpenClawHealth);
router.get('/feishu/health', OpenclawViewController.getFeishuHealth);

export default router;
