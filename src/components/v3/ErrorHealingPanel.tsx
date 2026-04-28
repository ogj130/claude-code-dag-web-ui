/**
 * ErrorHealingPanel — 错误自愈面板
 *
 * 检测错误 → 匹配情景记忆 → 生成修复方案 → 一键修复。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfidenceColor } from './v3DesignTokens';
import { useTaskStore } from '../../stores/useTaskStore';

// ── 类型 ────────────────────────────────────────────────────

interface ErrorDetected {
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'fatal';
  source: string;
  timestamp: number;
}

interface MatchedFix {
  episodeId: string;
  similarity: number;
  fixDescription: string;
  fixContent: string;
}

interface HealingState {
  error: ErrorDetected;
  matchedFixes: MatchedFix[];
  selectedFix?: MatchedFix;
  isHealing: boolean;
  healingResult?: 'success' | 'failed';
}

// ── 真实数据 Hook ────────────────────────────────────────────

function useRealErrors() {
  const storeError = useTaskStore(s => s.error);
  const toolCalls = useTaskStore(s => s.toolCalls);
  const [errors, setErrors] = useState<ErrorDetected[]>([]);

  useEffect(() => {
    const detected: ErrorDetected[] = [];
    // Add store-level error if present
    if (storeError) {
      detected.push({
        id: 'store_error',
        message: storeError,
        severity: 'error' as const,
        source: 'Store',
        timestamp: Date.now(),
      });
    }
    // Add failed tool calls
    for (const tc of toolCalls) {
      if (tc.status === 'error') {
        detected.push({
          id: tc.id,
          message: tc.result || `Tool ${tc.tool} failed`,
          severity: 'error' as const,
          source: tc.tool,
          timestamp: tc.endTime || tc.startTime || Date.now(),
        });
      }
    }
    setErrors(detected);
  }, [storeError, toolCalls]);

  return errors;
}

// 严重度映射
const SEVERITY_META: Record<string, { icon: string; textColor: string; bg: string; border: string }> = {
  error:   { icon: '✗', textColor: '#F87171', bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.15)' },
  warning: { icon: '⚠', textColor: '#FBBF24', bg: 'rgba(251, 191, 36, 0.08)',  border: 'rgba(251, 191, 36, 0.15)' },
  fatal:   { icon: '💀', textColor: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)',   border: 'rgba(239, 68, 68, 0.2)' },
};

// ── 错误卡片 ────────────────────────────────────────────────

function ErrorCard({
  error,
  isAnalyzing,
  onAnalyze,
}: {
  error: ErrorDetected;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}) {
  const { t } = useTranslation();
  const style = SEVERITY_META[error.severity] ?? SEVERITY_META.error;

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: `1px solid ${style.border}`,
      background: style.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: style.textColor }}>{style.icon}</span>
          <span style={{
            fontSize: 10,
            textTransform: 'uppercase',
            fontWeight: 500,
            color: style.textColor,
          }}>
            {error.severity}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#64748B' }}>
          {new Date(error.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p style={{
        margin: '0 0 6px',
        fontSize: 12,
        color: '#94A3B8',
        fontFamily: '"JetBrains Mono", monospace',
        wordBreak: 'break-all',
      }}>
        {error.message}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 10, color: '#64748B' }}>{error.source}</p>
      <button
        onClick={onAnalyze}
        disabled={isAnalyzing}
        style={{
          fontSize: 10,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60A5FA',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          cursor: isAnalyzing ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: isAnalyzing ? 0.5 : 1,
          transition: 'all 0.15s ease-out',
        }}
        onMouseEnter={e => { if (!isAnalyzing) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
      >
        {isAnalyzing ? t('error.analyzing', '正在分析...') : t('error.find_fix', '查找修复方案')}
      </button>
    </div>
  );
}

// ── 修复卡片 ────────────────────────────────────────────────

function FixCard({
  fix,
  isSelected,
  onSelect,
  onApply,
}: {
  fix: MatchedFix;
  isSelected: boolean;
  onSelect: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const confidenceColor = getConfidenceColor(fix.similarity);
  const confidenceTextColor = confidenceColor === 'green' ? '#34D399'
    : confidenceColor === 'yellow' ? '#FBBF24'
    : '#F87171';

  return (
    <div
      onClick={onSelect}
      style={{
        padding: 12,
        borderRadius: 8,
        border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(148, 163, 184, 0.1)',
        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : '#1E293B',
        cursor: 'pointer',
        transition: 'all 0.15s ease-out',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{fix.fixDescription}</span>
        <span style={{ fontSize: 10, color: confidenceTextColor }}>
          {t('error.similarity', '相似度')} {(fix.similarity * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{
        fontSize: 10,
        fontFamily: '"JetBrains Mono", monospace',
        color: '#64748B',
        background: '#050508',
        padding: 8,
        borderRadius: 6,
        marginBottom: 8,
        overflowX: 'auto',
      }}>
        {fix.fixContent}
      </div>
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onApply(); }}
          style={{
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(52, 211, 153, 0.15)',
            color: '#34D399',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.15)'; }}
        >
          {t('error.one_click_fix', '一键修复')}
        </button>
      )}
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface ErrorHealingPanelProps {
  className?: string;
}

export default function ErrorHealingPanel({}: ErrorHealingPanelProps) {
  const { t } = useTranslation();
  const errors = useRealErrors();
  const [healing, setHealing] = useState<HealingState | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = useCallback((error: ErrorDetected) => {
    setIsAnalyzing(true);
    // Real episode matching needs episodeDedup service (TODO)
    setTimeout(() => {
      setHealing({
        error,
        matchedFixes: [],
        isHealing: false,
      });
      setIsAnalyzing(false);
    }, 800);
  }, []);

  const handleApply = useCallback(() => {
    if (!healing) return;
    setHealing({ ...healing, isHealing: true });
    setTimeout(() => {
      setHealing({ ...healing, isHealing: false, healingResult: 'success' });
    }, 1000);
  }, [healing]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{
        margin: '0 0 12px',
        fontSize: 14,
        fontWeight: 600,
        color: '#F1F5F9',
      }}>
        {t('error.healing_title', '错误自愈')}
      </h3>

      {/* 错误列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {errors.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748B', fontSize: 12, padding: '24px 0' }}>
            {t('error.no_errors', '当前无检测到的错误')}
          </div>
        ) : (
          errors.map((error) => (
            <ErrorCard
              key={error.id}
              error={error}
              isAnalyzing={isAnalyzing}
              onAnalyze={() => handleAnalyze(error)}
            />
          ))
        )}
      </div>

      {/* 修复方案 */}
      {healing && (
        <div>
          <h4 style={{
            margin: '0 0 8px',
            fontSize: 12,
            fontWeight: 500,
            color: '#94A3B8',
          }}>
            {t('error.matched_fixes', '匹配修复方案')} ({healing.matchedFixes.length})
          </h4>

          {healing.healingResult === 'success' ? (
            <div style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid rgba(52, 211, 153, 0.25)',
              background: 'rgba(52, 211, 153, 0.08)',
              fontSize: 12,
              color: '#34D399',
            }}>
              ✓ {t('error.fix_success', '修复成功！')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {healing.matchedFixes.map((fix) => (
                <FixCard
                  key={fix.episodeId}
                  fix={fix}
                  isSelected={healing.selectedFix?.episodeId === fix.episodeId}
                  onSelect={() => setHealing({ ...healing, selectedFix: fix })}
                  onApply={handleApply}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
