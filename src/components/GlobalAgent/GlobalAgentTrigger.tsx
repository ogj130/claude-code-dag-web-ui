/**
 * GlobalAgentTrigger — 全局 Agent 分析触发器主容器
 *
 * 功能：
 * - 监听 useMultiDispatchStore 的 batchResult / allCompleted / batchId 状态
 * - 有 batchResult 时显示「全局分析」按钮
 * - 点击按钮 → 调用 globalAgentService.analyzeWorkspaceResults
 * - 分析完成 → 弹出 GlobalAgentReportModal
 * - 支持 autoAnalyze 模式（batchResult 更新时自动触发）
 * - 支持错误处理和重试
 * - 支持演示模式（用户明确请求时使用 mock 数据）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMultiDispatchStore } from '@/stores/useMultiDispatchStore';
import { analyzeWorkspaceResults } from '@/services/globalAgentService';
import type { GlobalAgentResult, GlobalAgentError } from '@/types/globalAgent';
import type { GlobalAgentConfig } from '@/types/globalAgent';
import { AnalyzeButton } from './AnalyzeButton';
import { GlobalAgentReportModal } from './GlobalAgentReportModal';

/** 默认 Agent 配置 */
const DEFAULT_CONFIG: GlobalAgentConfig = {
  modelConfigId: 'default',
  autoAnalyze: false,
};

export interface GlobalAgentTriggerProps {
  /** 是否自动触发分析（当 batchResult 更新时） */
  autoAnalyze?: boolean;
  /** Agent 配置 */
  config?: Partial<GlobalAgentConfig>;
}

export interface GlobalAgentTriggerState {
  /** 是否正在分析 */
  isAnalyzing: boolean;
  /** 分析结果 */
  result: GlobalAgentResult | null;
  /** 错误信息 */
  error: GlobalAgentError | null;
  /** Modal 是否打开 */
  isModalOpen: boolean;
}

/**
 * GlobalAgentTrigger — 全局 Agent 分析触发器
 *
 * 放在 dispatch 完成后的汇总区域（App.tsx 中的 isDispatchActive 区域附近）
 */
export function GlobalAgentTrigger({
  autoAnalyze = false,
  config: configOverrides = {},
}: GlobalAgentTriggerProps) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides, autoAnalyze };

  // ── 状态 ────────────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<GlobalAgentResult | null>(null);
  const [error, setError] = useState<GlobalAgentError | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Store 订阅 ───────────────────────────────────────────────────────────
  // 仅用于触发重新渲染；内部回调使用 getState() 读取最新值避免闭包陷阱
  const _batchResult = useMultiDispatchStore(s => s.batchResult);
  const _batchId = useMultiDispatchStore(s => s.batchId);

  // 是否可以触发分析：有 batchResult + batchId
  const canAnalyze = _batchResult !== null && _batchResult.length > 0 && _batchId !== null;

  // ── 执行分析 ─────────────────────────────────────────────────────────────
  const performAnalyze = useCallback(async () => {
    // 使用 getState() 读取最新值，避免 useCallback 闭包捕获旧值
    const { batchResult: freshBatchResult, batchId: freshBatchId } =
      useMultiDispatchStore.getState();

    if (
      !freshBatchResult ||
      freshBatchResult.length === 0 ||
      !freshBatchId
    ) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setIsModalOpen(true);

    try {
      const analysisResult = await analyzeWorkspaceResults(
        freshBatchId,
        freshBatchResult,
        config,
      );

      setResult(analysisResult);
      setError(null);
    } catch (err) {
      // 捕获分析异常
      const message = err instanceof Error ? err.message : '分析服务异常';
      setError({
        status: 'error',
        code: 'API_ERROR',
        message,
        retryable: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [config]); // config 是对象引用稳定，不会有问题

  // ── 防止 autoAnalyze 重复触发的 ref ──────────────────────────────────────
  // batchResult 引用每次都变（来自 store），用 ref 记录是否已触发过
  const hasAutoAnalyzedRef = useRef(false);

  // ── 自动触发分析 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoAnalyze) return;
    // 每次 batchResult 更新（引用变化），重新检查
    // useEffect 依赖是 [_batchResult, autoAnalyze]，确保 batchResult 有值时才触发
    if (!canAnalyze) {
      hasAutoAnalyzedRef.current = false; // 重置，允许下次触发
      return;
    }
    if (hasAutoAnalyzedRef.current) return; // 防止重复触发
    hasAutoAnalyzedRef.current = true;
    performAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze, _batchResult]); // 故意省略 canAnalyze 和 performAnalyze，避免循环依赖

  // ── 手动触发 ─────────────────────────────────────────────────────────────
  const handleAnalyzeClick = useCallback(() => {
    if (!canAnalyze) return;
    // 同步设置 loading，在 await 之前触发 React 状态更新
    setIsAnalyzing(true);
    setError(null);
    setIsModalOpen(true);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    performAnalyze();
  }, [canAnalyze, performAnalyze]);

  // ── 演示模式触发 ─────────────────────────────────────────────────────────
  const handleDemoClick = useCallback(() => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setIsModalOpen(true);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    performAnalyze();
  }, [canAnalyze, performAnalyze]);

  // ── 关闭 Modal ───────────────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // ── 清除错误（下次点击重新分析）──────────────────────────────────────────
  const handleClearError = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return (
    <>
      <AnalyzeButton
        disabled={!canAnalyze || isAnalyzing}
        loading={isAnalyzing}
        onClick={handleAnalyzeClick}
      />

      {/* 错误提示 + 重试 + 演示模式 */}
      {error && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: `1px solid ${error.retryable ? 'var(--error)' : 'var(--warn)'}`,
            borderRadius: 10,
            padding: '14px 18px',
            fontSize: 12,
            color: error.retryable ? 'var(--error)' : 'var(--warn)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            maxWidth: 420,
            minWidth: 300,
          }}
        >
          {/* 错误图标 + 消息 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>分析失败</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>
                {error.message}
              </div>
              {!error.retryable && (
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                  请检查配置后重试
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            {/* 演示模式按钮（仅可重试错误显示） */}
            {error.retryable && (
              <button
                onClick={handleDemoClick}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: 6,
                  color: '#eab308',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.12)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                演示模式
              </button>
            )}
            {/* 重试按钮 */}
            {error.retryable && (
              <button
                onClick={() => {
                  setError(null);
                  if (canAnalyze) {
                    setIsAnalyzing(true);
                    setIsModalOpen(true);
                    performAnalyze();
                  }
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                重试
              </button>
            )}
            {/* 关闭按钮 */}
            <button
              onClick={handleClearError}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="关闭错误提示"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 分析报告 Modal */}
      <GlobalAgentReportModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        result={isAnalyzing ? null : result}
        error={isAnalyzing ? null : error}
      />
    </>
  );
}
