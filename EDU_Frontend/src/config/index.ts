// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// 静态文件基础 URL (去掉 /api 后缀)
// 开发环境: http://localhost:4000
// 生产环境: '' (相对路径，由 Nginx 代理)
export const STATIC_BASE_URL = API_BASE_URL.replace('/api', '');

// 获取静态文件完整 URL (用于 /uploads 目录下的文件)
export const getStaticUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${STATIC_BASE_URL}${path}`;
};

// 获取图片 URL (带默认占位图)
export const getImageUrl = (url: string, defaultImage?: string): string => {
  const placeholder = defaultImage || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop';
  if (!url) return placeholder;
  if (url.startsWith('http')) return url;
  return `${STATIC_BASE_URL}${url}`;
};

// App configuration
export const APP_CONFIG = {
  name: 'Agent EDU Lab',
  description: 'AI 教育实训平台',
  version: '0.1.0',
};
