import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'edu-lab-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: number;
  username: string;
  roleType: number;
}

// 生成 Token
export const generateToken = (payload: TokenPayload): string => {
  // 使用类型断言绕过严格的类型检查
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// 验证 Token
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
};

// 从请求头中提取 Token
export const extractToken = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};
