/**
 * 构建部署包脚本
 * 
 * 使用方法: node scripts/build-deploy.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.join(ROOT_DIR, 'dist-deploy');
const BACKEND_DIR = path.join(ROOT_DIR, 'EDU_Backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'EDU_Frontend');

// 颜色输出
const log = {
  info: (msg) => console.log(`\x1b[32m[INFO]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[34m=== ${msg} ===\x1b[0m\n`),
};

// 执行命令
function exec(cmd, cwd, extraEnv = {}) {
  log.info(`执行: ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

// 复制目录
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    log.warn(`目录不存在，跳过: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 复制文件
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    log.warn(`文件不存在，跳过: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// 清理目录
function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  console.log('\n');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║     Agent EDU 部署包构建工具          ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('\n');

  // 1. 清理部署目录
  log.step('清理部署目录');
  cleanDir(DEPLOY_DIR);

  // 2. 构建后端
  log.step('构建后端');
  exec('npm run build', BACKEND_DIR);

  // 3. 构建前端
  log.step('构建前端');
  // 不覆盖 .env.production，避免抹掉业务配置（如 Dify、终端传输模式等）
  exec('npm run build', FRONTEND_DIR, { VITE_API_BASE_URL: '/api' });

  // 4. 组装部署目录
  log.step('组装部署目录');

  // 4.1 后端
  const backendDest = path.join(DEPLOY_DIR, 'backend');
  fs.mkdirSync(backendDest, { recursive: true });

  copyDir(path.join(BACKEND_DIR, 'dist'), path.join(backendDest, 'dist'));
  copyFile(path.join(BACKEND_DIR, 'package.json'), path.join(backendDest, 'package.json'));
  copyFile(path.join(BACKEND_DIR, 'package-lock.json'), path.join(backendDest, 'package-lock.json'));
  copyDir(path.join(BACKEND_DIR, 'public'), path.join(backendDest, 'public'));

  // conf 目录占位
  const confDir = path.join(backendDest, 'conf');
  fs.mkdirSync(confDir, { recursive: true });
  fs.writeFileSync(path.join(confDir, 'README.txt'), 
`Docker TLS 证书目录

请将以下证书文件放到此目录:
- ca.pem     (CA 证书)
- cert.pem   (客户端证书)
- key.pem    (客户端私钥)

这些证书用于连接远程 Docker 服务器创建实验环境。
`);

  // .env.example
  const envExample = `# Agent EDU 后端配置

PORT=4000
NODE_ENV=development

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=edu_db

LOG_LEVEL=debug
LOG_DIR=logs

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# Docker (实验环境)
DOCKER_HOST=192.168.20.3
DOCKER_PORT=2376
DOCKER_TLS=true
DOCKER_CERT_PATH=./conf

# 通义千问 API
DASHSCOPE_API_KEY=your-api-key
QWEN_MODEL=qwen3-max
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
`;
  fs.writeFileSync(path.join(backendDest, '.env.example'), envExample);

  // 4.2 前端
  copyDir(path.join(FRONTEND_DIR, 'dist'), path.join(DEPLOY_DIR, 'frontend'));

  // 4.3 Nginx 配置
  copyFile(path.join(ROOT_DIR, 'deploy', 'nginx.conf'), path.join(DEPLOY_DIR, 'nginx.conf'));

  // 5. 部署脚本
  log.step('生成部署脚本');
  
  const deployScript = `#!/bin/bash
set -e

GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo -e "\${BLUE}"
echo "  Agent EDU 部署脚本"
echo -e "\${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "\${YELLOW}请使用 sudo 运行\${NC}"
    exit 1
fi

read -p "域名或 IP (默认 localhost): " DOMAIN
DOMAIN=\${DOMAIN:-localhost}

BACKEND_DIR="/var/www/edu-backend"
FRONTEND_DIR="/var/www/edu"

echo -e "\${GREEN}[1/5] 创建目录\${NC}"
mkdir -p \$BACKEND_DIR \$FRONTEND_DIR

echo -e "\${GREEN}[2/5] 部署后端\${NC}"

# 检查源目录是否有 .env 文件
if [ ! -f "\$SCRIPT_DIR/backend/.env" ]; then
    echo -e "\${YELLOW}请先在 \$SCRIPT_DIR/backend/ 目录创建 .env 文件\${NC}"
    echo -e "\${YELLOW}可以参考 .env.example 进行配置\${NC}"
    exit 1
fi

cp -r "\$SCRIPT_DIR/backend/"* \$BACKEND_DIR/
cd \$BACKEND_DIR

npm install --production

echo -e "\${GREEN}[3/5] 部署前端\${NC}"
rm -rf \$FRONTEND_DIR/*
cp -r "\$SCRIPT_DIR/frontend/"* \$FRONTEND_DIR/

echo -e "\${GREEN}[4/5] 配置 Nginx\${NC}"
cp "\$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/edu
sed -i "s/your-domain.com/\$DOMAIN/g" /etc/nginx/sites-available/edu
ln -sf /etc/nginx/sites-available/edu /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo -e "\${GREEN}[5/5] 启动服务\${NC}"
cd \$BACKEND_DIR
pm2 delete edu-backend 2>/dev/null || true
pm2 start dist/index.js --name edu-backend
pm2 save

echo ""
echo -e "\${GREEN}部署完成! 访问: http://\$DOMAIN\${NC}"
`;

  fs.writeFileSync(path.join(DEPLOY_DIR, 'deploy.sh'), deployScript);

  // 6. README
  const readme = `# Agent EDU 部署包

## 部署步骤

1. 编辑 backend/.env.example 并重命名为 .env
2. 将 Docker 证书放入 backend/conf/ (如需实验环境)
3. 上传整个目录到服务器
4. 运行: sudo ./deploy.sh

## 服务器环境要求

- Node.js 18+
- MySQL 8.0
- Nginx
- PM2
- Docker (可选，用于实验环境)
`;

  fs.writeFileSync(path.join(DEPLOY_DIR, 'README.md'), readme);

  // 完成
  log.step('构建完成!');
  console.log(`部署包: ${DEPLOY_DIR}`);
  console.log('');
  console.log('下一步:');
  console.log('1. 编辑 dist-deploy/backend/.env.example → .env');
  console.log('2. 放入 Docker 证书到 dist-deploy/backend/conf/');
  console.log('3. 上传 dist-deploy 到服务器');
  console.log('4. 运行: sudo ./deploy.sh');
}

main();
