import crypto from 'crypto';

const SALT_ROUNDS = 10;

// 简单的密码哈希实现（生产环境建议使用 bcrypt）
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  const [salt, originalHash] = hashedPassword.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};
