import 'reflect-metadata';
import http from 'http';
import app from './app';
import { config } from './config/env';
import { AppDataSource } from './config/database';
import { logger } from './utils/logger';
import { UserService } from './services/UserService';
import { setupTerminalWebSocket } from './services/TerminalService';

const startServer = async (): Promise<void> => {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    logger.info('Database connection established');

    // 初始化默认管理员
    const userService = new UserService();
    await userService.initDefaultAdmin();
    logger.info('Default admin initialized');

    // 创建 HTTP 服务器
    const server = http.createServer(app);

    // 设置 WebSocket 终端服务
    setupTerminalWebSocket(server);
    logger.info('Terminal WebSocket service initialized');

    // 启动服务器
    server.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await AppDataSource.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await AppDataSource.destroy();
  process.exit(0);
});

startServer();
