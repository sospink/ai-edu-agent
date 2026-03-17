import { Router } from 'express';
import userRoutes from './userRoutes';
import authRoutes from './authRoutes';
import projectRoutes from './projectRoutes';
import tagRoutes from './tagRoutes';
import uploadRoutes from './uploadRoutes';
import courseRoutes from './courseRoutes';
import skillRoutes from './skillRoutes';
import learningRoutes from './learningRoutes';
import dockerRoutes from './dockerRoutes';
import labRoutes from './labRoutes';
import agentRoutes from './agentRoutes';
import openclawViewRoutes from './openclawViewRoutes';
import integrationRoutes from './integrationRoutes';

const router = Router();

// 认证路由
router.use('/auth', authRoutes);

// 用户管理路由
router.use('/users', userRoutes);

// 项目管理路由
router.use('/projects', projectRoutes);

// 标签管理路由
router.use('/tags', tagRoutes);

// 文件上传路由
router.use('/upload', uploadRoutes);

// 课程管理路由
router.use('/courses', courseRoutes);

// 技能管理路由
router.use('/skills', skillRoutes);

// 学习进度路由
router.use('/learning', learningRoutes);

// Docker 管理路由
router.use('/docker', dockerRoutes);

// 实验室环境路由
router.use('/lab', labRoutes);

// Agent 教学智能体路由
router.use('/agent', agentRoutes);

// OpenClaw 视图聚合路由
router.use('/openclaw-view', openclawViewRoutes);

// 第三方集成健康路由
router.use('/integrations', integrationRoutes);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
