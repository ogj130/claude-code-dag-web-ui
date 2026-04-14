/**
 * DownloadProgressModal — 下载进度弹窗
 * 不可关闭，下载完成自动消失，失败显示重试按钮
 */
import { useUpdateStore } from '@/stores/useUpdateStore';

export function DownloadProgressModal() {
  const { status, updateInfo, progress, error, setError, setChecking } = useUpdateStore();

  if (status !== 'downloading' && status !== 'ready' && status !== 'error') {
    return null;
  }

  const isReady = status === 'ready';
  const isError = status === 'error';

  const handleRetry = () => {
    setError('');
    setChecking();
    window.electron.updateApi.check();
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* 弹窗 */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px 40px',
          width: 400,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        {/* 图标 */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: isReady ? 'rgba(34,197,94,0.15)' :
                      isError ? 'rgba(248,113,113,0.15)' :
                      'rgba(74,158,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          {isReady ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : isError ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
        </div>

        {/* 标题 */}
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {isReady ? '下载完成' : isError ? '下载失败' : '正在下载更新'}
        </div>

        {/* 版本号 */}
        {updateInfo && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            v{updateInfo.version}
          </div>
        )}

        {/* 进度条 */}
        {!isReady && !isError && (
          <>
            <div style={{
              height: 8, borderRadius: 4, background: 'var(--bg-input)',
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'var(--accent)',
                width: `${progress}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {progress}%
            </div>
          </>
        )}

        {/* 错误信息 */}
        {isError && error && (
          <div style={{
            fontSize: 12, color: '#f87171',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 8, padding: '10px 14px',
            marginBottom: 20, textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {/* 按钮 */}
        {isError && (
          <button
            onClick={handleRetry}
            style={{
              padding: '10px 28px', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        )}

        {isReady && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            请重启应用以完成安装
          </div>
        )}
      </div>
    </>
  );
}
