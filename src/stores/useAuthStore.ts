/**
 * useAuthStore — 认证状态管理
 *
 * 管理用户登录/注册/登出流程、Token 持久化、会话恢复。
 * 支持 mock 模式（开发环境无需后端）和真实 API 模式。
 */

import { create } from 'zustand';
import type { LoginCredentials, RegisterCredentials, AuthUser, AuthTokens, AuthError } from '../types/auth';

// ── 常量 ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'cc-auth-tokens';
const USER_KEY = 'cc-auth-user';

// ── 工具函数 ───────────────────────────────────────────────────────
function persistTokens(tokens: AuthTokens | null): void {
  if (tokens) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens)); } catch {}
  } else {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const tokens = JSON.parse(raw) as AuthTokens;
      // 检查是否过期
      if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return tokens;
    }
  } catch {}
  return null;
}

function persistUser(user: AuthUser | null): void {
  if (user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  } else {
    try { localStorage.removeItem(USER_KEY); } catch {}
  }
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
  } catch {}
  return null;
}

// ── 简单的邮箱验证 ─────────────────────────────────────────────────
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): AuthError | null {
  if (password.length < 8) {
    return { code: 'VALIDATION_ERROR', message: '密码至少需要 8 个字符', field: 'password' };
  }
  if (!/[A-Z]/.test(password) && !/[a-z]/.test(password)) {
    return { code: 'VALIDATION_ERROR', message: '密码需要包含字母', field: 'password' };
  }
  return null;
}

// ── Mock API（开发/演示环境，当未配置真实 API 时使用） ───────────────
const mockLogin = async (credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> => {
  await new Promise(resolve => setTimeout(resolve, 800)); // 模拟网络延迟

  if (credentials.email === 'admin@cc.ai' && credentials.password === 'admin123') {
    return {
      user: {
        id: 'mock_user_001',
        email: credentials.email,
        displayName: 'Admin',
        createdAt: Date.now(),
      },
      tokens: {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresAt: credentials.rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 60 * 60 * 1000,
      },
    };
  }

  const error: AuthError = {
    code: 'INVALID_CREDENTIALS',
    message: '邮箱或密码不正确',
    field: 'email',
  };
  throw error;
};

const mockRegister = async (credentials: RegisterCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> => {
  await new Promise(resolve => setTimeout(resolve, 800));

  if (credentials.email === 'admin@cc.ai') {
    const error: AuthError = {
      code: 'EMAIL_EXISTS',
      message: '该邮箱已被注册',
      field: 'email',
    };
    throw error;
  }

  return {
    user: {
      id: 'mock_user_' + Date.now(),
      email: credentials.email,
      displayName: credentials.displayName || credentials.email.split('@')[0],
      createdAt: Date.now(),
    },
    tokens: {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
  };
};

// ── 可以通过此函数注入真实 API ─────────────────────────────────────
type AuthAPI = {
  login: (credentials: LoginCredentials) => Promise<{ user: AuthUser; tokens: AuthTokens }>;
  register: (credentials: RegisterCredentials) => Promise<{ user: AuthUser; tokens: AuthTokens }>;
  logout: () => Promise<void>;
  refreshToken: (refreshToken: string) => Promise<AuthTokens>;
};

let authAPI: AuthAPI = {
  login: mockLogin,
  register: mockRegister,
  logout: async () => {},
  refreshToken: async () => { throw new Error('Not implemented'); },
};

/** 注入自定义认证 API（用于对接真实后端） */
export function setAuthAPI(api: Partial<AuthAPI>): void {
  authAPI = { ...authAPI, ...api };
}

// ── Store ──────────────────────────────────────────────────────────
interface AuthState {
  /** 当前用户 */
  user: AuthUser | null;
  /** 当前 Token */
  tokens: AuthTokens | null;
  /** 是否正在加载（认证中） */
  isLoading: boolean;
  /** 是否正在初始化（恢复会话） */
  isInitializing: boolean;
  /** 认证错误 */
  error: AuthError | null;
  /** 是否已认证 */
  isAuthenticated: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  isAuthenticated: false,

  /** 初始化：从 localStorage 恢复会话 */
  initialize: async () => {
    const tokens = loadTokens();
    const user = loadUser();

    if (tokens && user) {
      // 如果有 refreshToken 且 accessToken 已过期，尝试刷新
      if (tokens.expiresAt && Date.now() > tokens.expiresAt && tokens.refreshToken) {
        try {
          const newTokens = await authAPI.refreshToken(tokens.refreshToken);
          persistTokens(newTokens);
          set({ tokens: newTokens, user, isAuthenticated: true, isInitializing: false });
          return;
        } catch {
          // 刷新失败，清除
          persistTokens(null);
          persistUser(null);
        }
      } else if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
        // 过期且无 refreshToken
        persistTokens(null);
        persistUser(null);
      } else {
        set({ tokens, user, isAuthenticated: true, isInitializing: false });
        return;
      }
    }

    set({ isInitializing: false, isAuthenticated: false });
  },

  /** 登录 */
  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    // 客户端验证
    if (!validateEmail(credentials.email)) {
      set({
        isLoading: false,
        error: { code: 'VALIDATION_ERROR', message: '请输入有效的邮箱地址', field: 'email' },
      });
      return;
    }
    if (!credentials.password) {
      set({
        isLoading: false,
        error: { code: 'VALIDATION_ERROR', message: '请输入密码', field: 'password' },
      });
      return;
    }

    try {
      const { user, tokens } = await authAPI.login(credentials);
      persistTokens(tokens);
      persistUser(user);
      set({ user, tokens, isLoading: false, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const authErr: AuthError = (err && typeof err === 'object' && 'code' in err)
        ? err as AuthError
        : { code: 'NETWORK_ERROR', message: '网络连接失败，请稍后重试' };
      set({ isLoading: false, error: authErr });
    }
  },

  /** 注册 */
  register: async (credentials: RegisterCredentials) => {
    set({ isLoading: true, error: null });

    // 客户端验证
    if (!validateEmail(credentials.email)) {
      set({
        isLoading: false,
        error: { code: 'VALIDATION_ERROR', message: '请输入有效的邮箱地址', field: 'email' },
      });
      return;
    }
    const pwErr = validatePassword(credentials.password);
    if (pwErr) {
      set({ isLoading: false, error: pwErr });
      return;
    }
    if (credentials.password !== credentials.confirmPassword) {
      set({
        isLoading: false,
        error: { code: 'VALIDATION_ERROR', message: '两次输入的密码不一致', field: 'confirmPassword' },
      });
      return;
    }

    try {
      const { user, tokens } = await authAPI.register(credentials);
      persistTokens(tokens);
      persistUser(user);
      set({ user, tokens, isLoading: false, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const authErr: AuthError = (err && typeof err === 'object' && 'code' in err)
        ? err as AuthError
        : { code: 'NETWORK_ERROR', message: '网络连接失败，请稍后重试' };
      set({ isLoading: false, error: authErr });
    }
  },

  /** 登出 */
  logout: async () => {
    try {
      await authAPI.logout();
    } catch {}
    persistTokens(null);
    persistUser(null);
    set({ user: null, tokens: null, isAuthenticated: false, error: null });
  },

  /** 清除错误 */
  clearError: () => set({ error: null }),
}));
