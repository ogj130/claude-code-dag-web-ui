/**
 * UpdateSettingsTab — 更新设置标签页内容
 * 显示版本信息、检查更新按钮、下载/安装入口
 */
import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { DownloadProgressModal } from './DownloadProgressModal';

export function UpdateSettingsTab() {
  const {
    currentVersion, updateInfo, status, progress, error,
    init, setAvailable, setChecking, setDownloading,
    setProgress, setReady, setUpToDate, setError,
  } = useUpdateStore();

  // 监听主进程事件
  useEffect(() => {
    const api = window.electron.updateApi;
    api.onInit(({ currentVersion: v }) => init(v));
    api.onAvailable((info) => setAvailable(info));
    api.onProgress((p) => setProgress(p));
    api.onDownloaded(() => {
      setReady();
    });
    api.onError((msg) => setError(msg));
  }, [init, setAvailable, setProgress, setReady, setError]);

  const handleCheck = async () => {
    setChecking();
    const result = await window.electron.updateApi.check();
    if (result.error) {
      setError(result.error);
    } else if (result.available && result.info) {
      setAvailable({
        version: result.info.version,
        releaseDate: result.info.releaseDate,
        releaseNotes: typeof result.info.releaseNotes === 'string'
          ? result.info.releaseNotes : null,
        downloadUrl: result.info.downloadUrl ?? '',
      });
    } else {
      setUpToDate();
    }
  };

  const handleDownload = async () => {
    setDownloading();
    const result = await window.electron.updateApi.startDownload();
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const handleInstall = async () => {
    await window.electron.updateApi.install();
  };

  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isAvailable = status === 'available';
  const isChecking = status === 'checking';
  const isUpToDate = status === 'up-to-date';
  const isError = status === 'error';
  const isIdle = status === 'idle' || isUpToDate;

  return (
    <>
      {/* 版本信息区 */}
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-card)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 0' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>当前版本</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
              v{currentVersion || '-'}
            </div>
          </div>
          {updateInfo && (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>最新版本</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                  v{updateInfo.version}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>发布日期</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Release Notes */}
      {updateInfo?.releaseNotes && (
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-card)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 12,
          maxHeight: 200, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            更新说明
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <ReactMarkdown>{updateInfo.releaseNotes}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* 发布地址 */}
      {updateInfo?.downloadUrl && (
        <button
          onClick={() => window.electron.openExternal(updateInfo.downloadUrl)}
          style={{
            width: '100%', padding: '10px 16px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          查看 Release 页面
        </button>
      )}

      {/* 错误提示 */}
      {isError && error && (
        <div style={{
          fontSize: 12, color: '#f87171',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      {isIdle && (
        <button
          onClick={handleCheck}
          style={{
            width: '100%', padding: '11px 20px', borderRadius: 8,
            border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          检查更新
        </button>
      )}

      {isChecking && (
        <button disabled style={{
          width: '100%', padding: '11px 20px', borderRadius: 8,
          border: 'none', background: 'var(--bg-input)',
          color: 'var(--text-muted)', fontSize: 13, cursor: 'wait',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          检查中...
        </button>
      )}

      {isAvailable && updateInfo && (
        <button
          onClick={handleDownload}
          style={{
            width: '100%', padding: '11px 20px', borderRadius: 8,
            border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          下载更新 v{updateInfo.version}
        </button>
      )}

      {isDownloading && (
        <button
          onClick={() => {}}
          style={{
            width: '100%', padding: '11px 20px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          下载中... {progress}%
        </button>
      )}

      {isReady && (
        <button
          onClick={handleInstall}
          style={{
            width: '100%', padding: '11px 20px', borderRadius: 8,
            border: 'none', background: '#22c55e',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          安装更新并重启
        </button>
      )}

      {isUpToDate && (
        <div style={{
          width: '100%', padding: '11px 20px', borderRadius: 8,
          border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)',
          color: '#22c55e', fontSize: 13, fontWeight: 600,
          textAlign: 'center', cursor: 'default',
        }}>
          已是最新版本 ✓
        </div>
      )}

      {/* 下载进度弹窗 */}
      <DownloadProgressModal />
    </>
  );
}
