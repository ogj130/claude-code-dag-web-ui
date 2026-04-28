import type { RecallState } from '../../hooks/useHistoryRecall';

interface RecallPanelProps {
  recallState: RecallState;
  inputValue: string;
  onApplyRecall: (query: string) => void;
  onDismissSimilar: () => void;
  onDismissError: () => void;
}

export function RecallPanel({
  recallState,
  inputValue,
  onApplyRecall,
  onDismissSimilar,
  onDismissError,
}: RecallPanelProps) {
  if (
    recallState.isIndexing ||
    (!recallState.showSimilarHint &&
      !recallState.showErrorHint &&
      recallState.rankedResults.length === 0 &&
      recallState.welcomeSuggestions.length === 0)
  ) {
    return null;
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: 0,
      padding: '6px 12px',
      fontSize: 11,
      maxHeight: 160,
      overflowY: 'auto',
      transition: 'opacity 0.2s',
    }}>
      {/* 相似问题提示 */}
      {recallState.showSimilarHint && recallState.similarQueries.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: '0.03em',
            marginBottom: 4,
          }}>
            <span>你之前问过类似问题</span>
            <button
              onClick={onDismissSimilar}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 10,
                padding: 0,
              }}
            >
              忽略
            </button>
          </div>
          {recallState.similarQueries.slice(0, 3).map((sq, i) => (
            <div
              key={`sim-${sq.document.id}-${i}`}
              onClick={() => onApplyRecall(sq.document.query)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: 'rgba(74, 142, 255, 0.06)',
                marginBottom: 2,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'background 0.15s',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74, 142, 255, 0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74, 142, 255, 0.06)')}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                {Math.round(sq.similarity * 100)}%
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sq.document.query.length > 80 ? sq.document.query.slice(0, 80) + '...' : sq.document.query}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 错误解决方案提示 */}
      {recallState.showErrorHint && recallState.errorSolutions.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--warn)',
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: '0.03em',
            marginBottom: 4,
          }}>
            <span>找到相似错误的解决方案</span>
            <button
              onClick={onDismissError}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 10,
                padding: 0,
              }}
            >
              忽略
            </button>
          </div>
          {recallState.errorSolutions.slice(0, 2).map((es, i) => (
            <div
              key={`err-${es.document.id}-${i}`}
              onClick={() => onApplyRecall(es.document.query)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: 'rgba(255, 170, 50, 0.06)',
                marginBottom: 2,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 170, 50, 0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 170, 50, 0.06)')}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                  Q:
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {es.document.query.length > 60 ? es.document.query.slice(0, 60) + '...' : es.document.query}
                </span>
              </div>
              {es.document.summary && (
                <div style={{ color: 'var(--success)', fontSize: 10, paddingLeft: 14 }}>
                  解决方案: {es.document.summary.length > 80 ? es.document.summary.slice(0, 80) + '...' : es.document.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 召回排序结果（输入时显示） */}
      {recallState.rankedResults.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 9,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}>
            相关历史 ({recallState.rankedResults.length})
          </div>
          {recallState.rankedResults.map((r, i) => (
            <div
              key={`rank-${r.id}-${i}`}
              onClick={() => onApplyRecall(r.query)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.02)',
                marginBottom: 2,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'background 0.15s',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                #{i + 1}
              </span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {r.query.length > 80 ? r.query.slice(0, 80) + '...' : r.query}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                {Math.round(r.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 欢迎推荐（无输入时，显示最近的历史记录） */}
      {inputValue.trim() === '' && recallState.welcomeSuggestions.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 9,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}>
            最近问答 ({recallState.welcomeSuggestions.length})
          </div>
          {recallState.welcomeSuggestions.map((r, i) => (
            <div
              key={`welcome-${r.id}-${i}`}
              onClick={() => onApplyRecall(r.query)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.02)',
                marginBottom: 2,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'background 0.15s',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                #{i + 1}
              </span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {r.query.length > 80 ? r.query.slice(0, 80) + '...' : r.query}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
