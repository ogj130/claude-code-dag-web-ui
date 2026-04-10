/**
 * AES-256 加密/解密工具
 * 使用 crypto-js 实现敏感字段的加密存储
 */
import CryptoJS from 'crypto-js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 本地加密密钥存储键 */
const ENCRYPTION_KEY_STORAGE = 'cc_web_encryption_key';

/** 密钥派生迭代次数 */
const KEY_ITERATIONS = 10000;

/** 密钥长度（位） */
const KEY_SIZE = 256 / 32;

// ---------------------------------------------------------------------------
// 密钥管理
// ---------------------------------------------------------------------------

/**
 * 获取或生成加密密钥
 * 密钥存储在 localStorage 中，用户可通过设置重置
 */
export function getEncryptionKey(): string {
  let key = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  if (!key) {
    // 生成新的随机密钥
    key = CryptoJS.lib.WordArray.random(32).toString();
    localStorage.setItem(ENCRYPTION_KEY_STORAGE, key);
  }
  return key;
}

/**
 * 生成新的加密密钥（会清除现有加密数据）
 */
export function regenerateEncryptionKey(): string {
  const newKey = CryptoJS.lib.WordArray.random(32).toString();
  localStorage.setItem(ENCRYPTION_KEY_STORAGE, newKey);
  return newKey;
}

/**
 * 检查是否已设置加密密钥
 */
export function hasEncryptionKey(): boolean {
  return localStorage.getItem(ENCRYPTION_KEY_STORAGE) !== null;
}

// ---------------------------------------------------------------------------
// 加密/解密核心
// ---------------------------------------------------------------------------

/**
 * 使用 AES-256 加密敏感字段
 * @param data 要加密的明文字符串
 * @param key 加密密钥（如果不提供则使用存储的密钥）
 * @returns Base64 编码的密文
 */
export function encryptField(data: string, key?: string): string {
  const encryptionKey = key ?? getEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(data, encryptionKey, {
    keySize: KEY_SIZE,
    iterations: KEY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  return encrypted.toString();
}

/**
 * 使用 AES-256 解密敏感字段
 * @param encrypted Base64 编码的密文
 * @param key 解密密钥（如果不提供则使用存储的密钥）
 * @returns 解密后的明文字符串
 */
export function decryptField(encrypted: string, key?: string): string {
  if (!encrypted) return '';
  try {
    const encryptionKey = key ?? getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encrypted, encryptionKey, {
      keySize: KEY_SIZE,
      iterations: KEY_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    });
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || '';
  } catch {
    console.error('[Encryption] 解密失败，密钥可能不匹配');
    return '';
  }
}

/**
 * 检查密文是否可以正确解密
 * @param encrypted 密文
 * @param key 密钥（可选）
 * @returns 是否可以解密
 */
export function canDecrypt(encrypted: string, key?: string): boolean {
  const decrypted = decryptField(encrypted, key);
  return decrypted !== '';
}

// ---------------------------------------------------------------------------
// 批量操作
// ---------------------------------------------------------------------------

/**
 * 加密多个字段
 * @param fields 要加密的字段映射
 * @param key 加密密钥（可选）
 * @returns 加密后的字段映射
 */
export function encryptFields<T extends Record<string, string>>(
  fields: T,
  key?: string
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string };
  for (const [fieldKey, value] of Object.entries(fields)) {
    result[fieldKey as keyof T] = encryptField(value, key);
  }
  return result;
}

/**
 * 解密多个字段
 * @param fields 要解密的字段映射
 * @param key 解密密钥（可选）
 * @returns 解密后的字段映射
 */
export function decryptFields<T extends Record<string, string>>(
  fields: T,
  key?: string
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string };
  for (const [fieldKey, value] of Object.entries(fields)) {
    result[fieldKey as keyof T] = decryptField(value, key);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 隐私数据加密
// ---------------------------------------------------------------------------

/** 需要加密的敏感字段列表 */
export const SENSITIVE_FIELDS = ['query', 'analysis', 'summary', 'metadata'] as const;

export type SensitiveField = typeof SENSITIVE_FIELDS[number];

/**
 * 检查字段是否需要加密
 */
export function isSensitiveField(field: string): field is SensitiveField {
  return (SENSITIVE_FIELDS as readonly string[]).includes(field);
}
