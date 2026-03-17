import { Router } from 'express';
import { OpenclawViewController } from '../controllers/OpenclawViewController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/:sessionId/thinking', OpenclawViewController.getThinking);
router.get('/:sessionId/executing', OpenclawViewController.getExecuting);
router.get('/:sessionId/completed', OpenclawViewController.getCompleted);
router.get('/:sessionId/phase', OpenclawViewController.getPhase);
router.get('/file/:messageId/:fileKey', OpenclawViewController.downloadFile);
router.post('/chat/send', OpenclawViewController.sendMessage);

export default router;
