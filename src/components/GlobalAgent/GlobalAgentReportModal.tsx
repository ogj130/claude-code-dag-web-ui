/**
 * GlobalAgentReportModal — 全局 Agent 分析报告展示面板
 *
 * 功能：
 * - 综合排名展示（🥇🥈🥉卡片）
 * - 分维度评分雷达图（使用 recharts/RadarChart）
 * - 横向对比表格（各维度得分）
 * - 吐槽卡片（气泡对话形式）
 * - 最佳实践建议
 * - 导出报告按钮（Markdown/HTML）
 * - 错误状态展示（API 失败时）
 * - 演示模式徽章（模拟数据时）
 */

import { useEffect, useRef } from 'react';
import type { GlobalAgentResult, GlobalAgentError, ExtendedAnalysisDimension } from '@/types/globalAgent';
import { RankingCard } from './RankingCard';
import { RadarChartView } from './RadarChartView';
import { RoastCard } from './RoastCard';
import { DimensionLeaderboard } from './DimensionLeaderboard';

// ── 维度中文名称映射 ─────────────────────────────────────────────────────────
const DIMENSION_LABELS: Record<ExtendedAnalysisDimension, string> = {
  codeQuality: '代码质量',
  correctness: '正确性',
  performance: '性能',
  consistency: '一致性',
  creativity: '创意',
  costEfficiency: '成本效率',
  speed: '速度',
  fileQuantity: '文件数量',
  fileDiversity: '文件多样性',
  codeDocRatio: '代码文档比',
  modificationDensity: '修改密度',
};

// ── Props ────────────────────────────────────────────────────────────────────
export interface GlobalAgentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GlobalAgentResult | null;
  /** 分析错误信息（错误状态时显示） */
  error: GlobalAgentError | null;
}

// ── 导出函数 ─────────────────────────────────────────────────────────────────
/**
 * 生成 Markdown 格式报告
 */
function generateMarkdownReport(result: GlobalAgentResult): string {
  const { rankings, scores, commentary, roast, recommendations, modelUsed, createdAt } = result;

  const date = new Date(createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  let md = `# 全局 Agent 分析报告\n\n`;
  md += `> 生成时间: ${date}\n`;
  md += `> 使用模型: ${modelUsed}\n`;
  md += `\n`;

  md += `## 综合排名\n\n`;
  md += `| 排名 | 工作区 | 总分 | 优点 | 待改进 |\n`;
  md += `|------|--------|------|------|--------|\n`;
  for (const r of rankings) {
    md += `| #${r.rank} ${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : ''} | ${r.workspaceName} | ${r.totalScore}/10 | ${r.strengths[0] ?? '-'} | ${r.weaknesses[0] ?? '-'} |\n`;
  }
  md += '\n';

  md += `## 维度评分\n\n`;
  md += `| 维度 | 评分 | 评语 |\n`;
  md += `|------|------|------|\n`;
  for (const s of scores) {
    md += `| ${DIMENSION_LABELS[s.dimension]} | ${s.score}/10 | ${s.comment} |\n`;
  }
  md += '\n';

  // 各维度 Top1 对比表
  const perWs = scores[0]?.perWorkspaceScores;
  if (perWs && perWs.length > 0) {
    const wsOrder = rankings.map(r => r.workspaceId);
    md += `## 各维度 Top1\n\n`;
    md += `| 维度 | ${wsOrder.map(id => rankings.find(r => r.workspaceId === id)?.workspaceName ?? id).join(' | ')} |\n`;
    md += `|------|${wsOrder.map(() => '------').join('|')}|\n`;
    for (const s of scores) {
      const psMap = new Map((s.perWorkspaceScores ?? []).map(w => [w.workspaceId, w.score]));
      const maxScore = Math.max(...(s.perWorkspaceScores ?? []).map(w => w.score), 0);
      const cells = wsOrder.map(wsId => {
        const sc = psMap.get(wsId) ?? 0;
        return sc === maxScore && maxScore > 0 ? `🏆 **${sc.toFixed(1)}**` : `${sc.toFixed(1)}`;
      });
      md += `| ${DIMENSION_LABELS[s.dimension]} | ${cells.join(' | ')} |\n`;
    }
    md += '\n';
  }

  md += `## 综合评语\n\n${commentary}\n\n`;

  md += `## Agent 吐槽\n\n`;
  md += `> ${roast.replace(/\n/g, '\n> ')}\n\n`;

  md += `## 最佳实践建议\n\n`;
  for (let i = 0; i < recommendations.length; i++) {
    md += `${i + 1}. ${recommendations[i]}\n`;
  }
  md += `\n---\n\n*由 cc-web-ui 全局 Agent 分析引擎生成*\n`;

  return md;
}

/**
 * 生成 HTML 格式报告
 */
function generateHTMLReport(result: GlobalAgentResult): string {
  const md = generateMarkdownReport(result);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>全局 Agent 分析报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #0f0f1a;
      color: #e4e4e7;
      line-height: 1.7;
    }
    h1 { color: #3b82f6; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #a78bfa; font-size: 18px; margin-top: 32px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .meta { color: #71717a; font-size: 13px; margin-bottom: 24px; }
    blockquote {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      margin: 16px 0;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      color: #fca5a5;
    }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: rgba(59, 130, 246, 0.1); color: #60a5fa; }
    tr:hover { background: rgba(255,255,255,0.02); }
    ol { padding-left: 24px; }
    li { margin: 8px 0; }
    hr { border: none; border-top: 1px solid #333; margin: 24px 0; }
    .footer { color: #52525b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  ${md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      const isHeader = cells.every(c => c.match(/^[-:]+$/));
      if (isHeader) return '';
      const tag = 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (match) => `<table>${match}</table>`)
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ol>${match}</ol>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
  }
  <hr>
  <p class="footer">由 cc-web-ui 全局 Agent 分析引擎生成</p>
</body>
</html>`;
}

/**
 * 触发文件下载
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Focus Trap Hook ──────────────────────────────────────────────────────────
function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    // 记录当前焦点元素，关闭时恢复
    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      // 恢复关闭前的焦点元素
      previousFocusRef.current?.focus();
    };
  }, [active, ref]);
}

// ── 分数条形组件 ─────────────────────────────────────────────────────────────
function ScoreBar({ score, label }: { score: number; label: string }) {
  const percentage = (score / 10) * 100;
  const color = score >= 8 ? 'var(--success)' : score >= 6 ? 'var(--accent)' : score >= 4 ? 'var(--warn)' : 'var(--error)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 70, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ width: 32, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', textAlign: 'right' }}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────────────
function GlobalAgentReportModalInner({ isOpen, onClose, result, error }: GlobalAgentReportModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, isOpen);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExportMarkdown = () => {
    if (!result) return;
    const md = generateMarkdownReport(result);
    const date = new Date(result.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-');
    downloadFile(md, `global-agent-report-${date}.md`, 'text/markdown;charset=utf-8');
  };

  const handleExportHTML = () => {
    if (!result) return;
    const html = generateHTMLReport(result);
    const date = new Date(result.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-');
    downloadFile(html, `global-agent-report-${date}.html`, 'text/html;charset=utf-8');
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className=""
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'inherit',
      }}
    >
      <div
        className=""
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: 'min(1000px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--bg-bar)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Robot 图标 */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(74, 142, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <div id="modal-title" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  全局 Agent 分析报告
                </span>
              </div>
              {result && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  使用模型: {result.modelUsed}
                </span>
              )}
            </div>
          </div>

          {/* 导出按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {result && (
              <>
                <button
                  onClick={handleExportMarkdown}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  导出 Markdown
                </button>
                <button
                  onClick={handleExportHTML}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  导出 HTML
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="关闭"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 错误状态 */}
          {error && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              gap: 16,
              background: error.retryable ? 'rgba(239, 68, 68, 0.06)' : 'rgba(234, 179, 8, 0.06)',
              border: `1px solid ${error.retryable ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`,
              borderRadius: 12,
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={error.retryable ? 'var(--error)' : 'var(--warn)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: error.retryable ? 'var(--error)' : 'var(--warn)' }}>
                  {error.retryable ? '分析失败' : '配置错误'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: 360 }}>
                  {error.message}
                </div>
                {!error.retryable && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    请前往「设置 → 模型配置」检查 API Key 和模型设置后重试
                  </div>
                )}
              </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
                  提示：点击「设置」中的模型配置可解决大部分问题
                </div>
            </div>
          )}

          {/* 空状态 */}
          {!result && !error && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: 12,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                暂无分析结果
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                请先运行全局 Dispatch 后再查看分析报告
              </div>
            </div>
          )}

          {/* 有结果时显示完整报告 */}
          {result && (
            <>
              {/* 综合评语 */}
              <div style={{
                background: 'var(--bg-input)',
                borderRadius: 10,
                padding: '14px 16px',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  综合评语
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {result.commentary}
                </div>
              </div>

              {/* 排名卡片 */}
              <div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginBottom: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  综合排名
                </div>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  paddingBottom: 4,
                }}>
                  {result.rankings.map(ranking => (
                    <RankingCard key={ranking.workspaceId} ranking={ranking} />
                  ))}
                </div>
              </div>

              {/* 雷达图和维度评分 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* 雷达图 */}
                <RadarChartView scores={result.scores} height={240} />

                {/* 维度评分详情 */}
                <div style={{
                  background: 'var(--bg-input)',
                  borderRadius: 10,
                  padding: '16px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    维度评分详情
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.scores.map(s => (
                      <ScoreBar
                        key={s.dimension}
                        score={s.score}
                        label={DIMENSION_LABELS[s.dimension]}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 各维度 Top1 对比表 */}
              <DimensionLeaderboard result={result} />

              {/* 吐槽和建议 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* 吐槽 */}
                <RoastCard roast={result.roast} />

                {/* 最佳实践建议 */}
                <div style={{
                  background: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--success)',
                    marginBottom: 10,
                  }}>
                    最佳实践建议
                  </div>
                  <ol style={{
                    margin: 0,
                    paddingLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {result.recommendations.map((rec, i) => (
                      <li key={i} style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                      }}>
                        {rec}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Default export for testing
export const GlobalAgentReportModal = GlobalAgentReportModalInner;
export default GlobalAgentReportModalInner;
