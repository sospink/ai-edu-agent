import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 确保上传目录存在
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 图片存储配置
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 生成唯一文件名: 时间戳-随机数.扩展名
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, filename);
  },
});

// 通用文件存储配置
const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'files');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, filename);
  },
});

// 学习资料存储配置
const materialStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 处理中文文件名编码问题
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    // 更新 file.originalname 以便后续使用
    file.originalname = originalName;
    
    const ext = path.extname(originalName);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, filename);
  },
});

// 图片文件过滤器
const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP, SVG)'));
  }
};

// 学习资料文件过滤器 (markdown, pdf, 思维导图)
const materialFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'text/markdown',
    'text/x-markdown',
    'text/plain',           // .md 文件有时被识别为 text/plain
    'application/pdf',
    'application/x-xmind',  // XMind
    'application/octet-stream', // 通用二进制（某些思维导图格式）
  ];
  const allowedExts = ['.md', '.markdown', '.pdf', '.xmind', '.mm', '.xmm'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 Markdown、PDF 或思维导图文件 (.md, .pdf, .xmind, .mm)'));
  }
};

// 图片上传中间件 (单个)
export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single('image');

// 图片上传中间件 (多个)
export const uploadImages = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10, // 最多10个文件
  },
}).array('images', 10);

// 通用文件上传中间件
export const uploadFile = multer({
  storage: fileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single('file');

// 学习资料上传中间件 (单个)
export const uploadMaterial = multer({
  storage: materialStorage,
  fileFilter: materialFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single('material');

// 学习资料上传中间件 (多个)
export const uploadMaterials = multer({
  storage: materialStorage,
  fileFilter: materialFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, // 最多10个文件
  },
}).array('materials', 10);

// 错误处理包装器
export const handleUploadError = (uploadMiddleware: any) => {
  return (req: any, res: any, next: any) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: '文件大小超出限制' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ success: false, error: '文件数量超出限制' });
        }
        return res.status(400).json({ success: false, error: err.message });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  };
};
