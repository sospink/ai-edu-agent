# Agent EDU 部署指南

## 构建部署包

在本地开发机器上运行：

```bash
# 安装依赖 (首次)
npm install

# 构建部署包
npm run build:deploy
```

这会生成 `dist-deploy/` 目录，包含所有部署所需的文件。

## 部署包结构

```
dist-deploy/
├── backend/           # 后端
│   ├── dist/          # 编译后的代码
│   ├── public/        # 上传文件目录
│   │   └── uploads/
│   ├── conf/          # Docker 证书 (需要自己放入)
│   ├── package.json
│   └── .env.example   # 环境配置模板
├── frontend/          # 前端静态文件
├── nginx.conf         # Nginx 配置
├── deploy.sh          # 部署脚本
└── README.md
```

## 部署流程

### 1. 本地构建

```bash
npm run build:deploy
```

### 2. 配置部署包

```bash
cd dist-deploy/backend

# 创建配置文件
cp .env.example .env
# 编辑 .env，填入数据库密码、API Key 等

# 如果需要实验环境，放入 Docker 证书
# 将 ca.pem, cert.pem, key.pem 放入 conf/ 目录
```

### 3. 上传到服务器

将整个 `dist-deploy` 目录上传到服务器

### 4. 服务器环境准备

```bash
# Ubuntu
sudo apt update
sudo apt install -y nginx mysql-server docker.io
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 配置 MySQL
sudo mysql -e "CREATE DATABASE edu_db CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'edu_user'@'localhost' IDENTIFIED BY 'your_password';"
sudo mysql -e "GRANT ALL ON edu_db.* TO 'edu_user'@'localhost';"
```

### 5. 执行部署

```bash
cd dist-deploy
chmod +x deploy.sh
sudo ./deploy.sh
```

## 常用命令

```bash
pm2 status              # 查看后端状态
pm2 logs edu-backend    # 查看日志
pm2 restart edu-backend # 重启后端
sudo systemctl reload nginx  # 重载 Nginx
```
