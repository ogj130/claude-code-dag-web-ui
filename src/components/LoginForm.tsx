import React, { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

// ── Icons (inline SVG) ──────────────────────────────────────────────
const EyeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const SpinnerIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
    <path d="M12 2a10 10 0 019.95 9" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12"
        dur="0.75s" repeatCount="indefinite" />
    </path>
  </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--success)"
    strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── 输入框子组件 ─────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  passwordVisible?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  success?: boolean;
}

function InputField({
  label, type, value, onChange, placeholder, error,
  autoFocus, showPasswordToggle, onTogglePassword,
  passwordVisible, onKeyDown, success,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputType = showPasswordToggle && !passwordVisible ? 'password' : type === 'password' ? 'password' : 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
        userSelect: 'none',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%', height: 42,
            padding: showPasswordToggle ? '0 44px 0 14px' : '0 14px',
            borderRadius: 8,
            border: error
              ? '1.5px solid var(--error)'
              : success
              ? '1.5px solid var(--success)'
              : isFocused
              ? '1.5px solid var(--accent)'
              : '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: isFocused && !error
              ? '0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)'
              : 'none',
          }}
        />
        {/* 密码可见性切换 */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            style={{
              position: 'absolute', right: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
              background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-dim)',
              borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
            tabIndex={-1}
          >
            {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        {/* 成功对勾 */}
        {success && !showPasswordToggle && (
          <span style={{ position: 'absolute', right: 10 }}><CheckIcon /></span>
        )}
      </div>
      {/* 错误提示 */}
      {error && (
        <span style={{ fontSize: 11, color: 'var(--error)', paddingLeft: 2, lineHeight: 1.4 }}>
          {error}
        </span>
      )}
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────
export function LoginForm() {
  const { login, register, isLoading, error, clearError, isInitializing } = useAuthStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 切换登录/注册时清理错误和字段
  const switchMode = useCallback((newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setShowPassword(false);
    clearError();
  }, [clearError]);

  // 表单提交
  const handleSubmit = useCallback(async () => {
    if (isLoading) return;

    if (mode === 'signin') {
      await login({ email: email.trim(), password, rememberMe });
    } else {
      await register({ email: email.trim(), password, confirmPassword, displayName: displayName.trim() || undefined });
    }
  }, [mode, email, password, confirmPassword, displayName, rememberMe, isLoading, login, register]);

  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // 判断当前错误对应的字段
  const getFieldError = (field: string) => error?.field === field ? error.message : undefined;
  // 全局错误（无具体字段）
  const globalError = error && !error.field ? error.message : undefined;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.25s ease',
    }}>
      {/* Overlay click handler — 仅当非 loading 时 */}
      {isInitializing && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SpinnerIcon size={32} />
        </div>
      )}

      {/* 卡片 */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '36px 32px 28px',
        width: 400,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.45)',
        animation: 'slideUp 0.3s ease',
        position: 'relative',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Logo / 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 20, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 40%, transparent)',
          }}>
            CC
          </div>
          <h1 style={{
            margin: 0, fontSize: 18, fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            {mode === 'signin' ? '欢迎回来' : '创建账户'}
          </h1>
          <p style={{
            margin: '6px 0 0', fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            {mode === 'signin'
              ? '登录您的 Claude Code Web UI 账户'
              : '注册以开始使用 Claude Code Web UI'}
          </p>
        </div>

        {/* 全局错误提示 */}
        {globalError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            color: 'var(--error)',
            fontSize: 12, lineHeight: 1.5,
            marginBottom: 16,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {globalError}
          </div>
        )}

        {/* 表单字段 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 注册时显示昵称 */}
          {mode === 'signup' && (
            <InputField
              label="昵称（选填）"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="您的显示名称"
              onKeyDown={handleKeyDown}
              success={displayName.trim().length > 0}
            />
          )}

          <InputField
            label="邮箱"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="your@email.com"
            autoFocus
            error={getFieldError('email')}
            onKeyDown={handleKeyDown}
          />

          <InputField
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === 'signin' ? '输入密码' : '至少 8 位，含字母'}
            error={getFieldError('password')}
            showPasswordToggle
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword(v => !v)}
            onKeyDown={handleKeyDown}
          />

          {mode === 'signup' && (
            <InputField
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="再次输入密码"
              error={getFieldError('confirmPassword')}
              onKeyDown={handleKeyDown}
              success={confirmPassword.length > 0 && confirmPassword === password}
            />
          )}
        </div>

        {/* 记住我 + 忘记密码（仅登录模式） */}
        {mode === 'signin' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14,
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', userSelect: 'none',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              <div
                onClick={() => setRememberMe(v => !v)}
                style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: rememberMe ? 'none' : '1.5px solid var(--border)',
                  background: rememberMe ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                {rememberMe && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              记住我
            </label>
            <button
              type="button"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--accent)',
                fontFamily: 'inherit', padding: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-dim)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; }}
            >
              忘记密码？
            </button>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          style={{
            width: '100%', height: 44, marginTop: 22,
            borderRadius: 9,
            border: 'none',
            background: isLoading
              ? 'var(--bg-input)'
              : 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
            color: isLoading ? 'var(--text-dim)' : '#fff',
            fontSize: 14, fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            boxShadow: isLoading
              ? 'none'
              : '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 18px color-mix(in srgb, var(--accent) 45%, transparent)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)';
          }}
        >
          {isLoading ? (
            <>
              <SpinnerIcon size={18} />
              {mode === 'signin' ? '登录中...' : '注册中...'}
            </>
          ) : mode === 'signin' ? '登  录' : '注  册'}
        </button>

        {/* 切换登录/注册 */}
        <div style={{
          textAlign: 'center', marginTop: 18,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          {mode === 'signin' ? '还没有账户？' : '已有账户？'}
          {' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontWeight: 600,
              fontSize: 12, fontFamily: 'inherit',
              padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; }}
            disabled={isLoading}
          >
            {mode === 'signin' ? '立即注册' : '去登录'}
          </button>
        </div>

        {/* 演示账号提示 */}
        <div style={{
          marginTop: 16, padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--pending-bg)',
          border: '1px solid var(--pending-border)',
          fontSize: 11, color: 'var(--text-dim)',
          textAlign: 'center', lineHeight: 1.6,
        }}>
          演示账号：admin@cc.ai / admin123
        </div>
      </div>

      {/* 内联动画关键帧 */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
