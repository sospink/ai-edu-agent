import type React from 'react';

// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 静态文件基础 URL (去掉 /api 后缀)
// 默认使用相对路径 /api，统一通过 Nginx 代理
export const STATIC_BASE_URL = API_BASE_URL.replace('/api', '');

const isApiBaseAbsolute = /^https?:\/\//.test(API_BASE_URL);
const resolvedApiUrl = isApiBaseAbsolute
  ? new URL(API_BASE_URL)
  : new URL(API_BASE_URL, window.location.origin);
const API_PATH_PREFIX = resolvedApiUrl.pathname.replace(/\/$/, '');
const API_ORIGIN = resolvedApiUrl.origin;

const normalizePath = (filePath: string): string =>
  filePath.startsWith('/') ? filePath : `/${filePath}`;

const getUploadDirectUrl = (filePath: string): string => {
  const normalizedPath = normalizePath(filePath);
  if (isApiBaseAbsolute) {
    return `${API_ORIGIN}${normalizedPath}`;
  }
  return normalizedPath;
};

const getUploadProxyUrl = (filePath: string): string => {
  const normalizedPath = normalizePath(filePath);
  if (isApiBaseAbsolute) {
    return `${API_ORIGIN}${API_PATH_PREFIX}${normalizedPath}`;
  }
  return `${API_PATH_PREFIX}${normalizedPath}`;
};

// 获取静态文件完整 URL (用于 /uploads 目录下的文件)
export const getStaticUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const normalizedPath = normalizePath(path);
  // 优先使用 /uploads，兼容未重启后端或旧版后端场景
  if (normalizedPath.startsWith('/uploads/')) return getUploadDirectUrl(normalizedPath);
  return `${STATIC_BASE_URL}${normalizedPath}`;
};

// 获取图片 URL (带默认占位图)
export const getImageUrl = (url: string, defaultImage?: string): string => {
  const placeholder = defaultImage || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop';
  if (!url) return placeholder;
  if (url.startsWith('http')) return url;
  return getStaticUrl(url);
};

// 获取图片候选 URL（优先 /uploads，失败时回退 /api/uploads）
export const getImageUrlCandidates = (url: string, defaultImage?: string): string[] => {
  const placeholder =
    defaultImage || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop';

  if (!url) return [placeholder];
  if (url.startsWith('http')) return [url, placeholder];

  const normalizedPath = normalizePath(url);
  if (!normalizedPath.startsWith('/uploads/')) {
    return [getStaticUrl(normalizedPath), placeholder];
  }

  const candidates = [getUploadDirectUrl(normalizedPath), getUploadProxyUrl(normalizedPath), placeholder];
  return Array.from(new Set(candidates));
};

// 图片 onError 回退处理
export const handleImageFallback = (
  event: React.SyntheticEvent<HTMLImageElement>,
  candidates: string[]
): void => {
  if (!candidates.length) return;
  const img = event.currentTarget;
  const currentIndex = Number(img.dataset.fallbackIndex || '0');
  const nextIndex = currentIndex + 1;

  if (nextIndex >= candidates.length) return;

  img.dataset.fallbackIndex = String(nextIndex);
  img.src = candidates[nextIndex];
};

// App configuration
export const APP_CONFIG = {
  name: 'Agent EDU Lab',
  description: 'AI 教育实训平台',
  version: '0.1.0',
};

// Dify configuration
const DIFY_DEFAULT_BASE_URL = 'http://117.50.80.138';
const DIFY_DEFAULT_CHATBOT_TOKEN = 'EH3HxvW3csV1dr7k';

export const DIFY_BASE_URL = import.meta.env.VITE_DIFY_BASE_URL || DIFY_DEFAULT_BASE_URL;
export const DIFY_CHATBOT_TOKEN = import.meta.env.VITE_DIFY_CHATBOT_TOKEN || DIFY_DEFAULT_CHATBOT_TOKEN;

export const getDifyChatbotUrl = (query: Record<string, string | number | undefined> = {}): string => {
  const normalizedBase = DIFY_BASE_URL.replace(/\/$/, '');
  const normalizedToken = DIFY_CHATBOT_TOKEN.trim();
  if (!normalizedBase || !normalizedToken) return '';

  const url = new URL(`/chatbot/${normalizedToken}`, normalizedBase);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const encodeDifyQueryValue = async (value: string): Promise<string> => {
  // Dify WebApp 会尝试对 query value 做 base64 + gzip 解码
  if (typeof CompressionStream === 'undefined') {
    return value;
  }

  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(value));
  writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  return toBase64(new Uint8Array(compressed));
};

export const getDifyChatbotUrlEncoded = async (
  query: Record<string, string | number | undefined> = {},
): Promise<string> => {
  const normalizedBase = DIFY_BASE_URL.replace(/\/$/, '');
  const normalizedToken = DIFY_CHATBOT_TOKEN.trim();
  if (!normalizedBase || !normalizedToken) return '';

  const url = new URL(`/chatbot/${normalizedToken}`, normalizedBase);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    const encoded = await encodeDifyQueryValue(String(value));
    url.searchParams.set(key, encoded);
  }

  return url.toString();
};
