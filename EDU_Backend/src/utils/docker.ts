import Dockerode from 'dockerode';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 固定从后端项目根目录加载 .env，并覆盖已存在的同名环境变量，
// 避免 shell/进程里遗留的 DOCKER_* 把配置“顶掉”。
const backendRoot = path.resolve(__dirname, '../../');
dotenv.config({
  path: path.join(backendRoot, '.env'),
  override: true,
});

const certPathRaw = process.env.DOCKER_CERT_PATH || './conf';
const certPath = path.isAbsolute(certPathRaw)
  ? certPathRaw
  : path.resolve(backendRoot, certPathRaw.replace(/^\.\//, ''));
const host = process.env.DOCKER_HOST || 'localhost';
const port = parseInt(process.env.DOCKER_PORT || '2376');
const tlsEnabled = process.env.DOCKER_TLS === 'true';

let docker: Dockerode;

// 如果启用 TLS，加载证书
if (tlsEnabled) {
  const basePath = certPath;
  docker = new Dockerode({
    host: host,
    port: port,
    ca: fs.readFileSync(path.join(basePath, 'ca.pem')),
    cert: fs.readFileSync(path.join(basePath, 'cert.pem')),
    key: fs.readFileSync(path.join(basePath, 'key.pem')),
    protocol: 'https',
  });
} else {
  docker = new Dockerode({
    host: host,
    port: port,
  });
}

console.log(`[Docker] Client target ${host}:${port} TLS=${tlsEnabled ? 'on' : 'off'} certPath=${certPath}`);

export { docker };

// 测试连接
export async function testDockerConnection(): Promise<boolean> {
  try {
    const info = await docker.info();
    console.log('Docker 连接成功!');
    console.log(`  服务器: ${host}:${port}`);
    console.log(`  TLS: ${process.env.DOCKER_TLS === 'true' ? '已启用' : '未启用'}`);
    console.log(`  Docker 版本: ${info.ServerVersion}`);
    console.log(`  容器数量: ${info.Containers}`);
    console.log(`  镜像数量: ${info.Images}`);
    return true;
  } catch (error) {
    console.error('Docker 连接失败:', error);
    return false;
  }
}
