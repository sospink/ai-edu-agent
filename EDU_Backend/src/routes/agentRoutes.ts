import { Router } from 'express';
import * as AgentController from '../controllers/AgentController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// 所有路由需要登录
router.use(authMiddleware);

// 获取手册
router.get('/manual/:sourceType/:sourceId', AgentController.getManual);

// 验证步骤
router.post('/verify', AgentController.verifyStep);

// AI 问答（非流式）
router.post('/chat', AgentController.chat);

// AI 问答（流式 SSE）
router.post('/chat/stream', AgentController.chatStream);

// 代码解释
router.post('/explain', AgentController.explainCode);

// 获取用户进度
router.get('/progress/:sourceType/:sourceId', AgentController.getProgress);

// 更新用户进度
router.post('/progress', AgentController.updateProgress);

// AI 验证建议
router.post('/suggestion', AgentController.getVerificationSuggestion);

// ============ Admin Routes ============
// 获取手册（管理员）
router.get('/admin/manual/:sourceType/:sourceId', adminMiddleware, AgentController.getManualForAdmin);

// 创建手册
router.post('/admin/manual', adminMiddleware, AgentController.createManual);

// 更新手册
router.put('/admin/manual/:id', adminMiddleware, AgentController.updateManual);

// 删除手册
router.delete('/admin/manual/:id', adminMiddleware, AgentController.deleteManual);

// 批量更新步骤
router.post('/admin/manual/:id/steps', adminMiddleware, AgentController.updateSteps);

// 导入 Markdown
router.post('/admin/import', adminMiddleware, AgentController.importMarkdown);

// 解析预览 Markdown
router.post('/admin/parse-preview', adminMiddleware, AgentController.parseMarkdownPreview);

export default router;
