import { Router } from 'express';
import { CourseController } from '../controllers/CourseController';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { uploadMaterial, handleUploadError } from '../middlewares/upload';

const router = Router();
const controller = new CourseController();

// ==================== 课程管理 (管理员) ====================

// 获取课程列表 (公开)
router.get('/', (req, res) => controller.getAll(req, res));

// 获取单个课程 (公开)
router.get('/:id', (req, res) => controller.getById(req, res));

// 按 Slug 获取课程 (公开)
router.get('/slug/:slug', (req, res) => controller.getBySlug(req, res));

// 创建课程 (需要认证)
router.post('/', authMiddleware, (req, res) => controller.create(req, res));

// 更新课程 (需要认证)
router.put('/:id', authMiddleware, (req, res) => controller.update(req, res));

// 删除课程 (需要认证)
router.delete('/:id', authMiddleware, (req, res) => controller.delete(req, res));

// 发布课程 (需要认证)
router.post('/:id/publish', authMiddleware, (req, res) => controller.publish(req, res));

// 下架课程 (需要认证)
router.post('/:id/archive', authMiddleware, (req, res) => controller.archive(req, res));

// 设为草稿 (需要认证)
router.post('/:id/draft', authMiddleware, (req, res) => controller.draft(req, res));

// ==================== 阶段管理 ====================

// 获取课程阶段列表
router.get('/:id/stages', (req, res) => controller.getStages(req, res));

// 创建阶段
router.post('/:id/stages', authMiddleware, (req, res) => controller.createStage(req, res));

// 更新阶段
router.put('/:id/stages/:stageId', authMiddleware, (req, res) => controller.updateStage(req, res));

// 删除阶段
router.delete('/:id/stages/:stageId', authMiddleware, (req, res) => controller.deleteStage(req, res));

// 阶段排序
router.post('/:id/stages/reorder', authMiddleware, (req, res) => controller.reorderStages(req, res));

// ==================== 课时管理 ====================

// 获取课程所有课时
router.get('/:id/lessons', (req, res) => controller.getLessons(req, res));

// 获取阶段课时列表
router.get('/:id/stages/:stageId/lessons', (req, res) => controller.getStageLessons(req, res));

// 创建课时
router.post('/:id/stages/:stageId/lessons', authMiddleware, (req, res) => controller.createLesson(req, res));

// 更新课时
router.put('/:id/lessons/:lessonId', authMiddleware, (req, res) => controller.updateLesson(req, res));

// 删除课时
router.delete('/:id/lessons/:lessonId', authMiddleware, (req, res) => controller.deleteLesson(req, res));

// 课时排序
router.post('/:id/stages/:stageId/lessons/reorder', authMiddleware, (req, res) => controller.reorderLessons(req, res));

// ==================== 用户学习进度 ====================

// 加入课程
router.post('/:id/enroll', authMiddleware, (req, res) => controller.enrollCourse(req, res));

// 获取用户在该课程的学习记录
router.get('/:id/progress', authMiddleware, (req, res) => controller.getUserLessonRecords(req, res));

// 开始学习课时
router.post('/lessons/:lessonId/start', authMiddleware, (req, res) => controller.startLesson(req, res));

// 完成课时
router.post('/lessons/:lessonId/complete', authMiddleware, (req, res) => controller.completeLesson(req, res));

// 获取单个课时
router.get('/lessons/:lessonId', (req, res) => controller.getLessonById(req, res));

// ==================== 课时学习资料管理 ====================

// 获取课时学习资料列表
router.get('/lessons/:lessonId/materials', (req, res) => controller.getLessonMaterials(req, res));

// 上传学习资料
router.post('/lessons/:lessonId/materials', authMiddleware, handleUploadError(uploadMaterial), (req, res) => controller.uploadMaterial(req, res));

// 更新学习资料
router.put('/materials/:materialId', authMiddleware, (req, res) => controller.updateMaterial(req, res));

// 删除学习资料
router.delete('/materials/:materialId', authMiddleware, (req, res) => controller.deleteMaterial(req, res));

// 学习资料排序
router.post('/lessons/:lessonId/materials/reorder', authMiddleware, (req, res) => controller.reorderMaterials(req, res));

export default router;
