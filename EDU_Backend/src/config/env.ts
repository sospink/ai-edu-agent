import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MySQL配置
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'edu_db',
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    dir: process.env.LOG_DIR || 'logs',
  },

  // 实验室SSH配置
  labSsh: {
    host: process.env.LAB_SSH_HOST || '',
    port: parseInt(process.env.LAB_SSH_PORT || '22'),
    user: process.env.LAB_SSH_USER || '',
    password: process.env.LAB_SSH_PASSWORD || '',
  },

  // WebSocket配置
  wsPort: parseInt(process.env.WS_PORT || '4001'),
};
