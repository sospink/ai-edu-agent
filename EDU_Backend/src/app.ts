import 'reflect-metadata';
import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// 静态文件服务 - 用于访问上传的文件
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
// 兼容仅代理 /api 的部署场景
app.use('/api/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// API 路由
app.use('/api', routes);

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
