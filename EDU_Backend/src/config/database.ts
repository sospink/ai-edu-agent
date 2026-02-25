import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'edu_db',
  // 开启自动同步，自动创建/更新表结构
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '../models/**/*.{ts,js}')],
  migrations: [path.join(__dirname, '../migrations/**/*.{ts,js}')],
  subscribers: [],
  charset: 'utf8mb4',
});
