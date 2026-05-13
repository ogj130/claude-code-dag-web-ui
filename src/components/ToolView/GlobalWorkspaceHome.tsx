/**
 * GlobalWorkspaceHome — 全局页容器
 *
 * 承载：全局发送区 + 分析区 + 全局终端输出 + 分析结果
 */

// React used via JSX transform

interface GlobalWorkspaceHomeProps {
  /** 是否显示全局终端输出区域 */
  showGlobalTerminalOutput?: boolean;
  /** 是否有分析结果 */
  hasAnalysisResult?: boolean;
  /** 分析状态 */
  analysisStatus?: 'idle' | 'loading' | 'success' | 'error';
  /** 分析错误信息 */
  analysisError?: string | null;
  /** 分析范围快照 */
  analysisScopeSnapshot?: string[];
  /** 当前选中的分析范围 */
  selectedAnalysisWorkspaceIds?: string[];
  /** 工作区列表 */
  workspaces?: Array<{ id: string; name: string; enabled: boolean }>;
  /** 分析按钮是否禁用 */
  analysisDisabled?: boolean;
  /** 分析回调 */
  onAnalyze?: () => void;
  /** 子内容 */
  children?: React.ReactNode;
}

export function GlobalWorkspaceHome({
  showGlobalTerminalOutput = false,
  hasAnalysisResult = false,
  analysisStatus = 'idle',
  analysisError = null,
  analysisScopeSnapshot = [],
  selectedAnalysisWorkspaceIds = [],
  analysisDisabled = false,
  onAnalyze,
  children,
}: GlobalWorkspaceHomeProps) {
  const isStale =
    hasAnalysisResult &&
    analysisScopeSnapshot.length > 0 &&
    !(
      analysisScopeSnapshot.length === selectedAnalysisWorkspaceIds.length &&
      analysisScopeSnapshot.every((id) => selectedAnalysisWorkspaceIds.includes(id))
    );

  return (
    <div
      data-testid="global-workspace-home"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: '8px 12px',
        gap: 12,
      }}
    >
      {/* 全局发送 + 分析区域（由 children 注入） */}
      {children}

      {/* 分析按钮 */}
      {onAnalyze && (
        <button
          type="button"
          disabled={analysisDisabled || analysisStatus === 'loading'}
          onClick={onAnalyze}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: analysisStatus === 'loading' ? 'var(--accent-dim)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 6px)',
            cursor: analysisDisabled || analysisStatus === 'loading' ? 'not-allowed' : 'pointer',
            opacity: analysisDisabled || analysisStatus === 'loading' ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {analysisStatus === 'loading' ? '分析中...' : '开始全局分析'}
        </button>
      )}

      {/* Stale 提示 */}
      {isStale && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--warn)',
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-border)',
            borderRadius: 'var(--radius-sm, 6px)',
          }}
        >
          结果已过期，请重新分析
        </div>
      )}

      {/* 分析中提示 */}
      {analysisStatus === 'loading' && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          正在分析 {selectedAnalysisWorkspaceIds.length} 个工作区...
        </div>
      )}

      {/* 分析错误 */}
      {analysisStatus === 'error' && analysisError && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--error)',
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-sm, 6px)',
          }}
        >
          {analysisError}
        </div>
      )}

      {/* 全局终端输出 */}
      {showGlobalTerminalOutput && (
        <section>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            全局终端输出
          </div>
          {/* 输出列表由 children 或 props 注入 */}
        </section>
      )}

      {/* 分析结果 */}
      {hasAnalysisResult && analysisStatus === 'success' && (
        <section>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            分析结果
          </div>
        </section>
      )}
    </div>
  );
}
