/**
 * Auth types — 用户认证相关类型定义
 *
 * 支持: 邮箱密码登录、Token 刷新、记住我
 */

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'EMAIL_EXISTS' | 'VALIDATION_ERROR' | 'UNKNOWN';
  message: string;
  field?: 'email' | 'password' | 'confirmPassword';
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';
